/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./settings.css";

import { classNameFactory } from "@equicord/types/api/Styles";
import { Divider, ErrorBoundary } from "@equicord/types/components";
import { Text } from "@equicord/types/webpack/common";
import { ComponentType } from "react";
import { Settings, useSettings } from "renderer/settings";
import { isMac, isWindows } from "renderer/utils";

import { Arguments } from "./Arguments";
import { ArRPCWebSocketSettings } from "./ArRPCWebSocketSettings";
import { AutoStartToggle } from "./AutoStartToggle";
import { DeveloperOptionsButton } from "./DeveloperOptions";
import { DiscordBranchPicker } from "./DiscordBranchPicker";
import { NotificationBadgeToggle } from "./NotificationBadgeToggle";
import { Updater } from "./Updater";
import { UserAssetsButton } from "./UserAssets";
import { VesktopSettingsSwitch } from "./VesktopSettingsSwitch";
import { WindowsTransparencyControls } from "./WindowsTransparencyControls";

interface BooleanSetting {
    key: keyof typeof Settings.store;
    title: string;
    description: string;
    defaultValue: boolean;
    disabled?(): boolean;
    invisible?(): boolean;
}

export const cl = classNameFactory("vcd-settings-");

export type SettingsComponent = ComponentType<{ settings: typeof Settings.store }>;

const SettingsOptions: Record<string, Array<BooleanSetting | SettingsComponent>> = {
    "Discord Branch": [DiscordBranchPicker],
    "System Startup & Performance": [
        AutoStartToggle,
        {
            key: "hardwareAcceleration",
            title: "Hardware Acceleration",
            description: "Enable hardware acceleration",
            defaultValue: true
        },
        {
            key: "hardwareVideoAcceleration",
            title: "Video Hardware Acceleration",
            description:
                "Enable hardware video acceleration. This can improve performance of screenshare and video playback, but may cause graphical glitches and infinitely loading streams.",
            defaultValue: false,
            disabled: () => Settings.store.hardwareAcceleration === false
        }
    ],
    "User Interface": [
        {
            key: "customTitleBar",
            title: "Discord Titlebar",
            description: "Use Discord's custom title bar instead of the native system one. Requires a full restart.",
            defaultValue: isWindows
        },
        {
            key: "staticTitle",
            title: "Static Title",
            description: 'Makes the window title "Equibop" instead of changing to the current page',
            defaultValue: false
        },
        {
            key: "enableMenu",
            title: "Enable Menu Bar",
            description: "Enables the application menu bar. Press ALT to toggle visibility.",
            defaultValue: false,
            disabled: () => Settings.store.customTitleBar ?? isWindows
        },
        {
            key: "enableSplashScreen",
            title: "Enable Splash Screen",
            description:
                "Shows a small splash screen while Equibop is loading. Disabling this option will show the main window earlier while it's still loading.",
            defaultValue: true
        },
        {
            key: "splashTheming",
            title: "Splash theming",
            description: "Adapt the splash window colors to your custom theme",
            defaultValue: true
        },
        {
            key: "splashProgress",
            title: "Show progress bar in Splash",
            description: "Adds a fancy progress bar to the splash window",
            defaultValue: false
        },
        WindowsTransparencyControls,
        UserAssetsButton
    ],
    Behaviour: [
        Arguments,
        {
            key: "tray",
            title: "Tray Icon",
            description: "Add a tray icon for Equibop",
            defaultValue: true,
            invisible: () => isMac
        },
        {
            key: "minimizeToTray",
            title: "Minimize to tray",
            description: "Hitting X will make Equibop minimize to the tray instead of closing",
            defaultValue: true,
            invisible: () => isMac,
            disabled: () => Settings.store.tray === false
        },
        {
            key: "clickTrayToShowHide",
            title: "Hide/Show on tray click",
            description: "Left clicking tray icon will toggle the equibop window visibility.",
            defaultValue: false
        },
        {
            key: "disableMinSize",
            title: "Disable minimum window size",
            description: "Allows you to make the window as small as your heart desires",
            defaultValue: false
        },
        {
            key: "disableSmoothScroll",
            title: "Disable smooth scrolling",
            description: "Disables smooth scrolling",
            defaultValue: false
        }
    ],
    Notifications: [NotificationBadgeToggle],
    "Rich Presence (arRPC)": [
        {
            key: "arRPC",
            title: "Enable Integrated arRPC",
            description:
                "Enable the integrated arRPC server (process scanning and IPC). Disable this if using only external arRPC.",
            defaultValue: false
        },
        {
            key: "arRPCProcessScanning",
            title: "Process Scanning",
            description: "Enables automatic game/application detection for Rich Presence",
            defaultValue: true,
            disabled: () => Settings.store.arRPC === false
        },
        {
            key: "arRPCBridge",
            title: "Bridge Server",
            description: "Enables the WebSocket bridge server for web clients",
            defaultValue: true,
            disabled: () => Settings.store.arRPC === false
        },
        {
            key: "arRPCDebug",
            title: "Debug Logging",
            description: "Enables detailed debug logging (bun path detection, process spawning, IPC messages, etc.)",
            defaultValue: false,
            disabled: () => Settings.store.arRPC === false
        },
        ArRPCWebSocketSettings,
        {
            key: "arRPCWebSocketAutoReconnect",
            title: "Auto Reconnect",
            description: "Automatically reconnect to arRPC WebSocket when connection is lost",
            defaultValue: true
        }
    ],
    Miscellaneous: [
        {
            key: "middleClickAutoscroll",
            title: "Middle Click Autoscroll",
            description: "Enables middle-click scrolling (Requires a full restart)",
            defaultValue: false
        },
        {
            key: "openLinksWithElectron",
            title: "Open Links in app (experimental)",
            description: "Opens links in a new equibop window instead of your web browser",
            defaultValue: false
        }
    ],
    "Developer Options": [DeveloperOptionsButton]
};

function SettingsSections() {
    const Settings = useSettings();

    const sections = Object.entries(SettingsOptions).map(([title, settings], i, arr) => (
        <div key={title} className={cl("category")}>
            <Text variant="heading-lg/semibold" color="header-primary" className={cl("category-title")}>
                {title}
            </Text>

            <div className={cl("category-content")}>
                {settings.map((Setting, i) => {
                    if (typeof Setting === "function") return <Setting key={`Custom-${i}`} settings={Settings} />;

                    const { defaultValue, title, description, key, disabled, invisible } = Setting;
                    if (invisible?.()) return null;

                    return (
                        <VesktopSettingsSwitch
                            title={title}
                            description={description}
                            value={Settings[key as any] ?? defaultValue}
                            onChange={v => (Settings[key as any] = v)}
                            disabled={disabled?.()}
                            key={key}
                        />
                    );
                })}
            </div>

            {i < arr.length - 1 && <Divider className={cl("category-divider")} />}
        </div>
    ));

    return <>{sections}</>;
}

export default ErrorBoundary.wrap(
    function SettingsUI() {
        return (
            <section>
                <Text variant="heading-xl/semibold" color="header-primary" className={cl("title")}>
                    Vesktop Settings
                </Text>
                <Updater />
                <SettingsSections />
            </section>
        );
    },
    {
        message:
            "Failed to render the Equibop Settings tab. If this issue persists, try to right click the Equibop tray icon, then click 'Repair Equicord'. And make sure your Equibop is up to date."
    }
);
