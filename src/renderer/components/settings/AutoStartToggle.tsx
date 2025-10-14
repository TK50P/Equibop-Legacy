/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useState } from "@equicord/types/webpack/common";

import { SettingsComponent } from "./Settings";
import { VesktopSettingsSwitch } from "./VesktopSettingsSwitch";

export const AutoStartToggle: SettingsComponent = () => {
    const [autoStartEnabled, setAutoStartEnabled] = useState(VesktopNative.autostart.isEnabled());

    return (
        <VesktopSettingsSwitch
            value={autoStartEnabled}
            onChange={async v => {
                await VesktopNative.autostart[v ? "enable" : "disable"]();
                setAutoStartEnabled(v);
            }}
            title="Start With System"
            description="Automatically start Equibop on computer start-up"
        />
    );
};
