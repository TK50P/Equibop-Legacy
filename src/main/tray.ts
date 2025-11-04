/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, BrowserWindow, Menu, NativeImage, nativeImage, Tray } from "electron";

import { createAboutWindow } from "./about";
import { restartArRPC } from "./arrpc";
import { AppEvents } from "./events";
import { Settings } from "./settings";
import { resolveAssetPath, UserAssetType } from "./userAssets";
import { clearData } from "./utils/clearData";
import { downloadVencordAsar } from "./utils/vencordLoader";

type TrayVariant = "tray" | "trayUnread" | "traySpeaking" | "trayIdle" | "trayMuted" | "trayDeafened";

let tray: Tray;
let trayVariant: TrayVariant = "tray";
let onTrayClick: (() => void) | null = null;
let trayUpdateTimeout: NodeJS.Timeout | null = null;
let pendingTrayVariant: TrayVariant | null = null;

const trayImageCache = new Map<string, NativeImage>();

async function getCachedTrayImage(variant: TrayVariant): Promise<NativeImage> {
    const path = await resolveAssetPath(variant as UserAssetType);

    const cached = trayImageCache.get(path);
    if (cached) return cached;

    const image = nativeImage.createFromPath(path);
    trayImageCache.set(path, image);

    return image;
}

const userAssetChangedListener = async (asset: string) => {
    if (tray && asset.startsWith("tray")) {
        const path = await resolveAssetPath(trayVariant as UserAssetType);
        trayImageCache.delete(path);

        const image = await getCachedTrayImage(trayVariant);
        tray.setImage(image);
    }
};

async function updateTrayIcon(variant: TrayVariant) {
    if (!tray || trayVariant === variant) return;

    trayVariant = variant;
    const image = await getCachedTrayImage(trayVariant);
    tray.setImage(image);
}

const setTrayVariantListener = (variant: TrayVariant) => {
    pendingTrayVariant = variant;

    if (trayUpdateTimeout) return;

    updateTrayIcon(variant);

    trayUpdateTimeout = setTimeout(() => {
        trayUpdateTimeout = null;

        if (pendingTrayVariant && pendingTrayVariant !== trayVariant) {
            updateTrayIcon(pendingTrayVariant);
        }
        pendingTrayVariant = null;
    }, 100);
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

    if (tray) {
        if (onTrayClick) {
            tray.removeListener("click", onTrayClick);
            onTrayClick = null;
        }
        tray.destroy();
    }

    trayImageCache.clear();
}

export async function initTray(win: BrowserWindow, setIsQuitting: (val: boolean) => void) {
    if (tray) {
        destroyTray();
    }

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
}
