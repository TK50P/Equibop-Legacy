/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChildProcess, spawn } from "child_process";
import { accessSync, constants, existsSync, statSync } from "fs";
import { join, resolve } from "path";

import { Settings } from "../settings";

interface ArRPCStreamerModeMessage {
    type: "STREAMERMODE";
    data: string;
}

interface ArRPCServerInfoMessage {
    type: "SERVER_INFO";
    data: {
        port?: number;
        host?: string;
        socketPath?: string;
        service?: string;
    };
}

interface ArRPCReadyMessage {
    type: "READY";
    data: {
        version: string;
    };
}

interface ArRPCHeartbeatMessage {
    type: "HEARTBEAT";
    data: {
        timestamp: number;
    };
}

type ArRPCMessage = ArRPCStreamerModeMessage | ArRPCServerInfoMessage | ArRPCReadyMessage | ArRPCHeartbeatMessage;

function isArRPCMessage(message: unknown): message is ArRPCMessage {
    return (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message.type === "STREAMERMODE" ||
            message.type === "SERVER_INFO" ||
            message.type === "READY" ||
            message.type === "HEARTBEAT")
    );
}

function debugLog(...args: any[]) {
    if (Settings.store.arRPCDebug) {
        console.log("[arRPC > debug]", ...args);
    }
}

const SUPPORTED_PLATFORMS = new Map([
    ["linux", ["x64", "arm64"]],
    ["darwin", ["x64", "arm64"]],
    ["win32", ["x64"]]
]);

function validatePlatform(): void {
    const { platform, arch } = process;
    const supportedArchs = SUPPORTED_PLATFORMS.get(platform);

    if (!supportedArchs) {
        throw new Error(
            `Unsupported platform: ${platform}. arRPC only supports: ${Array.from(SUPPORTED_PLATFORMS.keys()).join(", ")}`
        );
    }

    if (!supportedArchs.includes(arch)) {
        throw new Error(`Unsupported architecture for ${platform}: ${arch}. Supported: ${supportedArchs.join(", ")}`);
    }
}

function getArRPCBinaryPath(): string {
    validatePlatform();

    const { platform } = process;
    const { arch } = process;

    const platformName = platform === "win32" ? "windows" : platform;
    let binaryName = `arrpc-${platformName}-${arch}`;
    if (platform === "win32") binaryName += ".exe";

    debugLog(`Looking for arRPC binary for platform=${platform}, arch=${arch}`);

    const checkBinary = (path: string): boolean => {
        if (!existsSync(path)) return false;

        const stats = statSync(path);
        if (!stats.isFile()) {
            debugLog(`Path exists but is not a file: ${path}`);
            return false;
        }

        try {
            accessSync(path, constants.X_OK);
            return true;
        } catch {
            if (platform !== "win32") {
                debugLog(`Binary not executable: ${path}`);
                return false;
            }
            return true;
        }
    };

    if (process.resourcesPath) {
        const binaryPath = join(process.resourcesPath, "arrpc", binaryName);
        debugLog(`Checking packaged arRPC binary path: ${binaryPath}`);

        if (checkBinary(binaryPath)) {
            debugLog(`Found arRPC binary at: ${binaryPath}`);
            return binaryPath;
        }
    }

    debugLog("No bundled arRPC binary found, falling back to development path");
    const devPath = resolve(__dirname, "..", "..", "resources", "arrpc", binaryName);
    debugLog(`Checking dev path: ${devPath}`);
    if (checkBinary(devPath)) {
        debugLog(`Found arRPC binary at dev path: ${devPath}`);
        return devPath;
    }

    throw new Error(`arRPC binary not found for ${platformName}-${arch} at ${devPath}`);
}

let arrpcProcess: ChildProcess | null = null;
let lastError: string | null = null;
let lastExitCode: number | null = null;
let serverPort: number | null = null;
let serverHost: string | null = null;
let startTime: number | null = null;
let readyTime: number | null = null;
let restartCount: number = 0;
let binaryPath: string | null = null;
let isReady: boolean = false;
let settingsListener: (() => void) | null = null;
let stderrBuffer: string = "";
let initTimeout: NodeJS.Timeout | null = null;
let isDestroying: boolean = false;
let lastHeartbeat: number | null = null;

