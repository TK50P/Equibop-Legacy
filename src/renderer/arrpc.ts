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

async function lookupAsset(applicationId: string, key: string): Promise<string | undefined> {
    try {
        const assets = await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]);
        return assets?.[0];
    } catch (e) {
        logger.warn(`Failed to lookup asset ${key} for ${applicationId}:`, e);
        return undefined;
    }
}

const APP_CACHE_MAX = 50;
const appCache = new Map<string, RPCApplication>();

async function lookupApp(applicationId: string): Promise<RPCApplication | undefined> {
    const cached = appCache.get(applicationId);
    if (cached) {
        appCache.delete(applicationId);
        appCache.set(applicationId, cached);
        return cached;
    }

    try {
        const socket: { application?: RPCApplication } = {};
        await fetchApplicationsRPC(socket, applicationId);

        if (socket.application) {
            if (appCache.size >= APP_CACHE_MAX) {
                const oldest = appCache.keys().next().value;
                if (oldest) appCache.delete(oldest);
            }
            appCache.set(applicationId, socket.application);
            return socket.application;
        }
    } catch (e) {
        logger.warn(`Failed to lookup app ${applicationId}:`, e);
    }

    return undefined;
}

let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let waitingForReady = false;
let intentionalClose = false;

async function handleActivityEvent(e: MessageEvent<string>) {
    let data: ActivityEvent;
    try {
        data = JSON.parse(e.data);
    } catch {
        logger.error("Failed to parse activity event:", e.data);
        return;
    }

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

    if (activity) {
        const { assets } = activity;
        if (assets?.large_image) assets.large_image = await lookupAsset(activity.application_id, assets.large_image);
        if (assets?.small_image) assets.small_image = await lookupAsset(activity.application_id, assets.small_image);

        const app = await lookupApp(activity.application_id);
        if (app) activity.name ||= app.name;
    }

    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", ...data });
}

function connectWebSocket() {
    const arrpcStatus = VesktopNative.arrpc.getStatus();
    const customHost = Settings.store.arRPCWebSocketCustomHost;
    const customPort = Settings.store.arRPCWebSocketCustomPort;

    const host = customHost || arrpcStatus.host || "127.0.0.1";
    const port = customPort || arrpcStatus.port || 1337;

    const wsUrl = `ws://${host}:${port}`;
    const isCustom = customHost || customPort;
    logger.info(`Connecting to arRPC at ${wsUrl}${isCustom ? " (custom)" : ""}`);

    if (ws) {
        intentionalClose = true;
        ws.close();
    }
    ws = new WebSocket(wsUrl);

    ws.onmessage = handleActivityEvent;

    ws.onerror = err => {
        logger.error("WebSocket connection error:", err);
    };

    ws.onclose = () => {
        if (intentionalClose) {
            intentionalClose = false;
            return;
        }

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
    waitingForReady = false;
    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null });
    if (ws) {
        intentionalClose = true;
        ws.close();
        ws = null;
    }
    logger.info("Stopped arRPCBun connection");
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

const ARRPC_READY_TIMEOUT = 15000;

function waitForArRPCReady(): Promise<boolean> {
    return new Promise(resolve => {
        const status = VesktopNative.arrpc.getStatus();
        if (status.isReady && status.port) {
            resolve(true);
            return;
        }

        const timeout = setTimeout(() => {
            VesktopNative.arrpc.offReady(onReady);
            logger.warn("Timed out waiting for arRPC to become ready");
            resolve(false);
        }, ARRPC_READY_TIMEOUT);

        const onReady = () => {
            clearTimeout(timeout);
            VesktopNative.arrpc.offReady(onReady);
            resolve(true);
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
    const hasCustomSettings = !!(customHost || customPort);

    if (hasCustomSettings) {
        connectWebSocket();
        return;
    }

    if (!Settings.store.arRPC) {
        stopWebSocket();
        return;
    }

    const arrpcStatus = VesktopNative.arrpc.getStatus();

    if (!arrpcStatus.enabled && !arrpcStatus.running) {
        logger.warn("Equibop built-in arRPC is disabled and not running");
        stopWebSocket();
        return;
    }

    if (arrpcStatus.isReady && arrpcStatus.port) {
        connectWebSocket();
        return;
    }

    if (waitingForReady) return;

    waitingForReady = true;
    logger.info("Waiting for arRPC to become ready...");

    const ready = await waitForArRPCReady();
    waitingForReady = false;

    if (ready && shouldConnect()) {
        connectWebSocket();
    }
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

VesktopNative.arrpc.onReady(async () => {
    if (waitingForReady) return;
    if (ws) return;
    if (!shouldConnect()) return;

    await onceReady;

    logger.info("arRPC is now ready, connecting");
    connectWebSocket();
});

initArRPCBridge();

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
