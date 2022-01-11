/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as mssql from '../../../../mssql/src/mssql';
import {SchemaCompareOptionsModel} from '../../models/schemaCompareOptionsModel';

describe('Schema Compare Options Model', () => {
	it('Should create model and set options successfully', function (): void {
		const model = new SchemaCompareOptionsModel(defaultOptions);
		should.notEqual(model.getOptionsData(), undefined, 'Options shouldn\'t be undefined');
		should.notEqual(model.getObjectsData(), undefined, 'Objects shouldn\'t be undefined');

		should.doesNotThrow(() => model.setDeploymentOptions());
		should.doesNotThrow(() => model.setObjectTypeOptions());

		should(model.getSchemaCompareOptionUtil('')).be.false('Should return false if an invalid option is passed in');
		should(model.getSchemaCompareIncludedObjectsUtil('')).be.false('Should return false if invalid object name is passed in');
	});

	it('Should exclude objects', function (): void {
		const model = new SchemaCompareOptionsModel(defaultOptions);
		should(model.excludedObjectTypes.length).be.equal(0, 'There should be no excluded objects');

		model.objectTypeLabels.forEach(l => {
			model.setSchemaCompareIncludedObjectsUtil(l, false);
		});

		should(model.excludedObjectTypes.length).be.equal(model.objectTypeLabels.length, 'All the object types should be excluded');
	});

	it('Should get descriptions', function (): void {
		const model = new SchemaCompareOptionsModel(defaultOptions);
		model.optionsLabels.forEach(l => {
			should(model.getDescription(l)).not.equal(undefined);
		});
	});
});

const sampleDesc = 'Sample Description text';
const defaultOptions: mssql.DeploymentOptions =  {
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
				excludeObjectTypes: { value: [mssql.SchemaObjectType.Tables], description: sampleDesc },
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
