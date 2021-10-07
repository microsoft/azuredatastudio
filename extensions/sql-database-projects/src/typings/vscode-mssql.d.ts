/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode-mssql' {

    import * as vscode from 'vscode';

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

        /**
         * Path to the root of the SQL Tools Service folder
         */
        readonly sqlToolsServicePath: string;

        /**
         * Service for accessing DacFx functionality
         */
        readonly dacFx: IDacFxService;

        /**
         * Service for accessing SchemaCompare functionality
         */
        readonly schemaCompare: ISchemaCompareService;

        /**
         * Service for accessing AzureFunctions functionality
         */
        readonly azureFunctions: IAzureFunctionsService;

        /**
         * Prompts the user to select an existing connection or create a new one, and then returns the result
         * @param ignoreFocusOut Whether the quickpick prompt ignores focus out (default false)
         */
        promptForConnection(ignoreFocusOut?: boolean): Promise<IConnectionInfo | undefined>;

        /**
         * Attempts to create a new connection for the given connection info. An error is thrown and displayed
         * to the user if an error occurs while connecting.
         * @param connectionInfo The connection info
         * @param saveConnection Save the connection profile if sets to true
         * @returns The URI associated with this connection
         */
        connect(connectionInfo: IConnectionInfo, saveConnection?: boolean): Promise<string>;

        /**
         * Lists the databases for a given connection. Must be given an already-opened connection to succeed.
         * @param connectionUri The URI of the connection to list the databases for.
         * @returns The list of database names
         */
        listDatabases(connectionUri: string): Promise<string[]>;

        /**
         * Gets the database name for the node - which is the database name of the connection for a server node, the database name
         * for nodes at or under a database node or a default value if it's neither of those.
         * @param node The node to get the database name of
         * @returns The database name
         */
        getDatabaseNameFromTreeNode(node: ITreeNodeInfo): string;

    }

    /**
     * Information about a database connection
     */
    export interface IConnectionInfo {
        /**
         * server name
         */
        server: string;

        /**
         * database name
         */
        database: string;

        /**
         * user name
         */
        user: string;

        /**
         * password
         */
        password: string;

        /**
         * email
         */
        email: string | undefined;

        /**
         * accountId
         */
        accountId: string | undefined;

        /**
         * The port number to connect to.
         */
        port: number;

        /**
         * Gets or sets the authentication to use.
         */
        authenticationType: string;

        /**
         * Gets or sets the azure account token to use.
         */
        azureAccountToken: string | undefined;

        /**
         * Gets or sets a Boolean value that indicates whether SQL Server uses SSL encryption for all data sent between the client and server if
         * the server has a certificate installed.
         */
        encrypt: boolean;

        /**
         * Gets or sets a value that indicates whether the channel will be encrypted while bypassing walking the certificate chain to validate trust.
         */
        trustServerCertificate: boolean | undefined;

        /**
         * Gets or sets a Boolean value that indicates if security-sensitive information, such as the password, is not returned as part of the connection
         * if the connection is open or has ever been in an open state.
         */
        persistSecurityInfo: boolean | undefined;

        /**
         * Gets or sets the length of time (in seconds) to wait for a connection to the server before terminating the attempt and generating an error.
         */
        connectTimeout: number | undefined;

        /**
         * The number of reconnections attempted after identifying that there was an idle connection failure.
         */
        connectRetryCount: number | undefined;

        /**
         * Amount of time (in seconds) between each reconnection attempt after identifying that there was an idle connection failure.
         */
        connectRetryInterval: number | undefined;

        /**
         * Gets or sets the name of the application associated with the connection string.
         */
        applicationName: string | undefined;

        /**
         * Gets or sets the name of the workstation connecting to SQL Server.
         */
        workstationId: string | undefined;

        /**
         * Declares the application workload type when connecting to a database in an SQL Server Availability Group.
         */
        applicationIntent: string | undefined;

        /**
         * Gets or sets the SQL Server Language record name.
         */
        currentLanguage: string | undefined;

        /**
         * Gets or sets a Boolean value that indicates whether the connection will be pooled or explicitly opened every time that the connection is requested.
         */
        pooling: boolean | undefined;

        /**
         * Gets or sets the maximum number of connections allowed in the connection pool for this specific connection string.
         */
        maxPoolSize: number | undefined;

        /**
         * Gets or sets the minimum number of connections allowed in the connection pool for this specific connection string.
         */
        minPoolSize: number | undefined;

        /**
         * Gets or sets the minimum time, in seconds, for the connection to live in the connection pool before being destroyed.
         */
        loadBalanceTimeout: number | undefined;

        /**
         * Gets or sets a Boolean value that indicates whether replication is supported using the connection.
         */
        replication: boolean | undefined;

        /**
         * Gets or sets a string that contains the name of the primary data file. This includes the full path name of an attachable database.
         */
        attachDbFilename: string | undefined;

        /**
         * Gets or sets the name or address of the partner server to connect to if the primary server is down.
         */
        failoverPartner: string | undefined;

        /**
         * If your application is connecting to an AlwaysOn availability group (AG) on different subnets, setting MultiSubnetFailover=true
         * provides faster detection of and connection to the (currently) active server.
         */
        multiSubnetFailover: boolean | undefined;

        /**
         * When true, an application can maintain multiple active result sets (MARS).
         */
        multipleActiveResultSets: boolean | undefined;

        /**
         * Gets or sets the size in bytes of the network packets used to communicate with an instance of SQL Server.
         */
        packetSize: number | undefined;

        /**
         * Gets or sets a string value that indicates the type system the application expects.
         */
        typeSystemVersion: string | undefined;

        /**
         * Gets or sets the connection string to use for this connection.
         */
        connectionString: string | undefined;
    }

    export const enum ExtractTarget {
        dacpac = 0,
        file = 1,
        flat = 2,
        objectType = 3,
        schema = 4,
        schemaObjectType = 5
    }

    export interface ISchemaCompareService {
        schemaCompareGetDefaultOptions(): Thenable<SchemaCompareOptionsResult>;
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

    export interface IAzureFunctionsService {
        /**
         * Adds a SQL Binding to a specified Azure function in a file
         * @param bindingType Type of SQL Binding
         * @param filePath Path of the file where the Azure Functions are
         * @param functionName Name of the function where the SQL Binding is to be added
         * @param objectName Name of Object for the SQL Query
         * @param connectionStringSetting Setting for the connection string
         */
        addSqlBinding(bindingType: BindingType, filePath: string, functionName: string, objectName: string, connectionStringSetting: string): Thenable<ResultStatus>;
        /**
         * Gets the names of the Azure functions in the file
         * @param filePath Path of the file to get the Azure functions
         * @returns array of names of Azure functions in the file
         */
        getAzureFunctions(filePath: string): Thenable<GetAzureFunctionsResult>;
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

    export interface SchemaCompareGetOptionsParams { }

    export interface SchemaCompareOptionsResult extends ResultStatus {
        defaultDeploymentOptions: DeploymentOptions;
    }

    export interface ITreeNodeInfo extends vscode.TreeItem {
        readonly connectionInfo: IConnectionInfo;
        nodeType: string;
        metadata: ObjectMetadata;
        parentNode: ITreeNodeInfo;
    }

    export const enum MetadataType {
        Table = 0,
        View = 1,
        SProc = 2,
        Function = 3
    }

    export interface ObjectMetadata {
        metadataType: MetadataType;

        metadataTypeName: string;

        urn: string;

        name: string;

        schema: string;
    }

    /**
     * Azure functions binding type
     */
    export const enum BindingType {
        input,
        output
    }

    /**
     * Parameters for adding a SQL binding to an Azure function
     */
     export interface AddSqlBindingParams {
        /**
         * Aboslute file path of file to add SQL binding
         */
        filePath: string;

        /**
         * Name of function to add SQL binding
         */
        functionName: string;

        /**
         * Name of object to use in SQL binding
         */
        objectName: string;

        /**
         * Type of Azure function binding
         */
        bindingType: BindingType;

        /**
         * Name of SQL connection string setting specified in local.settings.json
         */
        connectionStringSetting: string;
    }

    /**
     * Parameters for getting the names of the Azure functions in a file
     */
    export interface GetAzureFunctionsParams {
        /**
         * Absolute file path of file to get Azure functions
         */
        filePath: string;
    }

    /**
     * Result from a get Azure functions request
     */
    export interface GetAzureFunctionsResult extends ResultStatus {
        /**
         * Array of names of Azure functions in the file
         */
        azureFunctions: string[];
    }
}
