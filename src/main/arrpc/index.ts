/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { join, resolve } from "path";
import { IpcCommands, IpcEvents } from "shared/IpcEvents";
import { MessageChannel, Worker } from "worker_threads";

import { SESSION_DATA_DIR } from "../constants";
import { AppEvents } from "../events";
import { sendRendererCommand } from "../ipcCommands";
import { mainWin } from "../mainWindow";
import { Settings } from "../settings";
import { ArRpcEvent, ArRpcHostEvent } from "./types";

let worker: Worker | null = null;
let lastActivityData: any = null;

const inviteCodeRegex = /^(\w|-)+$/;

export async function cleanupArRPC() {
    if (!worker) return;

    await worker.terminate();
    worker = null;
    lastActivityData = null;
    mainWin?.webContents.send(IpcEvents.ARRPC_ACTIVITY, { activity: null });
}

export async function initArRPC() {
    if (!Settings.store.arRPC) {
        await cleanupArRPC();
        return;
    }

    if (worker) return;

    process.env.ARRPC_DETECTABLE_CACHE_PATH = join(SESSION_DATA_DIR, "arrpc-detectable-db.json");

    try {
        const { port1: hostPort, port2: workerPort } = new MessageChannel();

        worker = new Worker(resolve(__dirname, "./arRpcWorker.js"), {
            workerData: {
                workerPort
            },
            transferList: [workerPort]
        });

        hostPort.on("message", async ({ type, nonce, data }: ArRpcEvent) => {
            switch (type) {
                case "activity": {
                    const parsed = JSON.parse(data);
                    lastActivityData = parsed;
                    mainWin?.webContents.send(IpcEvents.ARRPC_ACTIVITY, parsed);
                    break;
                }

                case "invite": {
                    const invite = String(data);

                    const response: ArRpcHostEvent = {
                        type: "ack-invite",
                        nonce,
                        data: false
                    };

                    if (!inviteCodeRegex.test(invite)) {
                        return hostPort.postMessage(response);
                    }

                    response.data = await sendRendererCommand(IpcCommands.RPC_INVITE, invite).catch(() => false);

                    hostPort.postMessage(response);
                    break;
                }

                case "link": {
                    const response: ArRpcHostEvent = {
                        type: "ack-link",
                        nonce: nonce,
                        data: false
                    };

                    response.data = await sendRendererCommand(IpcCommands.RPC_DEEP_LINK, data).catch(() => false);

                    hostPort.postMessage(response);
                    break;
                }
            }
        });

        worker.on("error", err => {
            console.error("[arRPC] Worker error:", err);
        });
    } catch (e) {
        console.error("Failed to start arRPC server", e);
    }
}

export function setupArRPC() {
    Settings.addChangeListener("arRPC", initArRPC);
    AppEvents.on("appLoaded", () => {
        if (lastActivityData && Settings.store.arRPC) {
            mainWin?.webContents.send(IpcEvents.ARRPC_ACTIVITY, lastActivityData);
        }
    });
}
