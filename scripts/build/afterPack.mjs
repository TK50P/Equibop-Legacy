import { cpSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

import { addAssetsCar } from "./addAssetsCar.mjs";

async function copyArRPCBinaries(context) {
    const { electronPlatformName, arch, appOutDir } = context;

    // map electron-builder arch enum to string
    // 0 = ia32, 1 = x64, 2 = armv7l, 3 = arm64
    const archMap = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64" };
    const archString = typeof arch === "number" ? archMap[arch] : arch;

    if (archString === "universal" || archString === undefined) {
        console.log("Skipping arRPC copy for universal build (already merged from x64/arm64)");
        return;
    }

    const resourcesDir = join(appOutDir, electronPlatformName === "darwin" ? `${context.packager.appInfo.productFilename}.app/Contents/Resources` : "resources");
    const arrpcDestDir = join(resourcesDir, "arrpc");

    mkdirSync(arrpcDestDir, { recursive: true });

    const arrpcSourceDir = join(process.cwd(), "static", "dist");
    const platformName = electronPlatformName === "win32" ? "windows" : electronPlatformName;

    let sourceBinaryName = `arrpc-${platformName}-${archString}`;
    if (electronPlatformName === "win32") sourceBinaryName += ".exe";

    let destBinaryName;
    if (electronPlatformName === "darwin") {
        destBinaryName = "arrpc";
    } else {
        destBinaryName = sourceBinaryName;
    }

    const binarySourcePath = join(arrpcSourceDir, sourceBinaryName);

    if (existsSync(binarySourcePath)) {
        const binaryDestPath = join(arrpcDestDir, destBinaryName);
        console.log(`Copying arRPC binary: ${sourceBinaryName} -> ${destBinaryName}...`);
        cpSync(binarySourcePath, binaryDestPath);
    } else {
        console.warn(`Warning: arRPC binary not found: ${binarySourcePath}`);
        console.warn("Run 'bun compileArrpc' to build arRPC binaries");
    }
}

export default async function afterPack(context) {
    await copyArRPCBinaries(context);
    await addAssetsCar(context);
}
