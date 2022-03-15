/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import * as mssql from '../../../mssql/src/mssql';
import * as vscodeMssql from 'vscode-mssql';
import { RequestType } from 'vscode-languageclient';
import { BindingType, GetAzureFunctionsResult } from 'sql-bindings';

export interface TestUtils {
	context: vscode.ExtensionContext;
	dacFxService: TypeMoq.IMock<mssql.IDacFxService>;
	azureFunctionService: TypeMoq.IMock<vscodeMssql.IAzureFunctionsService>;
	outputChannel: vscode.OutputChannel;
	vscodeMssqlIExtension: TypeMoq.IMock<vscodeMssql.IExtension>
	dacFxMssqlService: TypeMoq.IMock<vscodeMssql.IDacFxService>;
	schemaCompareService: TypeMoq.IMock<vscodeMssql.ISchemaCompareService>;
}

export const mockDacFxResult = {
	operationId: '',
	success: true,
	errorMessage: '',
	report: ''
};

export const mockDacFxOptionsResult: mssql.DacFxOptionsResult = {
	success: true,
	errorMessage: '',
	deploymentOptions: {
		ignoreTableOptions: false,
		ignoreSemicolonBetweenStatements: false,
		ignoreRouteLifetime: false,
		ignoreRoleMembership: false,
		ignoreQuotedIdentifiers: false,
		ignorePermissions: false,
		ignorePartitionSchemes: false,
		ignoreObjectPlacementOnPartitionScheme: false,
		ignoreNotForReplication: false,
		ignoreLoginSids: false,
		ignoreLockHintsOnIndexes: false,
		ignoreKeywordCasing: false,
		ignoreIndexPadding: false,
		ignoreIndexOptions: false,
		ignoreIncrement: false,
		ignoreIdentitySeed: false,
		ignoreUserSettingsObjects: false,
		ignoreFullTextCatalogFilePath: false,
		ignoreWhitespace: false,
		ignoreWithNocheckOnForeignKeys: false,
		verifyCollationCompatibility: false,
		unmodifiableObjectWarnings: false,
		treatVerificationErrorsAsWarnings: false,
		scriptRefreshModule: false,
		scriptNewConstraintValidation: false,
		scriptFileSize: false,
		scriptDeployStateChecks: false,
		scriptDatabaseOptions: false,
		scriptDatabaseCompatibility: false,
		scriptDatabaseCollation: false,
		runDeploymentPlanExecutors: false,
		registerDataTierApplication: false,
		populateFilesOnFileGroups: false,
		noAlterStatementsToChangeClrTypes: false,
		includeTransactionalScripts: false,
		includeCompositeObjects: false,
		allowUnsafeRowLevelSecurityDataMovement: false,
		ignoreWithNocheckOnCheckConstraints: false,
		ignoreFillFactor: false,
		ignoreFileSize: false,
		ignoreFilegroupPlacement: false,
		doNotAlterReplicatedObjects: false,
		doNotAlterChangeDataCaptureObjects: false,
		disableAndReenableDdlTriggers: false,
		deployDatabaseInSingleUserMode: false,
		createNewDatabase: false,
		compareUsingTargetCollation: false,
		commentOutSetVarDeclarations: false,
		blockWhenDriftDetected: false,
		blockOnPossibleDataLoss: false,
		backupDatabaseBeforeChanges: false,
		allowIncompatiblePlatform: false,
		allowDropBlockingAssemblies: false,
		dropConstraintsNotInSource: false,
		dropDmlTriggersNotInSource: false,
		dropExtendedPropertiesNotInSource: false,
		dropIndexesNotInSource: false,
		ignoreFileAndLogFilePath: false,
		ignoreExtendedProperties: false,
		ignoreDmlTriggerState: false,
		ignoreDmlTriggerOrder: false,
		ignoreDefaultSchema: false,
		ignoreDdlTriggerState: false,
		ignoreDdlTriggerOrder: false,
		ignoreCryptographicProviderFilePath: false,
		verifyDeployment: false,
		ignoreComments: false,
		ignoreColumnCollation: false,
		ignoreAuthorizer: false,
		ignoreAnsiNulls: false,
		generateSmartDefaults: false,
		dropStatisticsNotInSource: false,
		dropRoleMembersNotInSource: false,
		dropPermissionsNotInSource: false,
		dropObjectsNotInSource: false,
		ignoreColumnOrder: false,
		doNotDropObjectTypes: [],
		excludeObjectTypes: []
	}
};

