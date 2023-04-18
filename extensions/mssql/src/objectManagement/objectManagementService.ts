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
import { AuthenticationType, NodeType, UserType } from './constants';

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

	async initializeView(contextId: string, objectType: ObjectManagement.NodeType, connectionUri: string, database: string, isNewObject: boolean, parentUrn: string, objectUrn: string): Promise<ObjectManagement.ObjectViewInfo<ObjectManagement.SqlObject>> {
		const params: contracts.InitializeViewRequestParams = { connectionUri, contextId, isNewObject, objectType, database, parentUrn, objectUrn };
		return this.runWithErrorHandling(contracts.InitializeViewRequest.type, params);
	}

	private constructor(context: AppContext, client: SqlOpsDataClient) {
		super(client);
		context.registerService(constants.ObjectManagementService, this);
	}

	async save(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		const params: contracts.SaveObjectRequestParams = { contextId, object };
		return this.runWithErrorHandling(contracts.SaveObjectRequest.type, params);
	}

	async script(contextId: string, object: ObjectManagement.SqlObject): Promise<string> {
		const params: contracts.ScriptObjectRequestParams = { contextId, object };
		return this.runWithErrorHandling(contracts.ScriptObjectRequest.type, params);
	}

	async disposeView(contextId: string): Promise<void> {
		const params: contracts.DisposeViewRequestParams = { contextId };
		return this.runWithErrorHandling(contracts.DisposeViewRequest.type, params);
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
	initializeView(contextId: string, objectType: ObjectManagement.NodeType, connectionUri: string, database: string, isNewObject: boolean, parentUrn: string, objectUrn: string): Thenable<ObjectManagement.ObjectViewInfo<ObjectManagement.SqlObject>> {
		if (objectType === NodeType.ServerLevelLogin) {
			return Promise.resolve(this.getLoginView(isNewObject, objectUrn));
		} else if (objectType === NodeType.User) {
			return Promise.resolve(this.getUserView(isNewObject, objectUrn));
		}
		else {
			throw Error('Not implemented');
		}
	}
	save(contextId: string, object: ObjectManagement.SqlObject): Thenable<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, 3000);
		});
	}
	script(contextId: string, object: ObjectManagement.SqlObject): Thenable<string> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve('test script');
			}, 1000);
		});
	}
	disposeView(contextId: string): Thenable<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, 100);
		});
	}
	async rename(connectionUri: string, objectUrn: string, newName: string): Promise<void> {
		return this.delayAndResolve();
	}
	async drop(connectionUri: string, objectUrn: string): Promise<void> {
		return this.delayAndResolve();
	}
	async create(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		return this.delayAndResolve();
	}
	private getLoginView(isNewObject: boolean, name: string): ObjectManagement.LoginViewInfo {
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
		return login;
	}
	private getUserView(isNewObject: boolean, name: string): ObjectManagement.UserViewInfo {
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
		return viewInfo;
	}
	private delayAndResolve(): Promise<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, 3000);
		});
	}
}
