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

	async rename(connectionUri: string, objectType: ObjectManagement.NodeType, objectUrn: string, newName: string): Promise<void> {
		const params: contracts.RenameObjectRequestParams = { connectionUri, objectUrn, newName, objectType };
		return this.runWithErrorHandling(contracts.RenameObjectRequest.type, params);
	}
	async drop(connectionUri: string, objectType: ObjectManagement.NodeType, objectUrn: string): Promise<void> {
		const params: contracts.DropObjectRequestParams = { connectionUri, objectUrn, objectType };
		return this.runWithErrorHandling(contracts.DropObjectRequest.type, params);
	}
	async search(contextId: string, searchText: string, objectTypes: ObjectManagement.NodeType[]): Promise<ObjectManagement.SearchResultItem[]> {
		const params: contracts.SearchObjectRequestParams = { contextId, searchText, objectTypes };
		return this.runWithErrorHandling(contracts.SearchObjectRequest.type, params);
	}
}

export class TestObjectManagementService implements IObjectManagementService {
	initializeView(contextId: string, objectType: ObjectManagement.NodeType, connectionUri: string, database: string, isNewObject: boolean, parentUrn: string, objectUrn: string): Thenable<ObjectManagement.ObjectViewInfo<ObjectManagement.SqlObject>> {
		let obj;
		if (objectType === ObjectManagement.NodeType.ApplicationRole) {
			obj = this.getApplicationRoleView(isNewObject, objectUrn);
		} else if (objectType === ObjectManagement.NodeType.DatabaseRole) {
			obj = this.getDatabaseRoleView(isNewObject, objectUrn);
		} else if (objectType === ObjectManagement.NodeType.ServerLevelLogin) {
			obj = this.getLoginView(isNewObject, objectUrn);
		} else if (objectType === ObjectManagement.NodeType.ServerLevelServerRole) {
			obj = this.getServerRoleView(isNewObject, objectUrn);
		} else if (objectType === ObjectManagement.NodeType.User) {
			obj = this.getUserView(isNewObject, objectUrn);
		}
		else {
			throw Error('Not implemented');
		}
		return this.delayAndResolve(obj);
	}
	save(contextId: string, object: ObjectManagement.SqlObject): Thenable<void> {
		return this.delayAndResolve();
	}
	script(contextId: string, object: ObjectManagement.SqlObject): Thenable<string> {
		return this.delayAndResolve('test script');
	}
	disposeView(contextId: string): Thenable<void> {
		return this.delayAndResolve();
	}
	async rename(connectionUri: string, objectType: ObjectManagement.NodeType, objectUrn: string, newName: string): Promise<void> {
		return this.delayAndResolve();
	}
	async drop(connectionUri: string, objectType: ObjectManagement.NodeType, objectUrn: string): Promise<void> {
		return this.delayAndResolve();
	}

	async search(contextId: string, searchText: string, objectTypes: ObjectManagement.NodeType[]): Promise<ObjectManagement.SearchResultItem[]> {
		const items = [];
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test1', type: ObjectManagement.NodeType.ServerLevelLogin });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test2', type: ObjectManagement.NodeType.ServerLevelLogin });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test3', type: ObjectManagement.NodeType.ServerLevelLogin });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test4', type: ObjectManagement.NodeType.ServerLevelLogin });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test5', type: ObjectManagement.NodeType.ServerLevelLogin });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test6', type: ObjectManagement.NodeType.ServerLevelServerRole });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test7', type: ObjectManagement.NodeType.ServerLevelServerRole });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test8', type: ObjectManagement.NodeType.ServerLevelServerRole });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test9', type: ObjectManagement.NodeType.ServerLevelServerRole });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test10', type: ObjectManagement.NodeType.ServerLevelServerRole });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test11', type: ObjectManagement.NodeType.ServerLevelServerRole });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test12', type: ObjectManagement.NodeType.ServerLevelServerRole });
		items.push(<ObjectManagement.SearchResultItem>{ name: 'test13', type: ObjectManagement.NodeType.ServerLevelServerRole });
		return this.delayAndResolve(items);
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
					authenticationType: ObjectManagement.AuthenticationType.Sql,
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
					authenticationType: ObjectManagement.AuthenticationType.Sql,
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
					type: ObjectManagement.UserType.WithLogin,
					defaultSchema: 'dbo',
					defaultLanguage: '<default>',
					authenticationType: ObjectManagement.AuthenticationType.Sql,
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
					type: ObjectManagement.UserType.WithLogin,
					defaultSchema: 'dbo',
					defaultLanguage: '<default>',
					loginName: 'sa',
					authenticationType: ObjectManagement.AuthenticationType.Sql,
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

	private getServerRoleView(isNewObject: boolean, name: string): ObjectManagement.ServerRoleViewInfo {
		return isNewObject ? <ObjectManagement.ServerRoleViewInfo>{
			objectInfo: {
				name: '',
				members: [],
				owner: '',
				memberships: []
			},
			isFixedRole: false,
			serverRoles: ['server role1', 'server role2', 'server role3', 'server role4'],
		} : <ObjectManagement.ServerRoleViewInfo>{
			objectInfo: {
				name: 'server role1',
				members: ['login1', 'server role2'],
				owner: 'login1',
				memberships: ['server role3', 'server role4']
			},
			isFixedRole: false,
			serverRoles: ['server role2', 'server role3', 'server role4']
		};
	}

	private getApplicationRoleView(isNewObject: boolean, name: string): ObjectManagement.ApplicationRoleViewInfo {
		return isNewObject ? <ObjectManagement.ApplicationRoleViewInfo>{
			objectInfo: {
				name: '',
				defaultSchema: 'dbo',
				ownedSchemas: [],
			},
			schemas: ['dbo', 'sys', 'admin']
		} : <ObjectManagement.ApplicationRoleViewInfo>{
			objectInfo: {
				name: 'app role1',
				defaultSchema: 'dbo',
				ownedSchemas: ['dbo'],
			},
			schemas: ['dbo', 'sys', 'admin']
		};
	}

	private getDatabaseRoleView(isNewObject: boolean, name: string): ObjectManagement.DatabaseRoleViewInfo {
		return isNewObject ? <ObjectManagement.DatabaseRoleViewInfo>{
			objectInfo: {
				name: '',
				owner: '',
				members: [],
				ownedSchemas: []
			},
			schemas: ['dbo', 'sys', 'admin']
		} : <ObjectManagement.DatabaseRoleViewInfo>{
			objectInfo: {
				name: 'db role1',
				owner: '',
				members: [],
				ownedSchemas: ['dbo']
			},
			schemas: ['dbo', 'sys', 'admin']
		};
	}

	private delayAndResolve(obj?: any): Promise<any> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve(obj);
			}, 1000);
		});
	}
}
