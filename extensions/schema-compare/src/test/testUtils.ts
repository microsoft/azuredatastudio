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

export const mockConnectionProfile: azdata.connection.ConnectionProfile = {
	providerId: 'My Provider',
	connectionId: 'My Id',
	connectionName: 'My Connection',
	serverName: 'My Server',
	databaseName: 'My Database',
	userName: 'My User',
	password: 'My Pwd',
	authenticationType: 'SqlLogin',
	savePassword: false,
	groupFullName: 'My groupName',
	groupId: 'My GroupId',
	saveProfile: true,
	options: {
		server: 'My Server',
		database: 'My Database',
		user: 'My User',
		password: 'My Pwd',
		authenticationType: 'SqlLogin'
	}
};

export const mockConnectionProfile2: azdata.connection.ConnectionProfile = {
	providerId: 'My Provider2',
	connectionId: 'My Id2',
	connectionName: 'My Connection2',
	serverName: 'My Server2',
	databaseName: 'My Database2',
	userName: 'My User2',
	password: 'My Pwd2',
	authenticationType: 'SqlLogin',
	savePassword: false,
	groupFullName: 'My groupName2',
	groupId: 'My GroupId2',
	saveProfile: true,
	options: {
		server: 'My Server2',
		database: 'My Database2',
		user: 'My User2',
		password: 'My Pwd2',
		authenticationType: 'SqlLogin'
	}
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
	};
}
