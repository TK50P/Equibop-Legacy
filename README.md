# Equibop-Legacy [<img src="/static/icon.png" width="225" align="right" alt="Equibop">](https://github.com/Equicord/Equibop)

[![Equicord](https://img.shields.io/badge/Equicord-grey?style=flat)](https://github.com/Equicord/Equicord)
[![Tests](https://github.com/Equicord/Equibop/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/Equicord/Equibop/actions/workflows/test.yml)
[![Discord](https://img.shields.io/discord/1173279886065029291.svg?color=768AD4&label=Discord&logo=discord&logoColor=white)](https://equicord.org/discord)

Equibop-Legacy is a fork of [Equibop](https://github.com/Equicord/Equibop) (and [Vesktop](https://github.com/Vencord/Vesktop)) with Windows NT 6.x, 32-bit Windows, and macOS Catalina 10.15 support.

You can join the [Equicord Discord server](https://equicord.org/discord) for commits, changes, and general chat.

> [!CAUTION]
> Usage of unofficial or ported clients is not guaranteed to function as intended. Future updates may break certain features or cause unexpected behavior.
>
> **Don’t be stupid** — do **not** open issues or contact official Equicord support regarding this port. These builds are not supported by or affiliated with **the official Equibop** project.
>
> **Use at your own risk.**

## Main Features
- Equicord preinstalled
- Much more lightweight and faster than the official Discord app
- Much better privacy, since Discord has no direct access to your system
- **Windows NT 6.x support**: Windows Vista (with [Extended Kernel](https://win32subsystem.live/extended-kernel/download/)), Windows 7, Windows 8, and Windows 8.1
- **Windows 32-bit (`ia32`) support**
- **macOS Catalina (10.15) support**

### Extra Included Changes
- Tray customization with voice state detection and notification badges
- Custom launch arguments support ([PR #46](https://github.com/Equicord/Equibop/pull/46))
- Classic [OpenAsar arRPC](https://github.com/OpenAsar/arrpc) ([Vencord fork](https://github.com/Vencord/arrpc)) running in a Node worker thread instead of `arrpc-bun` (which crashes on Windows NT 6.x)

### Not Fully Supported
- Global Keybinds (Windows/macOS)

<img width="1920" height="1080" alt="Windows Vista" src="https://github.com/user-attachments/assets/930db53a-e8d4-49d0-b898-e2f532cf43c9" />
<img width="1920" height="1080" alt="Windows 7" src="https://github.com/user-attachments/assets/f5813e00-9158-4ce1-9a42-1e5557c2530e" />
<img width="1920" height="1080" alt="Windows 8 x64" src="https://github.com/user-attachments/assets/c6c1efd9-6773-4e42-af9d-d6d60d861715" />
<img width="1920" height="1080" alt="Windows 8.1" src="https://github.com/user-attachments/assets/14207aa9-cf93-45ac-a289-89a03da2b953" />
<img width="1920" height="1080" alt="Settings Screenshot" src="https://github.com/user-attachments/assets/bdf579d9-a548-41f4-877b-f5828be39af2" />
<img width="1920" height="1080" alt="macOS Catalina" src="https://github.com/user-attachments/assets/537334e9-376a-4eaa-8224-afb62112175f" />

## Equibop Arguments

> [!NOTE]
> You can pass runtime flags from the command line or configure them inside the app via **Right-click Equibop tray icon > Launch Arguments**.

### Runtime Flags

| Flag | Description |
| :--- | :--- |
| `--no-sandbox` | Disables the Chromium sandbox (use with caution, e.g., when running as root) |
| `--force_high_performance_gpu` | Prioritizes the discrete (high-performance) GPU |
| `--start-minimized` | Launches Equibop minimized to the system tray |
| `--windows-spoof` | Spoofs the OS/User-Agent to Windows on non-Windows platforms |

### Build Script Arguments

| Flag | Description |
| :--- | :--- |
| `--dev` | Enables development mode (disables minification and sets `IS_DEV = true`) |
| `--watch` | Starts a persistent build context that rebuilds automatically on file changes |

### Persistent Configuration File
Equibop also reads flags from `${XDG_CONFIG_HOME}/equibop-flags.conf` (one flag per line; empty lines and lines starting with `#` are ignored).

## Installing

Download the latest prebuilt installers and portable archives from the [Releases](https://github.com/TK50P/Equibop-Legacy/releases) page.

## Building from Source

### Prerequisites
- [Git](https://git-scm.com/downloads)
- [Bun](https://bun.sh)

Packaged builds are output to the `dist/` directory.

### 1. Replacing `arrpc-bun` with Classic `arRPC` (Required for Windows NT 6.x)

Upstream Equibop compiles `arrpc-bun` into a standalone Bun executable, which crashes on Windows 7/8/8.1. To use classic in-process `arRPC` via Node `worker_threads`:

1. **Update `package.json`**:
   - Remove `"arrpc-bun"`, `"ws"`, and `"@types/ws"` from `"dependencies"`, and add Vencord's maintained `OpenAsar/arrpc` fork:
     ```json
     "dependencies": {
         "@typescript-eslint/eslint-plugin": "^8.72.0",
         "@typescript-eslint/parser": "^8.72.0",
         "arrpc": "github:Vencord/arrpc#1dc801e8ea14d96ce8dccff416417614f058afb8",
         "electron-updater": "^6.8.9",
         "tsutils": "^3.21.0"
     }
     ```
   - Remove `"compileArrpc"`, `"updateArrpcDB"`, and `"postinstall"` from `"scripts"`.

2. **Add `declare module "arrpc";` to `src/module.d.ts`**.

3. **Restore the Worker files in `src/main/arrpc/`**:
   - Create `src/main/arrpc/types.ts`:
     ```ts
     export type ArRpcEvent = ArRpcActivityEvent | ArRpcInviteEvent | ArRpcLinkEvent;
     export type ArRpcHostEvent = ArRpcHostAckInviteEvent | ArRpcHostAckLinkEvent;

     export interface ArRpcActivityEvent {
         type: "activity";
         nonce: string;
         data: string;
     }
     export interface ArRpcInviteEvent {
         type: "invite";
         nonce: string;
         data: string;
     }
     export interface ArRpcLinkEvent {
         type: "link";
         nonce: string;
         data: any;
     }
     export interface ArRpcHostAckInviteEvent {
         type: "ack-invite";
         nonce: string;
         data: boolean;
     }
     export interface ArRpcHostAckLinkEvent {
         type: "ack-link";
         nonce: string;
         data: boolean;
     }
     ```
   - Create `src/main/arrpc/worker.ts`:
     ```ts
     import Server from "arrpc";
     import { randomUUID } from "crypto";
     import { MessagePort, workerData } from "worker_threads";
     import { ArRpcEvent, ArRpcHostEvent } from "./types";

     let server: any;
     type InviteCallback = (valid: boolean) => void;
     type LinkCallback = InviteCallback;

     const inviteCallbacks = new Map<string, InviteCallback>();
     const linkCallbacks = new Map<string, LinkCallback>();

     (async function () {
         const { workerPort } = workerData as { workerPort: MessagePort };
         server = await new Server();

         server.on("activity", (data: any) => {
             workerPort.postMessage({
                 type: "activity",
                 data: JSON.stringify(data),
                 nonce: randomUUID()
             } satisfies ArRpcEvent);
         });

         server.on("invite", (invite: string, callback: InviteCallback) => {
             const nonce = randomUUID();
             inviteCallbacks.set(nonce, callback);
             workerPort.postMessage({ type: "invite", data: invite, nonce } satisfies ArRpcEvent);
         });

         server.on("link", async (data: any, callback: LinkCallback) => {
             const nonce = randomUUID();
             linkCallbacks.set(nonce, callback);
             workerPort.postMessage({ type: "link", data, nonce } satisfies ArRpcEvent);
         });

         workerPort.on("message", (e: ArRpcHostEvent) => {
             if (e.type === "ack-invite") {
                 inviteCallbacks.get(e.nonce)?.(e.data);
                 inviteCallbacks.delete(e.nonce);
             } else if (e.type === "ack-link") {
                 linkCallbacks.get(e.nonce)?.(e.data);
                 linkCallbacks.delete(e.nonce);
             }
         });
     })();
     ```
   - Replace `src/main/arrpc/index.ts` so it spawns `arRpcWorker.js`, caches the detectable DB in `SESSION_DATA_DIR`, and forwards activities to `IpcEvents.ARRPC_ACTIVITY` (replaying any initial activity on `appLoaded`):
     ```ts
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
                 workerData: { workerPort },
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
                         const response: ArRpcHostEvent = { type: "ack-invite", nonce, data: false };
                         if (!inviteCodeRegex.test(invite)) return hostPort.postMessage(response);
                         response.data = await sendRendererCommand(IpcCommands.RPC_INVITE, invite).catch(() => false);
                         hostPort.postMessage(response);
                         break;
                     }
                     case "link": {
                         const response: ArRpcHostEvent = { type: "ack-link", nonce, data: false };
                         response.data = await sendRendererCommand(IpcCommands.RPC_DEEP_LINK, data).catch(() => false);
                         hostPort.postMessage(response);
                         break;
                     }
                 }
             });

             worker.on("error", err => console.error("[arRPC] Worker error:", err));
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
     ```

4. **Update the Build Pipeline (`scripts/build/build.mts` & `scripts/build/afterPack.mjs`)**:
   - In `scripts/build/build.mts`, replace the `src/preload/arrpcSettings.ts` build context with `src/main/arrpc/worker.ts` (including an `esbuild` plugin to ensure `detectable.json` is bundled via CommonJS `require` rather than `fileURLToPath(import.meta.url)`):
     ```ts
     const arrpcPatchPlugin: Plugin = {
         name: "arrpc-patch",
         setup(build) {
             build.onLoad({ filter: /arrpc[\\/]src[\\/]process[\\/]index\.js$/ }, async args => {
                 let contents = await readFile(args.path, "utf-8");
                 contents = contents.replace(
                     /const __dirname = dirname\(fileURLToPath\(import\.meta\.url\)\);\s*const DetectableDB = JSON\.parse\(fs\.readFileSync\(join\(__dirname, ['"]detectable\.json['"]\), ['"]utf8['"]\)\);/,
                     `const DetectableDB = require('./detectable.json');
     DetectableDB.push({
         aliases: ["Obs"],
         executables: [
             { is_launcher: false, name: "obs", os: "linux" },
             { is_launcher: false, name: "obs.exe", os: "win32" },
             { is_launcher: false, name: "obs.app", os: "darwin" }
         ],
         hook: true,
         id: "STREAMERMODE",
         name: "OBS"
     });`
                 );
                 return { contents, loader: "js" };
             });
         }
     };
     ```
     And register the worker context:
     ```ts
     createContext({
         ...NodeCommonOpts,
         entryPoints: ["src/main/arrpc/worker.ts"],
         outfile: "dist/js/arRpcWorker.js",
         plugins: [arrpcPatchPlugin],
         footer: { js: "//# sourceURL=VesktopArRpcWorker" }
     }),
     ```
   - In `scripts/build/afterPack.mjs`, remove `copyArRPCBinaries(context)` so `electron-builder` only runs `await addAssetsCar(context);`.
   - In `src/renderer/components/settings/Settings.tsx`, replace `[ArRPCSettingsButton]` with a boolean toggle under `Miscellaneous` (`key: "arRPC"`, `title: "Rich Presence"`), and remove `createArRPCWindow` references from `src/main/tray.ts` and `src/main/ipc.ts`.

5. **Clean up unused `arrpc-bun` files & settings**:
   - Delete `scripts/build/compileArrpc.mts`, `src/main/arrpcWindow.ts`, `src/main/utils/arrpcHostValidation.ts`, `src/preload/arrpcSettings.ts`, `src/renderer/components/settings/ArRPCSettings.tsx`, and `static/views/arrpc.html`.
   - Remove `arRPCDisabled`, `arRPCDebug`, `arRPCProcessScanning`, `arRPCWebSocketAutoReconnect`, `arRPCWebSocketCustomHost`, and `arRPCWebSocketCustomPort` from `src/shared/settings.d.ts` and `src/shared/defaultSettings.ts`.
   - Remove `ARRPC_OPEN_SETTINGS` from `src/shared/IpcEvents.ts` and `openSettings` from `src/preload/VesktopNative.ts`.

### 2. Building for Windows NT 6.x (Vista / 7 / 8 / 8.1)

1. **Download the Windows 7 backported Electron binaries**:
   - [Modified Electron for Windows 7](https://github.com/e3kskoy7wqk/Electron-for-windows-7) (thanks to [@e3kskoy7wqk](https://github.com/e3kskoy7wqk))
   - [`local_electron/package.json`](https://raw.githubusercontent.com/TK50P/Equibop-Legacy/refs/heads/main/local_electron/package.json)

2. **Set up `local_electron/`**:
   - Create a `local_electron` folder in the project root and place the downloaded `package.json` inside it.
   - Extract the modified Electron archive into `local_electron/`:
     - For **64-bit (`x64`)**: rename the extracted folder to `local_electron/electron-v40.2.0-win32-x64`
     - For **32-bit (`ia32`)**: rename the extracted folder to `local_electron/electron-v40.2.0-win32-ia32` (and update `local_electron/package.json` accordingly)

3. **Configure the root `package.json`**:
   - Update `"start"` and `"start:dev"` in `"scripts"` to point to your local Electron binary:
     ```json
     "start": "bun run build && local_electron/electron-v40.2.0-win32-x64/electron .",
     "start:dev": "bun run build:dev && local_electron/electron-v40.2.0-win32-x64/electron .",
     ```
   - In `"devDependencies"`, point `"electron"` to `"file:./local_electron"`.
   - In `"build"`, add `"electronDist"` and `"electronVersion"`:
     ```json
     "build": {
         "appId": "org.equicord.equibop",
         "productName": "Equibop",
         "executableName": "equibop",
         "electronDist": "./local_electron/electron-v40.2.0-win32-x64",
         "electronVersion": "40.2.0",
         "files": [
             "!*",
             "!node_modules",
             "dist/js",
             "static",
             "package.json",
             "LICENSE"
         ]
     }
     ```

#### Targeting 32-Bit (`ia32`) vs 64-Bit (`x64`)
To build a **32-bit (`ia32`)** release, replace `x64` with `ia32` in `"electronDist"` and set the Windows target architectures explicitly in `package.json`:

```json
"win": {
    "icon": "build/icon.ico",
    "target": [
        {
            "target": "nsis",
            "arch": ["ia32"]
        },
        {
            "target": "zip",
            "arch": ["ia32"]
        }
    ]
}
```

#### Run the Build (Windows)
```bat
:: (32-bit only) Set architecture before installing dependencies
set npm_config_arch=ia32

:: Link local_electron
cd local_electron
bun link
cd ..

:: Install dependencies and build
bun install
bun run build

:: Run without packaging
bun start

:: Or build the installer and portable zip in dist/
bun package
```

### 3. Building for macOS Catalina (10.15)

> [!NOTE]
> Because macOS Catalina only runs on Intel Macs, building a `universal` binary is unnecessary. Set the target architecture to `x64` and downgrade Electron to **v32** (the last Electron release supporting macOS 10.15, based on Chromium 128).

1. **Update the `"mac"` section in `package.json`**:
   ```json
   "mac": {
       "target": [
           {
               "target": "default",
               "arch": "x64"
           }
       ],
       "minimumSystemVersion": "10.15.0",
       "category": "public.app-category.social-networking",
       "darkModeSupport": true,
       "extendInfo": {
           "NSMicrophoneUsageDescription": "This app needs access to the microphone",
           "NSCameraUsageDescription": "This app needs access to the camera",
           "com.apple.security.device.audio-input": true,
           "com.apple.security.device.camera": true,
           "CFBundleIconName": "Icon"
       },
       "notarize": true
   }
   ```

2. **Install dependencies, downgrade Electron to v32, and package**:
   ```sh
   bun install
   bun install -f electron@32
   bun package
   ```
