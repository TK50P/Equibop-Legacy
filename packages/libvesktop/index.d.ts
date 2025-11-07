export function getAccentColor(): number | null;
export function requestBackground(autoStart: boolean, commandLine: string[]): boolean;
export function updateUnityLauncherCount(count: number): boolean;

export function initStatusNotifierItem(): boolean;
export function setStatusNotifierIcon(pixmapData: Buffer): boolean;
export function setStatusNotifierTitle(title: string): boolean;
export function destroyStatusNotifierItem(): void;
