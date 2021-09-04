/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode-mssql' {
    /**
     * Covers defining what the vscode-mssql extension exports to other extensions
     *
     * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
     * (const enums get evaluated when typescript -> javascript so those are fine)
     */


    export const enum extension {
        name = 'ms-mssql.mssql'
    }

    /**
    * The APIs provided by Mssql extension
    */
    export interface IExtension {

        readonly dacFx: IDacFxService;
    }

    export const enum ExtractTarget {
        dacpac = 0,
        file = 1,
        flat = 2,
        objectType = 3,
        schema = 4,
        schemaObjectType = 5
    }

    export interface IDacFxService {
        exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
        importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
        extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
        createProjectFromDatabase(databaseName: string, targetFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, extractTarget: ExtractTarget, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
        deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
        generateDeployScript(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
        generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<GenerateDeployPlanResult>;
        getOptionsFromProfile(profilePath: string): Thenable<DacFxOptionsResult>;
        validateStreamingJob(packageFilePath: string, createStreamingJobTsql: string): Thenable<ValidateStreamingJobResult>;
    }

    export const enum TaskExecutionMode {
        execute = 0,
        script = 1,
        executeAndScript = 2
    }

    export interface DeploymentOptions {
        ignoreTableOptions: boolean;
        ignoreSemicolonBetweenStatements: boolean;
        ignoreRouteLifetime: boolean;
        ignoreRoleMembership: boolean;
        ignoreQuotedIdentifiers: boolean;
        ignorePermissions: boolean;
        ignorePartitionSchemes: boolean;
        ignoreObjectPlacementOnPartitionScheme: boolean;
        ignoreNotForReplication: boolean;
        ignoreLoginSids: boolean;
        ignoreLockHintsOnIndexes: boolean;
        ignoreKeywordCasing: boolean;
        ignoreIndexPadding: boolean;
        ignoreIndexOptions: boolean;
        ignoreIncrement: boolean;
        ignoreIdentitySeed: boolean;
        ignoreUserSettingsObjects: boolean;
        ignoreFullTextCatalogFilePath: boolean;
        ignoreWhitespace: boolean;
        ignoreWithNocheckOnForeignKeys: boolean;
        verifyCollationCompatibility: boolean;
        unmodifiableObjectWarnings: boolean;
        treatVerificationErrorsAsWarnings: boolean;
        scriptRefreshModule: boolean;
        scriptNewConstraintValidation: boolean;
        scriptFileSize: boolean;
        scriptDeployStateChecks: boolean;
        scriptDatabaseOptions: boolean;
        scriptDatabaseCompatibility: boolean;
        scriptDatabaseCollation: boolean;
        runDeploymentPlanExecutors: boolean;
        registerDataTierApplication: boolean;
        populateFilesOnFileGroups: boolean;
        noAlterStatementsToChangeClrTypes: boolean;
        includeTransactionalScripts: boolean;
        includeCompositeObjects: boolean;
        allowUnsafeRowLevelSecurityDataMovement: boolean;
        ignoreWithNocheckOnCheckConstraints: boolean;
        ignoreFillFactor: boolean;
        ignoreFileSize: boolean;
        ignoreFilegroupPlacement: boolean;
        doNotAlterReplicatedObjects: boolean;
        doNotAlterChangeDataCaptureObjects: boolean;
        disableAndReenableDdlTriggers: boolean;
        deployDatabaseInSingleUserMode: boolean;
        createNewDatabase: boolean;
        compareUsingTargetCollation: boolean;
        commentOutSetVarDeclarations: boolean;
        blockWhenDriftDetected: boolean;
        blockOnPossibleDataLoss: boolean;
        backupDatabaseBeforeChanges: boolean;
        allowIncompatiblePlatform: boolean;
        allowDropBlockingAssemblies: boolean;
        dropConstraintsNotInSource: boolean;
        dropDmlTriggersNotInSource: boolean;
        dropExtendedPropertiesNotInSource: boolean;
        dropIndexesNotInSource: boolean;
        ignoreFileAndLogFilePath: boolean;
        ignoreExtendedProperties: boolean;
        ignoreDmlTriggerState: boolean;
        ignoreDmlTriggerOrder: boolean;
        ignoreDefaultSchema: boolean;
        ignoreDdlTriggerState: boolean;
        ignoreDdlTriggerOrder: boolean;
        ignoreCryptographicProviderFilePath: boolean;
        verifyDeployment: boolean;
        ignoreComments: boolean;
        ignoreColumnCollation: boolean;
        ignoreAuthorizer: boolean;
        ignoreAnsiNulls: boolean;
        generateSmartDefaults: boolean;
        dropStatisticsNotInSource: boolean;
        dropRoleMembersNotInSource: boolean;
        dropPermissionsNotInSource: boolean;
        dropObjectsNotInSource: boolean;
        ignoreColumnOrder: boolean;
        doNotDropObjectTypes: SchemaObjectType[];
        excludeObjectTypes: SchemaObjectType[];
    }

    /**
     * Values from <DacFx>\Product\Source\DeploymentApi\ObjectTypes.cs
     */
    export const enum SchemaObjectType {
        Aggregates = 0,
        ApplicationRoles = 1,
        Assemblies = 2,
        AssemblyFiles = 3,
        AsymmetricKeys = 4,
        BrokerPriorities = 5,
        Certificates = 6,
        ColumnEncryptionKeys = 7,
        ColumnMasterKeys = 8,
        Contracts = 9,
        DatabaseOptions = 10,
        DatabaseRoles = 11,
        DatabaseTriggers = 12,
        Defaults = 13,
        ExtendedProperties = 14,
        ExternalDataSources = 15,
        ExternalFileFormats = 16,
        ExternalTables = 17,
        Filegroups = 18,
        Files = 19,
        FileTables = 20,
        FullTextCatalogs = 21,
        FullTextStoplists = 22,
        MessageTypes = 23,
        PartitionFunctions = 24,
        PartitionSchemes = 25,
        Permissions = 26,
        Queues = 27,
        RemoteServiceBindings = 28,
        RoleMembership = 29,
        Rules = 30,
        ScalarValuedFunctions = 31,
        SearchPropertyLists = 32,
        SecurityPolicies = 33,
        Sequences = 34,
        Services = 35,
        Signatures = 36,
        StoredProcedures = 37,
        SymmetricKeys = 38,
        Synonyms = 39,
        Tables = 40,
        TableValuedFunctions = 41,
        UserDefinedDataTypes = 42,
        UserDefinedTableTypes = 43,
        ClrUserDefinedTypes = 44,
        Users = 45,
        Views = 46,
        XmlSchemaCollections = 47,
        Audits = 48,
        Credentials = 49,
        CryptographicProviders = 50,
        DatabaseAuditSpecifications = 51,
        DatabaseEncryptionKeys = 52,
        DatabaseScopedCredentials = 53,
        Endpoints = 54,
        ErrorMessages = 55,
        EventNotifications = 56,
        EventSessions = 57,
        LinkedServerLogins = 58,
        LinkedServers = 59,
        Logins = 60,
        MasterKeys = 61,
        Routes = 62,
        ServerAuditSpecifications = 63,
        ServerRoleMembership = 64,
        ServerRoles = 65,
        ServerTriggers = 66,
        ExternalStreams = 67,
        ExternalStreamingJobs = 68
    }

    /**
     * ResultStatus from d.ts
     */
    export interface ResultStatus {
        success: boolean;
        errorMessage: string;
    }

    export interface DacFxResult extends ResultStatus {
        operationId: string;
    }

    export interface GenerateDeployPlanResult extends DacFxResult {
        report: string;
    }

    export interface DacFxOptionsResult extends ResultStatus {
        deploymentOptions: DeploymentOptions;
    }

    export interface ValidateStreamingJobResult extends ResultStatus { }

    export interface ExportParams {
        databaseName: string;
        packageFilePath: string;
        ownerUri: string;
        taskExecutionMode: TaskExecutionMode;
    }

    export interface ImportParams {
        packageFilePath: string;
        databaseName: string;
        ownerUri: string;
        taskExecutionMode: TaskExecutionMode;
    }

    export interface ExtractParams {
        databaseName: string;
        packageFilePath: string;
        applicationName: string;
        applicationVersion: string;
        ownerUri: string;
        extractTarget?: ExtractTarget;
        taskExecutionMode: TaskExecutionMode;
    }

    export interface DeployParams {
        packageFilePath: string;
        databaseName: string;
        upgradeExisting: boolean;
        sqlCommandVariableValues?: Record<string, string>;
        deploymentOptions?: DeploymentOptions;
        ownerUri: string;
        taskExecutionMode: TaskExecutionMode;
    }

    export interface GenerateDeployScriptParams {
        packageFilePath: string;
        databaseName: string;
        sqlCommandVariableValues?: Record<string, string>;
        deploymentOptions?: DeploymentOptions;
        ownerUri: string;
        taskExecutionMode: TaskExecutionMode;
    }

    export interface GenerateDeployPlanParams {
        packageFilePath: string;
        databaseName: string;
        ownerUri: string;
        taskExecutionMode: TaskExecutionMode;
    }

    export interface GetOptionsFromProfileParams {
        profilePath: string;
    }

    export interface ValidateStreamingJobParams {
        packageFilePath: string;
        createStreamingJobTsql: string;
    }

}
