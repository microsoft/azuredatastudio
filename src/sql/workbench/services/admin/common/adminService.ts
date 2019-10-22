/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

export const SERVICE_ID = 'adminService';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';

import * as azdata from 'azdata';

export const IAdminService = createDecorator<IAdminService>(SERVICE_ID);

export interface IAdminService {
	_serviceBrand: undefined;

	registerProvider(providerId: string, provider: azdata.AdminServicesProvider): void;

	getDefaultDatabaseInfo(connectionUri: string): Thenable<azdata.DatabaseInfo>;

	getDatabaseInfo(connectionUri: string): Thenable<azdata.DatabaseInfo>;
}

export class AdminService implements IAdminService {
	_serviceBrand: undefined;

	private _providers: { [handle: string]: azdata.AdminServicesProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) {
	}

	private _runAction<T>(uri: string, action: (handler: azdata.AdminServicesProvider) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return Promise.reject(new Error(localize('adminService.providerIdNotValidError', "Connection is required in order to interact with adminservice")));
		}
		let handler = this._providers[providerId];
		if (handler) {
			return action(handler);
		} else {
			return Promise.reject(new Error(localize('adminService.noHandlerRegistered', "No Handler Registered")));
		}
	}

	public getDefaultDatabaseInfo(connectionUri: string): Thenable<azdata.DatabaseInfo> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.getDefaultDatabaseInfo(connectionUri);
			}
		}
		return Promise.resolve(undefined);
	}

	public getDatabaseInfo(connectionUri: string): Thenable<azdata.DatabaseInfo> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getDatabaseInfo(connectionUri);
		});
	}

	public registerProvider(providerId: string, provider: azdata.AdminServicesProvider): void {
		this._providers[providerId] = provider;
	}
}
