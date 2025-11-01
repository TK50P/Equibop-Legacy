#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

// Use npm_config_arch if set, fallback to process.arch
const arch = process.env.npm_config_arch || process.arch;

// Path to your local Electron binary
const electronPath = path.resolve(
  __dirname,
  `../local_electron/electron-v37.2.2-win32-${arch}/electron.exe`
);

// Arguments for Electron
const electronArgs = [
  "--trace-warnings",
  "--ozone-platform-hint=auto",
  "./ts-out/main.js",
  ...process.argv.slice(2)
];

// Spawn Electron with args
const child = spawn(electronPath, electronArgs, { stdio: "inherit" });

// Exit when Electron closes
child.on("exit", (code) => process.exit(code));