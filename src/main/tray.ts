/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, BrowserWindow, Menu, Tray } from "electron";

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

const userAssetChangedListener = async (asset: string) => {
    if (tray && asset.startsWith("tray")) {
        tray.setImage(await resolveAssetPath(trayVariant as UserAssetType));
    }
};

const setTrayVariantListener = async (variant: TrayVariant) => {
    if (trayVariant === variant) return;

    trayVariant = variant;
    if (!tray) return;

    const iconPath = await resolveAssetPath(trayVariant as UserAssetType);
    tray.setImage(iconPath);
};

AppEvents.on("userAssetChanged", userAssetChangedListener);
AppEvents.on("setTrayVariant", setTrayVariantListener);

export function destroyTray() {
    AppEvents.off("userAssetChanged", userAssetChangedListener);
    AppEvents.off("setTrayVariant", setTrayVariantListener);
    tray?.destroy();
}

export async function initTray(win: BrowserWindow, setIsQuitting: (val: boolean) => void) {
    const onTrayClick = () => {
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

    tray = new Tray(await resolveAssetPath(trayVariant));
    tray.setToolTip("Equibop");
    tray.setContextMenu(trayMenu);
    tray.on("click", onTrayClick);
}
