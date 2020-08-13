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
export const generateScript = 'genenrate script';
export const generateDeployPlan = 'genenrate deploy plan';

export class DacFxTestService implements mssql.IDacFxService {
	dacfxResult: mssql.DacFxResult = {
		success: true,
		operationId: 'test',
		errorMessage: ''
	};
	constructor() {
	}

	exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = exportOperationId;
		return Promise.resolve(this.dacfxResult);
	}
	importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = importOperationId;
		return Promise.resolve(this.dacfxResult);
	}
	extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = extractOperationId;
		return Promise.resolve(this.dacfxResult);
	}
	importDatabaseProject(databaseName: string, targetFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, extractTarget: mssql.ExtractTarget, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = importOperationId;
		return Promise.resolve(this.dacfxResult);
	}
	deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = deployOperationId;
		return Promise.resolve(this.dacfxResult);
	}
	generateDeployScript(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = generateScript;
		return Promise.resolve(this.dacfxResult);
	}
	generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.GenerateDeployPlanResult> {
		this.dacfxResult.operationId = generateDeployPlan;
		const deployPlan: mssql.GenerateDeployPlanResult = {
			operationId: generateDeployPlan,
			success: true,
			errorMessage: '',
			report: generateDeployPlan
		};
		return Promise.resolve(deployPlan);
	}
	getOptionsFromProfile(profilePath: string): Thenable<mssql.DacFxOptionsResult> {
		const optionsResult: mssql.DacFxOptionsResult = {
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

		return Promise.resolve(optionsResult);
	}
}
