/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { setBadge } from "renderer/appBadge";

import { SettingsComponent } from "./Settings";
import { VesktopSettingsSwitch } from "./VesktopSettingsSwitch";

export const NotificationBadgeToggle: SettingsComponent = ({ settings }) => {
    return (
        <VesktopSettingsSwitch
            value={settings.appBadge ?? true}
            onChange={v => {
                settings.appBadge = v;
                if (v) setBadge();
                else VesktopNative.app.setBadgeCount(0);
            }}
            title="Notification Badge"
            description="Show mention badge on the app icon"
        />
    );
};