export class MockDacFxService implements mssql.IDacFxService {
	public exportBacpac(_: string, __: string, ___: string, ____: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public importBacpac(_: string, __: string, ___: string, ____: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public extractDacpac(_: string, __: string, ___: string, ____: string, _____: string, ______: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public createProjectFromDatabase(_: string, __: string, ___: string, ____: string, _____: string, ______: mssql.ExtractTarget, _______: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public deployDacpac(_: string, __: string, ___: boolean, ____: string, _____: azdata.TaskExecutionMode, ______?: Record<string, string>): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public generateDeployScript(_: string, __: string, ___: string, ____: azdata.TaskExecutionMode, ______?: Record<string, string>): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public generateDeployPlan(_: string, __: string, ___: string, ____: azdata.TaskExecutionMode): Thenable<mssql.GenerateDeployPlanResult> { return Promise.resolve(mockDacFxResult); }
	public getOptionsFromProfile(_: string): Thenable<mssql.DacFxOptionsResult> { return Promise.resolve(mockDacFxOptionsResult); }
	public validateStreamingJob(_: string, __: string): Thenable<mssql.ValidateStreamingJobResult> { return Promise.resolve(mockDacFxResult); }
}

export const mockResultStatus = {
	success: true,
	errorMessage: ''
};

export const mockGetAzureFunctionsResult = {
	success: true,
	errorMessage: '',
	azureFunctions: []
};

export class MockAzureFunctionService implements vscodeMssql.IAzureFunctionsService {
	addSqlBinding(_: BindingType, __: string, ___: string, ____: string, _____: string): Thenable<vscodeMssql.ResultStatus> { return Promise.resolve(mockResultStatus); }
	getAzureFunctions(_: string): Thenable<GetAzureFunctionsResult> { return Promise.resolve(mockGetAzureFunctionsResult); }
}

export const mockDacFxMssqlOptionResult: vscodeMssql.DacFxOptionsResult = {
	success: true,
	errorMessage: '',
	deploymentOptions: {
		ignoreTableOptions: false,
		ignoreSemicolonBetweenStatements: false,
		ignoreRouteLifetime: false,
		ignoreRoleMembership: false,
		ignoreQuotedIdentifiers: false,
		ignorePermissions: false,
		ignorePartitionSchemes: false,
		ignoreObjectPlacementOnPartitionScheme: false,
		ignoreNotForReplication: false,
		ignoreLoginSids: false,
		ignoreLockHintsOnIndexes: false,
		ignoreKeywordCasing: false,
		ignoreIndexPadding: false,
		ignoreIndexOptions: false,
		ignoreIncrement: false,
		ignoreIdentitySeed: false,
		ignoreUserSettingsObjects: false,
		ignoreFullTextCatalogFilePath: false,
		ignoreWhitespace: false,
		ignoreWithNocheckOnForeignKeys: false,
		verifyCollationCompatibility: false,
		unmodifiableObjectWarnings: false,
		treatVerificationErrorsAsWarnings: false,
		scriptRefreshModule: false,
		scriptNewConstraintValidation: false,
		scriptFileSize: false,
		scriptDeployStateChecks: false,
		scriptDatabaseOptions: false,
		scriptDatabaseCompatibility: false,
		scriptDatabaseCollation: false,
		runDeploymentPlanExecutors: false,
		registerDataTierApplication: false,
		populateFilesOnFileGroups: false,
		noAlterStatementsToChangeClrTypes: false,
		includeTransactionalScripts: false,
		includeCompositeObjects: false,
		allowUnsafeRowLevelSecurityDataMovement: false,
		ignoreWithNocheckOnCheckConstraints: false,
		ignoreFillFactor: false,
		ignoreFileSize: false,
		ignoreFilegroupPlacement: false,
		doNotAlterReplicatedObjects: false,
		doNotAlterChangeDataCaptureObjects: false,
		disableAndReenableDdlTriggers: false,
		deployDatabaseInSingleUserMode: false,
		createNewDatabase: false,
		compareUsingTargetCollation: false,
		commentOutSetVarDeclarations: false,
		blockWhenDriftDetected: false,
		blockOnPossibleDataLoss: false,
		backupDatabaseBeforeChanges: false,
		allowIncompatiblePlatform: false,
		allowDropBlockingAssemblies: false,
		dropConstraintsNotInSource: false,
		dropDmlTriggersNotInSource: false,
		dropExtendedPropertiesNotInSource: false,
		dropIndexesNotInSource: false,
		ignoreFileAndLogFilePath: false,
		ignoreExtendedProperties: false,
		ignoreDmlTriggerState: false,
		ignoreDmlTriggerOrder: false,
		ignoreDefaultSchema: false,
		ignoreDdlTriggerState: false,
		ignoreDdlTriggerOrder: false,
		ignoreCryptographicProviderFilePath: false,
		verifyDeployment: false,
		ignoreComments: false,
		ignoreColumnCollation: false,
		ignoreAuthorizer: false,
		ignoreAnsiNulls: false,
		generateSmartDefaults: false,
		dropStatisticsNotInSource: false,
		dropRoleMembersNotInSource: false,
		dropPermissionsNotInSource: false,
		dropObjectsNotInSource: false,
		ignoreColumnOrder: false,
		doNotDropObjectTypes: [],
		excludeObjectTypes: []
	}
};

export class MockDacFxMssqlService implements vscodeMssql.IDacFxService {
	public exportBacpac(_: string, __: string, ___: string, ____: vscodeMssql.TaskExecutionMode): Thenable<vscodeMssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public importBacpac(_: string, __: string, ___: string, ____: vscodeMssql.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public extractDacpac(_: string, __: string, ___: string, ____: string, _____: string, ______: vscodeMssql.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public createProjectFromDatabase(_: string, __: string, ___: string, ____: string, _____: string, ______: vscodeMssql.ExtractTarget, _______: vscodeMssql.TaskExecutionMode): Thenable<vscodeMssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public deployDacpac(_: string, __: string, ___: boolean, ____: string, _____: vscodeMssql.TaskExecutionMode, ______?: Record<string, string>): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public generateDeployScript(_: string, __: string, ___: string, ____: vscodeMssql.TaskExecutionMode, ______?: Record<string, string>): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public generateDeployPlan(_: string, __: string, ___: string, ____: vscodeMssql.TaskExecutionMode): Thenable<vscodeMssql.GenerateDeployPlanResult> { return Promise.resolve(mockDacFxResult); }
	public getOptionsFromProfile(_: string): Thenable<vscodeMssql.DacFxOptionsResult> { return Promise.resolve(mockDacFxMssqlOptionResult); }
	public validateStreamingJob(_: string, __: string): Thenable<mssql.ValidateStreamingJobResult> { return Promise.resolve(mockDacFxResult); }
}

export class MockSchemaCompareService implements vscodeMssql.ISchemaCompareService {
	schemaCompareGetDefaultOptions(): Thenable<vscodeMssql.SchemaCompareOptionsResult> {
		throw new Error('Method not implemented.');
	}
}

export class MockVscodeMssqlIExtension implements vscodeMssql.IExtension {
	sqlToolsServicePath: string = '';
	dacFx: vscodeMssql.IDacFxService;
	schemaCompare: vscodeMssql.ISchemaCompareService;
	azureFunctions: vscodeMssql.IAzureFunctionsService;

	constructor() {
		this.dacFx = new MockDacFxMssqlService;
		this.schemaCompare = new MockSchemaCompareService;
		this.azureFunctions = new MockAzureFunctionService;
	}
	sendRequest<P, R, E, R0>(_: RequestType<P, R, E, R0>, __?: P): Promise<R> {
		throw new Error('Method not implemented.');
	}
	promptForConnection(_?: boolean): Promise<vscodeMssql.IConnectionInfo | undefined> {
		throw new Error('Method not implemented.');
	}
	connect(_: vscodeMssql.IConnectionInfo, __?: boolean): Promise<string> {
		throw new Error('Method not implemented.');
	}
	listDatabases(_: string): Promise<string[]> {
		throw new Error('Method not implemented.');
	}
	getDatabaseNameFromTreeNode(_: vscodeMssql.ITreeNodeInfo): string {
		throw new Error('Method not implemented.');
	}
	getConnectionString(_: string | vscodeMssql.ConnectionDetails, ___?: boolean, _____?: boolean): Promise<string> {
		throw new Error('Method not implemented.');
	}
	createConnectionDetails(_: vscodeMssql.IConnectionInfo): vscodeMssql.ConnectionDetails {
		throw new Error('Method not implemented.');
	}
}

export function createTestUtils(): TestUtils {
	let extensionPath = path.join(__dirname, '..', '..');

	return {
		context: {
			subscriptions: [],
			workspaceState: {
				get: () => { return undefined; },
				update: () => { return Promise.resolve(); },
				keys: () => []
			},
			globalState: {
				setKeysForSync: (): void => { },
				get: (): any | undefined => { return Promise.resolve(); },
				update: (): Thenable<void> => { return Promise.resolve(); },
				keys: () => []
			},
			extensionPath: extensionPath,
			asAbsolutePath: () => { return ''; },
			storagePath: '',
			globalStoragePath: '',
			logPath: '',
			extensionUri: vscode.Uri.parse(''),
			environmentVariableCollection: undefined as any,
			extensionMode: undefined as any,
			globalStorageUri: vscode.Uri.parse('test://'),
			logUri: vscode.Uri.parse('test://'),
			storageUri: vscode.Uri.parse('test://'),
			secrets: undefined as any,
			extension: undefined as any
		},
		dacFxService: TypeMoq.Mock.ofType(MockDacFxService),
		azureFunctionService: TypeMoq.Mock.ofType(MockAzureFunctionService),
		vscodeMssqlIExtension: TypeMoq.Mock.ofType(MockVscodeMssqlIExtension),
		dacFxMssqlService: TypeMoq.Mock.ofType(MockDacFxMssqlService),
		schemaCompareService: TypeMoq.Mock.ofType(MockSchemaCompareService),
		outputChannel: {
			name: '',
			append: () => { },
			appendLine: () => { },
			clear: () => { },
			show: () => { },
			hide: () => { },
			dispose: () => { }
		}
	};
}

// Mock test data
export const mockConnectionProfile: azdata.IConnectionProfile = {
	connectionName: 'My Connection',
	serverName: 'My Server',
	databaseName: 'My Database',
	userName: 'My User',
	password: 'My Pwd',
	authenticationType: 'SqlLogin',
	savePassword: false,
	groupFullName: 'My groupName',
	groupId: 'My GroupId',
	providerName: 'My Server',
	saveProfile: true,
	id: 'My Id',
	options: {
		server: 'My Server',
		database: 'My Database',
		user: 'My User',
		password: 'My Pwd',
		authenticationType: 'SqlLogin',
		connectionName: 'My Connection Name'
	}
};

export function createTestCredentials(): vscodeMssql.IConnectionInfo {
	const creds: vscodeMssql.IConnectionInfo = {
		server: 'my-server',
		database: 'my_db',
		user: 'sa',
		password: '12345678',
		email: 'test-email',
		accountId: 'test-account-id',
		tenantId: 'test-tenant-id',
		port: 1234,
		authenticationType: 'test',
		azureAccountToken: '',
		expiresOn: 0,
		encrypt: false,
		trustServerCertificate: false,
		persistSecurityInfo: false,
		connectTimeout: 15,
		connectRetryCount: 0,
		connectRetryInterval: 0,
		applicationName: 'vscode-mssql',
		workstationId: 'test',
		applicationIntent: '',
		currentLanguage: '',
		pooling: true,
		maxPoolSize: 15,
		minPoolSize: 0,
		loadBalanceTimeout: 0,
		replication: false,
		attachDbFilename: '',
		failoverPartner: '',
		multiSubnetFailover: false,
		multipleActiveResultSets: false,
		packetSize: 8192,
		typeSystemVersion: 'Latest',
		connectionString: ''
	};
	return creds;
}
