/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../mssql/src/mssql';

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
		const optionsResult: mssql.DacFxOptionsResult = {
			success: true,
			errorMessage: '',
			deploymentOptions: {
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
				doNotDropObjectTypes: { value: [], description: sampleDesc },
				excludeObjectTypes: { value: [], description: sampleDesc },
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
