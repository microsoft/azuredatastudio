import * as data from 'data';
export interface CreateSessionResponse {
    sessionId: string;
}
export interface SessionCreatedParameters {
    success: boolean;
    sessionId: string;
    rootNode: NodeInfo;
    errorMessage: string;
}
export interface ExpandResponse {
    nodePath: string;
    sessionId: string;
    nodes: NodeInfo[];
    errorMessage: string;
}
export interface NodeInfo {
    nodePath: string;
    nodeType: string;
    nodeSubType: string;
    nodeStatus: string;
    label: string;
    isLeaf: boolean;
    metadata: data.ObjectMetadata;
    errorMessage: string;
}
export interface ExpandParams {
    sessionId: string;
    nodePath: string;
}
export interface CloseSessionParams {
    sessionId: string;
}
export interface CloseSessionResponse {
    success: boolean;
    sessionId: string;
}
export interface CategoryValue {
    displayName: string;
    name: string;
}
export interface ServiceOption {
    name: string;
    displayName: string;
    description: string;
    groupName: string;
    valueType: string;
    defaultValue: string;
    objectType: string;
    categoryValues: CategoryValue[];
    isRequired: boolean;
    isArray: boolean;
}
export interface ConnectionOption {
    name: string;
    displayName: string;
    description: string;
    groupName: string;
    valueType: string;
    defaultValue: string;
    objectType: string;
    categoryValues: CategoryValue[];
    specialValueType: string;
    isIdentity: boolean;
    isRequired: boolean;
    isArray: boolean;
}
export interface ConnectionProviderOptions {
    options: ConnectionOption[];
}
export interface AdminServicesProviderOptions {
    databaseInfoOptions: ServiceOption[];
    databaseFileInfoOptions: ServiceOption[];
    fileGroupInfoOptions: ServiceOption[];
}
export interface FeatureMetadataProvider {
    enabled: boolean;
    featureName: string;
    optionsMetadata: ServiceOption[];
}
/**
 * Parameters to initialize a connection to a database
 */
export interface ConnectionDetails {
    /**
     * connection options
     */
    options: {};
}
/**
 * Summary that identifies a unique database connection.
 */
export declare class ConnectionSummary {
    /**
     * server name
     */
    serverName: string;
    /**
     * database name
     */
    databaseName: string;
    /**
     * user name
     */
    userName: string;
}
/**
 * Connection response format.
 */
export declare class ConnectionCompleteParams {
    /**
     * URI identifying the owner of the connection
     */
    ownerUri: string;
    /**
     * connection id returned from service host.
     */
    connectionId: string;
    /**
     * any diagnostic messages return from the service host.
     */
    messages: string;
    /**
     * Error message returned from the engine, if any.
     */
    errorMessage: string;
    /**
     * Error number returned from the engine, if any.
     */
    errorNumber: number;
    /**
     * Information about the connected server.
     */
    serverInfo: ServerInfo;
    /**
     * information about the actual connection established
     */
    connectionSummary: ConnectionSummary;
}
/**
 * Update event parameters
 */
export declare class IntelliSenseReadyParams {
    /**
     * URI identifying the text document
     */
    ownerUri: string;
}
/**
 * Information about a SQL Server instance.
 */
