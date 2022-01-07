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

export interface TestContext {
	context: vscode.ExtensionContext;
	dacFxService: TypeMoq.IMock<mssql.IDacFxService>;
	azureFunctionService: TypeMoq.IMock<vscodeMssql.IAzureFunctionsService>;
	outputChannel: vscode.OutputChannel;
}

export const mockDacFxResult = {
	operationId: '',
	success: true,
	errorMessage: '',
	report: ''
};

/* Get the deployment options sample model */
export function getDeploymentOptions(): mssql.DeploymentOptions {
	const sampleDesc = 'Sample Description text';
	const defaultOptions: mssql.DeploymentOptions = {
		ignoreTableOptions: { value: false, description: sampleDesc },
		ignoreSemicolonBetweenStatements: { value: false, description: sampleDesc },
		ignoreRouteLifetime: { value: false, description: sampleDesc },
		ignoreRoleMembership: { value: false, description: sampleDesc },
		ignoreQuotedIdentifiers: { value: false, description: sampleDesc },
		ignorePermissions: { value: false, description: sampleDesc },
		ignorePartitionSchemes: { value: false, description: sampleDesc },
		ignoreObjectPlacementOnPartitionScheme: { value: false, description: sampleDesc },
		ignoreNotForReplication: { value: false, description: sampleDesc },
		ignoreLoginSids: { value: false, description: sampleDesc },
		ignoreLockHintsOnIndexes: { value: false, description: sampleDesc },
		ignoreKeywordCasing: { value: false, description: sampleDesc },
		ignoreIndexPadding: { value: false, description: sampleDesc },
		ignoreIndexOptions: { value: false, description: sampleDesc },
		ignoreIncrement: { value: false, description: sampleDesc },
		ignoreIdentitySeed: { value: false, description: sampleDesc },
		ignoreUserSettingsObjects: { value: false, description: sampleDesc },
		ignoreFullTextCatalogFilePath: { value: false, description: sampleDesc },
		ignoreWhitespace: { value: false, description: sampleDesc },
		ignoreWithNocheckOnForeignKeys: { value: false, description: sampleDesc },
		verifyCollationCompatibility: { value: false, description: sampleDesc },
		unmodifiableObjectWarnings: { value: false, description: sampleDesc },
		treatVerificationErrorsAsWarnings: { value: false, description: sampleDesc },
		scriptRefreshModule: { value: false, description: sampleDesc },
		scriptNewConstraintValidation: { value: false, description: sampleDesc },
		scriptFileSize: { value: false, description: sampleDesc },
		scriptDeployStateChecks: { value: false, description: sampleDesc },
		scriptDatabaseOptions: { value: false, description: sampleDesc },
		scriptDatabaseCompatibility: { value: false, description: sampleDesc },
		scriptDatabaseCollation: { value: false, description: sampleDesc },
		runDeploymentPlanExecutors: { value: false, description: sampleDesc },
		registerDataTierApplication: { value: false, description: sampleDesc },
		populateFilesOnFileGroups: { value: false, description: sampleDesc },
		noAlterStatementsToChangeClrTypes: { value: false, description: sampleDesc },
		includeTransactionalScripts: { value: false, description: sampleDesc },
		includeCompositeObjects: { value: false, description: sampleDesc },
		allowUnsafeRowLevelSecurityDataMovement: { value: false, description: sampleDesc },
		ignoreWithNocheckOnCheckConstraints: { value: false, description: sampleDesc },
		ignoreFillFactor: { value: false, description: sampleDesc },
		ignoreFileSize: { value: false, description: sampleDesc },
		ignoreFilegroupPlacement: { value: false, description: sampleDesc },
		doNotAlterReplicatedObjects: { value: false, description: sampleDesc },
		doNotAlterChangeDataCaptureObjects: { value: false, description: sampleDesc },
		disableAndReenableDdlTriggers: { value: false, description: sampleDesc },
		deployDatabaseInSingleUserMode: { value: false, description: sampleDesc },
		createNewDatabase: { value: false, description: sampleDesc },
		compareUsingTargetCollation: { value: false, description: sampleDesc },
		commentOutSetVarDeclarations: { value: false, description: sampleDesc },
		blockWhenDriftDetected: { value: false, description: sampleDesc },
		blockOnPossibleDataLoss: { value: false, description: sampleDesc },
		backupDatabaseBeforeChanges: { value: false, description: sampleDesc },
		allowIncompatiblePlatform: { value: false, description: sampleDesc },
		allowDropBlockingAssemblies: { value: false, description: sampleDesc },
		dropConstraintsNotInSource: { value: false, description: sampleDesc },
		dropDmlTriggersNotInSource: { value: false, description: sampleDesc },
		dropExtendedPropertiesNotInSource: { value: false, description: sampleDesc },
		dropIndexesNotInSource: { value: false, description: sampleDesc },
		ignoreFileAndLogFilePath: { value: false, description: sampleDesc },
		ignoreExtendedProperties: { value: false, description: sampleDesc },
		ignoreDmlTriggerState: { value: false, description: sampleDesc },
		ignoreDmlTriggerOrder: { value: false, description: sampleDesc },
		ignoreDefaultSchema: { value: false, description: sampleDesc },
		ignoreDdlTriggerState: { value: false, description: sampleDesc },
		ignoreDdlTriggerOrder: { value: false, description: sampleDesc },
		ignoreCryptographicProviderFilePath: { value: false, description: sampleDesc },
		verifyDeployment: { value: false, description: sampleDesc },
		ignoreComments: { value: false, description: sampleDesc },
		ignoreColumnCollation: { value: false, description: sampleDesc },
		ignoreAuthorizer: { value: false, description: sampleDesc },
		ignoreAnsiNulls: { value: false, description: sampleDesc },
		generateSmartDefaults: { value: false, description: sampleDesc },
		dropStatisticsNotInSource: { value: false, description: sampleDesc },
		dropRoleMembersNotInSource: { value: false, description: sampleDesc },
		dropPermissionsNotInSource: { value: false, description: sampleDesc },
		dropObjectsNotInSource: { value: false, description: sampleDesc },
		ignoreColumnOrder: { value: false, description: sampleDesc },
		doNotDropObjectTypes: [],
		excludeObjectTypes: [],
		ignoreTablePartitionOptions: { value: false, description: sampleDesc },
		doNotEvaluateSqlCmdVariables: { value: false, description: sampleDesc },
		disableParallelismForEnablingIndexes: { value: false, description: sampleDesc },
		disableIndexesForDataPhase: { value: false, description: sampleDesc },
		restoreSequenceCurrentValue: { value: false, description: sampleDesc },
		rebuildIndexesOfflineForDataPhase: { value: false, description: sampleDesc },
		isAlwaysEncryptedParameterizationEnabled: { value: false, description: sampleDesc },
		preserveIdentityLastValues: { value: false, description: sampleDesc },
		allowExternalLibraryPaths: { value: false, description: sampleDesc },
		allowExternalLanguagePaths: { value: false, description: sampleDesc },
		hashObjectNamesInLogs: { value: false, description: sampleDesc },
		doNotDropWorkloadClassifiers: { value: false, description: sampleDesc },
		ignoreWorkloadClassifiers: { value: false, description: sampleDesc },
		ignoreDatabaseWorkloadGroups: { value: false, description: sampleDesc },
		doNotDropDatabaseWorkloadGroups: { value: false, description: sampleDesc }
	};
	return defaultOptions;
}

export const mockDacFxOptionsResult: mssql.DacFxOptionsResult = {
	success: true,
	errorMessage: '',
	deploymentOptions: getDeploymentOptions()
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
	addSqlBinding(_: vscodeMssql.BindingType, __: string, ___: string, ____: string, _____: string): Thenable<vscodeMssql.ResultStatus> { return Promise.resolve(mockResultStatus); }
	getAzureFunctions(_: string): Thenable<vscodeMssql.GetAzureFunctionsResult> { return Promise.resolve(mockGetAzureFunctionsResult); }
}

export function createContext(): TestContext {
	let extensionPath = path.join(__dirname, '..', '..');

	return {
		context: {
			subscriptions: [],
			workspaceState: {
				get: () => { return undefined; },
				update: () => { return Promise.resolve(); }
			},
			globalState: {
				setKeysForSync: (): void => { },
				get: (): any | undefined => { return Promise.resolve(); },
				update: (): Thenable<void> => { return Promise.resolve(); }
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
		authenticationType: 'SqlLogin'
	}
};
