/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import * as mssql from 'mssql';

export interface TestContext {
	context: vscode.ExtensionContext;
	dacFxService: TypeMoq.IMock<mssql.IDacFxService>;
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
	const sampleName = 'Sample Display Name';
	const defaultOptions: mssql.DeploymentOptions = {
		ignoreTableOptions: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreSemicolonBetweenStatements: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreRouteLifetime: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreRoleMembership: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreQuotedIdentifiers: { value: false, description: sampleDesc, displayName: sampleName },
		ignorePermissions: { value: false, description: sampleDesc, displayName: sampleName },
		ignorePartitionSchemes: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreObjectPlacementOnPartitionScheme: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreNotForReplication: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreLoginSids: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreLockHintsOnIndexes: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreKeywordCasing: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreIndexPadding: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreIndexOptions: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreIncrement: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreIdentitySeed: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreUserSettingsObjects: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreFullTextCatalogFilePath: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreWhitespace: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreWithNocheckOnForeignKeys: { value: false, description: sampleDesc, displayName: sampleName },
		verifyCollationCompatibility: { value: false, description: sampleDesc, displayName: sampleName },
		unmodifiableObjectWarnings: { value: false, description: sampleDesc, displayName: sampleName },
		treatVerificationErrorsAsWarnings: { value: false, description: sampleDesc, displayName: sampleName },
		scriptRefreshModule: { value: false, description: sampleDesc, displayName: sampleName },
		scriptNewConstraintValidation: { value: false, description: sampleDesc, displayName: sampleName },
		scriptFileSize: { value: false, description: sampleDesc, displayName: sampleName },
		scriptDeployStateChecks: { value: false, description: sampleDesc, displayName: sampleName },
		scriptDatabaseOptions: { value: false, description: sampleDesc, displayName: sampleName },
		scriptDatabaseCompatibility: { value: false, description: sampleDesc, displayName: sampleName },
		scriptDatabaseCollation: { value: false, description: sampleDesc, displayName: sampleName },
		runDeploymentPlanExecutors: { value: false, description: sampleDesc, displayName: sampleName },
		registerDataTierApplication: { value: false, description: sampleDesc, displayName: sampleName },
		populateFilesOnFileGroups: { value: false, description: sampleDesc, displayName: sampleName },
		noAlterStatementsToChangeClrTypes: { value: false, description: sampleDesc, displayName: sampleName },
		includeTransactionalScripts: { value: false, description: sampleDesc, displayName: sampleName },
		includeCompositeObjects: { value: false, description: sampleDesc, displayName: sampleName },
		allowUnsafeRowLevelSecurityDataMovement: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreWithNocheckOnCheckConstraints: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreFillFactor: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreFileSize: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreFilegroupPlacement: { value: false, description: sampleDesc, displayName: sampleName },
		doNotAlterReplicatedObjects: { value: false, description: sampleDesc, displayName: sampleName },
		doNotAlterChangeDataCaptureObjects: { value: false, description: sampleDesc, displayName: sampleName },
		disableAndReenableDdlTriggers: { value: false, description: sampleDesc, displayName: sampleName },
		deployDatabaseInSingleUserMode: { value: false, description: sampleDesc, displayName: sampleName },
		createNewDatabase: { value: false, description: sampleDesc, displayName: sampleName },
		compareUsingTargetCollation: { value: false, description: sampleDesc, displayName: sampleName },
		commentOutSetVarDeclarations: { value: false, description: sampleDesc, displayName: sampleName },
		blockWhenDriftDetected: { value: false, description: sampleDesc, displayName: sampleName },
		blockOnPossibleDataLoss: { value: false, description: sampleDesc, displayName: sampleName },
		backupDatabaseBeforeChanges: { value: false, description: sampleDesc, displayName: sampleName },
		allowIncompatiblePlatform: { value: false, description: sampleDesc, displayName: sampleName },
		allowDropBlockingAssemblies: { value: false, description: sampleDesc, displayName: sampleName },
		dropConstraintsNotInSource: { value: false, description: sampleDesc, displayName: sampleName },
		dropDmlTriggersNotInSource: { value: false, description: sampleDesc, displayName: sampleName },
		dropExtendedPropertiesNotInSource: { value: false, description: sampleDesc, displayName: sampleName },
		dropIndexesNotInSource: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreFileAndLogFilePath: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreExtendedProperties: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreDmlTriggerState: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreDmlTriggerOrder: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreDefaultSchema: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreDdlTriggerState: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreDdlTriggerOrder: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreCryptographicProviderFilePath: { value: false, description: sampleDesc, displayName: sampleName },
		verifyDeployment: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreComments: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreColumnCollation: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreAuthorizer: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreAnsiNulls: { value: false, description: sampleDesc, displayName: sampleName },
		generateSmartDefaults: { value: false, description: sampleDesc, displayName: sampleName },
		dropStatisticsNotInSource: { value: false, description: sampleDesc, displayName: sampleName },
		dropRoleMembersNotInSource: { value: false, description: sampleDesc, displayName: sampleName },
		dropPermissionsNotInSource: { value: false, description: sampleDesc, displayName: sampleName },
		dropObjectsNotInSource: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreColumnOrder: { value: false, description: sampleDesc, displayName: sampleName },
		doNotDropObjectTypes: { value: [], description: sampleDesc, displayName: sampleName },
		excludeObjectTypes: { value: [], description: sampleDesc, displayName: sampleName },
		ignoreTablePartitionOptions: { value: false, description: sampleDesc, displayName: sampleName },
		doNotEvaluateSqlCmdVariables: { value: false, description: sampleDesc, displayName: sampleName },
		disableParallelismForEnablingIndexes: { value: false, description: sampleDesc, displayName: sampleName },
		disableIndexesForDataPhase: { value: false, description: sampleDesc, displayName: sampleName },
		restoreSequenceCurrentValue: { value: false, description: sampleDesc, displayName: sampleName },
		rebuildIndexesOfflineForDataPhase: { value: false, description: sampleDesc, displayName: sampleName },
		isAlwaysEncryptedParameterizationEnabled: { value: false, description: sampleDesc, displayName: sampleName },
		preserveIdentityLastValues: { value: false, description: sampleDesc, displayName: sampleName },
		allowExternalLibraryPaths: { value: false, description: sampleDesc, displayName: sampleName },
		allowExternalLanguagePaths: { value: false, description: sampleDesc, displayName: sampleName },
		hashObjectNamesInLogs: { value: false, description: sampleDesc, displayName: sampleName },
		doNotDropWorkloadClassifiers: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreWorkloadClassifiers: { value: false, description: sampleDesc, displayName: sampleName },
		ignoreDatabaseWorkloadGroups: { value: false, description: sampleDesc, displayName: sampleName },
		doNotDropDatabaseWorkloadGroups: { value: false, description: sampleDesc, displayName: sampleName }
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

export function createContext(): TestContext {
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
