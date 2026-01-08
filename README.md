# Equibop-Legacy [<img src="/static/icon.png" width="225" align="right" alt="Equibop">](https://github.com/Equicord/Equibop)

[![Equicord](https://img.shields.io/badge/Equicord-grey?style=flat)](https://github.com/Equicord/Equicord)
[![Tests](https://github.com/Equicord/Equibop/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/Equicord/Equibop/actions/workflows/test.yml)
[![Discord](https://img.shields.io/discord/1173279886065029291.svg?color=768AD4&label=Discord&logo=discord&logoColor=white)](https://equicord.org/discord)

Equibop-Legacy is a fork of [Vesktop](https://github.com/Vencord/Vesktop) but with NT 6.x Support.

You can join our [discord server](https://equicord.org/discord) for commits, changes, chat or even support.<br></br>

> [!CAUTION]
> Usage of unofficial or ported clients is not guaranteed to function as intended. Future updates may break certain features or cause unexpected behavior.
>
> **Don’t be stupid** — do **not** open issues or contact Equicord support. These clients are not supported or affiliated with **the official Equibop** in any way.
>
> **Use at your own risk.**

**Main features**:
- Equicord preinstalled
- Much more lightweight and faster than the official Discord app
- Much better privacy, since Discord has no access to your system
- Windows NT 6.x (Vista _with [Extended kernel](https://win32subsystem.live/extended-kernel/download/)_, 7, 8, 8.1) Support
- Windows 32-bit support
- macOS Catalina 10.15 Support

**Extra included changes**

- Tray Customization with voice detection and notification badges
- Custom Arguments from [this PR](https://github.com/Equicord/Equibop/pull/46)
- ~arRPC-bun with debug logging support https://github.com/Creationsss/arrpc-bun~

**Not fully Supported**:
- Global Keybinds
- arRPC-bun (No support for lower than NT 10.0)

<img width="1920" height="1080" alt="Windows Vista-2025-11-21-21-29-30" src="https://github.com/user-attachments/assets/930db53a-e8d4-49d0-b898-e2f532cf43c9" />
<img width="1920" height="1080" alt="Screenshot 2025-08-30 150942" src="https://github.com/user-attachments/assets/f5813e00-9158-4ce1-9a42-1e5557c2530e" />
<img width="1920" height="1080" alt="Windows 8 1-2025-11-02-22-20-00" src="https://github.com/user-attachments/assets/14207aa9-cf93-45ac-a289-89a03da2b953" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/bdf579d9-a548-41f4-877b-f5828be39af2" />
<img width="1920" height="1080" alt="Screen Shot 2025-08-31 at 7 40 52 AM" src="https://github.com/user-attachments/assets/537334e9-376a-4eaa-8224-afb62112175f" />

# Equibop Arguments
<!-- No Arguments for Linux because I don't have plan for supporting like Ubuntu 16.04 lol -->

### Runtime Flags
These flags can be passed when launching the application  
(or via `Settings > Equibop Settings > Arguments > Configure`):

```bash
--no-sandbox
```
> Disables the Chromium sandbox.  
> Commonly used when the application is executed as root.

```bash
--force_high_performance_gpu
```
> Instructs the engine to prioritize the discrete (high-performance) GPU.

### Development and Build Arguments
These arguments are parsed during the build process:

```bash
--dev
```
> Enables development mode.  
> • Disables code minification  
> • Sets `IS_DEV` to `true`

```bash
--watch
```
> Starts a persistent build context that monitors file changes  
> and triggers automatic rebuilds.

### Persistent Configuration File
The launcher supports a flags file located at:

```
${XDG_CONFIG_HOME}/equibop-flags.conf
```

**Rules:**
- Empty lines are ignored
- Lines starting with `#` are treated as comments
- Valid entries are appended to the execution command

## Installing
Check the [Releases](https://github.com/TK50P/Equibop-Legacy/releases) page

## Building from Source

You need to have the following dependencies installed:
- [Git](https://git-scm.com/downloads)
- [Bun](https://bun.sh)

Packaging will create builds in the dist/ folder

### For Windows
You’ll need the following this files:  
- [Modified Electron](https://github.com/e3kskoy7wqk/Electron-for-windows-7) (Thanks to [@e3kskoy7wqk](https://github.com/e3kskoy7wqk))
- [package.json](https://raw.githubusercontent.com/TK50P/Equibop-Legacy/refs/heads/main/local_electron/package.json) (Use `curl` or `wget` to download)

Place the unpacked `dist-(x86).zip` and `package.json` in `local_electron`, rename to `electron-v37.2.2-win32-x64` for 64-Bit, and `electron-v37.2.2-win32-ia32` for 32-Bit.

Inside this folder, you **must** include the files:  
- `electron-v37.2.2-win32-x64` (for 64-Bit)
- `electron-v37.2.2-win32-ia32` (for 32-Bit)

Now open `package.json`. Replace `bun run build && electron .` with `bun run build && local_electron/electron-v37.2.2-win32-x64/electron .`. <br>
In `"devDependencies"` section, replace `"electron"`'s version (e.g. `"^37.2.2"` with `"file:./local_electron"`). 

Now, go to `"build"` section and add this line.
```js
"electronDist": "./local_electron/electron-v37.2.2-win32-x64",
"electronVersion": "37.2.2",
```
> [!NOTE]
> You must change `x64` to `ia32` if you are targetting to 32-Bit. (Including `package.json` *inside of `local_electron`).*

For Example, if code is like this,
```js
    "build": {
        "appId": "org.equicord.equibop",
        "productName": "Equibop",
        "executableName": "equibop",
        "files": [
            "!*",
            "!node_modules",
            "dist/js",
            "static",
            "package.json",
            "LICENSE"
        ],
```

Place like this.
```js
    "build": {
        "appId": "org.equicord.equibop",
        "productName": "Equibop",
        "executableName": "equibop",
        "electronDist": "./local_electron/electron-v37.2.2-win32-x64",
        "electronVersion": "37.2.2",
        "files": [
            "!*",
            "!node_modules",
            "dist/js",
            "static",
            "package.json",
            "LICENSE"
        ],
```

#### How to Build 32-Bit Version of Equibop

To build a **32-bit** version of Equibop, change all occurrences of `x64` to `ia32`.

In the following section, remove any other architecture definitions and ensure both the `nsis` and `zip` targets are explicitly set to a specific architecture (`x64` or `ia32`):

```js
        "win": {
            "icon": "build/icon.ico",
            "target": [
                {
                    "target": "nsis",
                    "arch": [
                        "ia32"
                    ]
                },
                {
                    "target": "zip",
                    "arch": [
                        "ia32"
                    ]
                }
            ]
        },
```

Now, run this.

```sh
# Set architecture FIRST to build 32-bit (ia32) target
set npm_config_arch=ia32

git clone https://github.com/Equicord/Equibop
cd Equibop

# Link the modified one
cd local_electron
bun link

# Move to root of Equibop directory
cd ..

# Install Dependencies
bun install

# Compile TypeScript files
bun run build

# Either run it without packaging
bun start

# Or package (will build packages for your OS)
bun package
```

### For macOS Catalina (10.15)  
For macOS, the setup is simpler than on Windows.
> [!NOTE]  
> Since macOS Catalina only supports Intel Macs, so building with universal binary is pointless.
> 
> You can replace `universal` with `x64` to build Intel Macs (x64 binaries) only.

Open `package.json` and replace like this.
```js
        "mac": {
            "target": [
                {
                    "target": "default",
                    "arch": "universal"
                }
            ],
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
        },
```
Change to like this.
```js
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
        },
```

Now, simply downgrade the Electron version as follows:

```sh
git clone https://github.com/Equicord/Equibop
cd Equibop

# Install Dependencies
bun install

# Downgrade Electron to v32 (last version supported on Catalina, based on Chromium 128)
bun install -f electron@32

# Package the app
bun package
```
