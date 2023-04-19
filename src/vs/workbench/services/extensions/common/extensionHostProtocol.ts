/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from 'vs/base/common/buffer';
import { URI, UriComponents } from 'vs/base/common/uri';
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { LogLevel } from 'vs/platform/log/common/log';
import { IRemoteConnectionData } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { ITelemetryInfo } from 'vs/platform/telemetry/common/telemetry';

export interface IExtensionDescriptionDelta {
	readonly toRemove: ExtensionIdentifier[];
	readonly toAdd: IExtensionDescription[];
	readonly myToRemove: ExtensionIdentifier[];
	readonly myToAdd: ExtensionIdentifier[];
}

export interface IExtensionHostInitData {
	version: string;
	commit?: string;
	parentPid: number;
	environment: IEnvironment;
	workspace?: IStaticWorkspaceData | null;
	allExtensions: IExtensionDescription[];
	myExtensions: ExtensionIdentifier[];
	telemetryInfo: ITelemetryInfo;
	logLevel: LogLevel;
	logsLocation: URI;
	logFile: URI;
	autoStart: boolean;
	remote: { isRemote: boolean; authority: string | undefined; connectionData: IRemoteConnectionData | null };
	uiKind: UIKind;
	messagePorts?: ReadonlyMap<string, MessagePortLike>;
	vscodeVersion: string; // {{SQL CARBON EDIT}} add vscode version
	quality?: string; // {{SQL CARBON EDIT}} add quality
}

export interface IEnvironment {
	isExtensionDevelopmentDebug: boolean;
	appName: string;
	appHost: string;
	appRoot?: URI;
	appLanguage: string;
	appUriScheme: string;
	extensionDevelopmentLocationURI?: URI[];
	extensionTestsLocationURI?: URI;
	globalStorageHome: URI;
	workspaceStorageHome: URI;
	useHostProxy?: boolean;
	skipWorkspaceStorageLock?: boolean;
}

export interface IStaticWorkspaceData {
	id: string;
	name: string;
	transient?: boolean;
	configuration?: UriComponents | null;
	isUntitled?: boolean | null;
}

export interface MessagePortLike {
	postMessage(message: any, transfer?: any[]): void;
	addEventListener(type: 'message', listener: (e: any) => any): void;
	removeEventListener(type: 'message', listener: (e: any) => any): void;
	start(): void;
}

export enum UIKind {
	Desktop = 1,
	Web = 2
}

export const enum ExtensionHostExitCode {
	// nodejs uses codes 1-13 and exit codes >128 are signal exits
	VersionMismatch = 55,
	UnexpectedError = 81,
}

export interface IExtHostReadyMessage {
	type: 'VSCODE_EXTHOST_IPC_READY';
}

export interface IExtHostSocketMessage {
	type: 'VSCODE_EXTHOST_IPC_SOCKET';
	initialDataChunk: string;
	skipWebSocketFrames: boolean;
	permessageDeflate: boolean;
	inflateBytes: string;
}

export interface IExtHostReduceGraceTimeMessage {
	type: 'VSCODE_EXTHOST_IPC_REDUCE_GRACE_TIME';
}

export const enum MessageType {
	Initialized,
	Ready,
	Terminate
}

export function createMessageOfType(type: MessageType): VSBuffer {
	const result = VSBuffer.alloc(1);

	switch (type) {
		case MessageType.Initialized: result.writeUInt8(1, 0); break;
		case MessageType.Ready: result.writeUInt8(2, 0); break;
		case MessageType.Terminate: result.writeUInt8(3, 0); break;
	}

	return result;
}

export function isMessageOfType(message: VSBuffer, type: MessageType): boolean {
	if (message.byteLength !== 1) {
		return false;
	}

	switch (message.readUInt8(0)) {
		case 1: return type === MessageType.Initialized;
		case 2: return type === MessageType.Ready;
		case 3: return type === MessageType.Terminate;
		default: return false;
	}
}
