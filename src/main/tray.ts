/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, BrowserWindow, Menu, NativeImage, nativeImage, Tray } from "electron";
import { join } from "path";
import { STATIC_DIR } from "shared/paths";

import { createAboutWindow } from "./about";
import { restartArRPC } from "./arrpc";
import { AppEvents } from "./events";
import { Settings } from "./settings";
import { resolveAssetPath, UserAssetType } from "./userAssets";
import { clearData } from "./utils/clearData";
import { downloadVencordAsar } from "./utils/vencordLoader";

type TrayVariant = "tray" | "trayUnread" | "traySpeaking" | "trayIdle" | "trayMuted" | "trayDeafened";

const isLinux = process.platform === "linux";

let nativeSNI: typeof import("libvesktop") | null = null;
if (isLinux) {
    try {
        nativeSNI = require(join(STATIC_DIR, `dist/libvesktop-${process.arch}.node`));
    } catch (e) {
        console.warn("[Tray] Failed to load native StatusNotifierItem, falling back to Electron Tray:", e);
    }
}

let tray: Tray | null = null;
let trayVariant: TrayVariant = "tray";
let onTrayClick: (() => void) | null = null;
let trayUpdateTimeout: NodeJS.Timeout | null = null;
let pendingTrayVariant: TrayVariant | null = null;

const trayImageCache = new Map<string, NativeImage>();

let useNativeTray = false;
let nativeTrayInitialized = false;

async function getCachedTrayImage(variant: TrayVariant): Promise<NativeImage> {
    const path = await resolveAssetPath(variant as UserAssetType);

    const cached = trayImageCache.get(path);
    if (cached) return cached;

    const image = nativeImage.createFromPath(path);
    trayImageCache.set(path, image);

    return image;
}

function nativeImageToPixmap(image: NativeImage): Promise<Buffer> {
    return new Promise((resolve) => {
        setImmediate(() => {
            const resized = image.resize({ width: 32, height: 32 });
            const size = resized.getSize();
            const width = size.width;
            const height = size.height;

            const bitmap = resized.toBitmap();

            const pixmapSize = 8 + bitmap.length;
            const pixmap = Buffer.allocUnsafe(pixmapSize);

            pixmap.writeUInt32LE(width, 0);
            pixmap.writeUInt32LE(height, 4);

            for (let i = 0; i < bitmap.length; i += 4) {
                const r = bitmap[i];
                const g = bitmap[i + 1];
                const b = bitmap[i + 2];
                const a = bitmap[i + 3];

                const alpha = a / 255;
                const premultR = Math.round(r * alpha);
                const premultG = Math.round(g * alpha);
                const premultB = Math.round(b * alpha);

                pixmap[8 + i] = a;
                pixmap[8 + i + 1] = premultB;
                pixmap[8 + i + 2] = premultG;
                pixmap[8 + i + 3] = premultR;
            }

            resolve(pixmap);
        });
    });
}

const userAssetChangedListener = async (asset: string) => {
    if (!asset.startsWith("tray")) return;

    if (useNativeTray && nativeSNI) {
        trayImageCache.clear();
        const image = await getCachedTrayImage(trayVariant);
        const pixmap = await nativeImageToPixmap(image);
        nativeSNI.setStatusNotifierIcon(pixmap);
    } else if (tray) {
        trayImageCache.clear();
        const image = await getCachedTrayImage(trayVariant);
        tray.setImage(image);
    }
};

async function updateTrayIconNative(variant: TrayVariant) {
    if (trayVariant === variant) return;

    trayVariant = variant;

    if (useNativeTray && nativeSNI) {
        const image = await getCachedTrayImage(variant);
        const pixmap = await nativeImageToPixmap(image);
        nativeSNI.setStatusNotifierIcon(pixmap);
    }
}

async function updateTrayIconElectron(variant: TrayVariant) {
    if (!tray || trayVariant === variant) return;

    trayVariant = variant;
    const image = await getCachedTrayImage(trayVariant);
    tray.setImage(image);
}

