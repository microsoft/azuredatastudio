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
	const optiontype = '';
	const defaultOptions: mssql.DeploymentOptions = {
		ignoreTableOptions: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreSemicolonBetweenStatements: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreRouteLifetime: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreRoleMembership: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreQuotedIdentifiers: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignorePermissions: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignorePartitionSchemes: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreObjectPlacementOnPartitionScheme: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreNotForReplication: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreLoginSids: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreLockHintsOnIndexes: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreKeywordCasing: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreIndexPadding: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreIndexOptions: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreIncrement: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreIdentitySeed: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreUserSettingsObjects: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreFullTextCatalogFilePath: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreWhitespace: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreWithNocheckOnForeignKeys: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		verifyCollationCompatibility: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		unmodifiableObjectWarnings: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		treatVerificationErrorsAsWarnings: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		scriptRefreshModule: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		scriptNewConstraintValidation: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		scriptFileSize: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		scriptDeployStateChecks: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		scriptDatabaseOptions: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		scriptDatabaseCompatibility: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		scriptDatabaseCollation: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		runDeploymentPlanExecutors: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		registerDataTierApplication: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		populateFilesOnFileGroups: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		noAlterStatementsToChangeClrTypes: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		includeTransactionalScripts: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		includeCompositeObjects: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		allowUnsafeRowLevelSecurityDataMovement: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreWithNocheckOnCheckConstraints: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreFillFactor: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreFileSize: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreFilegroupPlacement: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		doNotAlterReplicatedObjects: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		doNotAlterChangeDataCaptureObjects: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		disableAndReenableDdlTriggers: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		deployDatabaseInSingleUserMode: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		createNewDatabase: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		compareUsingTargetCollation: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		commentOutSetVarDeclarations: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		blockWhenDriftDetected: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		blockOnPossibleDataLoss: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		backupDatabaseBeforeChanges: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		allowIncompatiblePlatform: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		allowDropBlockingAssemblies: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		dropConstraintsNotInSource: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		dropDmlTriggersNotInSource: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		dropExtendedPropertiesNotInSource: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		dropIndexesNotInSource: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreFileAndLogFilePath: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreExtendedProperties: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreDmlTriggerState: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreDmlTriggerOrder: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreDefaultSchema: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreDdlTriggerState: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreDdlTriggerOrder: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreCryptographicProviderFilePath: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		verifyDeployment: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreComments: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreColumnCollation: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreAuthorizer: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreAnsiNulls: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		generateSmartDefaults: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		dropStatisticsNotInSource: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		dropRoleMembersNotInSource: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		dropPermissionsNotInSource: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		dropObjectsNotInSource: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreColumnOrder: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		doNotDropObjectTypes: { value: [], description: sampleDesc, propertyName: sampleName, optiontype },
		excludeObjectTypes: { value: [], description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreTablePartitionOptions: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		doNotEvaluateSqlCmdVariables: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		disableParallelismForEnablingIndexes: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		disableIndexesForDataPhase: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		restoreSequenceCurrentValue: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		rebuildIndexesOfflineForDataPhase: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		isAlwaysEncryptedParameterizationEnabled: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		preserveIdentityLastValues: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		allowExternalLibraryPaths: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		allowExternalLanguagePaths: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		hashObjectNamesInLogs: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		doNotDropWorkloadClassifiers: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreWorkloadClassifiers: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreSensitivityClassifications: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		ignoreDatabaseWorkloadGroups: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		doNotDropDatabaseWorkloadGroups: { value: false, description: sampleDesc, propertyName: sampleName, optiontype },
		optionsMapTable: new Map<string, mssql.DacDeployOptionPropertyBoolean>([
			['Sample Display Name Option1', { value: false, description: sampleDesc, propertyName: sampleName }],
			['Sample Display Name Option2', { value: false, description: sampleDesc, propertyName: sampleName }]
		]),
		includeObjects: new Map<string, number>([
			['Sample Include Object Type1', 0],
			['Sample Include Object Type2', 2]
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
