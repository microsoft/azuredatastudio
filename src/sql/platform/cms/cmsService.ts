/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { localize } from 'vs/nls';
import * as sqlops from 'sqlops';
import { TPromise } from 'vs/base/common/winjs.base';
import { ICmsService } from 'sql/platform/cms/interfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { Event, Emitter } from 'vs/base/common/event';
import { relative } from 'path';

export class CmsService implements ICmsService {

	_serviceBrand: any;

	private _onDidChange = new Emitter<void>();
	public readonly onDidChange: Event<void> = this._onDidChange.event;

	private _providers: { [handle: string]: sqlops.CmsServiceProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) {
	}

	public fireOnDidChange(): void {
		this._onDidChange.fire(void 0);
	}

	public registerProvider(providerId: string, provider: sqlops.CmsServiceProvider): void {
		this._providers[providerId] = provider;
	}

	createCmsServer(name: string, description:string, connectiondetails: sqlops.ConnectionInfo, connectionUri: string): Thenable<sqlops.ListRegisteredServersResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.createCmsServer(name, description, connectiondetails, connectionUri);
		});
	}

	getRegisteredServers(connectionUri: string, relativePath: string[]): Thenable<sqlops.ListRegisteredServersResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getRegisteredServers(connectionUri, relativePath);
		});
	}

	addRegisteredServer(connectionUri: string, relativePath: string[], registeredServerName: string, registeredServerDescription: string, connectionDetails: sqlops.ConnectionInfo): Thenable<boolean> {
		return this._runAction(connectionUri, (runner) => {
			return runner.addRegisteredServer(connectionUri, relativePath, registeredServerName, registeredServerDescription, connectionDetails);
		});
	}

	removeRegisteredServer(connectionUri: string, relativePath: string[], registeredServerName: string): Thenable<boolean> {
		return this._runAction(connectionUri, (runner) => {
			return runner.removeRegisteredServer(connectionUri, relativePath, registeredServerName);
		});
	}

	addServerGroup(connectionUri: string, relativePath: string[], groupName: string, groupDescription: string): Thenable<boolean> {
		return this._runAction(connectionUri, (runner) => {
			return runner.addServerGroup(connectionUri, relativePath, groupName, groupDescription);
		});
	}

	removeServerGroup(connectionUri: string, relativePath: string[], groupName: string): Thenable<boolean> {
		return this._runAction(connectionUri, (runner) => {
			return runner.removeServerGroup(connectionUri, relativePath, groupName);
		});
	}

	private _runAction<T>(uri: string, action: (handler: sqlops.CmsServiceProvider) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return TPromise.wrapError(new Error(localize('providerIdNotValidError', "Connection is required in order to interact with JobManagementService")));
		}
		let handler = this._providers[providerId];
		if (handler) {
			return action(handler);
		} else {
			return TPromise.wrapError(new Error(localize('noHandlerRegistered', "No Handler Registered")));
		}
	}
}