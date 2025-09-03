# Equibop-Legacy [<img src="/static/icon.png" width="225" align="right" alt="Equibop">](https://github.com/Equicord/Equibop)

Equibop is a fork of [Vesktop](https://github.com/Vencord/Vesktop) but for Legacy OSes support.

> [!NOTE]  
> If you're looking for ported version of Vencord's Vesktop, please look [here](https://github.com/TK50P/Vesktop-Legacy).

Ported for Windows NT 6.x and macOS Catalina.

## Main features

- Much more lightweight and faster than the official Discord app
- Windows NT 6.x (Vista _with [Extended kernel](https://win32subsystem.live/extended-kernel/download/)_, 7, 8, 8.1) Support
- Windows 32-bit support
- macOS Catalina 10.15 Support

**Extra included changes**

- Equicord preinstalled
- Custom Splash animations from [this PR](https://github.com/Vencord/Vesktop/pull/355)
- Tray Customization & Voice detection and Badge from [this PR](https://github.com/Vencord/Vesktop/pull/517)
- Global Keybind to Toggle voice status from [this PR](https://github.com/Vencord/Vesktop/pull/609)
- Custom Arguments from [this PR](https://github.com/Equicord/Equibop/pull/46)
- Remove (#) title prefix when Notification Badge option is toggled from [this PR](https://github.com/Vencord/Vesktop/pull/686)
- Allow patching video & audio devices into screen share from [this PR](https://github.com/Vencord/Vesktop/pull/195)

<img width="1920" height="1080" alt="Screenshot 2025-08-30 150942" src="https://github.com/user-attachments/assets/f5813e00-9158-4ce1-9a42-1e5557c2530e" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/bdf579d9-a548-41f4-877b-f5828be39af2" />
<img width="1920" height="1080" alt="Screen Shot 2025-08-31 at 7 40 52 AM" src="https://github.com/user-attachments/assets/537334e9-376a-4eaa-8224-afb62112175f" />

**Not fully Supported**:
<!-- not supported on windows yet lol -->
- Global Keybinds

## Installing

### Windows

If you don't know the difference, pick the Installer.

- Installer
  - [Windows NT 6.x 32-Bit](https://github.com/TK50P/Equibop-Legacy/releases/download/v2.1.6/Equibop-win7-ia32.exe)
  - [Windows NT 6.x 64-Bit](https://github.com/TK50P/Equibop-Legacy/releases/download/v2.1.6/Equibop-win7-ia32.exe)
  - [Windows 10 32-Bit](https://github.com/TK50P/Equibop-Legacy/releases/download/v2.1.6/Equibop-win-ia32.exe)

### Mac

These work on macOS Catalina 10.15

- [DMG](https://github.com/TK50P/Equibop-Legacy/releases/download/v2.1.6/Equibop-mac-universal.dmg)

## Building from Source

You need to have the following dependencies installed:

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en/download)
- pnpm: `npm install --global pnpm`

Packaging will create builds in the dist/ folder

> [!NOTE]
> On Windows, if you run the test script, you will get test errors about venmic, you can ignore these as it's a linux only module.

## For Windows
You’ll need the following 2 files:  
- [Modified Electron](https://github.com/e3kskoy7wqk/Electron-for-windows-7) (Thanks to [@e3kskoy7wqk](https://github.com/e3kskoy7wqk))
- [electron.js](https://raw.githubusercontent.com/TK50P/Equibop-Legacy/refs/heads/main/scripts/electron.js) and [package.json](https://raw.githubusercontent.com/TK50P/Equibop-Legacy/refs/heads/main/local_electron/package.json) (Use `curl` or `wget` to fetch this file)

Place the unpacked `dist-(x86).zip` in `local_electron`, rename to `electron-v37.2.2-win32-x64` for 64-Bit, and `electron-v37.2.2-win32-ia32` for 32-Bit.

Inside this folder, you **must** include the files:  
- `electron-v37.2.2-win32-x64` (for 64-Bit)
- `electron-v37.2.2-win32-ia32` (for 32-Bit)
- `package.json`

Place the `electron.js` in `scripts` folder.

Now open `package.json`. Replace `pnpm build && electron .` with `node scripts/electron.js .`. <br>
In `"devDependencies"` section, replace `"electron"`'s version (e.g. `"^37.2.2"` with `"file:./local_electron"`). 

Now, go to `"build"` section and add this line.
```js
"electronDist": "./local_electron/electron-v37.2.2-win32-x64",
"electronVersion": "37.2.2",
```

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

### How to Build 32-Bit Version of Vesktop

To build a **32-bit** version of Vesktop, change all occurrences of `x64` to `ia32`.

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
git clone https://github.com/Equicord/Equibop
cd Equibop

# Install Dependencies
pnpm i

# Compile TypeScript files
pnpm build

# Now, start the program
pnpm start

# Or package it for Windows
pnpm package
```

## For macOS Catalina (10.15)  
For macOS, the setup is simpler than on Windows.
> [!IMPORTANT]  
> You **must** be using macOS Catalina as **host** to build it.

You can simply downgrade the Electron version as follows:

```sh
git clone https://github.com/Equicord/Equibop
cd Equibop

# Install dependencies
pnpm i

# Downgrade Electron to v32 (last version supported on Catalina, based on Chromium 128)
pnpm i -f electron@32

# Package the app
pnpm package
```
