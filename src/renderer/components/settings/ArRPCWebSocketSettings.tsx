/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Divider } from "@equicord/types/components";
import { Margins, Modals, ModalSize, openModal } from "@equicord/types/utils";
import { Button, Forms, TextInput } from "@equicord/types/webpack/common";
import { useSettings } from "renderer/settings";

import { SettingsComponent } from "./Settings";

export const ArRPCWebSocketSettings: SettingsComponent = ({ settings }) => {
    const settingsStore = useSettings();

    const openWebSocketModal = () => {
        let customHost = settingsStore.arRPCWebSocketCustomHost || "";
        let customPort = String(settingsStore.arRPCWebSocketCustomPort || "");
        let reconnectInterval = String(settingsStore.arRPCWebSocketReconnectInterval || 5000);

        openModal(props => (
            <Modals.ModalRoot {...props} size={ModalSize.SMALL}>
                <Modals.ModalHeader className="vcd-custom-tray-header">
                    <Forms.FormTitle tag="h2">Configure WebSocket Connection</Forms.FormTitle>
                    <Modals.ModalCloseButton onClick={props.onClose} />
                </Modals.ModalHeader>
                <Modals.ModalContent>
                    <Forms.FormSection>
                        <Forms.FormTitle tag="h3">Custom Host</Forms.FormTitle>
                        <Forms.FormText>
                            Leave empty to use default/built-in arRPC server. Specify a custom host to connect to
                            external arRPC servers.
                        </Forms.FormText>
                        <TextInput
                            type="text"
                            defaultValue={customHost}
                            onChange={value => (customHost = value)}
                            placeholder="127.0.0.1"
                        />
                    </Forms.FormSection>
                    <Forms.FormSection className={Margins.top16}>
                        <Forms.FormTitle tag="h3">Custom Port</Forms.FormTitle>
                        <Forms.FormText>
                            Leave 0 to use default/built-in arRPC server. Specify a custom port to connect to external
                            arRPC servers.
                        </Forms.FormText>
                        <TextInput
                            type="number"
                            defaultValue={customPort}
                            onChange={value => (customPort = value)}
                            placeholder="0"
                        />
                    </Forms.FormSection>
                    <Forms.FormSection className={Margins.top16}>
                        <Forms.FormTitle tag="h3">Reconnect Interval (ms)</Forms.FormTitle>
                        <Forms.FormText>
                            Time in milliseconds between reconnection attempts when auto-reconnect is enabled (5000 = 5
                            seconds).
                        </Forms.FormText>
                        <TextInput
                            type="number"
                            defaultValue={reconnectInterval}
                            onChange={value => (reconnectInterval = value)}
                            placeholder="5000"
                        />
                    </Forms.FormSection>
                </Modals.ModalContent>
                <Modals.ModalFooter>
                    <Button
                        style={{ marginLeft: "10px" }}
                        color={Button.Colors.BRAND}
                        onClick={() => {
                            settingsStore.arRPCWebSocketCustomHost = customHost;
                            settingsStore.arRPCWebSocketCustomPort = customPort ? parseInt(customPort, 10) : 0;
                            settingsStore.arRPCWebSocketReconnectInterval = reconnectInterval
                                ? parseInt(reconnectInterval, 10)
                                : 5000;
                            props.onClose();
                        }}
                    >
                        Save
                    </Button>
                    <Button onClick={props.onClose}>Close</Button>
                </Modals.ModalFooter>
            </Modals.ModalRoot>
        ));
    };

    return (
        <div className="vcd-tray-settings">
            <div className="vcd-tray-container">
                <div className="vcd-tray-settings-labels">
                    <Forms.FormTitle tag="h3">WebSocket Connection</Forms.FormTitle>
                    <Forms.FormText>
                        Configure custom host and port for arRPC WebSocket bridge. Useful for connecting to external
                        arRPC servers.
                    </Forms.FormText>
                </div>
                <Button onClick={openWebSocketModal}>Configure</Button>
            </div>
            <Divider className={Margins.top20 + " " + Margins.bottom20} />
        </div>
    );
};
