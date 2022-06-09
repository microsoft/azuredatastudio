/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from 'mssql';

export const deployOperationId = 'deploy dacpac';
export const extractOperationId = 'extract dacpac';
export const exportOperationId = 'export bacpac';
export const importOperationId = 'import bacpac';
export const generateScript = 'generate script';
export const generateDeployPlan = 'generate deploy plan';
export const validateStreamingJob = 'validate streaming job';

export class DacFxTestService implements mssql.IDacFxService {
	dacfxResult: mssql.DacFxResult = {
		success: true,
		operationId: 'test',
		errorMessage: ''
	};
	constructor() {
	}

	exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<mssql.DacFxResult> {
		this.dacfxResult.operationId = exportOperationId;
		return Promise.resolve(this.dacfxResult);
	}
	importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<mssql.DacFxResult> {
		this.dacfxResult.operationId = importOperationId;
		return Promise.resolve(this.dacfxResult);
	}
	extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<mssql.DacFxResult> {
		this.dacfxResult.operationId = extractOperationId;
		return Promise.resolve(this.dacfxResult);
	}
	createProjectFromDatabase(databaseName: string, targetFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, extractTarget: mssql.ExtractTarget, taskExecutionMode: azdata.TaskExecutionMode): Promise<mssql.DacFxResult> {
		this.dacfxResult.operationId = importOperationId;
		return Promise.resolve(this.dacfxResult);
	}
	deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>): Promise<mssql.DacFxResult> {
		this.dacfxResult.operationId = deployOperationId;
		return Promise.resolve(this.dacfxResult);
	}
	generateDeployScript(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>): Promise<mssql.DacFxResult> {
		this.dacfxResult.operationId = generateScript;
		return Promise.resolve(this.dacfxResult);
	}
	generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<mssql.GenerateDeployPlanResult> {
		this.dacfxResult.operationId = generateDeployPlan;
		const deployPlan: mssql.GenerateDeployPlanResult = {
			operationId: generateDeployPlan,
			success: true,
			errorMessage: '',
			report: generateDeployPlan
		};
		return Promise.resolve(deployPlan);
	}
	getOptionsFromProfile(profilePath: string): Promise<mssql.DacFxOptionsResult> {
		const sampleDesc = 'Sample Description text';
		const sampleName = 'Sample Display Name';
		const optionsResult: mssql.DacFxOptionsResult = {
			success: true,
			errorMessage: '',
			deploymentOptions: {
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
				ignoreDatabaseWorkloadGroups: { value: false, description: sampleDesc, propertyName: sampleName },
				ignoreSensitivityClassifications: { value: false, description: sampleDesc, propertyName: sampleName },
				doNotDropDatabaseWorkloadGroups: { value: false, description: sampleDesc, propertyName: sampleName },
				optionsMapTable: new Map<string, mssql.DacDeployOptionPropertyBoolean>([
					['Sample Display Name Option1', { value: false, description: sampleDesc, propertyName: sampleName }],
					['Sample Display Name Option2', { value: false, description: sampleDesc, propertyName: sampleName }]
				])
			}
		};

		return Promise.resolve(optionsResult);
	}
	validateStreamingJob(packageFilePath: string, createStreamingJobTsql: string): Promise<mssql.ValidateStreamingJobResult> {
		this.dacfxResult.operationId = validateStreamingJob;
		const streamingJobValidationResult: mssql.ValidateStreamingJobResult = {
			success: true,
			errorMessage: ''
		};
		return Promise.resolve(streamingJobValidationResult);
	}
}