const INIT_TIMEOUT_MS = 10000;
const PROCESS_KILL_TIMEOUT_MS = 5000;

export function getArRPCStatus() {
    const proc = arrpcProcess;
    const pid = proc?.pid ?? null;
    const running = proc != null && !proc.killed && pid != null;

    return {
        running,
        pid,
        port: serverPort,
        host: serverHost,
        enabled: Settings.store.arRPC ?? false,
        lastError,
        lastExitCode,
        uptime: startTime ? Date.now() - startTime : null,
        readyTime: readyTime ? Date.now() - readyTime : null,
        restartCount,
        binaryPath,
        isReady,
        lastHeartbeat: lastHeartbeat ? Date.now() - lastHeartbeat : null
    };
}

function clearInitTimeout() {
    if (initTimeout) {
        clearTimeout(initTimeout);
        initTimeout = null;
    }
}

export async function destroyArRPC(): Promise<void> {
    if (!arrpcProcess || isDestroying) return;

    isDestroying = true;
    debugLog("Destroying arRPC process");

    clearInitTimeout();

    const proc = arrpcProcess;
    arrpcProcess = null;
    serverPort = null;
    serverHost = null;
    startTime = null;
    readyTime = null;
    isReady = false;
    stderrBuffer = "";
    lastHeartbeat = null;

    if (proc) {
        proc.removeAllListeners();
        proc.stdout?.removeAllListeners();
        proc.stderr?.removeAllListeners();

        if (!proc.killed) {
            const killPromise = new Promise<void>(resolve => {
                const timeout = setTimeout(() => {
                    if (!proc.killed) {
                        debugLog("Process did not exit gracefully, force killing");
                        proc.kill("SIGKILL");
                    }
                    resolve();
                }, PROCESS_KILL_TIMEOUT_MS);

                proc.once("exit", () => {
                    clearTimeout(timeout);
                    resolve();
                });

                proc.kill("SIGTERM");
            });

            await killPromise;
        }
    }

    isDestroying = false;
    debugLog("arRPC process destroyed");
}

export async function restartArRPC() {
    debugLog("Restarting arRPC");
    await destroyArRPC();
    await initArRPC();
    if (arrpcProcess) {
        restartCount++;
    }
}

function validateServerInfo(data: ArRPCServerInfoMessage["data"]): boolean {
    if (data.port !== undefined) {
        if (typeof data.port !== "number" || data.port < 1 || data.port > 65535) {
            debugLog(`Invalid port in SERVER_INFO: ${data.port}`);
            return false;
        }
    }

    if (data.host !== undefined) {
        if (typeof data.host !== "string" || data.host.length === 0) {
            debugLog(`Invalid host in SERVER_INFO: ${data.host}`);
            return false;
        }
    }

    return true;
}

function handleArRPCMessage(message: ArRPCMessage) {
    switch (message.type) {
        case "SERVER_INFO": {
            if (!validateServerInfo(message.data)) {
                lastError = "Received invalid SERVER_INFO data";
                return;
            }

            const { port, host, socketPath, service } = message.data;
            if (port && host && service === "bridge") {
                serverPort = port;
                serverHost = host;
                debugLog(`Received arRPC server info [${service}]: ${host}:${port}`);
            } else if (socketPath) {
                debugLog(`Received arRPC server info [${service}]: ${socketPath}`);
            } else if (port && host) {
                debugLog(`Received arRPC server info [${service}]: ${host}:${port}`);
            }
            break;
        }

        case "READY": {
            isReady = true;
            readyTime = Date.now();
            clearInitTimeout();
            debugLog(`arRPC ready, version: ${message.data.version}`);
            break;
        }

        case "HEARTBEAT": {
            lastHeartbeat = message.data.timestamp;
            debugLog(`Received heartbeat: ${message.data.timestamp}`);
            break;
        }

        case "STREAMERMODE": {
            debugLog(`Streamer mode changed: ${message.data}`);
            break;
        }
    }
}

