/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findStoreLazy, onceReady } from "@equicord/types/webpack";
import { FluxDispatcher, UserStore } from "@equicord/types/webpack/common";

import { setBadge } from "../appBadge";

const MediaEngineStore = findStoreLazy("MediaEngineStore");

type TrayVariant = "tray" | "trayUnread" | "traySpeaking" | "trayIdle" | "trayMuted" | "trayDeafened";

let isInCall = false;
let currentVariant: TrayVariant | null = null;

const unsubscribeFunctions: Array<() => void> = [];

function getTrayVariantForVoiceState(): TrayVariant | null {
    if (!isInCall) return null;

    if (MediaEngineStore.isSelfDeaf()) return "trayDeafened";
    if (MediaEngineStore.isSelfMute()) return "trayMuted";
    return "trayIdle";
}

function updateTrayIcon() {
    const newVariant = getTrayVariantForVoiceState();

    if (newVariant !== currentVariant) {
        currentVariant = newVariant;

        if (newVariant) {
            VesktopNative.tray.setVoiceState(newVariant);
        }
    }
}

export function cleanupTraySubscriptions() {
    unsubscribeFunctions.forEach(unsub => unsub());
    unsubscribeFunctions.length = 0;
}

onceReady.then(() => {
    const userID = UserStore.getCurrentUser().id;

    unsubscribeFunctions.push(
        FluxDispatcher.subscribe("SPEAKING", params => {
            if (params.userId === userID && params.context === "default") {
                if (params.speakingFlags) {
                    if (currentVariant !== "traySpeaking") {
                        currentVariant = "traySpeaking";
                        VesktopNative.tray.setVoiceState("traySpeaking");
                    }
                } else {
                    updateTrayIcon();
                }
            }
        })
    );

    unsubscribeFunctions.push(
        FluxDispatcher.subscribe("AUDIO_TOGGLE_SELF_DEAF", () => {
            if (isInCall) updateTrayIcon();
        })
    );

    unsubscribeFunctions.push(
        FluxDispatcher.subscribe("AUDIO_TOGGLE_SELF_MUTE", () => {
            if (isInCall) updateTrayIcon();
        })
    );

    unsubscribeFunctions.push(
        FluxDispatcher.subscribe("RTC_CONNECTION_STATE", params => {
            if (params.context === "default") {
                if (params.state === "RTC_CONNECTED") {
                    isInCall = true;
                    VesktopNative.tray.setVoiceCallState(true);
                    updateTrayIcon();
                } else if (params.state === "RTC_DISCONNECTED") {
                    isInCall = false;
                    currentVariant = null;
                    VesktopNative.tray.setVoiceCallState(false);
                    setBadge();
                }
            }
        })
    );
});
