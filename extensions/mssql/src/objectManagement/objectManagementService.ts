/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ApplicationRoleViewInfo, AuthenticationType, DatabaseRoleViewInfo, DatabaseViewInfo, LoginViewInfo, SecurablePermissions, SecurableTypeMetadata, ServerRoleViewInfo, User, UserType, UserViewInfo } from './interfaces';
import * as Utils from '../utils';
import * as constants from '../constants';
import * as contracts from '../contracts';
import { BaseService, ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ObjectManagement, IObjectManagementService, DatabaseFileData, BackupInfo } from 'mssql';
import { ClientCapabilities } from 'vscode-languageclient';
import { AppContext } from '../appContext';
import { BackupResponse } from 'azdata';
import { CredentialInfo } from 'azdata';

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

	async detachDatabase(connectionUri: string, database: string, dropConnections: boolean, updateStatistics: boolean, generateScript: boolean): Promise<string> {
		const params: contracts.DetachDatabaseRequestParams = { connectionUri, database, dropConnections, updateStatistics, generateScript };
		return this.runWithErrorHandling(contracts.DetachDatabaseRequest.type, params);
	}

	async dropDatabase(connectionUri: string, database: string, dropConnections: boolean, deleteBackupHistory: boolean, generateScript: boolean): Promise<string> {
		const params: contracts.DropDatabaseRequestParams = { connectionUri, database, dropConnections, deleteBackupHistory, generateScript };
		return this.runWithErrorHandling(contracts.DropDatabaseRequest.type, params);
	}

	async attachDatabases(connectionUri: string, databases: DatabaseFileData[], generateScript: boolean): Promise<string> {
		const params: contracts.AttachDatabaseRequestParams = { connectionUri, databases, generateScript };
		return this.runWithErrorHandling(contracts.AttachDatabaseRequest.type, params);
	}

	async backupDatabase(connectionUri: string, backupInfo: BackupInfo, taskExecutionMode: azdata.TaskExecutionMode): Promise<BackupResponse> {
		const params: contracts.BackupDatabaseRequestParams = { ownerUri: connectionUri, backupInfo, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.BackupDatabaseRequest.type, params);
	}

	async getDataFolder(connectionUri: string): Promise<string> {
		const params: contracts.GetDataFolderRequestParams = { connectionUri };
		return this.runWithErrorHandling(contracts.GetDataFolderRequest.type, params);
	}

	async getBackupFolder(connectionUri: string): Promise<string> {
		const params: contracts.GetBackupFolderRequestParams = { connectionUri };
		return this.runWithErrorHandling(contracts.GetBackupFolderRequest.type, params);
	}

	async getAssociatedFiles(connectionUri: string, primaryFilePath: string): Promise<string[]> {
		const params: contracts.GetAssociatedFilesRequestParams = { connectionUri, primaryFilePath };
		return this.runWithErrorHandling(contracts.GetAssociatedFilesRequest.type, params);
	}

	async purgeQueryStoreData(connectionUri: string, database: string): Promise<void> {
		const params: contracts.PurgeQueryStoreDataRequestParams = { connectionUri, database };
		return this.runWithErrorHandling(contracts.PurgeQueryStoreDataRequest.type, params);
	}

	async createCredential(connectionUri: string, credentialInfo: azdata.CredentialInfo): Promise<void> {
		const params: contracts.CreateCredentialRequestParams = { connectionUri, credentialInfo };
		return this.runWithErrorHandling(contracts.CreateCredentialRequest.type, params);
	}

	async getCredentialNames(connectionUri: string): Promise<string[]> {
		const params: contracts.GetCredentialNamesRequestParams = { connectionUri };
		return this.runWithErrorHandling(contracts.GetCredentialNamesRequest.type, params);
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
		} else if (objectType === ObjectManagement.NodeType.Database) {
			obj = this.getDatabaseView(isNewObject, objectUrn);
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

	async search(contextId: string, objectTypes: ObjectManagement.NodeType[], searchText?: string, schema?: string): Promise<ObjectManagement.SearchResultItem[]> {
		const items: ObjectManagement.SearchResultItem[] = [];
		objectTypes.forEach(type => {
			items.push(...this.generateSearchResult(type, schema, 15));
		});
		return this.delayAndResolve(items);
	}

	async detachDatabase(connectionUri: string, database: string, dropConnections: boolean, updateStatistics: boolean, generateScript: boolean): Promise<string> {
		return this.delayAndResolve('');
	}

	async attachDatabases(connectionUri: string, databases: DatabaseFileData[], generateScript: boolean): Promise<string> {
		return this.delayAndResolve('');
	}

	async backupDatabase(connectionUri: string, backupInfo: BackupInfo, taskMode: azdata.TaskExecutionMode): Promise<azdata.BackupResponse> {
		return this.delayAndResolve({ result: true, taskId: 0 });
	}

	dropDatabase(connectionUri: string, database: string, dropConnections: boolean, deleteBackupHistory: boolean, generateScript: boolean): Thenable<string> {
		return this.delayAndResolve('');
	}

	async getDataFolder(connectionUri: string): Promise<string> {
		return this.delayAndResolve('');
	}

	async getBackupFolder(connectionUri: string): Promise<string> {
		return this.delayAndResolve('');
	}

	async getAssociatedFiles(connectionUri: string, primaryFilePath: string): Promise<string[]> {
		return this.delayAndResolve([]);
	}

	async purgeQueryStoreData(connectionUri: string, database: string): Promise<void> {
		return this.delayAndResolve([]);
	}

	async createCredential(connectionUri: string, credentialInfo: CredentialInfo): Promise<void> {
		return this.delayAndResolve();
	}

	async getCredentialNames(connectionUri: string): Promise<string[]> {
		return this.delayAndResolve([]);
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

	private getDatabaseView(isNewObject: boolean, name: string): DatabaseViewInfo {
		return isNewObject ? <DatabaseViewInfo>{
			objectInfo: {
				name: 'New Database Name',
				owner: '',
				collationName: '',
				compatibilityLevel: '',
				containmentType: '',
				recoveryModel: '',
				azureEdition: '',
				azureMaxSize: '',
				azureBackupRedundancyLevel: '',
				azureServiceLevelObjective: ''
			}
		} : <DatabaseViewInfo>{
			collationNames: { defaultValueIndex: 0, options: ['Latin1_General_100_CI_AS_KS_WS', 'Latin1_General_100_CI_AS_KS_WS_SC'] },
			compatibilityLevels: { defaultValueIndex: 0, options: ['SQL Server 2008', 'SQL Server 2012', 'SQL Server 2014', 'SQL Server 2016', 'SQL Server 2017', 'SQL Server 2019'] },
			containmentTypes: { defaultValueIndex: 0, options: ['NONE', 'PARTIAL'] },
			loginNames: { defaultValueIndex: 0, options: ['user1', 'user2', 'user3'] },
			restrictAccessOptions: ['MULTI_USER', 'RESTRICTED_USER', 'SINGLE_USER'],
			recoveryModels: { defaultValueIndex: 0, options: ['FULL', 'SIMPLE', 'BULK_LOGGED'] },
			pageVerifyOptions: ['CHECKSUM', 'NONE', 'TORN_PAGE_DETECTION'],
			dscElevateOptions: ['OFF', 'WHEN_SUPPORTED', 'FAIL_UNSUPPORTED'],
			dscEnableDisableOptions: ['ENABLED', 'DISABLED'],
			propertiesOnOffOptions: ['ON', 'OFF'],
			rowDataFileGroupsOptions: ['PRIMARY', 'RowDataGroup1', 'RowDataGroup2'],
			fileStreamFileGroupsOptions: ['PRIMARY', 'FileStreamGroup1', 'FileStreamGroup2'],
			fileTypesOptions: ['ROWS', 'LOG', 'FILESTREAM'],
			objectInfo: {
				name: 'Database Properties1',
				collationName: 'Latin1_General_100_CI_AS_KS_WS',
				dateCreated: '5/31/2023 8:05:55 AM',
				lastDatabaseBackup: 'None',
				lastDatabaseLogBackup: 'None',
				memoryAllocatedToMemoryOptimizedObjectsInMb: 0,
				memoryUsedByMemoryOptimizedObjectsInMb: 0,
				numberOfUsers: 5,
				owner: 'databaseProperties 1',
				sizeInMb: 16.00,
				spaceAvailableInMb: 1.15,
				status: 'Normal',
				autoCreateIncrementalStatistics: false,
				autoCreateStatistics: true,
				autoShrink: false,
				autoUpdateStatistics: true,
				autoUpdateStatisticsAsynchronously: false,
				isLedgerDatabase: false,
				pageVerify: 'CHECKSUM',
				targetRecoveryTimeInSec: 60,
				databaseReadOnly: true,
				encryptionEnabled: false,
				restrictAccess: 'SINGLE_USER',
				databaseScopedConfigurations: [
					{ name: 'MAXDOP', valueForPrimary: '', valueForSecondary: '' },
					{ name: 'legacy_cardinality_estimation', valueForPrimary: 'ON', valueForSecondary: 'ON' },
					{ name: 'parameter_sniffing', valueForPrimary: 'ON', valueForSecondary: 'OFF' },
					{ name: 'query_optimizer_hotfixes', valueForPrimary: 'ON', valueForSecondary: 'OFF' },
					{ name: 'identity_cache', valueForPrimary: 'ON', valueForSecondary: 'ON' },
					{ name: 'interleaved_execution_tvf', valueForPrimary: 'ON', valueForSecondary: 'ON' },
					{ name: 'batch_mode_memory_grant_feedback', valueForPrimary: 'OFF', valueForSecondary: 'OFF' },
					{ name: 'batch_mode_adaptive_joins', valueForPrimary: 'OFF', valueForSecondary: 'ON' },
					{ name: 'tsql_scalar_udf_inlining', valueForPrimary: 'ON', valueForSecondary: 'ON' }
				],
				isFilesTabSupported: true,
				files: [
					{ id: 1, name: 'databasefile1', type: 'ROWS Data', path: 'C:\\Temp\\', fileGroup: 'PRIMARY', fileNameWithExtension: 'databasefile1.mdf', sizeInMb: 62, isAutoGrowthEnabled: true, autoFileGrowth: 64, autoFileGrowthType: 0, maxSizeLimitInMb: -1 },
					{ id: 2, name: 'databasefile1_Log', type: 'Log', path: 'C:\\Temp\\', fileGroup: 'Not Applicable', fileNameWithExtension: 'databasefile1_log.ldf', sizeInMb: 62, isAutoGrowthEnabled: true, autoFileGrowth: 64, autoFileGrowthType: 1, maxSizeLimitInMb: -1 },
				]
			}
		}
	}

	private delayAndResolve(obj?: any): Promise<any> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve(obj);
			}, 1000);
		});
	}
}

