/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChildProcess, spawn } from "child_process";
import { existsSync } from "fs";
import { join, resolve } from "path";

import { Settings } from "../settings";

interface ArRPCStreamerModeMessage {
    type: "STREAMERMODE";
    data: string;
}

interface ArRPCServerInfoMessage {
    type: "SERVER_INFO";
    data: {
        port: number;
        host: string;
    };
}

type ArRPCMessage = ArRPCStreamerModeMessage | ArRPCServerInfoMessage;

function isArRPCMessage(message: unknown): message is ArRPCMessage {
    return (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message.type === "STREAMERMODE" || message.type === "SERVER_INFO")
    );
}

function debugLog(...args: any[]) {
    if (Settings.store.arRPCDebug) {
        console.log("[arRPC > debug]", ...args);
    }
}

function getArRPCBinaryPath(): string {
    const { platform } = process;
    const { arch } = process;

    const platformName = platform === "win32" ? "windows" : platform;
    let binaryName = `arrpc-${platformName}-${arch}`;
    if (platform === "win32") binaryName += ".exe";

    debugLog(`Looking for arRPC binary for platform=${platform}, arch=${arch}`);

    if (process.resourcesPath) {
        const binaryPath = join(process.resourcesPath, "arrpc", binaryName);
        debugLog(`Checking packaged arRPC binary path: ${binaryPath}`);

        if (existsSync(binaryPath)) {
            debugLog(`Found arRPC binary at: ${binaryPath}`);
            return binaryPath;
        }
    }

    debugLog("No bundled arRPC binary found, falling back to development path");
    // dev __dirname is dist/js, so we need to go up 2 levels
    const devPath = resolve(__dirname, "..", "..", "resources", "arrpc", binaryName);
    debugLog(`Checking dev path: ${devPath}`);
    if (existsSync(devPath)) {
        debugLog(`Found arRPC binary at dev path: ${devPath}`);
        return devPath;
    }

    throw new Error(`arRPC binary not found for ${platformName}-${arch} at ${devPath}`);
}

let arrpcProcess: ChildProcess;
let lastError: string | null = null;
let lastExitCode: number | null = null;
let serverPort: number | null = null;
let serverHost: string | null = null;
let startTime: number | null = null;
let restartCount: number = 0;
let binaryPath: string | null = null;
let warnings: string[] = [];

export function getArRPCStatus() {
    return {
        running: arrpcProcess?.pid != null,
        pid: arrpcProcess?.pid ?? null,
        port: serverPort,
        host: serverHost,
        enabled: Settings.store.arRPC ?? false,
        lastError,
        lastExitCode,
        uptime: startTime ? Date.now() - startTime : null,
        restartCount,
        binaryPath,
        warnings: [...warnings]
    };
}

export function destroyArRPC() {
    if (!arrpcProcess) return;

    debugLog("Destroying arRPC process");

    arrpcProcess.removeAllListeners("message");
    arrpcProcess.removeAllListeners("error");
    arrpcProcess.removeAllListeners("exit");
    arrpcProcess.stdout?.removeAllListeners("data");
    arrpcProcess.stderr?.removeAllListeners("data");

    arrpcProcess.kill();
    arrpcProcess = null as any;
    serverPort = null;
    serverHost = null;
    startTime = null;
}

export async function restartArRPC() {
    debugLog("Restarting arRPC");
    restartCount++;
    destroyArRPC();
    await new Promise(resolve => setTimeout(resolve, 500));
    await initArRPC();
}

export async function initArRPC() {
    if (!Settings.store.arRPC) {
        debugLog("arRPC is disabled in settings, destroying if running");
        destroyArRPC();
        return;
    }

    if (arrpcProcess) {
        debugLog("arRPC process already running");
        return;
    }

    warnings = [];
    lastError = null;
    lastExitCode = null;

    try {
        const resolvedBinaryPath = getArRPCBinaryPath();

        let dataDir: string;

        const binaryDir = resolve(resolvedBinaryPath, "..");

        if (existsSync(join(binaryDir, "detectable.json"))) {
            dataDir = binaryDir;
        } else if (process.resourcesPath) {
            const prodDataDir = join(process.resourcesPath, "arrpc");
            if (existsSync(prodDataDir) && existsSync(join(prodDataDir, "detectable.json"))) {
                dataDir = prodDataDir;
            } else {
                dataDir = resolve(__dirname, "..", "..", "resources", "arrpc");
            }
        } else {
            dataDir = resolve(__dirname, "..", "..", "resources", "arrpc");
        }

        debugLog("Initializing arRPC");
        debugLog(`Binary path: ${resolvedBinaryPath}`);
        debugLog(`Data directory: ${dataDir}`);

        if (!existsSync(dataDir)) {
            throw new Error(`Data directory does not exist: ${dataDir}`);
        }

        if (!existsSync(join(dataDir, "detectable.json"))) {
            throw new Error(`detectable.json not found in data directory: ${dataDir}`);
        }

        binaryPath = resolvedBinaryPath;

        const env = {
            ...process.env,
            ARRPC_DATA_DIR: dataDir
        };

        arrpcProcess = spawn(resolvedBinaryPath, [], {
            stdio: ["ignore", "pipe", "pipe"],
            cwd: dataDir,
            env,
            windowsHide: true
        });

        debugLog(`arRPC process spawned with PID: ${arrpcProcess.pid}`);

        startTime = Date.now();

        arrpcProcess.stdout?.on("data", data => {
            const output = data.toString().trim();
            console.log("[arRPC]", output);

            const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, "");

            const bridgeMatch = cleanOutput.match(/\[arRPC > bridge\] listening on (\d+)/);
            if (bridgeMatch) {
                serverPort = parseInt(bridgeMatch[1], 10);
                serverHost = "127.0.0.1";
                debugLog(`Parsed arRPC server info: ${serverHost}:${serverPort}`);
            }
        });

        arrpcProcess.stderr?.on("data", data => {
            const errorMsg = data.toString().trim();
            console.error("[arRPC ! stderr]", errorMsg);
            lastError = errorMsg;
        });

        arrpcProcess.on("error", err => {
            console.error("[arRPC] Failed to start:", err);
            lastError = err.message;
        });

        arrpcProcess.on("exit", code => {
            lastExitCode = code;
            if (code !== 0 && code !== null) {
                console.error(`[arRPC] Process exited with code ${code}`);
            }
            debugLog(`arRPC process exited with code ${code}`);
            arrpcProcess = null as any;
            startTime = null;
        });
    } catch (e) {
        console.error("Failed to start arRPC server", e);
        lastError = e instanceof Error ? e.message : String(e);
    }
}

Settings.addChangeListener("arRPC", initArRPC);
