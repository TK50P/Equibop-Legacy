/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@equicord/types/utils";
import { findLazy, onceReady } from "@equicord/types/webpack";
import {
    ApplicationAssetUtils,
    fetchApplicationsRPC,
    FluxDispatcher,
    InviteActions,
    StreamerModeStore
} from "@equicord/types/webpack/common";
import { IpcCommands } from "shared/IpcEvents";

import { onIpcCommand } from "./ipcCommands";
import { Settings } from "./settings";

const logger = new Logger("EquibopRPC", "#5865f2");

async function lookupAsset(applicationId: string, key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]))[0];
}

const apps: any = {};
async function lookupApp(applicationId: string): Promise<string> {
    const socket: any = {};
    await fetchApplicationsRPC(socket, applicationId);
    return socket.application;
}

let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

async function handleActivityEvent(e: MessageEvent<any>) {
    const data = JSON.parse(e.data);

    const { activity } = data;

    if (data.socketId === "STREAMERMODE" || activity?.application_id === "STREAMERMODE") {
        if (StreamerModeStore.autoToggle) {
            const shouldEnable = activity != null;
            logger.info(`Toggling streamer mode: ${shouldEnable ? "ON" : "OFF"}`);
            FluxDispatcher.dispatch({
                type: "STREAMER_MODE_UPDATE",
                key: "enabled",
                value: shouldEnable
            });
        }
        return;
    }

    const assets = activity?.assets;

    if (assets?.large_image) assets.large_image = await lookupAsset(activity.application_id, assets.large_image);
    if (assets?.small_image) assets.small_image = await lookupAsset(activity.application_id, assets.small_image);

    if (activity) {
        const appId = activity.application_id;
        apps[appId] ||= await lookupApp(appId);

        const app = apps[appId];
        activity.name ||= app.name;
    }

    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", ...data });
}

function connectWebSocket() {
    const arrpcStatus = VesktopNative.arrpc?.getStatus?.();
    const customHost = Settings.store.arRPCWebSocketCustomHost;
    const customPort = Settings.store.arRPCWebSocketCustomPort;

    const host = customHost || arrpcStatus?.host || "127.0.0.1";
    const port = customPort || arrpcStatus?.port || 1337;

    const wsUrl = `ws://${host}:${port}`;
    const isCustom = customHost || customPort;
    logger.info(`Connecting to arRPCBun at ${wsUrl}${isCustom ? " (custom)" : ""}`);

    if (ws) ws.close();
    ws = new WebSocket(wsUrl);

    ws.onmessage = handleActivityEvent;

    ws.onerror = error => {
        logger.error("WebSocket error:", error);
    };

    ws.onclose = () => {
        const autoReconnect = Settings.store.arRPCWebSocketAutoReconnect ?? true;
        const reconnectInterval = Settings.store.arRPCWebSocketReconnectInterval || 5000;

        logger.info(`WebSocket closed${autoReconnect ? `, will attempt reconnect in ${reconnectInterval}ms` : ""}`);
        FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null });

        if (reconnectTimer) clearTimeout(reconnectTimer);

        if (autoReconnect) {
            reconnectTimer = setTimeout(() => {
                logger.info("Attempting to reconnect...");
                connectWebSocket();
            }, reconnectInterval);
        }
    };

    ws.onopen = () => {
        logger.info("Successfully connected to arRPCBun");
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };
}

function stopWebSocket() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null });
    ws?.close();
    ws = null;
    logger.info("Stopped arRPCBun connection");
}

async function initArRPCBridge() {
    await onceReady;

    if (Settings.store.arRPCDisabled) {
        logger.info("arRPC is disabled entirely");
        stopWebSocket();
        return;
    }

    const customHost = Settings.store.arRPCWebSocketCustomHost;
    const customPort = Settings.store.arRPCWebSocketCustomPort;
    const hasCustomSettings = !!(customHost || customPort);

    if (hasCustomSettings) {
        connectWebSocket();
        return;
    }

    if (!Settings.store.arRPC) {
        stopWebSocket();
        return;
    }

    const arrpcStatus = VesktopNative.arrpc?.getStatus?.();

    if (!arrpcStatus?.enabled && !arrpcStatus?.running) {
        logger.warn("Equibop's built-in arRPC is disabled and not running");
        stopWebSocket();
        return;
    }

    connectWebSocket();
}

Settings.addChangeListener("arRPCDisabled", initArRPCBridge);
Settings.addChangeListener("arRPC", initArRPCBridge);
Settings.addChangeListener("arRPCWebSocketCustomHost", initArRPCBridge);
Settings.addChangeListener("arRPCWebSocketCustomPort", initArRPCBridge);
Settings.addChangeListener("arRPCWebSocketAutoReconnect", () => {
    if (!Settings.store.arRPCWebSocketAutoReconnect && reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
});

initArRPCBridge();

// handle STREAMERMODE separately from regular RPC activities
VesktopNative.arrpc.onStreamerModeDetected(async jsonData => {
    if (Settings.store.arRPCDisabled || !Settings.store.arRPC) return;

    try {
        await onceReady;

        const data = JSON.parse(jsonData);
        if (Settings.store.arRPCDebug) {
            logger.info("STREAMERMODE detected:", data);
            logger.info("StreamerModeStore.autoToggle:", StreamerModeStore.autoToggle);
        }

        if (data.socketId === "STREAMERMODE" && StreamerModeStore.autoToggle) {
            if (Settings.store.arRPCDebug) {
                logger.info("Toggling streamer mode to:", data.activity?.application_id === "STREAMERMODE");
            }
            FluxDispatcher.dispatch({
                type: "STREAMER_MODE_UPDATE",
                key: "enabled",
                value: data.activity?.application_id === "STREAMERMODE"
            });
        }
    } catch (e) {
        logger.error("Failed to handle STREAMERMODE:", e);
    }
});

onIpcCommand(IpcCommands.RPC_INVITE, async code => {
    const { invite } = await InviteActions.resolveInvite(code, "Desktop Modal");
    if (!invite) return false;

    VesktopNative.win.focus();

    FluxDispatcher.dispatch({
        type: "INVITE_MODAL_OPEN",
        invite,
        code,
        context: "APP"
    });

    return true;
});

const { DEEP_LINK } = findLazy(m => m.DEEP_LINK?.handler);

onIpcCommand(IpcCommands.RPC_DEEP_LINK, async data => {
    logger.debug("Opening deep link:", data);
    try {
        DEEP_LINK.handler({ args: data });
        return true;
    } catch (err) {
        logger.error("Failed to open deep link:", err);
        return false;
    }
});