export declare class ServerInfo {
    /**
     * The major version of the SQL Server instance.
     */
    serverMajorVersion: number;
    /**
     * The minor version of the SQL Server instance.
     */
    serverMinorVersion: number;
    /**
     * The build of the SQL Server instance.
     */
    serverReleaseVersion: number;
    /**
     * The ID of the engine edition of the SQL Server instance.
     */
    engineEditionId: number;
    /**
     * String containing the full server version text.
     */
    serverVersion: string;
    /**
     * String describing the product level of the server.
     */
    serverLevel: string;
    /**
     * The edition of the SQL Server instance.
     */
    serverEdition: string;
    /**
     * Whether the SQL Server instance is running in the cloud (Azure) or not.
     */
    isCloud: boolean;
    /**
     * The version of Azure that the SQL Server instance is running on, if applicable.
     */
    azureVersion: number;
    /**
     * The Operating System version string of the machine running the SQL Server instance.
     */
    osVersion: string;
}
export declare class CapabiltiesDiscoveryResult {
    capabilities: data.DataProtocolServerCapabilities;
}
export declare enum TaskStatus {
    notStarted = 0,
    inProgress = 1,
    succeeded = 2,
    succeededWithWarning = 3,
    failed = 4,
    canceled = 5,
}
export interface CreateDatabaseParams {
    ownerUri: string;
    databaseInfo: data.DatabaseInfo;
}
export interface DefaultDatabaseInfoParams {
    ownerUri: string;
}
export interface DefaultDatabaseInfoResponse {
    defaultDatabaseInfo: data.DatabaseInfo;
}
export interface GetDatabaseInfoResponse {
    databaseInfo: data.DatabaseInfo;
}
export interface GetDatabaseInfoParams {
    ownerUri: string;
}
export interface BackupConfigInfoResponse {
    backupConfigInfo: data.BackupConfigInfo;
}
export interface CreateLoginParams {
    ownerUri: string;
    loginInfo: data.LoginInfo;
}
export interface BackupInfo {
    ownerUri: string;
    databaseName: string;
    backupType: number;
    backupComponent: number;
    backupDeviceType: number;
    selectedFiles: string;
    backupsetName: string;
    selectedFileGroup: {
        [path: string]: string;
    };
    backupPathDevices: {
        [path: string]: number;
    };
    backupPathList: [string];
    isCopyOnly: boolean;
    formatMedia: boolean;
    initialize: boolean;
    skipTapeHeader: boolean;
    mediaName: string;
    mediaDescription: string;
    checksum: boolean;
    continueAfterError: boolean;
    logTruncation: boolean;
    tailLogBackup: boolean;
    retainDays: number;
    compressionOption: number;
    verifyBackupRequired: boolean;
    encryptionAlgorithm: number;
    encryptorType: number;
    encryptorName: string;
}
export interface BackupParams {
    ownerUri: string;
    backupInfo: BackupInfo;
    taskExecutionMode: data.TaskExecutionMode;
}
export interface RestoreParams {
    ownerUri: string;
    options: {};
    taskExecutionMode: data.TaskExecutionMode;
}
export interface RestoreConfigInfoRequestParams {
    ownerUri: string;
}
export interface RestoreConfigInfoResponse {
    configInfo: {
        [key: string]: any;
    };
}
export interface RestoreDatabaseFileInfo {
    fileType: string;
    logicalFileName: string;
    originalFileName: string;
    restoreAsFileName: string;
}
export interface FileBrowserOpenParams {
    ownerUri: string;
    expandPath: string;
    fileFilters: string[];
    changeFilter: boolean;
}
export interface FileTreeNode {
    children: FileTreeNode[];
    isExpanded: boolean;
    isFile: boolean;
    name: string;
    fullPath: string;
}
export interface FileTree {
    rootNode: FileTreeNode;
    selectedNode: FileTreeNode;
}
export interface FileBrowserExpandParams {
    ownerUri: string;
    expandPath: string;
}
export interface FileBrowserValidateParams {
    ownerUri: string;
    serviceType: string;
    selectedFiles: string[];
}
export interface FileBrowserCloseParams {
    ownerUri: string;
}
export interface DatabaseFileInfo {
    properties: LocalizedPropertyInfo[];
    id: string;
    isSelected: boolean;
}
export interface LocalizedPropertyInfo {
    propertyName: string;
    propertyValue: string;
    propertyDisplayName: string;
    propertyValueDisplayName: string;
}
export interface RestorePlanDetailInfo {
    name: string;
    currentValue: any;
    isReadOnly: boolean;
    isVisible: boolean;
    defaultValue: any;
}
export interface ResultSetSummary {
    id: number;
    batchId: number;
    rowCount: number;
    columnInfo: IDbColumn[];
}
export interface BatchSummary {
    hasError: boolean;
    id: number;
    selection: data.ISelectionData;
    resultSetSummaries: ResultSetSummary[];
    executionElapsed: string;
    executionEnd: string;
    executionStart: string;
}
export interface IDbColumn {
    allowDBNull?: boolean;
    baseCatalogName: string;
    baseColumnName: string;
    baseSchemaName: string;
    baseServerName: string;
    baseTableName: string;
    columnName: string;
    columnOrdinal?: number;
    columnSize?: number;
    isAliased?: boolean;
    isAutoIncrement?: boolean;
    isExpression?: boolean;
    isHidden?: boolean;
    isIdentity?: boolean;
    isKey?: boolean;
    isBytes?: boolean;
    isChars?: boolean;
    isSqlVariant?: boolean;
    isUdt?: boolean;
    dataType: string;
    isXml?: boolean;
    isJson?: boolean;
    isLong?: boolean;
    isReadOnly?: boolean;
    isUnique?: boolean;
    numericPrecision?: number;
    numericScale?: number;
    udtAssemblyQualifiedName: string;
    dataTypeName: string;
}
export interface IGridResultSet {
    columns: IDbColumn[];
    rowsUri: string;
    numberOfRows: number;
}
export interface IResultMessage {
    batchId?: number;
    isError: boolean;
    time: string;
    message: string;
}
export interface ExecutionPlanOptions {
    includeEstimatedExecutionPlanXml?: boolean;
    includeActualExecutionPlanXml?: boolean;
}
export interface QueryExecuteParams {
    ownerUri: string;
    querySelection: data.ISelectionData;
    executionPlanOptions?: ExecutionPlanOptions;
}
export declare enum EditRowState {
    clean = 0,
    dirtyInsert = 1,
    dirtyDelete = 2,
    dirtyUpdate = 3,
}
export interface EditRow {
    cells: data.DbCellValue[];
    id: number;
    isDirty: boolean;
    state: EditRowState;
}
export declare class MetadataQueryParams {
    /**
     * Owner URI of the connection that changed.
     */
    ownerUri: string;
}
/**
 * Used as value version of data.MetadataType THESE SHOULD MIRROR
 */
