# Equibop [<img src="/static/icon.png" width="225" align="right" alt="Equibop">](https://github.com/Equicord/Equibop)

[![Equicord](https://img.shields.io/badge/Equicord-grey?style=flat)](https://github.com/Equicord/Equicord)
[![Tests](https://github.com/Equicord/Equibop/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/Equicord/Equibop/actions/workflows/test.yml)
[![Discord](https://img.shields.io/discord/1173279886065029291.svg?color=768AD4&label=Discord&logo=discord&logoColor=white)](https://equicord.org/discord)

Equibop is a fork of [Vesktop](https://github.com/Vencord/Vesktop).

You can join our [discord server](https://equicord.org/discord) for commits, changes, chat or even support.<br></br>

**Main features**:
- Equicord preinstalled
- Much more lightweight and faster than the official Discord app
- Linux Screenshare with sound & wayland
- Much better privacy, since Discord has no access to your system
- Windows NT 6.x (Vista _with [Extended kernel](https://win32subsystem.live/extended-kernel/download/)_, 7, 8, 8.1) Support
- Windows 32-bit support
- macOS Catalina 10.15 Support

**Extra included changes**

- Tray Customization with voice detection and notification badges
- Command-line flags to toggle microphone and deafen status (Linux)
- Custom Arguments from [this PR](https://github.com/Equicord/Equibop/pull/46)
- ~~arRPC-bun with debug logging support https://github.com/Creationsss/arrpc-bun~~

**Not fully Supported**:
- Global Keybinds (Windows/macOS - use command-line flags on Linux instead)
- arRPC-bun

## Installing
Check the [Releases](https://github.com/TK50P/Equibop-Legacy/releases) page

## Building from Source

You need to have the following dependencies installed:
- [Git](https://git-scm.com/downloads)
- [Bun](https://bun.sh)

Packaging will create builds in the dist/ folder

### For Windows
You’ll need the following 2 files:  
- [Modified Electron](https://github.com/e3kskoy7wqk/Electron-for-windows-7) (Thanks to [@e3kskoy7wqk](https://github.com/e3kskoy7wqk))
- [electron.js](https://raw.githubusercontent.com/TK50P/Equibop-Legacy/refs/heads/main/scripts/electron.js) and [package.json](https://raw.githubusercontent.com/TK50P/Equibop-Legacy/refs/heads/main/local_electron/package.json) (Use `curl` or `wget` to fetch this file)

Place the unpacked `dist-(x86).zip` in `local_electron`, rename to `electron-v37.2.2-win32-x64` for 64-Bit, and `electron-v37.2.2-win32-ia32` for 32-Bit.

Inside this folder, you **must** include the files:  
- `electron-v37.2.2-win32-x64` (for 64-Bit)
- `electron-v37.2.2-win32-ia32` (for 32-Bit)
- `package.json`

Place the `electron.js` in `scripts` folder.

Now open `package.json`. Replace `bun run build && electron .` with `node scripts/electron.js .`. <br>
In `"devDependencies"` section, replace `"electron"`'s version (e.g. `"^37.2.2"` with `"file:./local_electron"`). 

Now, go to `"build"` section and add this line.
```js
"electronDist": "./local_electron/electron-v37.2.2-win32-x64",
"electronVersion": "37.2.2",
```
> [!NOTE]
> You must change `x64` to `ia32` if you are targetting to 32Bit.

For Example, if code is like this,
```js
    "build": {
        "appId": "io.github.equicord.equibop",
        "artifactName": "${productName}-${os}-${arch}.${ext}",
        "productName": "Equibop",
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
        "appId": "io.github.equicord.equibop",
        "artifactName": "${productName}-${os}-${arch}.${ext}",
        "electronDist": "./local_electron/electron-v37.2.2-win32-x64",
        "electronVersion": "37.2.2",
        "productName": "Equibop",
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
                    "arch": [
                        "universal"
                    ]
                }
            ],
            "category": "public.app-category.social-networking",
            "darkModeSupport": true,
            "extendInfo": {
                "NSMicrophoneUsageDescription": "This app needs access to the microphone",
                "NSCameraUsageDescription": "This app needs access to the camera",
                "com.apple.security.device.audio-input": true,
                "com.apple.security.device.camera": true
            }
        },
```
Change to like this.
```js
        "mac": {
            "target": [
                {
                    "target": "default",
                    "arch": [
                        "x64"
                    ]
                }
            ],
            "minimumSystemVersion": "10.15.0",
            "category": "public.app-category.social-networking",
            "darkModeSupport": true,
            "extendInfo": {
                "NSMicrophoneUsageDescription": "This app needs access to the microphone",
                "NSCameraUsageDescription": "This app needs access to the camera",
                "com.apple.security.device.audio-input": true,
                "com.apple.security.device.camera": true
            }
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
