/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IChannel, IServerChannel } from 'vs/base/parts/ipc/common/ipc';
import { Client as IPCElectronClient } from 'vs/base/parts/ipc/electron-sandbox/ipc.electron';
import { Disposable } from 'vs/base/common/lifecycle';
import { IMainProcessService } from 'vs/platform/ipc/electron-sandbox/services';

/**
 * An implementation of `IMainProcessService` that leverages Electron's IPC.
 */
export class ElectronIPCMainProcessService extends Disposable implements IMainProcessService {

	declare readonly _serviceBrand: undefined;

	private mainProcessConnection: IPCElectronClient;

	constructor(
		windowId: number
	) {
		super();

		this.mainProcessConnection = this._register(new IPCElectronClient(`window:${windowId}`));
	}

	getChannel(channelName: string): IChannel {
		return this.mainProcessConnection.getChannel(channelName);
	}

	registerChannel(channelName: string, channel: IServerChannel<string>): void {
		this.mainProcessConnection.registerChannel(channelName, channel);
	}
}
