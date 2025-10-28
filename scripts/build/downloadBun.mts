import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { file, spawn, write } from "bun";

if (process.env.SKIP_BUN_DOWNLOAD === "true") {
    console.log("SKIP_BUN_DOWNLOAD is set, skipping bun download...");
    process.exit(0);
}

const BUN_VERSION = "1.3.1";
const OUTPUT_DIR = join(import.meta.dir, "../../resources/bun");

const ALL_TARGETS = [
    { platform: "linux", arch: "x64", url: `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip` },
    { platform: "linux", arch: "arm64", url: `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-aarch64.zip` },
    { platform: "darwin", arch: "x64", url: `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-darwin-x64.zip` },
    { platform: "darwin", arch: "arm64", url: `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-darwin-aarch64.zip` },
    { platform: "win32", arch: "x64", url: `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-windows-x64.zip` }
];

const TARGETS = ALL_TARGETS;

const markerFile = join(OUTPUT_DIR, ".download-complete");
if (existsSync(markerFile)) {
    console.log("Bun binaries already downloaded, skipping...");
    process.exit(0);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

console.log("Downloading Bun binaries for all platforms...");

for (const target of TARGETS) {
    const outDir = join(OUTPUT_DIR, `${target.platform}-${target.arch}`);
    mkdirSync(outDir, { recursive: true });

    console.log(`Downloading ${target.platform}-${target.arch} from ${target.url}...`);

    try {
        const response = await fetch(target.url);
        if (!response.ok) {
            console.error(`Failed to download ${target.platform}-${target.arch}: ${response.status} ${response.statusText}`);
            continue;
        }

        const contentLength = response.headers.get("content-length");
        console.log(`  Size: ${contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) + " MB" : "unknown"}`);

        const zipPath = join(outDir, "bun.zip");
        console.log(`  Writing to ${zipPath}...`);
        const arrayBuffer = await response.arrayBuffer();
        await write(zipPath, arrayBuffer);
        console.log(`  Download complete, extracting...`);

        const proc = spawn(["unzip", "-o", "bun.zip"], {
            cwd: outDir,
            stdout: "pipe",
            stderr: "pipe"
        });
        await proc.exited;

        if (proc.exitCode !== 0) {
            console.error(`  Failed to extract: exit code ${proc.exitCode}`);
            continue;
        }

        await file(zipPath).unlink();

        console.log(`✓ Downloaded ${target.platform}-${target.arch}`);
    } catch (err) {
        console.error(`  Error downloading ${target.platform}-${target.arch}:`, err);
    }
}

await write(markerFile, `Downloaded on ${new Date().toISOString()}\nVersion: ${BUN_VERSION}\nPlatforms: all`);

console.log("Done!");
