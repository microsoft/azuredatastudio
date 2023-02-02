/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ObjectManagement, IObjectManagementService } from 'mssql';
import { ClientCapabilities } from 'vscode-languageclient';
import { AppContext } from '../appContext';
import * as Utils from '../utils';
import * as constants from '../constants';
import * as contracts from '../contracts';

export class ObjectManagementService implements IObjectManagementService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends ObjectManagementService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(capabilities, 'objectManagement')!.objectManagement = true;
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.ObjectManagementService, this);
	}
	initializeLoginView(connectionUri: string, contextId: string, isNewObject: boolean, name: string | undefined): Thenable<ObjectManagement.LoginViewInfo> {
		const params: contracts.InitializeLoginViewRequestParams = { connectionUri, contextId, isNewObject, name };
		return this.client.sendRequest(contracts.InitializeLoginViewRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.InitializeLoginViewRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}
	createLogin(contextId: string, login: ObjectManagement.Login): Thenable<void> {
		const params: contracts.CreateLoginRequestParams = { contextId, login };
		return this.client.sendRequest(contracts.CreateLoginRequest.type, params).then(
			r => { },
			e => {
				this.client.logFailedRequest(contracts.CreateLoginRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}
	updateLogin(contextId: string, login: ObjectManagement.Login): Thenable<void> {
		const params: contracts.UpdateLoginRequestParams = { contextId, login };
		return this.client.sendRequest(contracts.UpdateLoginRequest.type, params).then(
			r => { },
			e => {
				this.client.logFailedRequest(contracts.UpdateLoginRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}
	deleteLogin(connectionUri: string, name: string): Thenable<void> {
		const params: contracts.DeleteLoginRequestParams = { connectionUri, name };
		return this.client.sendRequest(contracts.DeleteLoginRequest.type, params).then(
			r => { },
			e => {
				this.client.logFailedRequest(contracts.DeleteLoginRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}
	disposeLoginView(contextId: string): Thenable<void> {
		const params: contracts.DisposeLoginViewRequestParams = { contextId };
		return this.client.sendRequest(contracts.DisposeLoginViewRequest.type, params).then(
			r => { },
			e => {
				this.client.logFailedRequest(contracts.DisposeLoginViewRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}

}

export class TestObjectManagementService implements IObjectManagementService {
	async disposeLoginView(contextId: string): Promise<void> {

	}
	initializeLoginView(connectionUri: string, contextId: string, isNewObject: boolean, name: string | undefined): Promise<ObjectManagement.LoginViewInfo> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				let login: ObjectManagement.LoginViewInfo;
				if (isNewObject) {
					login = <ObjectManagement.LoginViewInfo>{
						login: {
							name: '',
							authenticationType: 'Sql',
							enforcePasswordPolicy: true,
							enforcePasswordExpiration: true,
							mustChangePassword: true,
							defaultDatabase: 'master',
							defaultLanguage: '<default>',
							serverRoles: ['public'],
							connectPermission: true,
							isEnabled: true,
							isLockedOut: false
						},
						supportAADAuthentication: true,
						supportSQLAuthentication: true,
						supportWindowsAuthentication: true,
						supportAdvancedOptions: true,
						supportAdvancedPasswordOptions: true,
						canEditName: true,
						canEditLockedOutState: false,
						languages: ['<default>', 'English'],
						databases: ['master', 'db1', 'db2'],
						serverRoles: ['sysadmin', 'public']
					};
				} else {
					login = <ObjectManagement.LoginViewInfo>{
						login: {
							name: name,
							authenticationType: 'Sql',
							enforcePasswordPolicy: true,
							enforcePasswordExpiration: true,
							mustChangePassword: true,
							defaultDatabase: 'master',
							defaultLanguage: '<default>',
							serverRoles: ['public'],
							connectPermission: true,
							isEnabled: true,
							isLockedOut: false,
							password: '******************'
						},
						supportAADAuthentication: true,
						supportSQLAuthentication: true,
						supportWindowsAuthentication: true,
						supportAdvancedOptions: true,
						supportAdvancedPasswordOptions: true,
						canEditName: false,
						canEditLockedOutState: false,
						languages: ['<default>', 'English'],
						databases: ['master', 'db1', 'db2'],
						serverRoles: ['sysadmin', 'public']
					};
				}
				resolve(login);
			}, 3000);
		});
	}
	async createLogin(contextId: string, login: ObjectManagement.Login): Promise<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, 3000);
		});
	}
	async updateLogin(contextId: string, login: ObjectManagement.Login): Promise<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, 3000);
		});
	}
	async deleteLogin(connectionUri: string, name: string): Promise<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, 3000);
		});
	}
}
