/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from 'mssql';
import should = require('should');
import { AssertionError } from 'assert';

// Mock test data
export const mockIConnectionProfile: azdata.IConnectionProfile = {
	connectionName: 'My Connection',
	serverName: 'My Server',
	databaseName: 'My Database',
	userName: 'My User',
	password: 'My Pwd',
	authenticationType: 'SqlLogin',
	savePassword: false,
	groupFullName: 'My groupName',
	groupId: 'My GroupId',
	providerName: 'My Provider',
	saveProfile: true,
	id: 'My Id',
	options: null
};

export const mockConnectionResult: azdata.ConnectionResult = {
	connected: false,
	connectionId: undefined,
	errorMessage: 'Login failed for user \'sa\'',
	errorCode: 18456
};

export const mockConnectionInfo = {
	options: {},
	serverName: 'My Server',
	databaseName: 'My Database',
	userName: 'My User',
	password: 'My Pwd',
	authenticationType: 'SqlLogin'
};

export const mockFilePath: string = 'test.dacpac';

export const mockDacpacEndpoint: mssql.SchemaCompareEndpointInfo = {
	endpointType: mssql.SchemaCompareEndpointType.Dacpac,
	serverDisplayName: '',
	serverName: '',
	databaseName: '',
	ownerUri: '',
	packageFilePath: mockFilePath,
	connectionDetails: undefined,
	projectFilePath: '',
	folderStructure: '',
	targetScripts: [],
	dataSchemaProvider: '',
};

export const mockDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = {
	endpointType: mssql.SchemaCompareEndpointType.Database,
	serverDisplayName: '',
	serverName: '',
	databaseName: '',
	ownerUri: '',
	packageFilePath: '',
	connectionDetails: undefined,
	projectFilePath: '',
	folderStructure: '',
	targetScripts: [],
	dataSchemaProvider: '',
};

export async function shouldThrowSpecificError(block: Function, expectedMessage: string, details?: string) {
	let succeeded = false;
	try {
		await block();
		succeeded = true;
	}
	catch (err) {
		should(err.message).equal(expectedMessage);
	}

	if (succeeded) {
		throw new AssertionError({ message: `Operation succeeded, but expected failure with exception: "${expectedMessage}".${details ? '  ' + details : ''}` });
	}
}

export function setDacpacEndpointInfo(path: string): mssql.SchemaCompareEndpointInfo {
	let endpointInfo: mssql.SchemaCompareEndpointInfo;

	endpointInfo = { ...mockDacpacEndpoint };
	endpointInfo.packageFilePath = path;

	return endpointInfo;
}

export function setDatabaseEndpointInfo(): mssql.SchemaCompareEndpointInfo {
	let endpointInfo: mssql.SchemaCompareEndpointInfo;
	const serverName = 'My Server';
	const dbName = 'My Database';
	const serverDisplayName = 'My Connection';

	endpointInfo = { ...mockDatabaseEndpoint };
	endpointInfo.databaseName = dbName;
	endpointInfo.serverDisplayName = serverDisplayName;
	endpointInfo.serverName = serverName;

	return endpointInfo;
}

export function getDeploymentOptions(): mssql.DeploymentOptions {
	const sampleDesc = 'Sample Description text';
	const sampleName = 'Sample Display Name';
	return {
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
}