export declare enum MetadataType {
    Table = 0,
    View = 1,
    SProc = 2,
    Function = 3,
}
export declare class MetadataQueryResult {
    metadata: data.ObjectMetadata[];
}
export interface ScriptOptions {
    /**
     * Generate ANSI padding statements
     */
    scriptANSIPadding?: boolean;
    /**
     * Append the generated script to a file
     */
    appendToFile?: boolean;
    /**
     * Continue to script if an error occurs. Otherwise, stop.
     */
    continueScriptingOnError?: boolean;
    /**
     * Convert user-defined data types to base types.
     */
    convertUDDTToBaseType?: boolean;
    /**
     * Generate script for dependent objects for each object scripted.
     */
    generateScriptForDependentObjects?: boolean;
    /**
     * Include descriptive headers for each object generated.
     */
    includeDescriptiveHeaders?: boolean;
    /**
     * Check that an object with the given name exists before dropping or altering or that an object with the given name does not exist before creating.
     */
    includeIfNotExists?: boolean;
    /**
     * Script options to set vardecimal storage format.
     */
    includeVarDecimal?: boolean;
    /**
     * Include system generated constraint names to enforce declarative referential integrity.
     */
    scriptDRIIncludeSystemNames?: boolean;
    /**
     * Include statements in the script that are not supported on the specified SQL Server database engine type.
     */
    includeUnsupportedStatements?: boolean;
    /**
     * Prefix object names with the object schema.
     */
    schemaQualify?: boolean;
    /**
     * Script options to set bindings option.
     */
    bindings?: boolean;
    /**
     * Script the objects that use collation.
     */
    collation?: boolean;
    /**
     * Script the default values.
     */
    default?: boolean;
    /**
     * Script Object CREATE/DROP statements.
     */
    scriptCreateDrop: string;
    /**
     * Script the Extended Properties for each object scripted.
     */
    scriptExtendedProperties?: boolean;
    /**
     * Script only features compatible with the specified version of SQL Server.
     */
    scriptCompatibilityOption: string;
    /**
     * Script only features compatible with the specified SQL Server database engine type.
     */
    targetDatabaseEngineType: string;
    /**
     * Script only features compatible with the specified SQL Server database engine edition.
     */
    targetDatabaseEngineEdition: string;
    /**
     * Script all logins available on the server. Passwords will not be scripted.
     */
    scriptLogins?: boolean;
    /**
     * Generate object-level permissions.
     */
    scriptObjectLevelPermissions?: boolean;
    /**
     * Script owner for the objects.
     */
    scriptOwner?: boolean;
    /**
     * Script statistics, and optionally include histograms, for each selected table or view.
     */
    scriptStatistics: string;
    /**
     * Generate USE DATABASE statement.
     */
    scripUseDatabase?: boolean;
    /**
     * Generate script that contains schema only or schema and data.
     */
    typeOfDataToScript: string;
    /**
     * Scripts the change tracking information.
     */
    scriptChangeTracking?: boolean;
    /**
     * Script the check constraints for each table or view scripted.
     */
    scriptCheckConstraints?: boolean;
    /**
     * Scripts the data compression information.
     */
    scriptDataCompressionOptions?: boolean;
    /**
     * Script the foreign keys for each table scripted.
     */
    scriptForeignKeys?: boolean;
    /**
     * Script the full-text indexes for each table or indexed view scripted.
     */
    scriptFullTextIndexes?: boolean;
    /**
     * Script the indexes (including XML and clustered indexes) for each table or indexed view scripted.
     */
    scriptIndexes?: boolean;
    /**
     * Script the primary keys for each table or view scripted
     */
    scriptPrimaryKeys?: boolean;
    /**
     * Script the triggers for each table or view scripted
     */
    scriptTriggers?: boolean;
    /**
     * Script the unique keys for each table or view scripted.
     */
    uniqueKeys?: boolean;
}
export interface ScriptingObject {
    /**
     * The database object type
     */
    type: string;
    /**
     * The schema of the database object
     */
    schema: string;
    /**
     * The database object name
     */
    name: string;
}
export interface ScriptingParams {
    /**
     * File path used when writing out the script.
     */
    filePath: string;
    /**
     * Whether scripting to a single file or file per object.
     */
    scriptDestination: string;
    /**
     * Connection string of the target database the scripting operation will run against.
     */
    connectionString: string;
    /**
     * A list of scripting objects to script
     */
    scriptingObjects: ScriptingObject[];
    /**
     * A list of scripting object which specify the include criteria of objects to script.
     */
    includeObjectCriteria: ScriptingObject[];
    /**
     * A list of scripting object which specify the exclude criteria of objects to not script.
     */
    excludeObjectCriteria: ScriptingObject[];
    /**
     * A list of schema name of objects to script.
     */
    includeSchemas: string[];
    /**
     * A list of schema name of objects to not script.
     */
    excludeSchemas: string[];
    /**
     * A list of type name of objects to script.
     */
    includeTypes: string[];
    /**
     * A list of type name of objects to not script.
     */
    excludeTypes: string[];
    /**
     * Scripting options for the ScriptingParams
     */
    scriptOptions: ScriptOptions;
    /**
     * Connection details for the ScriptingParams
     */
    connectionDetails: ConnectionDetails;
    /**
     * Owner URI of the connection
     */
    ownerURI: string;
    /**
     * Whether the scripting operation is for
     * select script statements
     */
    selectScript: boolean;
    /**
     * Operation associated with the script request
     */
    operation: data.ScriptOperation;
}
export interface ScriptingCompleteParams {
    /**
     * The error details for an error that occurred during the scripting operation.
     */
    errorDetails: string;
    /**
     * The error message for an error that occurred during the scripting operation.
     */
    errorMessage: string;
    /**
     * A value to indicate an error occurred during the scripting operation.
     */
    hasError: boolean;
    /**
     * A value to indicate the scripting operation was canceled.
     */
    canceled: boolean;
    /**
     * A value to indicate the scripting operation successfully completed.
     */
    success: boolean;
}
export declare class TableMetadata {
    columns: data.ColumnMetadata[];
}
/**
 * Parameters to start a profiler session
 */
export interface StartProfilingParams {
    /**
     * Session Owner URI
     */
    ownerUri: string;
    /**
     * Session options
     */
    options: {};
}
export interface StartProfilingResponse {
    succeeded: string;
    errorMessage: string;
}
/**
 * Parameters to start a profiler session
 */
export interface StopProfilingParams {
    /**
     * Session Owner URI
     */
    ownerUri: string;
}
export interface StopProfilingResponse {
    succeeded: string;
    errorMessage: string;
}
/**
 * Profiler Event
 */
export interface ProfilerEvent {
    /**
     * Event class name
     */
    name: string;
    /**
     * Event timestamp
     */
    timestamp: string;
    /**
     * Event values
     */
    values: {};
}
/**
 * Profiler events available notification parameters
 */
export interface ProfilerEventsAvailableParams {
    /**
     * Session owner URI
     */
    ownerUri: string;
    /**
     * New profiler events available
     */
    events: ProfilerEvent[];
}
/**
 * Used as value version of data.ScriptOperation THESE SHOULD BE THE SAME
 */
export declare enum ScriptOperation {
    Select = 0,
    Create = 1,
    Insert = 2,
    Update = 3,
    Delete = 4,
    Execute = 5,
    Alter = 6,
}
