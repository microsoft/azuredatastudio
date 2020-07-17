/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as mssql from '../../../../mssql/src/mssql';
import {SchemaCompareOptionsModel} from '../../models/schemaCompareOptionsModel';

describe('Schema Compare Options Dialog', () => {
	it('Should create model successfully ', async function (): Promise<void> {
		const model = new SchemaCompareOptionsModel(defaultOptions);
		should.notEqual(model.getOptionsData(), undefined);
		should.notEqual(model.getObjectsData(), undefined);
		should.doesNotThrow(() => model.SetDeploymentOptions());
		should.doesNotThrow(() => model.SetObjectTypeOptions());
	});

	it('Should exclude objects correctly', async function (): Promise<void> {
		const model = new SchemaCompareOptionsModel(defaultOptions);
		model.objectTypeLabels.forEach(l => {
			model.SetSchemaCompareIncludedObjectsUtil(l, false);
		});

	});

	it('Should get descriptions', async function (): Promise<void> {
		const model = new SchemaCompareOptionsModel(defaultOptions);
		model.optionsLabels.forEach(l => {
			should.notEqual(model.GetDescription(l), undefined);
		});
	});
});


const defaultOptions: mssql.DeploymentOptions =  {
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
	excludeObjectTypes: [mssql.SchemaObjectType.Tables]
};
