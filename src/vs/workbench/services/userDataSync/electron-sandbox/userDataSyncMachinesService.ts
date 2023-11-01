/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISharedProcessService } from 'vs/platform/ipc/electron-sandbox/services';
import { Disposable } from 'vs/base/common/lifecycle';
import { IChannel } from 'vs/base/parts/ipc/common/ipc';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IUserDataSyncMachinesService, IUserDataSyncMachine } from 'vs/platform/userDataSync/common/userDataSyncMachines';
import { Event } from 'vs/base/common/event';

class UserDataSyncMachinesService extends Disposable implements IUserDataSyncMachinesService {

	declare readonly _serviceBrand: undefined;

	private readonly channel: IChannel;

	get onDidChange(): Event<void> { return this.channel.listen<void>('onDidChange'); }

	constructor(
		@ISharedProcessService sharedProcessService: ISharedProcessService
	) {
		super();
		this.channel = sharedProcessService.getChannel('userDataSyncMachines');
	}

	getMachines(): Promise<IUserDataSyncMachine[]> {
		return this.channel.call<IUserDataSyncMachine[]>('getMachines');
	}

	addCurrentMachine(): Promise<void> {
		return this.channel.call('addCurrentMachine');
	}

	removeCurrentMachine(): Promise<void> {
		return this.channel.call('removeCurrentMachine');
	}

	renameMachine(machineId: string, name: string): Promise<void> {
		return this.channel.call('renameMachine', [machineId, name]);
	}

	setEnablements(enablements: [string, boolean][]): Promise<void> {
		return this.channel.call('setEnablements', enablements);
	}

}

registerSingleton(IUserDataSyncMachinesService, UserDataSyncMachinesService, InstantiationType.Delayed);
