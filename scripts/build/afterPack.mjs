import { cpSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

import { addAssetsCar } from "./addAssetsCar.mjs";

async function copyArRPCBinaries(context) {
    const { electronPlatformName, arch, appOutDir } = context;

    // map electron-builder arch enum to string
    // 0 = ia32, 1 = x64, 2 = armv7l, 3 = arm64
    const archMap = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64" };
    const archString = typeof arch === "number" ? archMap[arch] : arch;

    const resourcesDir = join(appOutDir, electronPlatformName === "darwin" ? `${context.packager.appInfo.productFilename}.app/Contents/Resources` : "resources");
    const arrpcDestDir = join(resourcesDir, "arrpc");

    mkdirSync(arrpcDestDir, { recursive: true });

    const arrpcSourceDir = join(process.cwd(), "resources", "arrpc");

    // Determine binary name
    const platformName = electronPlatformName === "win32" ? "windows" : electronPlatformName;
    let binaryName = `arrpc-${platformName}-${archString}`;
    if (electronPlatformName === "win32") binaryName += ".exe";

    const binarySourcePath = join(arrpcSourceDir, binaryName);

    if (existsSync(binarySourcePath)) {
        const binaryDestPath = join(arrpcDestDir, binaryName);
        console.log(`Copying arRPC binary: ${binaryName}...`);
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
