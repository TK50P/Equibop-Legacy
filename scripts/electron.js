#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

// Use npm_config_arch if set, fallback to process.arch
const arch = process.env.npm_config_arch || process.arch;

// Build path to correct Electron binary
const electronPath = path.resolve(
  __dirname,
  `../local_electron/electron-v37.2.2-win32-${arch}/electron.exe`
);

// Spawn Electron with CLI args
const child = spawn(electronPath, process.argv.slice(2), {
  stdio: "inherit"
});

child.on("exit", (code) => process.exit(code));