import { cpSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

import { addAssetsCar } from "./addAssetsCar.mjs";

async function copyBunBinaries(context) {
    if (process.env.SKIP_BUN_DOWNLOAD === "true") {
        console.log("SKIP_BUN_DOWNLOAD is set, skipping bun binary copy");
        return;
    }

    const { electronPlatformName, arch, appOutDir } = context;

    // map electron-builder arch enum to string
    // 0 = ia32, 1 = x64, 2 = armv7l, 3 = arm64
    const archMap = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64" };
    const archString = typeof arch === "number" ? archMap[arch] : arch;

    const resourcesDir = join(appOutDir, electronPlatformName === "darwin" ? `${context.packager.appInfo.productFilename}.app/Contents/Resources` : "resources");
    const bunDestDir = join(resourcesDir, "bun");

    mkdirSync(bunDestDir, { recursive: true });

    const bunSourceDir = join(process.cwd(), "resources", "bun");

    if (electronPlatformName === "darwin") {
        const bunPlatformArch = `darwin-${archString}`;
        const sourcePath = join(bunSourceDir, bunPlatformArch);
        if (existsSync(sourcePath)) {
            const destPath = join(bunDestDir, bunPlatformArch);
            console.log(`Copying Bun binary for ${bunPlatformArch}...`);
            cpSync(sourcePath, destPath, { recursive: true });
        }
    } else if (electronPlatformName === "linux") {
        const bunPlatformArch = `linux-${archString}`;
        const sourcePath = join(bunSourceDir, bunPlatformArch);
        if (existsSync(sourcePath)) {
            const destPath = join(bunDestDir, bunPlatformArch);
            console.log(`Copying Bun binary for ${bunPlatformArch}...`);
            cpSync(sourcePath, destPath, { recursive: true });
        }
    } else if (electronPlatformName === "win32") {
        const bunPlatformArch = "win32-x64";
        const sourcePath = join(bunSourceDir, bunPlatformArch);
        if (existsSync(sourcePath)) {
            const destPath = join(bunDestDir, bunPlatformArch);
            console.log(`Copying Bun binary for ${bunPlatformArch}...`);
            cpSync(sourcePath, destPath, { recursive: true });
        }
    }
}

export default async function afterPack(context) {
    await copyBunBinaries(context);
    await addAssetsCar(context);
}
