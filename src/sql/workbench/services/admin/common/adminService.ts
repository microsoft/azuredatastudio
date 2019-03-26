/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { localize } from 'vs/nls';

export const SERVICE_ID = 'adminService';

import { IInstantiationService, createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { CreateLoginInput } from 'sql/parts/admin/security/createLoginInput';
import { TaskDialogInput } from 'sql/parts/tasks/dialog/taskDialogInput';

import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

import * as azdata from 'azdata';

export const IAdminService = createDecorator<IAdminService>(SERVICE_ID);

export interface IAdminService {
	_serviceBrand: any;

	registerProvider(providerId: string, provider: azdata.AdminServicesProvider): void;

	showCreateDatabaseWizard(uri: string, connection: IConnectionProfile): Promise<any>;

	showCreateLoginWizard(uri: string, connection: IConnectionProfile): Promise<any>;

	createDatabase(connectionUri: string, database: azdata.DatabaseInfo): Thenable<azdata.CreateDatabaseResponse>;

	getDefaultDatabaseInfo(connectionUri: string): Thenable<azdata.DatabaseInfo>;

	getDatabaseInfo(connectionUri: string): Thenable<azdata.DatabaseInfo>;
}

export class AdminService implements IAdminService {
	_serviceBrand: any;

	private _providers: { [handle: string]: azdata.AdminServicesProvider; } = Object.create(null);

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IEditorService private _editorService: IEditorService,
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) {
	}

	private _runAction<T>(uri: string, action: (handler: azdata.AdminServicesProvider) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return Promise.reject(new Error(localize('adminService.providerIdNotValidError', 'Connection is required in order to interact with adminservice')));
		}
		let handler = this._providers[providerId];
		if (handler) {
			return action(handler);
		} else {
			return Promise.reject(new Error(localize('adminService.noHandlerRegistered', 'No Handler Registered')));
		}
	}

	public showCreateDatabaseWizard(uri: string, connection: IConnectionProfile): Promise<any> {
		const self = this;
		return new Promise<boolean>((resolve, reject) => {
			let input: TaskDialogInput = self._instantiationService ? self._instantiationService.createInstance(TaskDialogInput, uri, connection) : undefined;
			self._editorService.openEditor(input, { pinned: true }, ACTIVE_GROUP);
			resolve(true);
		});
	}

	public createDatabase(connectionUri: string, database: azdata.DatabaseInfo): Thenable<azdata.CreateDatabaseResponse> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.createDatabase(connectionUri, database);
			}
		}

		return Promise.resolve(undefined);
	}

	public showCreateLoginWizard(uri: string, connection: IConnectionProfile): Promise<any> {
		const self = this;
		self.createLogin(uri, { name: 'TEST: login name' });

		return new Promise<boolean>((resolve, reject) => {
			let loginInput: CreateLoginInput = self._instantiationService ? self._instantiationService.createInstance(CreateLoginInput, uri, connection) : undefined;
			self._editorService.openEditor(loginInput, { pinned: true }, ACTIVE_GROUP);
			resolve(true);
		});
	}

	public createLogin(connectionUri: string, login: azdata.LoginInfo): Thenable<azdata.CreateLoginResponse> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.createLogin(connectionUri, login);
			}
		}
		return Promise.resolve(undefined);
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
