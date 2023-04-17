/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Utils from '../utils';
import * as constants from '../constants';
import * as contracts from '../contracts';

import { BaseService, ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ObjectManagement, IObjectManagementService } from 'mssql';
import { ClientCapabilities } from 'vscode-languageclient';
import { AppContext } from '../appContext';
import { AuthenticationType, UserType } from './constants';

export class ObjectManagementService extends BaseService implements IObjectManagementService {
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

	private constructor(context: AppContext, client: SqlOpsDataClient) {
		super(client);
		context.registerService(constants.ObjectManagementService, this);
	}

	async initializeLoginView(connectionUri: string, contextId: string, isNewObject: boolean, name: string | undefined): Promise<ObjectManagement.LoginViewInfo> {
		const params: contracts.InitializeLoginViewRequestParams = { connectionUri, contextId, isNewObject, name };
		return this.runWithErrorHandling(contracts.InitializeLoginViewRequest.type, params);
	}

	async createLogin(contextId: string, login: ObjectManagement.Login): Promise<void> {
		const params: contracts.CreateLoginRequestParams = { contextId, login };
		return this.runWithErrorHandling(contracts.CreateLoginRequest.type, params);
	}

	async updateLogin(contextId: string, login: ObjectManagement.Login): Promise<void> {
		const params: contracts.UpdateLoginRequestParams = { contextId, login };
		return this.runWithErrorHandling(contracts.UpdateLoginRequest.type, params);
	}

	async scriptLogin(contextId: string, login: ObjectManagement.Login): Promise<string> {
		const params: contracts.ScriptLoginRequestParams = { contextId, login };
		return this.runWithErrorHandling(contracts.ScriptLoginRequest.type, params);
	}

	async disposeLoginView(contextId: string): Promise<void> {
		const params: contracts.DisposeLoginViewRequestParams = { contextId };
		return this.runWithErrorHandling(contracts.DisposeLoginViewRequest.type, params);
	}

	async initializeUserView(connectionUri: string, database: string, contextId: string, isNewObject: boolean, name: string | undefined): Promise<ObjectManagement.UserViewInfo> {
		const params: contracts.InitializeUserViewRequestParams = { connectionUri, database, contextId, isNewObject, name };
		return this.runWithErrorHandling(contracts.InitializeUserViewRequest.type, params);
	}

	async createUser(contextId: string, user: ObjectManagement.User): Promise<void> {
		const params: contracts.CreateUserRequestParams = { contextId, user };
		return this.runWithErrorHandling(contracts.CreateUserRequest.type, params);
	}

	async updateUser(contextId: string, user: ObjectManagement.User): Promise<void> {
		const params: contracts.UpdateUserRequestParams = { contextId, user };
		return this.runWithErrorHandling(contracts.UpdateUserRequest.type, params);
	}

	async scriptUser(contextId: string, user: ObjectManagement.User): Promise<string> {
		const params: contracts.ScriptUserRequestParams = { contextId, user };
		return this.runWithErrorHandling(contracts.ScriptUserRequest.type, params);
	}

	async disposeUserView(contextId: string): Promise<void> {
		const params: contracts.DisposeUserViewRequestParams = { contextId };
		return this.runWithErrorHandling(contracts.DisposeUserViewRequest.type, params);
	}

	async rename(connectionUri: string, objectUrn: string, newName: string): Promise<void> {
		const params: contracts.RenameObjectRequestParams = { connectionUri, objectUrn, newName };
		return this.runWithErrorHandling(contracts.RenameObjectRequest.type, params);
	}
	async drop(connectionUri: string, objectUrn: string): Promise<void> {
		const params: contracts.DropObjectRequestParams = { connectionUri, objectUrn };
		return this.runWithErrorHandling(contracts.DropObjectRequest.type, params);
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
	async scriptLogin(contextId: string, login: ObjectManagement.Login): Promise<string> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve('test script');
			}, 1000);
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
							databaseRoles: [],
							password: ''
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
	async scriptUser(contextId: string, login: ObjectManagement.User): Promise<string> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				reject('generate script for user not supported');
			}, 1000);
		});
	}
	async disposeUserView(contextId: string): Promise<void> {
	}
	async rename(connectionUri: string, objectUrn: string, newName: string): Promise<void> {
		return this.delayAndResolve();
	}
	async drop(connectionUri: string, objectUrn: string): Promise<void> {
		return this.delayAndResolve();
	}
	private delayAndResolve(): Promise<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, 3000);
		});
	}
}