const setTrayVariantListener = (variant: TrayVariant) => {
    if (useNativeTray) {
        updateTrayIconNative(variant);
    } else {
        pendingTrayVariant = variant;

        if (trayUpdateTimeout) return;

        updateTrayIconElectron(variant);

        trayUpdateTimeout = setTimeout(() => {
            trayUpdateTimeout = null;

            if (pendingTrayVariant && pendingTrayVariant !== trayVariant) {
                updateTrayIconElectron(pendingTrayVariant);
            }
            pendingTrayVariant = null;
        }, 100);
    }
};

if (!AppEvents.listeners("userAssetChanged").includes(userAssetChangedListener)) {
    AppEvents.on("userAssetChanged", userAssetChangedListener);
}

if (!AppEvents.listeners("setTrayVariant").includes(setTrayVariantListener)) {
    AppEvents.on("setTrayVariant", setTrayVariantListener);
}

export function destroyTray() {
    AppEvents.off("userAssetChanged", userAssetChangedListener);
    AppEvents.off("setTrayVariant", setTrayVariantListener);

    if (trayUpdateTimeout) {
        clearTimeout(trayUpdateTimeout);
        trayUpdateTimeout = null;
    }
    pendingTrayVariant = null;

    if (useNativeTray && nativeSNI) {
        try {
            nativeSNI.destroyStatusNotifierItem();
            nativeTrayInitialized = false;
        } catch (e) {
            console.error("[Tray] Failed to destroy native StatusNotifierItem:", e);
        }
    }

    if (tray) {
        if (onTrayClick) {
            tray.removeListener("click", onTrayClick);
            onTrayClick = null;
        }
        tray.destroy();
        tray = null;
    }

    trayImageCache.clear();
    useNativeTray = false;
}

export async function initTray(win: BrowserWindow, setIsQuitting: (val: boolean) => void) {
    if (tray || nativeTrayInitialized) {
        destroyTray();
    }

    if (isLinux && nativeSNI) {
        try {
            const success = nativeSNI.initStatusNotifierItem();
            if (success) {
                useNativeTray = true;
                nativeTrayInitialized = true;

                const initialImage = await getCachedTrayImage(trayVariant);
                const pixmap = await nativeImageToPixmap(initialImage);
                nativeSNI.setStatusNotifierIcon(pixmap);
                nativeSNI.setStatusNotifierTitle("Equibop");
                return;
            } else {
                console.warn("[Tray] Native StatusNotifierItem initialization failed, falling back to Electron Tray");
            }
        } catch (e) {
            console.error("[Tray] Error initializing native StatusNotifierItem:", e);
        }
    }

    useNativeTray = false;

    onTrayClick = () => {
        if (Settings.store.clickTrayToShowHide && win.isVisible()) win.hide();
        else win.show();
    };

    const trayMenu = Menu.buildFromTemplate([
        {
            label: "Open",
            click() {
                win.show();
            }
        },
        {
            label: "About",
            click: createAboutWindow
        },
        {
            label: "Repair Equicord",
            async click() {
                await downloadVencordAsar();
                app.relaunch();
                app.quit();
            }
        },
        {
            label: "Reset Equibop",
            async click() {
                await clearData(win);
            }
        },
        {
            label: "Restart arRPC",
            visible: Settings.store.arRPC === true,
            async click() {
                await restartArRPC();
            }
        },
        {
            type: "separator"
        },
        {
            label: "Restart",
            click() {
                app.relaunch();
                app.quit();
            }
        },
        {
            label: "Quit",
            click() {
                setIsQuitting(true);
                app.quit();
            }
        }
    ]);

    const initialImage = await getCachedTrayImage(trayVariant);
    tray = new Tray(initialImage);
    tray.setToolTip("Equibop");
    tray.setContextMenu(trayMenu);
    tray.on("click", onTrayClick);

    console.log("[Tray] Using Electron Tray");
}
