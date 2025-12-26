/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText, Button, Divider, Paragraph } from "@equicord/types/components";
import {
    Margins,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalRoot,
    ModalSize,
    openModal
} from "@equicord/types/utils";
import { Forms, TextInput, useEffect, useState } from "@equicord/types/webpack/common";
import { useSettings } from "renderer/settings";

import { SettingsComponent } from "./Settings";
import { VesktopSettingsSwitch } from "./VesktopSettingsSwitch";

export const ArRPCSettingsButton: SettingsComponent = () => {
    return <Button onClick={openArRPCSettingsModal}>Configure Rich Presence</Button>;
};

function openArRPCSettingsModal() {
    openModal(props => (
        <ModalRoot {...props} size={ModalSize.SMALL}>
            <ModalHeader>
                <BaseText size="lg" weight="semibold" tag="h3" style={{ flexGrow: 1 }}>
                    Rich Presence
                </BaseText>
                <ModalCloseButton onClick={props.onClose} />
            </ModalHeader>

            <ModalContent>
                <ArRPCSettingsContent />
            </ModalContent>

            <ModalFooter>
                <Button onClick={props.onClose}>Done</Button>
            </ModalFooter>
        </ModalRoot>
    ));
}

function ArRPCStatus() {
    const [status, setStatus] = useState<ReturnType<typeof VesktopNative.arrpc.getStatus> | null>(null);

    useEffect(() => {
        const update = () => setStatus(VesktopNative.arrpc.getStatus());
        update();
        const interval = setInterval(update, 2000);
        return () => clearInterval(interval);
    }, []);

    if (!status) return null;

    let color: string;
    let text: string;

    if (status.isReady) {
        color = "var(--status-positive)";
        text = "Connected";
    } else if (status.isStale) {
        color = "var(--status-warning)";
        text = "Idle";
    } else if (status.running) {
        color = "var(--status-warning)";
        text = "Starting...";
    } else {
        color = "var(--status-danger)";
        text = "Stopped";
    }

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--text-muted)",
                fontSize: 12
            }}
        >
            <div
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: color
                }}
            />
            <span>{text}</span>
            {status.activities > 0 && (
                <span>
                    - {status.activities} {status.activities === 1 ? "activity" : "activities"}
                </span>
            )}
            {status.appVersion && <span>- v{status.appVersion}</span>}
        </div>
    );
}

function ArRPCSettingsContent() {
    const settings = useSettings();
    const [showAdvanced, setShowAdvanced] = useState(false);

    const isDisabled = settings.arRPCDisabled === true;
    const isIntegratedEnabled = settings.arRPC === true;

    return (
        <div style={{ padding: "0.5em 0" }}>
            <Paragraph className={Margins.bottom16} style={{ color: "var(--text-muted)" }}>
                Show what games and apps you're using as your Discord status.
            </Paragraph>

            <VesktopSettingsSwitch
                title="Enable Rich Presence"
                description="Display your current activity on Discord"
                value={!isDisabled}
                onChange={v => (settings.arRPCDisabled = !v)}
            />

            {!isDisabled && (
                <>
                    <VesktopSettingsSwitch
                        title="Use Built-in Server"
                        description="Use Equibop's built-in game detection"
                        value={isIntegratedEnabled}
                        onChange={v => (settings.arRPC = v)}
                    />

                    {isIntegratedEnabled && (
                        <VesktopSettingsSwitch
                            title="Game Detection"
                            description="Scan for running games and applications"
                            value={settings.arRPCProcessScanning ?? true}
                            onChange={v => (settings.arRPCProcessScanning = v)}
                        />
                    )}

                    <div className={Margins.top8}>
                        <ArRPCStatus />
                    </div>
                </>
            )}

            <Divider className={Margins.top16 + " " + Margins.bottom16} />

            <span
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                    color: "var(--text-link)",
                    cursor: "pointer",
                    fontSize: "14px",
                    userSelect: "none"
                }}
            >
                {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
            </span>

            {showAdvanced && (
                <div className={Margins.top16}>
                    <VesktopSettingsSwitch
                        title="Auto Reconnect"
                        description="Reconnect automatically if connection is lost"
                        value={settings.arRPCWebSocketAutoReconnect ?? true}
                        onChange={v => (settings.arRPCWebSocketAutoReconnect = v)}
                        disabled={isDisabled}
                    />

                    <VesktopSettingsSwitch
                        title="Debug Mode"
                        description="Log detailed information for troubleshooting"
                        value={settings.arRPCDebug ?? false}
                        onChange={v => (settings.arRPCDebug = v)}
                        disabled={isDisabled}
                    />

                    <div className={Margins.top16}>
                        <Forms.FormTitle tag="h5">External Server</Forms.FormTitle>
                        <Forms.FormText className={Margins.bottom8} style={{ color: "var(--text-muted)" }}>
                            Connect to an external server instead of the built-in one.
                        </Forms.FormText>
                        <div style={{ display: "flex", gap: 8 }}>
                            <TextInput
                                type="text"
                                value={settings.arRPCWebSocketCustomHost || ""}
                                onChange={v => (settings.arRPCWebSocketCustomHost = v)}
                                placeholder="Host (e.g. 127.0.0.1)"
                                disabled={isDisabled}
                                style={{ flex: 2 }}
                            />
                            <TextInput
                                type="number"
                                value={String(settings.arRPCWebSocketCustomPort || "")}
                                onChange={v => (settings.arRPCWebSocketCustomPort = parseInt(v, 10) || 0)}
                                placeholder="Port"
                                disabled={isDisabled}
                                style={{ flex: 1 }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
