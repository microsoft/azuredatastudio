/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { IChannel } from 'vs/base/parts/ipc/common/ipc';
import { IWorkspacesService, IWorkspaceIdentifier, IWorkspaceFolderCreationData, IWorkspacesMainService } from 'vs/platform/workspaces/common/workspaces';
import URI from 'vs/base/common/uri';
import { Event } from 'vs/base/common/event';

export interface IWorkspacesChannel extends IChannel {
	call(command: 'createWorkspace', arg: [IWorkspaceFolderCreationData[]]): TPromise<string>;
	call(command: string, arg?: any): TPromise<any>;
}

export class WorkspacesChannel implements IWorkspacesChannel {

	constructor(private service: IWorkspacesMainService) { }

	listen<T>(event: string, arg?: any): Event<T> {
		throw new Error('No events');
	}

	call(command: string, arg?: any): TPromise<any> {
		switch (command) {
			case 'createWorkspace': {
				const rawFolders: IWorkspaceFolderCreationData[] = arg;
				let folders: IWorkspaceFolderCreationData[];
				if (Array.isArray(rawFolders)) {
					folders = rawFolders.map(rawFolder => {
						return {
							uri: URI.revive(rawFolder.uri), // convert raw URI back to real URI
							name: rawFolder.name
						} as IWorkspaceFolderCreationData;
					});
				}

				return this.service.createWorkspace(folders);
			}
		}

		return void 0;
	}
}

export class WorkspacesChannelClient implements IWorkspacesService {

	_serviceBrand: any;

	constructor(private channel: IWorkspacesChannel) { }

	createWorkspace(folders?: IWorkspaceFolderCreationData[]): TPromise<IWorkspaceIdentifier> {
		return this.channel.call('createWorkspace', folders);
	}
}