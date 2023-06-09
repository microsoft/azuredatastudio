/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ApplicationRoleViewInfo, AuthenticationType, DatabaseRoleViewInfo, LoginViewInfo, SecurablePermissions, SecurableTypeMetadata, ServerRoleViewInfo, User, UserType, UserViewInfo } from './interfaces';
import * as Utils from '../utils';
import * as constants from '../constants';
import * as contracts from '../contracts';
import { ServerPropertiesViewInfo } from './interfaces';

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
	async search(contextId: string, objectTypes: ObjectManagement.NodeType[], searchText?: string, schema?: string): Promise<ObjectManagement.SearchResultItem[]> {
		const params: contracts.SearchObjectRequestParams = { contextId, searchText, objectTypes, schema };
		return this.runWithErrorHandling(contracts.SearchObjectRequest.type, params);
	}
}

const ServerLevelSecurableTypes: SecurableTypeMetadata[] = [
	{
		name: 'Server',
		displayName: 'Server',
		permissions: [{
			name: 'CONNECT SQL',
			displayName: 'CONNECT SQL'
		}, {
			name: 'VIEW ANY DATABASE',
			displayName: 'VIEW ANY DATABASE'
		}]
	}, {
		name: 'ServerRole',
		displayName: 'Server Role',
		permissions: [{
			name: 'ALTER',
			displayName: 'ALTER'
		}, {
			name: 'CONTROL',
			displayName: 'CONTROL'
		}, {
			name: 'TAKE OWNERSHIP',
			displayName: 'TAKE OWNERSHIP'
		}]
	}
];

const DatabaseLevelSecurableTypes: SecurableTypeMetadata[] = [
	{
		name: 'AggregateFunction',
		displayName: 'Aggregate Function',
		permissions: [{
			name: 'EXECUTE',
			displayName: 'EXECUTE'
		}, {
			name: 'ALTER',
			displayName: 'ALTER'
		}]
	}, {
		name: 'Table',
		displayName: 'Table',
		permissions: [{
			name: 'SELECT',
			displayName: 'SELECT'
		}, {
			name: 'ALTER',
			displayName: 'ALTER'
		}, {
			name: 'CONTROL',
			displayName: 'CONTROL'
		}, {
			name: 'TAKE OWNERSHIP',
			displayName: 'TAKE OWNERSHIP'
		}]
	}, {
		name: 'View',
		displayName: 'View',
		permissions: [{
			name: 'ALTER',
			displayName: 'ALTER'
		}, {
			name: 'CONTROL',
			displayName: 'CONTROL'
		}, {
			name: 'TAKE OWNERSHIP',
			displayName: 'TAKE OWNERSHIP'
		}]
	}
]

const ServerLevelPermissions: SecurablePermissions[] = [
	{
		name: 'Server',
		type: 'Server',
		permissions: [
			{
				permission: 'CONNECT SQL',
				grant: true,
				grantor: 'sa',
				withGrant: undefined
			}, {
				permission: 'VIEW ANY DATABASE',
				grant: false,
				grantor: 'sa',
				withGrant: undefined
			}
		],
		effectivePermissions: ['CONNECT SQL', 'VIEW ANY DATABASE']
	}
];

