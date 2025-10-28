import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const distDir = join(process.cwd(), "dist");
const unpackedDir = join(distDir, "linux-unpacked");

if (!existsSync(unpackedDir)) {
    console.error("Error: dist/linux-unpacked not found. Run electron-builder first.");
    process.exit(1);
}

const packageJson = require(join(process.cwd(), "package.json"));
const version = packageJson.version;

console.log(`Creating packager tarballs for version ${version}...`);

const architectures = ["x64", "arm64"];

for (const arch of architectures) {
    const archSuffix = arch === "x64" ? "" : `-${arch}`;
    const tarballName = `equibop-${version}${archSuffix}-packager.tar.gz`;
    const tarballPath = join(distDir, tarballName);

    console.log(`Creating ${tarballName}...`);

    execSync(
        `tar -czf "${tarballPath}" -C "${unpackedDir}" resources/`,
        { stdio: "inherit" }
    );

    console.log(`Created ${tarballName} (${(require("fs").statSync(tarballPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

console.log("Done!");
