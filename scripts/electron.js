#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

// Detect architecture
const arch = process.arch === "ia32" ? "ia32" : "x64";

// Path to correct custom Electron
const electronPath = path.resolve(__dirname, `../local_electron/electron-v37.2.2-win32-${arch}/electron.exe`);

// Spawn Electron with arguments
const child = spawn(electronPath, process.argv.slice(2), {
  stdio: "inherit"
});

child.on("exit", (code) => process.exit(code));