const DatabaseLevelPermissions: SecurablePermissions[] = [
	{
		name: 'table1',
		type: 'Table',
		schema: 'dbo',
		permissions: [
			{
				permission: 'SELECT',
				grant: true,
				grantor: '',
				withGrant: undefined
			}
		],
		effectivePermissions: ['SELECT']
	}, {
		name: 'view1',
		type: 'View',
		schema: 'Sales',
		permissions: [
			{
				permission: 'ALTER',
				grant: true,
				grantor: '',
				withGrant: undefined
			}
		],
		effectivePermissions: ['ALTER']
	}
];
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
		} else if (objectType === ObjectManagement.NodeType.Server) {
			obj = this.getServerPropertiesView(isNewObject, objectUrn);
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

	async search(contextId: string, objectTypes: ObjectManagement.NodeType[], searchText?: string, schema?: string): Promise<ObjectManagement.SearchResultItem[]> {
		const items: ObjectManagement.SearchResultItem[] = [];
		objectTypes.forEach(type => {
			items.push(...this.generateSearchResult(type, schema, 15));
		});
		return this.delayAndResolve(items);
	}

	private generateSearchResult(objectType: ObjectManagement.NodeType, schema: string | undefined, count: number): ObjectManagement.SearchResultItem[] {
		let items: ObjectManagement.SearchResultItem[] = [];
		for (let i = 0; i < count; i++) {
			items.push(<ObjectManagement.SearchResultItem>{ name: `${objectType} ${i}`, schema: schema, type: objectType });
		}
		return items;
	}

	private getLoginView(isNewObject: boolean, name: string): LoginViewInfo {
		const serverRoles = ['sysadmin', 'public', 'bulkadmin', 'dbcreator', 'diskadmin', 'processadmin', 'securityadmin', 'serveradmin'];
		const languages = ['<default>', 'English'];
		const databases = ['master', 'db1', 'db2'];
		let login: LoginViewInfo;
		if (isNewObject) {
			login = <LoginViewInfo>{
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
					isLockedOut: false,
					securablePermissions: []
				},
				authenticationTypes: [AuthenticationType.Sql, AuthenticationType.Windows],
				supportAdvancedOptions: true,
				supportAdvancedPasswordOptions: true,
				canEditLockedOutState: false,
				languages: languages,
				databases: databases,
				serverRoles: serverRoles,
				supportedSecurableTypes: ServerLevelSecurableTypes
			};
		} else {
			login = <LoginViewInfo>{
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
					password: '******************',
					securablePermissions: ServerLevelPermissions
				},
				authenticationTypes: [AuthenticationType.Sql, AuthenticationType.Windows],
				supportAdvancedOptions: true,
				supportAdvancedPasswordOptions: true,
				canEditLockedOutState: false,
				languages: languages,
				databases: databases,
				serverRoles: serverRoles,
				supportedSecurableTypes: ServerLevelSecurableTypes
			};
		}
		return login;
	}

	private getUserView(isNewObject: boolean, name: string): UserViewInfo {
		let viewInfo: UserViewInfo;
		const languages = ['<default>', 'English'];
		const schemas = ['dbo', 'sys', 'alanren'];
		const logins = ['sa', 'alanren', 'alanren@microsoft.com'];
		const databaseRoles = ['dbmanager', 'loginmanager', 'bulkadmin', 'sysadmin', 'tablemanager', 'viewmanager'];

		if (isNewObject) {
			viewInfo = {
				objectInfo: <User>{
					name: '',
					type: UserType.LoginMapped,
					defaultSchema: 'dbo',
					defaultLanguage: '<default>',
					authenticationType: AuthenticationType.Sql,
					loginName: 'sa',
					ownedSchemas: [],
					databaseRoles: [],
					password: '',
					securablePermissions: []
				},
				languages: languages,
				schemas: schemas,
				logins: logins,
				databaseRoles: databaseRoles,
				userTypes: [
					UserType.LoginMapped,
					UserType.AADAuthentication,
					UserType.SqlAuthentication,
					UserType.NoLoginAccess
				],
				supportedSecurableTypes: DatabaseLevelSecurableTypes
			};
		} else {
			viewInfo = {
				objectInfo: <User>{
					name: name,
					type: UserType.LoginMapped,
					defaultSchema: 'dbo',
					defaultLanguage: '<default>',
					loginName: 'sa',
					ownedSchemas: ['dbo'],
					databaseRoles: ['dbmanager', 'bulkadmin'],
					securablePermissions: DatabaseLevelPermissions
				},
				languages: languages,
				schemas: schemas,
				logins: logins,
				databaseRoles: databaseRoles,
				userTypes: [
					UserType.LoginMapped,
					UserType.AADAuthentication,
					UserType.SqlAuthentication,
					UserType.NoLoginAccess
				],
				supportedSecurableTypes: DatabaseLevelSecurableTypes
			};
		}
		return viewInfo;
	}

	private getServerRoleView(isNewObject: boolean, name: string): ServerRoleViewInfo {
		return isNewObject ? <ServerRoleViewInfo>{
			objectInfo: {
				name: '',
				members: [],
				owner: '',
				memberships: [],
				securablePermissions: []
			},
			isFixedRole: false,
			serverRoles: ['ServerLevelServerRole 1', 'ServerLevelServerRole 2', 'ServerLevelServerRole 3', 'ServerLevelServerRole 4'],
			supportedSecurableTypes: ServerLevelSecurableTypes
		} : <ServerRoleViewInfo>{
			objectInfo: {
				name: 'ServerLevelServerRole 1',
				members: ['ServerLevelLogin 1', 'ServerLevelServerRole 2'],
				owner: 'ServerLevelLogin 2',
				memberships: ['ServerLevelServerRole 3', 'ServerLevelServerRole 4'],
				securablePermissions: ServerLevelPermissions
			},
			isFixedRole: false,
			serverRoles: ['ServerLevelServerRole 2', 'ServerLevelServerRole 3', 'ServerLevelServerRole 4'],
			supportedSecurableTypes: ServerLevelSecurableTypes
		};
	}

	private getApplicationRoleView(isNewObject: boolean, name: string): ApplicationRoleViewInfo {
		return isNewObject ? <ApplicationRoleViewInfo>{
			objectInfo: {
				name: '',
				defaultSchema: 'dbo',
				ownedSchemas: [],
				securablePermissions: []
			},
			schemas: ['dbo', 'sys', 'admin'],
			supportedSecurableTypes: []
		} : <ApplicationRoleViewInfo>{
			objectInfo: {
				name: 'app role1',
				password: '******************',
				defaultSchema: 'dbo',
				ownedSchemas: ['dbo'],
				securablePermissions: DatabaseLevelPermissions
			},
			schemas: ['dbo', 'sys', 'admin'],
			supportedSecurableTypes: DatabaseLevelSecurableTypes
		};
	}

	private getDatabaseRoleView(isNewObject: boolean, name: string): DatabaseRoleViewInfo {
		return isNewObject ? <DatabaseRoleViewInfo>{
			objectInfo: {
				name: '',
				owner: '',
				members: [],
				ownedSchemas: [],
				securablePermissions: []
			},
			schemas: ['dbo', 'sys', 'admin'],
			supportedSecurableTypes: DatabaseLevelSecurableTypes
		} : <DatabaseRoleViewInfo>{
			objectInfo: {
				name: 'db role1',
				owner: '',
				members: [],
				ownedSchemas: ['dbo'],
				securablePermissions: DatabaseLevelPermissions
			},
			schemas: ['dbo', 'sys', 'admin'],
			supportedSecurableTypes: DatabaseLevelSecurableTypes
		};
	}

	private getServerPropertiesView(isNewObject: boolean, name: string): ServerPropertiesViewInfo {
		return isNewObject ? <ServerPropertiesViewInfo>{
			objectInfo: {
				name: 'Server Properties',
				language: '',
				memoryInMb: 0,
				operatingSystem: '',
				platform: '',
				processors: '',
				minMemoryInMb: 0,
				maxMemoryInMb: 0
			}
		} : <ServerPropertiesViewInfo>{
			objectInfo: {
				name: 'Server Properties',
				language: 'English (US)',
				memoryInMb: 256,
				operatingSystem: 'Windows',
				platform: '',
				processors: '',
				minMemoryInMb: 0,
				maxMemoryInMb: 22528
			}
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

