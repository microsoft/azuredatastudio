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
import { AuthenticationType, UserType } from './constants';

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

	initializeUserView(connectionUri: string, database: string, contextId: string, isNewObject: boolean, name: string | undefined): Thenable<ObjectManagement.UserViewInfo> {
		const params: contracts.InitializeUserViewRequestParams = { connectionUri, database, contextId, isNewObject, name };
		return this.client.sendRequest(contracts.InitializeUserViewRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.InitializeUserViewRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}
	createUser(contextId: string, user: ObjectManagement.User): Thenable<void> {
		const params: contracts.CreateUserRequestParams = { contextId, user };
		return this.client.sendRequest(contracts.CreateUserRequest.type, params).then(
			r => { },
			e => {
				this.client.logFailedRequest(contracts.CreateUserRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}
	updateUser(contextId: string, user: ObjectManagement.User): Thenable<void> {
		const params: contracts.UpdateUserRequestParams = { contextId, user };
		return this.client.sendRequest(contracts.UpdateUserRequest.type, params).then(
			r => { },
			e => {
				this.client.logFailedRequest(contracts.UpdateLoginRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}
	deleteUser(connectionUri: string, database: string, name: string): Thenable<void> {
		const params: contracts.DeleteUserRequestParams = { connectionUri, database, name };
		return this.client.sendRequest(contracts.DeleteUserRequest.type, params).then(
			r => { },
			e => {
				this.client.logFailedRequest(contracts.DeleteUserRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}
	disposeUserView(contextId: string): Thenable<void> {
		const params: contracts.DisposeUserViewRequestParams = { contextId };
		return this.client.sendRequest(contracts.DisposeUserViewRequest.type, params).then(
			r => { },
			e => {
				this.client.logFailedRequest(contracts.DisposeUserViewRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}
}

export class TestObjectManagementService implements IObjectManagementService {
	initializeLoginView(connectionUri: string, contextId: string, isNewObject: boolean, name: string | undefined): Promise<ObjectManagement.LoginViewInfo> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				const serverRoles = ['sysadmin', 'public', 'bulkadmin', 'dbcreator', 'diskadmin', 'processadmin', 'securityadmin', 'serveradmin'];
				const languages = ['<default>', 'English'];
				const databases = ['master', 'db1', 'db2'];
				let login: ObjectManagement.LoginViewInfo;
				if (isNewObject) {
					login = <ObjectManagement.LoginViewInfo>{
						objectInfo: {
							name: '',
							authenticationType: AuthenticationType.Sql,
							enforcePasswordPolicy: true,
							enforcePasswordExpiration: true,
							mustChangePassword: true,
							defaultDatabase: 'master',
							defaultLanguage: '<default>',
							serverRoles: ['public', 'bulkadmin'],
							connectPermission: true,
							isEnabled: true,
							isLockedOut: false
						},
						supportAADAuthentication: true,
						supportSQLAuthentication: true,
						supportWindowsAuthentication: true,
						supportAdvancedOptions: true,
						supportAdvancedPasswordOptions: true,
						canEditLockedOutState: false,
						languages: languages,
						databases: databases,
						serverRoles: serverRoles
					};
				} else {
					login = <ObjectManagement.LoginViewInfo>{
						objectInfo: {
							name: name,
							authenticationType: AuthenticationType.Sql,
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
						canEditLockedOutState: false,
						languages: languages,
						databases: databases,
						serverRoles: serverRoles
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
	async disposeLoginView(contextId: string): Promise<void> {
	}
	async initializeUserView(connectionUri: string, database: string, contextId: string, isNewObject: boolean, name: string): Promise<ObjectManagement.UserViewInfo> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				let viewInfo: ObjectManagement.UserViewInfo;
				const languages = ['<default>', 'English'];
				const schemas = ['dbo', 'sys', 'alanren'];
				const logins = ['sa', 'alanren', 'alanren@microsoft.com'];
				const databaseRoles = ['dbmanager', 'loginmanager', 'bulkadmin', 'sysadmin', 'tablemanager', 'viewmanager'];

				if (isNewObject) {
					viewInfo = {
						objectInfo: <ObjectManagement.User>{
							name: '',
							type: UserType.WithLogin,
							defaultSchema: 'dbo',
							defaultLanguage: '<default>',
							authenticationType: AuthenticationType.Sql,
							loginName: 'sa',
							ownedSchemas: [],
							databaseRoles: []
						},
						languages: languages,
						schemas: schemas,
						logins: logins,
						databaseRoles: databaseRoles,
						supportContainedUser: true,
						supportAADAuthentication: true,
						supportSQLAuthentication: true,
						supportWindowsAuthentication: true
					};
				} else {
					viewInfo = {
						objectInfo: <ObjectManagement.User>{
							name: name,
							type: UserType.WithLogin,
							defaultSchema: 'dbo',
							defaultLanguage: '<default>',
							loginName: 'sa',
							authenticationType: AuthenticationType.Sql,
							ownedSchemas: ['dbo'],
							databaseRoles: ['dbmanager', 'bulkadmin']
						},
						languages: languages,
						schemas: schemas,
						logins: logins,
						databaseRoles: databaseRoles,
						supportContainedUser: true,
						supportAADAuthentication: true,
						supportSQLAuthentication: true,
						supportWindowsAuthentication: true
					};
				}
				resolve(viewInfo);
			}, 3000);
		});
	}
	async createUser(contextId: string, user: ObjectManagement.User): Promise<void> {
		return this.delayAndResolve();
	}
	async updateUser(contextId: string, login: ObjectManagement.User): Promise<void> {
		return this.delayAndResolve();
	}
	async deleteUser(connectionUri: string, database: string, name: string): Promise<void> {
		return this.delayAndResolve();
	}
	async disposeUserView(contextId: string): Promise<void> {
	}

	private delayAndResolve(): Promise<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, 3000);
		});
	}
}
