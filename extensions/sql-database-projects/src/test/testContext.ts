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
	const sampleName = 'Sample Property Name';
	const defaultOptions: mssql.DeploymentOptions = {
		ignoreTableOptions: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreSemicolonBetweenStatements: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreRouteLifetime: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreRoleMembership: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreQuotedIdentifiers: { value: false, description: sampleDesc, propertyName: sampleName },
		ignorePermissions: { value: false, description: sampleDesc, propertyName: sampleName },
		ignorePartitionSchemes: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreObjectPlacementOnPartitionScheme: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreNotForReplication: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreLoginSids: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreLockHintsOnIndexes: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreKeywordCasing: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreIndexPadding: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreIndexOptions: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreIncrement: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreIdentitySeed: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreUserSettingsObjects: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreFullTextCatalogFilePath: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreWhitespace: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreWithNocheckOnForeignKeys: { value: false, description: sampleDesc, propertyName: sampleName },
		verifyCollationCompatibility: { value: false, description: sampleDesc, propertyName: sampleName },
		unmodifiableObjectWarnings: { value: false, description: sampleDesc, propertyName: sampleName },
		treatVerificationErrorsAsWarnings: { value: false, description: sampleDesc, propertyName: sampleName },
		scriptRefreshModule: { value: false, description: sampleDesc, propertyName: sampleName },
		scriptNewConstraintValidation: { value: false, description: sampleDesc, propertyName: sampleName },
		scriptFileSize: { value: false, description: sampleDesc, propertyName: sampleName },
		scriptDeployStateChecks: { value: false, description: sampleDesc, propertyName: sampleName },
		scriptDatabaseOptions: { value: false, description: sampleDesc, propertyName: sampleName },
		scriptDatabaseCompatibility: { value: false, description: sampleDesc, propertyName: sampleName },
		scriptDatabaseCollation: { value: false, description: sampleDesc, propertyName: sampleName },
		runDeploymentPlanExecutors: { value: false, description: sampleDesc, propertyName: sampleName },
		registerDataTierApplication: { value: false, description: sampleDesc, propertyName: sampleName },
		populateFilesOnFileGroups: { value: false, description: sampleDesc, propertyName: sampleName },
		noAlterStatementsToChangeClrTypes: { value: false, description: sampleDesc, propertyName: sampleName },
		includeTransactionalScripts: { value: false, description: sampleDesc, propertyName: sampleName },
		includeCompositeObjects: { value: false, description: sampleDesc, propertyName: sampleName },
		allowUnsafeRowLevelSecurityDataMovement: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreWithNocheckOnCheckConstraints: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreFillFactor: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreFileSize: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreFilegroupPlacement: { value: false, description: sampleDesc, propertyName: sampleName },
		doNotAlterReplicatedObjects: { value: false, description: sampleDesc, propertyName: sampleName },
		doNotAlterChangeDataCaptureObjects: { value: false, description: sampleDesc, propertyName: sampleName },
		disableAndReenableDdlTriggers: { value: false, description: sampleDesc, propertyName: sampleName },
		deployDatabaseInSingleUserMode: { value: false, description: sampleDesc, propertyName: sampleName },
		createNewDatabase: { value: false, description: sampleDesc, propertyName: sampleName },
		compareUsingTargetCollation: { value: false, description: sampleDesc, propertyName: sampleName },
		commentOutSetVarDeclarations: { value: false, description: sampleDesc, propertyName: sampleName },
		blockWhenDriftDetected: { value: false, description: sampleDesc, propertyName: sampleName },
		blockOnPossibleDataLoss: { value: false, description: sampleDesc, propertyName: sampleName },
		backupDatabaseBeforeChanges: { value: false, description: sampleDesc, propertyName: sampleName },
		allowIncompatiblePlatform: { value: false, description: sampleDesc, propertyName: sampleName },
		allowDropBlockingAssemblies: { value: false, description: sampleDesc, propertyName: sampleName },
		dropConstraintsNotInSource: { value: false, description: sampleDesc, propertyName: sampleName },
		dropDmlTriggersNotInSource: { value: false, description: sampleDesc, propertyName: sampleName },
		dropExtendedPropertiesNotInSource: { value: false, description: sampleDesc, propertyName: sampleName },
		dropIndexesNotInSource: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreFileAndLogFilePath: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreExtendedProperties: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreDmlTriggerState: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreDmlTriggerOrder: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreDefaultSchema: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreDdlTriggerState: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreDdlTriggerOrder: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreCryptographicProviderFilePath: { value: false, description: sampleDesc, propertyName: sampleName },
		verifyDeployment: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreComments: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreColumnCollation: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreAuthorizer: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreAnsiNulls: { value: false, description: sampleDesc, propertyName: sampleName },
		generateSmartDefaults: { value: false, description: sampleDesc, propertyName: sampleName },
		dropStatisticsNotInSource: { value: false, description: sampleDesc, propertyName: sampleName },
		dropRoleMembersNotInSource: { value: false, description: sampleDesc, propertyName: sampleName },
		dropPermissionsNotInSource: { value: false, description: sampleDesc, propertyName: sampleName },
		dropObjectsNotInSource: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreColumnOrder: { value: false, description: sampleDesc, propertyName: sampleName },
		doNotDropObjectTypes: { value: [], description: sampleDesc, propertyName: sampleName },
		excludeObjectTypes: { value: [], description: sampleDesc, propertyName: sampleName },
		ignoreTablePartitionOptions: { value: false, description: sampleDesc, propertyName: sampleName },
		doNotEvaluateSqlCmdVariables: { value: false, description: sampleDesc, propertyName: sampleName },
		disableParallelismForEnablingIndexes: { value: false, description: sampleDesc, propertyName: sampleName },
		disableIndexesForDataPhase: { value: false, description: sampleDesc, propertyName: sampleName },
		restoreSequenceCurrentValue: { value: false, description: sampleDesc, propertyName: sampleName },
		rebuildIndexesOfflineForDataPhase: { value: false, description: sampleDesc, propertyName: sampleName },
		isAlwaysEncryptedParameterizationEnabled: { value: false, description: sampleDesc, propertyName: sampleName },
		preserveIdentityLastValues: { value: false, description: sampleDesc, propertyName: sampleName },
		allowExternalLibraryPaths: { value: false, description: sampleDesc, propertyName: sampleName },
		allowExternalLanguagePaths: { value: false, description: sampleDesc, propertyName: sampleName },
		hashObjectNamesInLogs: { value: false, description: sampleDesc, propertyName: sampleName },
		doNotDropWorkloadClassifiers: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreWorkloadClassifiers: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreSensitivityClassifications: { value: false, description: sampleDesc, propertyName: sampleName },
		ignoreDatabaseWorkloadGroups: { value: false, description: sampleDesc, propertyName: sampleName },
		doNotDropDatabaseWorkloadGroups: { value: false, description: sampleDesc, propertyName: sampleName },
		optionsMapTable: new Map<string, mssql.DacDeployOptionPropertyBoolean>([
			['Sample Display Name Option1', { value: false, description: sampleDesc, propertyName: sampleName }],
			['Sample Display Name Option2', { value: false, description: sampleDesc, propertyName: sampleName }]
		])
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
