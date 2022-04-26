/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as loc from '../localizedConstants';
import * as mssql from 'mssql';
import { isNullOrUndefined } from 'util';

export class SchemaCompareOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;
	public excludedObjectTypes: mssql.SchemaObjectType[] = [];
	public optionsMapTable: Record<string, mssql.DacDeployOptionPropertyBoolean> = {};

	public optionsLookup = {};
	public objectsLookup = {};

	//#region Schema Compare Deployment Options
	/*
	* Initialize the options mapping table
	* This will map the key:Option_DisplayName to the value:DacFx_OptionsValue
	*/
	public InitializeUpdateOptionsMapTable() {
		this.optionsMapTable[this.deploymentOptions.ignoreTableOptions.displayName] = this.deploymentOptions.ignoreTableOptions;
		this.optionsMapTable[this.deploymentOptions.ignoreSemicolonBetweenStatements.displayName] = this.deploymentOptions.ignoreSemicolonBetweenStatements;
		this.optionsMapTable[this.deploymentOptions.ignoreRouteLifetime.displayName] = this.deploymentOptions.ignoreRouteLifetime;
		this.optionsMapTable[this.deploymentOptions.ignoreRoleMembership.displayName] = this.deploymentOptions.ignoreRoleMembership;
		this.optionsMapTable[this.deploymentOptions.ignoreQuotedIdentifiers.displayName] = this.deploymentOptions.ignoreQuotedIdentifiers;
		this.optionsMapTable[this.deploymentOptions.ignorePermissions.displayName] = this.deploymentOptions.ignorePermissions;
		this.optionsMapTable[this.deploymentOptions.ignorePartitionSchemes.displayName] = this.deploymentOptions.ignorePartitionSchemes;
		this.optionsMapTable[this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme.displayName] = this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme;
		this.optionsMapTable[this.deploymentOptions.ignoreNotForReplication.displayName] = this.deploymentOptions.ignoreNotForReplication;
		this.optionsMapTable[this.deploymentOptions.ignoreLoginSids.displayName] = this.deploymentOptions.ignoreLoginSids;
		this.optionsMapTable[this.deploymentOptions.ignoreLockHintsOnIndexes.displayName] = this.deploymentOptions.ignoreLockHintsOnIndexes;
		this.optionsMapTable[this.deploymentOptions.ignoreKeywordCasing.displayName] = this.deploymentOptions.ignoreKeywordCasing;
		this.optionsMapTable[this.deploymentOptions.ignoreIndexPadding.displayName] = this.deploymentOptions.ignoreIndexPadding;
		this.optionsMapTable[this.deploymentOptions.ignoreIndexOptions.displayName] = this.deploymentOptions.ignoreIndexOptions;
		this.optionsMapTable[this.deploymentOptions.ignoreIncrement.displayName] = this.deploymentOptions.ignoreIncrement;
		this.optionsMapTable[this.deploymentOptions.ignoreIdentitySeed.displayName] = this.deploymentOptions.ignoreIdentitySeed;
		this.optionsMapTable[this.deploymentOptions.ignoreUserSettingsObjects.displayName] = this.deploymentOptions.ignoreUserSettingsObjects;
		this.optionsMapTable[this.deploymentOptions.ignoreFullTextCatalogFilePath.displayName] = this.deploymentOptions.ignoreFullTextCatalogFilePath;
		this.optionsMapTable[this.deploymentOptions.ignoreWhitespace.displayName] = this.deploymentOptions.ignoreWhitespace;
		this.optionsMapTable[this.deploymentOptions.ignoreWithNocheckOnForeignKeys.displayName] = this.deploymentOptions.ignoreWithNocheckOnForeignKeys;
		this.optionsMapTable[this.deploymentOptions.verifyCollationCompatibility.displayName] = this.deploymentOptions.verifyCollationCompatibility;
		this.optionsMapTable[this.deploymentOptions.unmodifiableObjectWarnings.displayName] = this.deploymentOptions.unmodifiableObjectWarnings;
		this.optionsMapTable[this.deploymentOptions.treatVerificationErrorsAsWarnings.displayName] = this.deploymentOptions.treatVerificationErrorsAsWarnings;
		this.optionsMapTable[this.deploymentOptions.scriptRefreshModule.displayName] = this.deploymentOptions.scriptRefreshModule;
		this.optionsMapTable[this.deploymentOptions.scriptNewConstraintValidation.displayName] = this.deploymentOptions.scriptNewConstraintValidation;
		this.optionsMapTable[this.deploymentOptions.scriptFileSize.displayName] = this.deploymentOptions.scriptFileSize;
		this.optionsMapTable[this.deploymentOptions.scriptDeployStateChecks.displayName] = this.deploymentOptions.scriptDeployStateChecks;
		this.optionsMapTable[this.deploymentOptions.scriptDatabaseOptions.displayName] = this.deploymentOptions.scriptDatabaseOptions;
		this.optionsMapTable[this.deploymentOptions.scriptDatabaseCompatibility.displayName] = this.deploymentOptions.scriptDatabaseCompatibility;
		this.optionsMapTable[this.deploymentOptions.scriptDatabaseCollation.displayName] = this.deploymentOptions.scriptDatabaseCollation;
		this.optionsMapTable[this.deploymentOptions.runDeploymentPlanExecutors.displayName] = this.deploymentOptions.runDeploymentPlanExecutors;
		this.optionsMapTable[this.deploymentOptions.registerDataTierApplication.displayName] = this.deploymentOptions.registerDataTierApplication;
		this.optionsMapTable[this.deploymentOptions.populateFilesOnFileGroups.displayName] = this.deploymentOptions.populateFilesOnFileGroups;
		this.optionsMapTable[this.deploymentOptions.noAlterStatementsToChangeClrTypes.displayName] = this.deploymentOptions.noAlterStatementsToChangeClrTypes;
		this.optionsMapTable[this.deploymentOptions.includeTransactionalScripts.displayName] = this.deploymentOptions.includeTransactionalScripts;
		this.optionsMapTable[this.deploymentOptions.includeCompositeObjects.displayName] = this.deploymentOptions.includeCompositeObjects;
		this.optionsMapTable[this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement.displayName] = this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement;
		this.optionsMapTable[this.deploymentOptions.ignoreWithNocheckOnCheckConstraints.displayName] = this.deploymentOptions.ignoreWithNocheckOnCheckConstraints;
		this.optionsMapTable[this.deploymentOptions.ignoreFillFactor.displayName] = this.deploymentOptions.ignoreFillFactor;
		this.optionsMapTable[this.deploymentOptions.ignoreFileSize.displayName] = this.deploymentOptions.ignoreFileSize;
		this.optionsMapTable[this.deploymentOptions.ignoreFilegroupPlacement.displayName] = this.deploymentOptions.ignoreFilegroupPlacement;
		this.optionsMapTable[this.deploymentOptions.doNotAlterReplicatedObjects.displayName] = this.deploymentOptions.doNotAlterReplicatedObjects;
		this.optionsMapTable[this.deploymentOptions.doNotAlterChangeDataCaptureObjects.displayName] = this.deploymentOptions.doNotAlterChangeDataCaptureObjects;
		this.optionsMapTable[this.deploymentOptions.disableAndReenableDdlTriggers.displayName] = this.deploymentOptions.disableAndReenableDdlTriggers;
		this.optionsMapTable[this.deploymentOptions.deployDatabaseInSingleUserMode.displayName] = this.deploymentOptions.deployDatabaseInSingleUserMode;
		this.optionsMapTable[this.deploymentOptions.createNewDatabase.displayName] = this.deploymentOptions.createNewDatabase;
		this.optionsMapTable[this.deploymentOptions.compareUsingTargetCollation.displayName] = this.deploymentOptions.compareUsingTargetCollation;
		this.optionsMapTable[this.deploymentOptions.commentOutSetVarDeclarations.displayName] = this.deploymentOptions.commentOutSetVarDeclarations;
		this.optionsMapTable[this.deploymentOptions.blockWhenDriftDetected.displayName] = this.deploymentOptions.blockWhenDriftDetected;
		this.optionsMapTable[this.deploymentOptions.blockOnPossibleDataLoss.displayName] = this.deploymentOptions.blockOnPossibleDataLoss;
		this.optionsMapTable[this.deploymentOptions.backupDatabaseBeforeChanges.displayName] = this.deploymentOptions.backupDatabaseBeforeChanges;
		this.optionsMapTable[this.deploymentOptions.allowIncompatiblePlatform.displayName] = this.deploymentOptions.allowIncompatiblePlatform;
		this.optionsMapTable[this.deploymentOptions.allowDropBlockingAssemblies.displayName] = this.deploymentOptions.allowDropBlockingAssemblies;
		this.optionsMapTable[this.deploymentOptions.dropConstraintsNotInSource.displayName] = this.deploymentOptions.dropConstraintsNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropDmlTriggersNotInSource.displayName] = this.deploymentOptions.dropDmlTriggersNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropExtendedPropertiesNotInSource.displayName] = this.deploymentOptions.dropExtendedPropertiesNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropIndexesNotInSource.displayName] = this.deploymentOptions.dropIndexesNotInSource;
		this.optionsMapTable[this.deploymentOptions.ignoreFileAndLogFilePath.displayName] = this.deploymentOptions.ignoreFileAndLogFilePath;
		this.optionsMapTable[this.deploymentOptions.ignoreExtendedProperties.displayName] = this.deploymentOptions.ignoreExtendedProperties;
		this.optionsMapTable[this.deploymentOptions.ignoreDmlTriggerState.displayName] = this.deploymentOptions.ignoreDmlTriggerState;
		this.optionsMapTable[this.deploymentOptions.ignoreDmlTriggerOrder.displayName] = this.deploymentOptions.ignoreDmlTriggerOrder;
		this.optionsMapTable[this.deploymentOptions.ignoreDefaultSchema.displayName] = this.deploymentOptions.ignoreDefaultSchema;
		this.optionsMapTable[this.deploymentOptions.ignoreDdlTriggerState.displayName] = this.deploymentOptions.ignoreDdlTriggerState;
		this.optionsMapTable[this.deploymentOptions.ignoreDdlTriggerOrder.displayName] = this.deploymentOptions.ignoreDdlTriggerOrder;
		this.optionsMapTable[this.deploymentOptions.ignoreCryptographicProviderFilePath.displayName] = this.deploymentOptions.ignoreCryptographicProviderFilePath;
		this.optionsMapTable[this.deploymentOptions.verifyDeployment.displayName] = this.deploymentOptions.verifyDeployment;
		this.optionsMapTable[this.deploymentOptions.ignoreComments.displayName] = this.deploymentOptions.ignoreComments;
		this.optionsMapTable[this.deploymentOptions.ignoreColumnCollation.displayName] = this.deploymentOptions.ignoreColumnCollation;
		this.optionsMapTable[this.deploymentOptions.ignoreAuthorizer.displayName] = this.deploymentOptions.ignoreAuthorizer;
		this.optionsMapTable[this.deploymentOptions.ignoreAnsiNulls.displayName] = this.deploymentOptions.ignoreAnsiNulls;
		this.optionsMapTable[this.deploymentOptions.generateSmartDefaults.displayName] = this.deploymentOptions.generateSmartDefaults;
		this.optionsMapTable[this.deploymentOptions.dropStatisticsNotInSource.displayName] = this.deploymentOptions.dropStatisticsNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropRoleMembersNotInSource.displayName] = this.deploymentOptions.dropRoleMembersNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropPermissionsNotInSource.displayName] = this.deploymentOptions.dropPermissionsNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropObjectsNotInSource.displayName] = this.deploymentOptions.dropObjectsNotInSource;
		this.optionsMapTable[this.deploymentOptions.ignoreColumnOrder.displayName] = this.deploymentOptions.ignoreColumnOrder;
		this.optionsMapTable[this.deploymentOptions.ignoreTablePartitionOptions.displayName] = this.deploymentOptions.ignoreTablePartitionOptions;
		this.optionsMapTable[this.deploymentOptions.doNotEvaluateSqlCmdVariables.displayName] = this.deploymentOptions.doNotEvaluateSqlCmdVariables;
		this.optionsMapTable[this.deploymentOptions.disableParallelismForEnablingIndexes.displayName] = this.deploymentOptions.disableParallelismForEnablingIndexes;
		this.optionsMapTable[this.deploymentOptions.disableIndexesForDataPhase.displayName] = this.deploymentOptions.disableIndexesForDataPhase;
		this.optionsMapTable[this.deploymentOptions.restoreSequenceCurrentValue.displayName] = this.deploymentOptions.restoreSequenceCurrentValue;
		this.optionsMapTable[this.deploymentOptions.rebuildIndexesOfflineForDataPhase.displayName] = this.deploymentOptions.rebuildIndexesOfflineForDataPhase;
		this.optionsMapTable[this.deploymentOptions.preserveIdentityLastValues.displayName] = this.deploymentOptions.preserveIdentityLastValues;
		this.optionsMapTable[this.deploymentOptions.isAlwaysEncryptedParameterizationEnabled.displayName] = this.deploymentOptions.isAlwaysEncryptedParameterizationEnabled;
		this.optionsMapTable[this.deploymentOptions.allowExternalLibraryPaths.displayName] = this.deploymentOptions.allowExternalLibraryPaths;
		this.optionsMapTable[this.deploymentOptions.allowExternalLanguagePaths.displayName] = this.deploymentOptions.allowExternalLanguagePaths;
		this.optionsMapTable[this.deploymentOptions.hashObjectNamesInLogs.displayName] = this.deploymentOptions.hashObjectNamesInLogs;
		this.optionsMapTable[this.deploymentOptions.doNotDropWorkloadClassifiers.displayName] = this.deploymentOptions.doNotDropWorkloadClassifiers;
		this.optionsMapTable[this.deploymentOptions.ignoreWorkloadClassifiers.displayName] = this.deploymentOptions.ignoreWorkloadClassifiers;
		this.optionsMapTable[this.deploymentOptions.ignoreDatabaseWorkloadGroups.displayName] = this.deploymentOptions.ignoreDatabaseWorkloadGroups;
		this.optionsMapTable[this.deploymentOptions.doNotDropDatabaseWorkloadGroups.displayName] = this.deploymentOptions.doNotDropDatabaseWorkloadGroups;
	}

	public optionsLabels: string[] = [];
	public InitializeOptionsLabels() {
		this.optionsLabels = [this.deploymentOptions.ignoreTableOptions.displayName
			, this.deploymentOptions.ignoreSemicolonBetweenStatements.displayName
			, this.deploymentOptions.ignoreRouteLifetime.displayName
			, this.deploymentOptions.ignoreRoleMembership.displayName
			, this.deploymentOptions.ignoreQuotedIdentifiers.displayName
			, this.deploymentOptions.ignorePermissions.displayName
			, this.deploymentOptions.ignorePartitionSchemes.displayName
			, this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme.displayName
			, this.deploymentOptions.ignoreNotForReplication.displayName
			, this.deploymentOptions.ignoreLoginSids.displayName
			, this.deploymentOptions.ignoreLockHintsOnIndexes.displayName
			, this.deploymentOptions.ignoreKeywordCasing.displayName
			, this.deploymentOptions.ignoreIndexPadding.displayName
			, this.deploymentOptions.ignoreIndexOptions.displayName
			, this.deploymentOptions.ignoreIncrement.displayName
			, this.deploymentOptions.ignoreIdentitySeed.displayName
			, this.deploymentOptions.ignoreUserSettingsObjects.displayName
			, this.deploymentOptions.ignoreFullTextCatalogFilePath.displayName
			, this.deploymentOptions.ignoreWhitespace.displayName
			, this.deploymentOptions.ignoreWithNocheckOnForeignKeys.displayName
			, this.deploymentOptions.verifyCollationCompatibility.displayName
			, this.deploymentOptions.unmodifiableObjectWarnings.displayName
			, this.deploymentOptions.treatVerificationErrorsAsWarnings.displayName
			, this.deploymentOptions.scriptRefreshModule.displayName
			, this.deploymentOptions.scriptNewConstraintValidation.displayName
			, this.deploymentOptions.scriptFileSize.displayName
			, this.deploymentOptions.scriptDeployStateChecks.displayName
			, this.deploymentOptions.scriptDatabaseOptions.displayName
			, this.deploymentOptions.scriptDatabaseCompatibility.displayName
			, this.deploymentOptions.scriptDatabaseCollation.displayName
			, this.deploymentOptions.runDeploymentPlanExecutors.displayName
			, this.deploymentOptions.registerDataTierApplication.displayName
			, this.deploymentOptions.populateFilesOnFileGroups.displayName
			, this.deploymentOptions.noAlterStatementsToChangeClrTypes.displayName
			, this.deploymentOptions.includeTransactionalScripts.displayName
			, this.deploymentOptions.includeCompositeObjects.displayName
			, this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement.displayName
			, this.deploymentOptions.ignoreWithNocheckOnCheckConstraints.displayName
			, this.deploymentOptions.ignoreFillFactor.displayName
			, this.deploymentOptions.ignoreFileSize.displayName
			, this.deploymentOptions.ignoreFilegroupPlacement.displayName
			, this.deploymentOptions.doNotAlterReplicatedObjects.displayName
			, this.deploymentOptions.doNotAlterChangeDataCaptureObjects.displayName
			, this.deploymentOptions.disableAndReenableDdlTriggers.displayName
			, this.deploymentOptions.deployDatabaseInSingleUserMode.displayName
			, this.deploymentOptions.createNewDatabase.displayName
			, this.deploymentOptions.compareUsingTargetCollation.displayName
			, this.deploymentOptions.commentOutSetVarDeclarations.displayName
			, this.deploymentOptions.blockWhenDriftDetected.displayName
			, this.deploymentOptions.blockOnPossibleDataLoss.displayName
			, this.deploymentOptions.backupDatabaseBeforeChanges.displayName
			, this.deploymentOptions.allowIncompatiblePlatform.displayName
			, this.deploymentOptions.allowDropBlockingAssemblies.displayName
			, this.deploymentOptions.dropConstraintsNotInSource.displayName
			, this.deploymentOptions.dropDmlTriggersNotInSource.displayName
			, this.deploymentOptions.dropExtendedPropertiesNotInSource.displayName
			, this.deploymentOptions.dropIndexesNotInSource.displayName
			, this.deploymentOptions.ignoreFileAndLogFilePath.displayName
			, this.deploymentOptions.ignoreExtendedProperties.displayName
			, this.deploymentOptions.ignoreDmlTriggerState.displayName
			, this.deploymentOptions.ignoreDmlTriggerOrder.displayName
			, this.deploymentOptions.ignoreDefaultSchema.displayName
			, this.deploymentOptions.ignoreDdlTriggerState.displayName
			, this.deploymentOptions.ignoreDdlTriggerOrder.displayName
			, this.deploymentOptions.ignoreCryptographicProviderFilePath.displayName
			, this.deploymentOptions.verifyDeployment.displayName
			, this.deploymentOptions.ignoreComments.displayName
			, this.deploymentOptions.ignoreColumnCollation.displayName
			, this.deploymentOptions.ignoreAuthorizer.displayName
			, this.deploymentOptions.ignoreAnsiNulls.displayName
			, this.deploymentOptions.generateSmartDefaults.displayName
			, this.deploymentOptions.dropStatisticsNotInSource.displayName
			, this.deploymentOptions.dropRoleMembersNotInSource.displayName
			, this.deploymentOptions.dropPermissionsNotInSource.displayName
			, this.deploymentOptions.dropObjectsNotInSource.displayName
			, this.deploymentOptions.ignoreColumnOrder.displayName
			, this.deploymentOptions.ignoreTablePartitionOptions.displayName
			, this.deploymentOptions.doNotEvaluateSqlCmdVariables.displayName
			, this.deploymentOptions.disableParallelismForEnablingIndexes.displayName
			, this.deploymentOptions.disableIndexesForDataPhase.displayName
			, this.deploymentOptions.restoreSequenceCurrentValue.displayName
			, this.deploymentOptions.rebuildIndexesOfflineForDataPhase.displayName
			, this.deploymentOptions.preserveIdentityLastValues.displayName
			, this.deploymentOptions.isAlwaysEncryptedParameterizationEnabled.displayName
			, this.deploymentOptions.allowExternalLibraryPaths.displayName
			, this.deploymentOptions.allowExternalLanguagePaths.displayName
			, this.deploymentOptions.hashObjectNamesInLogs.displayName
			, this.deploymentOptions.doNotDropWorkloadClassifiers.displayName
			, this.deploymentOptions.ignoreWorkloadClassifiers.displayName
			, this.deploymentOptions.ignoreDatabaseWorkloadGroups.displayName
			, this.deploymentOptions.doNotDropDatabaseWorkloadGroups.displayName].sort();
	}

	public getOptionsData(): string[][] {
		let data = [];
		this.optionsLookup = {};
		this.optionsLabels.forEach(l => {
			let checked: boolean = this.getSchemaCompareOptionUtil(l);
			data.push([checked, l]);
			this.optionsLookup[l] = checked;
		});
		return data;
	}
	//#endregion

	//#region Schema Compare Objects
	public objectTypeLabels: string[] = [
		loc.Aggregates,
		loc.ApplicationRoles,
		loc.Assemblies,
		loc.AssemblyFiles,
		loc.AsymmetricKeys,
		loc.BrokerPriorities,
		loc.Certificates,
		loc.ColumnEncryptionKeys,
		loc.ColumnMasterKeys,
		loc.Contracts,
		loc.DatabaseOptions,
		loc.DatabaseRoles,
		loc.DatabaseTriggers,
		loc.Defaults,
		loc.ExtendedProperties,
		loc.ExternalDataSources,
		loc.ExternalFileFormats,
		loc.ExternalStreams,
		loc.ExternalStreamingJobs,
		loc.ExternalTables,
		loc.Filegroups,
		loc.Files,
		loc.FileTables,
		loc.FullTextCatalogs,
		loc.FullTextStoplists,
		loc.MessageTypes,
		loc.PartitionFunctions,
		loc.PartitionSchemes,
		loc.Permissions,
		loc.Queues,
		loc.RemoteServiceBindings,
		loc.RoleMembership,
		loc.Rules,
		loc.ScalarValuedFunctions,
		loc.SearchPropertyLists,
		loc.SecurityPolicies,
		loc.Sequences,
		loc.Services,
		loc.Signatures,
		loc.StoredProcedures,
		loc.SymmetricKeys,
		loc.Synonyms,
		loc.Tables,
		loc.TableValuedFunctions,
		loc.UserDefinedDataTypes,
		loc.UserDefinedTableTypes,
		loc.ClrUserDefinedTypes,
		loc.Users,
		loc.Views,
		loc.XmlSchemaCollections,
		loc.Audits,
		loc.Credentials,
		loc.CryptographicProviders,
		loc.DatabaseAuditSpecifications,
		loc.DatabaseEncryptionKeys,
		loc.DatabaseScopedCredentials,
		loc.Endpoints,
		loc.ErrorMessages,
		loc.EventNotifications,
		loc.EventSessions,
		loc.LinkedServerLogins,
		loc.LinkedServers,
		loc.Logins,
		loc.MasterKeys,
		loc.Routes,
		loc.ServerAuditSpecifications,
		loc.ServerRoleMembership,
		loc.ServerRoles,
		loc.ServerTriggers
	].sort();

	public getObjectsData(): string[][] {
		let data = [];
		this.objectsLookup = {};
		this.objectTypeLabels.forEach(l => {
			let checked: boolean = this.getSchemaCompareIncludedObjectsUtil(l);
			data.push([checked, l]);
			this.objectsLookup[l] = checked;
		});
		return data;
	}
	//#endregion

	constructor(defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = defaultOptions;
		this.InitializeUpdateOptionsMapTable();
		this.InitializeOptionsLabels();
	}

	public setDeploymentOptions() {
		for (let option in this.optionsLookup) {
			this.setSchemaCompareOptionUtil(option, this.optionsLookup[option]);
		}
	}

	public setSchemaCompareOptionUtil(label: string, value: boolean) {
		return this.optionsMapTable[label].value = value;
	}

	public getSchemaCompareOptionUtil(label): boolean {
		return this.optionsMapTable[label]?.value;
	}

	public setObjectTypeOptions() {
		for (let option in this.objectsLookup) {
			this.setSchemaCompareIncludedObjectsUtil(option, this.objectsLookup[option]);
		}
		this.deploymentOptions.excludeObjectTypes.value = this.excludedObjectTypes;
	}

	public getSchemaCompareIncludedObjectsUtil(label): boolean {
		switch (label) {
			case loc.Aggregates:
				return !isNullOrUndefined(this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Aggregates)) ? false : true;
			case loc.ApplicationRoles:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ApplicationRoles)) ? false : true;
			case loc.Assemblies:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Assemblies)) ? false : true;
			case loc.AssemblyFiles:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.AssemblyFiles)) ? false : true;
			case loc.AsymmetricKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.AsymmetricKeys)) ? false : true;
			case loc.BrokerPriorities:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.BrokerPriorities)) ? false : true;
			case loc.Certificates:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Certificates)) ? false : true;
			case loc.ColumnEncryptionKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ColumnEncryptionKeys)) ? false : true;
			case loc.ColumnMasterKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ColumnMasterKeys)) ? false : true;
			case loc.Contracts:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Contracts)) ? false : true;
			case loc.DatabaseOptions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseOptions)) ? false : true;
			case loc.DatabaseRoles:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseRoles)) ? false : true;
			case loc.DatabaseTriggers:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseTriggers)) ? false : true;
			case loc.Defaults:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Defaults)) ? false : true;
			case loc.ExtendedProperties:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExtendedProperties)) ? false : true;
			case loc.ExternalDataSources:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExternalDataSources)) ? false : true;
			case loc.ExternalFileFormats:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExternalFileFormats)) ? false : true;
			case loc.ExternalStreams:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExternalStreams)) ? false : true;
			case loc.ExternalStreamingJobs:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExternalStreamingJobs)) ? false : true;
			case loc.ExternalTables:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExternalTables)) ? false : true;
			case loc.Filegroups:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Filegroups)) ? false : true;
			case loc.Files:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Files)) ? false : true;
			case loc.FileTables:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.FileTables)) ? false : true;
			case loc.FullTextCatalogs:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.FullTextCatalogs)) ? false : true;
			case loc.FullTextStoplists:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.FullTextStoplists)) ? false : true;
			case loc.MessageTypes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.MessageTypes)) ? false : true;
			case loc.PartitionFunctions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.PartitionFunctions)) ? false : true;
			case loc.PartitionSchemes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.PartitionSchemes)) ? false : true;
			case loc.Permissions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Permissions)) ? false : true;
			case loc.Queues:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Queues)) ? false : true;
			case loc.RemoteServiceBindings:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.RemoteServiceBindings)) ? false : true;
			case loc.RoleMembership:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.RoleMembership)) ? false : true;
			case loc.Rules:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Rules)) ? false : true;
			case loc.ScalarValuedFunctions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ScalarValuedFunctions)) ? false : true;
			case loc.SearchPropertyLists:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.SearchPropertyLists)) ? false : true;
			case loc.SecurityPolicies:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.SecurityPolicies)) ? false : true;
			case loc.Sequences:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Sequences)) ? false : true;
			case loc.Services:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Services)) ? false : true;
			case loc.Signatures:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Signatures)) ? false : true;
			case loc.StoredProcedures:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.StoredProcedures)) ? false : true;
			case loc.SymmetricKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.SymmetricKeys)) ? false : true;
			case loc.Synonyms:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Synonyms)) ? false : true;
			case loc.Tables:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Tables)) ? false : true;
			case loc.TableValuedFunctions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.TableValuedFunctions)) ? false : true;
			case loc.UserDefinedDataTypes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.UserDefinedDataTypes)) ? false : true;
			case loc.UserDefinedTableTypes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.UserDefinedTableTypes)) ? false : true;
			case loc.ClrUserDefinedTypes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ClrUserDefinedTypes)) ? false : true;
			case loc.Users:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Users)) ? false : true;
			case loc.Views:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Views)) ? false : true;
			case loc.XmlSchemaCollections:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.XmlSchemaCollections)) ? false : true;
			case loc.Audits:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Audits)) ? false : true;
			case loc.Credentials:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Credentials)) ? false : true;
			case loc.CryptographicProviders:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.CryptographicProviders)) ? false : true;
			case loc.DatabaseAuditSpecifications:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseAuditSpecifications)) ? false : true;
			case loc.DatabaseEncryptionKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseEncryptionKeys)) ? false : true;
			case loc.DatabaseScopedCredentials:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseScopedCredentials)) ? false : true;
			case loc.Endpoints:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Endpoints)) ? false : true;
			case loc.ErrorMessages:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ErrorMessages)) ? false : true;
			case loc.EventNotifications:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.EventNotifications)) ? false : true;
			case loc.EventSessions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.EventSessions)) ? false : true;
			case loc.LinkedServerLogins:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.LinkedServerLogins)) ? false : true;
			case loc.LinkedServers:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.LinkedServers)) ? false : true;
			case loc.Logins:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Logins)) ? false : true;
			case loc.MasterKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.MasterKeys)) ? false : true;
			case loc.Routes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Routes)) ? false : true;
			case loc.ServerAuditSpecifications:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ServerAuditSpecifications)) ? false : true;
			case loc.ServerRoleMembership:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ServerRoleMembership)) ? false : true;
			case loc.ServerRoles:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ServerRoles)) ? false : true;
			case loc.ServerTriggers:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ServerTriggers)) ? false : true;
		}
		return false;
	}

	public setSchemaCompareIncludedObjectsUtil(label: string, included: boolean) {
		switch (label) {
			case loc.Aggregates:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Aggregates);
				}
				return;
			case loc.ApplicationRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ApplicationRoles);
				}
				return;
			case loc.Assemblies:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Assemblies);
				}
				return;
			case loc.AssemblyFiles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.AssemblyFiles);
				}
				return;
			case loc.AsymmetricKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.AsymmetricKeys);
				}
				return;
			case loc.BrokerPriorities:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.BrokerPriorities);
				}
				return;
			case loc.Certificates:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Certificates);
				}
				return;
			case loc.ColumnEncryptionKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ColumnEncryptionKeys);
				}
				return;
			case loc.ColumnMasterKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ColumnMasterKeys);
				}
				return;
			case loc.Contracts:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Contracts);
				}
				return;
			case loc.DatabaseOptions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseOptions);
				}
				return;
			case loc.DatabaseRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseRoles);
				}
				return;
			case loc.DatabaseTriggers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseTriggers);
				}
				return;
			case loc.Defaults:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Defaults);
				}
				return;
			case loc.ExtendedProperties:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExtendedProperties);
				}
				return;
			case loc.ExternalDataSources:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalDataSources);
				}
				return;
			case loc.ExternalFileFormats:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalFileFormats);
				}
				return;
			case loc.ExternalStreams:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalStreams);
				}
				return;
			case loc.ExternalStreamingJobs:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalStreamingJobs);
				}
				return;
			case loc.ExternalTables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalTables);
				}
				return;
			case loc.Filegroups:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Filegroups);
				}
				return;
			case loc.Files:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Files);
				}
				return;
			case loc.FileTables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FileTables);
				}
				return;
			case loc.FullTextCatalogs:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FullTextCatalogs);
				}
				return;
			case loc.FullTextStoplists:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FullTextStoplists);
				}
				return;
			case loc.MessageTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.MessageTypes);
				}
				return;
			case loc.PartitionFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.PartitionFunctions);
				}
				return;
			case loc.PartitionSchemes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.PartitionSchemes);
				}
				return;
			case loc.Permissions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Permissions);
				}
				return;
			case loc.Queues:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Queues);
				}
				return;
			case loc.RemoteServiceBindings:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.RemoteServiceBindings);
				}
				return;
			case loc.RoleMembership:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.RoleMembership);
				}
				return;
			case loc.Rules:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Rules);
				}
				return;
			case loc.ScalarValuedFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ScalarValuedFunctions);
				}
				return;
			case loc.SearchPropertyLists:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SearchPropertyLists);
				}
				return;
			case loc.SecurityPolicies:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SecurityPolicies);
				}
				return;
			case loc.Sequences:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Sequences);
				}
				return;
			case loc.Services:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Services);
				}
				return;
			case loc.Signatures:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Signatures);
				}
				return;
			case loc.StoredProcedures:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.StoredProcedures);
				}
				return;
			case loc.SymmetricKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SymmetricKeys);
				}
				return;
			case loc.Synonyms:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Synonyms);
				}
				return;
			case loc.Tables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Tables);
				}
				return;
			case loc.TableValuedFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.TableValuedFunctions);
				}
				return;
			case loc.UserDefinedDataTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.UserDefinedDataTypes);
				}
				return;
			case loc.UserDefinedTableTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.UserDefinedTableTypes);
				}
				return;
			case loc.ClrUserDefinedTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ClrUserDefinedTypes);
				}
				return;
			case loc.Users:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Users);
				}
				return;
			case loc.Views:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Views);
				}
				return;
			case loc.XmlSchemaCollections:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.XmlSchemaCollections);
				}
				return;
			case loc.Audits:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Audits);
				}
				return;
			case loc.Credentials:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Credentials);
				}
				return;
			case loc.CryptographicProviders:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.CryptographicProviders);
				}
				return;
			case loc.DatabaseAuditSpecifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseAuditSpecifications);
				}
				return;
			case loc.DatabaseEncryptionKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseEncryptionKeys);
				}
				return;
			case loc.DatabaseScopedCredentials:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseScopedCredentials);
				}
				return;
			case loc.Endpoints:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Endpoints);
				}
				return;
			case loc.ErrorMessages:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ErrorMessages);
				}
				return;
			case loc.EventNotifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.EventNotifications);
				}
				return;
			case loc.EventSessions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.EventSessions);
				}
				return;
			case loc.LinkedServerLogins:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.LinkedServerLogins);
				}
				return;
			case loc.LinkedServers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.LinkedServers);
				}
				return;
			case loc.Logins:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Logins);
				}
				return;
			case loc.MasterKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.MasterKeys);
				}
				return;
			case loc.Routes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Routes);
				}
				return;
			case loc.ServerAuditSpecifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerAuditSpecifications);
				}
				return;
			case loc.ServerRoleMembership:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerRoleMembership);
				}
				return;
			case loc.ServerRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerRoles);
				}
				return;
			case loc.ServerTriggers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerTriggers);
				}
				return;
		}
	}

	public getDescription(label: string): string {
		return this.optionsMapTable[label]?.description;
	}
}
