/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow } from "electron";

// https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#type-UserAgentBrandVersion
interface Brand {
    brand: string;
    version: string;
}

// https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#type-UserAgentMetadata
interface UserAgentMetadata {
    brandsList: Brand[];
    fullVersionList: Brand[];
    platform: string;
    platformVersion: string;
    architecture: string;
    model: string;
    mobile: boolean;
    bitness: string;
    wow64: boolean;
}

interface FakeData {
    userAgent: string; // navigator.userAgent
    platform: string; // navagitor.platform
    metadata: UserAgentMetadata; // idiotic content for requests idk bro web is annoying
}

function generateUserAgentString(versionString: string): string {
    const engine = "AppleWebKit/537.36 (KHTML, like Gecko)";
    const browser = `Chrome/${versionString}.0.0.0 Safari/537.36`;

    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${engine} ${browser}`;
}

function generateClientHints(chromeVersion: string): UserAgentMetadata {
    const majorVersion = chromeVersion.split(".")[0];

    const brandsList: Brand[] = [
        { brand: "Chromium", version: majorVersion },
        { brand: "Google Chrome", version: majorVersion },
        { brand: "Not_A Brand", version: "99" }
    ];

    const fullVersionList: Brand[] = [
        { brand: "Chromium", version: chromeVersion },
        { brand: "Google Chrome", version: chromeVersion },
        { brand: "Not_A Brand", version: "99.0.0.0" }
    ];

    const pPlatform = "Windows";
    const pVersion = "10.0.0";
    const pArch = "x86";
    const pBitness = "64";

    return {
        brandsList,
        fullVersionList,
        platform: pPlatform,
        platformVersion: pVersion,
        architecture: pArch,
        model: "",
        mobile: false,
        bitness: pBitness,
        wow64: false
    };
}

function getFakeData(): FakeData {
    const normalChrome = process.versions.chrome;
    const majorChrome = normalChrome.split(".")[0];

    const fdPlatform = "Win32";
    const uaString = generateUserAgentString(majorChrome);
    const clientHints = generateClientHints(normalChrome);

    return {
        userAgent: uaString,
        platform: fdPlatform,
        metadata: clientHints
    };
}

export async function spoofGnu(window: BrowserWindow) {
    const data = getFakeData();
    window.webContents.userAgent = data.userAgent;

    const runSpoof = async () => {
        try {
            if (!window.webContents.debugger.isAttached()) {
                console.log("debugger not attached, attaching");
                try {
                    window.webContents.debugger.attach("1.3");
                } catch (err) {
                    console.warn(`Debugger attach warning:`, err);
                }
            }

            console.info("Running setUserAgentOverride");

            // https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setUserAgentOverride
            await window.webContents.debugger.sendCommand("Emulation.setUserAgentOverride", {
                userAgent: data.userAgent,
                platform: data.platform,
                userAgentMetadata: data.metadata
            });
        } catch (err) {
            console.error("An error occured during spoofing:", err);
        }
    };

    // Apparently it doesn't have the spoof on reload?? thanks for noticing that MilkShift :trollface: ((and sorry for somewhat bugging goofcord cuz of the non complete spoof))
    // https://www.electronjs.org/docs/latest/api/web-contents#event-did-navigate
    window.webContents.on("did-navigate", async () => {
        console.log("Navigation detected, re-running spoof");
        await runSpoof();
    });

    await runSpoof();
}
