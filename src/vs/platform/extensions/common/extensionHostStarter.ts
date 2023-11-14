/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IExtensionHostStarter = createDecorator<IExtensionHostStarter>('extensionHostStarter');

export const ipcExtensionHostStarterChannelName = 'extensionHostStarter';

export interface IExtensionHostProcessOptions {
	responseWindowId: number;
	responseChannel: string;
	responseNonce: string;
	env: { [key: string]: string | undefined };
	detached: boolean;
	execArgv: string[] | undefined;
	silent: boolean;
}

export interface IExtensionHostStarter {
	readonly _serviceBrand: undefined;

	onDynamicStdout(id: string): Event<string>;
	onDynamicStderr(id: string): Event<string>;
	onDynamicMessage(id: string): Event<any>;
	onDynamicExit(id: string): Event<{ code: number; signal: string }>;

	createExtensionHost(): Promise<{ id: string }>;
	start(id: string, opts: IExtensionHostProcessOptions): Promise<void>;
	enableInspectPort(id: string): Promise<boolean>;
	kill(id: string): Promise<void>;

}
