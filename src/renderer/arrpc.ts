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

interface RPCApplication {
    id: string;
    name: string;
    icon: string | null;
    description: string;
}

interface ActivityAssets {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
}

interface Activity {
    application_id: string;
    name?: string;
    details?: string;
    state?: string;
    assets?: ActivityAssets;
    timestamps?: {
        start?: number;
        end?: number;
    };
    buttons?: string[];
}

interface ActivityEvent {
    socketId?: string;
    activity: Activity | null;
}

const appCache = new Map<string, RPCApplication>();

async function lookupAsset(applicationId: string, key: string): Promise<string | undefined> {
    try {
        const assets = await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]);
        return assets?.[0];
    } catch (e) {
        logger.warn(`Failed to lookup asset ${key} for ${applicationId}:`, e);
        return undefined;
    }
}

async function lookupApp(applicationId: string): Promise<RPCApplication | undefined> {
    const cached = appCache.get(applicationId);
    if (cached) return cached;

    try {
        const socket: { application?: RPCApplication } = {};
        await fetchApplicationsRPC(socket, applicationId);
        if (socket.application) {
            appCache.set(applicationId, socket.application);
            return socket.application;
        }
    } catch (e) {
        logger.warn(`Failed to lookup app ${applicationId}:`, e);
    }
    return undefined;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let waitingForReady = false;

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

async function handleActivityEvent(e: MessageEvent<string>) {
    const data: ActivityEvent = JSON.parse(e.data);
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

    if (activity?.assets) {
        const [largeImage, smallImage] = await Promise.all([
            activity.assets.large_image
                ? lookupAsset(activity.application_id, activity.assets.large_image)
                : undefined,
            activity.assets.small_image
                ? lookupAsset(activity.application_id, activity.assets.small_image)
                : undefined
        ]);

        if (largeImage) activity.assets.large_image = largeImage;
        if (smallImage) activity.assets.small_image = smallImage;
    }

    if (activity) {
        const app = await lookupApp(activity.application_id);
        if (app && !activity.name) {
            activity.name = app.name;
        }
    }

    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", ...data });
}

function getConnectionParams(): { host: string; port: number; isCustom: boolean } {
    const status = VesktopNative.arrpc.getStatus();
    const customHost = Settings.store.arRPCWebSocketCustomHost;
    const customPort = Settings.store.arRPCWebSocketCustomPort;

    return {
        host: customHost || status.host || "127.0.0.1",
        port: customPort || status.port || 1337,
        isCustom: !!(customHost || customPort)
    };
}

function connectWebSocket() {
    const { host, port, isCustom } = getConnectionParams();
    const wsUrl = `ws://${host}:${port}`;

    logger.info(`Connecting to arRPC at ${wsUrl}${isCustom ? " (custom)" : ""}`);

    if (ws) {
        ws.onclose = null;
        ws.close();
    }

    ws = new WebSocket(wsUrl);

    ws.onmessage = handleActivityEvent;

    ws.onerror = () => {
        logger.error("WebSocket connection error");
    };

    ws.onclose = () => {
        ws = null;
        FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null });

        const autoReconnect = Settings.store.arRPCWebSocketAutoReconnect ?? true;
        if (!autoReconnect) {
            logger.info("WebSocket closed, auto-reconnect disabled");
            return;
        }

        const interval = Settings.store.arRPCWebSocketReconnectInterval || 5000;
        logger.info(`WebSocket closed, reconnecting in ${interval}ms`);

        clearReconnectTimer();
        reconnectTimer = setTimeout(() => {
            if (shouldConnect()) {
                connectWebSocket();
            }
        }, interval);
    };

    ws.onopen = () => {
        logger.info("Connected to arRPC");
        clearReconnectTimer();
    };
}

function stopWebSocket() {
    clearReconnectTimer();
    waitingForReady = false;

    if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
    }

    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null });
    logger.info("Stopped arRPC connection");
}

function shouldConnect(): boolean {
    if (Settings.store.arRPCDisabled) return false;

    const customHost = Settings.store.arRPCWebSocketCustomHost;
    const customPort = Settings.store.arRPCWebSocketCustomPort;
    if (customHost || customPort) return true;

    if (!Settings.store.arRPC) return false;

    const status = VesktopNative.arrpc.getStatus();
    return status.enabled || status.running;
}

function waitForArRPCReady(): Promise<void> {
    return new Promise(resolve => {
        const status = VesktopNative.arrpc.getStatus();
        if (status.isReady && status.port) {
            resolve();
            return;
        }

        const onReady = () => {
            VesktopNative.arrpc.offReady(onReady);
            resolve();
        };

        VesktopNative.arrpc.onReady(onReady);
    });
}

async function initArRPCBridge() {
    await onceReady;

    if (Settings.store.arRPCDisabled) {
        logger.info("arRPC is disabled");
        stopWebSocket();
        return;
    }

    const customHost = Settings.store.arRPCWebSocketCustomHost;
    const customPort = Settings.store.arRPCWebSocketCustomPort;

    if (customHost || customPort) {
        connectWebSocket();
        return;
    }

    if (!Settings.store.arRPC) {
        stopWebSocket();
        return;
    }

    const status = VesktopNative.arrpc.getStatus();

    if (!status.enabled) {
        logger.warn("arRPC is not enabled in settings");
        stopWebSocket();
        return;
    }

    if (status.isReady && status.port) {
        connectWebSocket();
        return;
    }

    if (waitingForReady) return;

    waitingForReady = true;
    logger.info("Waiting for arRPC to become ready...");

    await waitForArRPCReady();
    waitingForReady = false;

    if (shouldConnect()) {
        connectWebSocket();
    }
}

Settings.addChangeListener("arRPCDisabled", initArRPCBridge);
Settings.addChangeListener("arRPC", initArRPCBridge);
Settings.addChangeListener("arRPCWebSocketCustomHost", initArRPCBridge);
Settings.addChangeListener("arRPCWebSocketCustomPort", initArRPCBridge);
Settings.addChangeListener("arRPCWebSocketAutoReconnect", () => {
    if (!Settings.store.arRPCWebSocketAutoReconnect) {
        clearReconnectTimer();
    }
});

VesktopNative.arrpc.onReady(() => {
    if (waitingForReady) return;
    if (ws) return;
    if (!shouldConnect()) return;

    logger.info("arRPC is now ready, connecting");
    connectWebSocket();
});

initArRPCBridge();

VesktopNative.arrpc.onStreamerModeDetected(async jsonData => {
    if (Settings.store.arRPCDisabled || !Settings.store.arRPC) return;

    try {
        await onceReady;

        const data: ActivityEvent = JSON.parse(jsonData);
        if (Settings.store.arRPCDebug) {
            logger.info("STREAMERMODE detected:", data);
        }

        if (data.socketId === "STREAMERMODE" && StreamerModeStore.autoToggle) {
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
    try {
        DEEP_LINK.handler({ args: data });
        return true;
    } catch (e) {
        logger.error("Failed to open deep link:", e);
        return false;
    }
});