function processStderrData(data: string) {
    stderrBuffer += data;

    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() || "";

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
            const message = JSON.parse(trimmed);
            if (isArRPCMessage(message)) {
                handleArRPCMessage(message);
                continue;
            }
        } catch (e) {
            debugLog(`Failed to parse stderr line as JSON: ${e instanceof Error ? e.message : String(e)}`);
        }

        console.error("[arRPC ! stderr]", trimmed);
        lastError = trimmed;
    }
}

export async function initArRPC() {
    if (!Settings.store.arRPC) {
        debugLog("arRPC is disabled in settings, destroying if running");
        await destroyArRPC();
        restartCount = 0;
        return;
    }

    if (arrpcProcess) {
        debugLog("arRPC process already running");
        return;
    }

    lastError = null;
    lastExitCode = null;
    isReady = false;
    stderrBuffer = "";

    try {
        const resolvedBinaryPath = getArRPCBinaryPath();

        let dataDir: string;
        const binaryDir = resolve(resolvedBinaryPath, "..");
        const detectableFile = "detectable.json";

        if (existsSync(join(binaryDir, detectableFile))) {
            dataDir = binaryDir;
        } else if (process.resourcesPath) {
            const prodDataDir = join(process.resourcesPath, "arrpc");
            if (existsSync(join(prodDataDir, detectableFile))) {
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

        const detectablePath = join(dataDir, detectableFile);
        if (!existsSync(detectablePath)) {
            throw new Error(`${detectableFile} not found in data directory: ${dataDir}`);
        }

        binaryPath = resolvedBinaryPath;

        const env = {
            ...process.env,
            ARRPC_DATA_DIR: dataDir,
            ARRPC_IPC_MODE: "1",
            ARRPC_PARENT_MONITOR: "1"
        };

        arrpcProcess = spawn(resolvedBinaryPath, [], {
            stdio: ["ignore", "pipe", "pipe"],
            cwd: dataDir,
            env,
            windowsHide: true
        });

        debugLog(`arRPC process spawned with PID: ${arrpcProcess.pid}`);
        startTime = Date.now();

        initTimeout = setTimeout(() => {
            if (!isReady && arrpcProcess) {
                const error = "arRPC failed to send READY message within timeout";
                console.error(`[arRPC] ${error}`);
                lastError = error;
                destroyArRPC();
            }
        }, INIT_TIMEOUT_MS);

        arrpcProcess.stdout?.on("data", data => {
            const output = data.toString().trim();
            console.log("[arRPC]", output);
        });

        arrpcProcess.stderr?.on("data", data => {
            processStderrData(data.toString());
        });

        arrpcProcess.on("error", err => {
            console.error("[arRPC] Process error:", err);
            lastError = err.message;
            clearInitTimeout();
        });

        arrpcProcess.on("exit", (code, signal) => {
            lastExitCode = code;
            const wasReady = isReady;

            if (code !== 0 && code !== null) {
                console.error(`[arRPC] Process exited with code ${code}, signal ${signal}`);
                lastError = `Process exited with code ${code}`;
            }

            debugLog(`arRPC process exited with code ${code}, signal ${signal}, wasReady: ${wasReady}`);

            arrpcProcess = null;
            serverPort = null;
            serverHost = null;
            startTime = null;
            readyTime = null;
            isReady = false;
            stderrBuffer = "";
            lastHeartbeat = null;

            clearInitTimeout();
        });
    } catch (e) {
        console.error("[arRPC] Failed to start arRPC server:", e);
        lastError = e instanceof Error ? e.message : String(e);
        clearInitTimeout();
    }
}

export function setupArRPC() {
    if (settingsListener) {
        debugLog("arRPC already set up");
        return;
    }

    settingsListener = () => {
        initArRPC();
    };

    Settings.addChangeListener("arRPC", settingsListener);
    debugLog("arRPC settings listener registered");
}

export async function cleanupArRPC() {
    if (settingsListener) {
        Settings.removeChangeListener("arRPC", settingsListener);
        settingsListener = null;
        debugLog("arRPC settings listener removed");
    }

    await destroyArRPC();
}
