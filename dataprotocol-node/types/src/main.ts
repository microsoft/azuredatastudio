/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

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
	metadata: ObjectMetadata;
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

export interface DataProtocolServerCapabilities {
	protocolVersion: string;

	providerName: string;

	providerDisplayName: string;

	connectionProvider: ConnectionProviderOptions;

	adminServicesProvider: AdminServicesProviderOptions;

	features: FeatureMetadataProvider[];
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
export class ConnectionSummary {
	/**
	 * server name
	 */
	public serverName: string;

	/**
	 * database name
	 */
	public databaseName: string;

	/**
	 * user name
	 */
	public userName: string;
}

/**
 * Connection response format.
 */
export class ConnectionCompleteParams {
	/**
	 * URI identifying the owner of the connection
	 */
	public ownerUri: string;

	/**
	 * connection id returned from service host.
	 */
	public connectionId: string;

	/**
	 * any diagnostic messages return from the service host.
	 */
	public messages: string;

	/**
	 * Error message returned from the engine, if any.
	 */
	public errorMessage: string;

	/**
	 * Error number returned from the engine, if any.
	 */
	public errorNumber: number;

	/**
	 * Information about the connected server.
	 */
	public serverInfo: ServerInfo;

	/**
	 * information about the actual connection established
	 */
	public connectionSummary: ConnectionSummary;
}

/**
 * Update event parameters
 */
export class IntelliSenseReadyParams {
	/**
	 * URI identifying the text document
	 */
	public ownerUri: string;
}

/**
 * Information about a SQL Server instance.
 */
export class ServerInfo {
	/**
	 * The major version of the SQL Server instance.
	 */
	public serverMajorVersion: number;

	/**
	 * The minor version of the SQL Server instance.
	 */
	public serverMinorVersion: number;

	/**
	 * The build of the SQL Server instance.
	 */
	public serverReleaseVersion: number;

	/**
	 * The ID of the engine edition of the SQL Server instance.
	 */
	public engineEditionId: number;

	/**
	 * String containing the full server version text.
	 */
	public serverVersion: string;

	/**
	 * String describing the product level of the server.
	 */
	public serverLevel: string;

	/**
	 * The edition of the SQL Server instance.
	 */
	public serverEdition: string;

	/**
	 * Whether the SQL Server instance is running in the cloud (Azure) or not.
	 */
	public isCloud: boolean;

	/**
	 * The version of Azure that the SQL Server instance is running on, if applicable.
	 */
	public azureVersion: number;

	/**
	 * The Operating System version string of the machine running the SQL Server instance.
	 */
	public osVersion: string;
}

export class CapabiltiesDiscoveryResult {
	public capabilities: DataProtocolServerCapabilities;
}

// Task Services types

export enum TaskStatus {
	notStarted = 0,
	inProgress = 1,
	succeeded = 2,
	succeededWithWarning = 3,
	failed = 4,
	canceled = 5
}

export enum TaskExecutionMode {
	execute = 0,
	script = 1,
	executeAndScript = 2,
}

export interface TaskInfo {
	taskId: string;
	status: TaskStatus;
	taskExecutionMode: TaskExecutionMode;
	serverName: string;
	databaseName: string;
	name: string;
	description: string;
	providerName: string;
	isCancelable: boolean;
}

export interface ListTasksParams {

	listActiveTasksOnly: boolean;
}

export interface ListTasksResponse {
	tasks: TaskInfo[];
}

export interface CancelTaskParams {
	taskId: string;
}

export interface TaskProgressInfo {
	taskId: string;
	status: TaskStatus;
	message: string;
	script: string;
	duration: number;
}

// Admin Services types

export interface DatabaseInfo {
	/**
	 * database options
	 */
	options: {};
}

export interface BackupConfigInfo {
	recoveryModel: string;
	defaultBackupFolder: string;
	backupEncryptors: {};
}

export interface LoginInfo {
	name: string;
}

export interface CreateDatabaseParams {
	ownerUri: string;

	databaseInfo: DatabaseInfo;
}

export interface CreateDatabaseResponse {
	result: boolean;
	taskId: number;
}

export interface DefaultDatabaseInfoParams {
	ownerUri: string;
}

export interface DefaultDatabaseInfoResponse {
	defaultDatabaseInfo: DatabaseInfo;
}

export interface GetDatabaseInfoResponse {
	databaseInfo: DatabaseInfo;
}

export interface GetDatabaseInfoParams {
	ownerUri: string;
}

export interface BackupConfigInfoResponse {
	backupConfigInfo: BackupConfigInfo;
}

export interface CreateLoginParams {
	ownerUri: string;

	loginInfo: LoginInfo;
}

export interface CreateLoginResponse {
	result: boolean;
	taskId: number;
}

// Disaster Recovery types

export interface BackupInfo {
	ownerUri: string;

	databaseName: string;

	backupType: number;

	backupComponent: number;

	backupDeviceType: number;

	selectedFiles: string;

	backupsetName: string;

	selectedFileGroup: { [path: string]: string };

	// List of {key: backup path, value: device type}
	backupPathDevices: { [path: string]: number };

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

	taskExecutionMode: TaskExecutionMode;
}

export interface BackupResponse {
	result: boolean;
	taskId: number;
}

export interface RestoreParams {
	ownerUri: string;
	options: {};
	taskExecutionMode: TaskExecutionMode;
}

export interface RestoreConfigInfoRequestParams {
	ownerUri: string;
}

export interface RestoreConfigInfoResponse {
	configInfo: { [key: string]: any };
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

export interface FileBrowserOpenedParams {
	ownerUri: string;
	fileTree: FileTree;
	succeeded: boolean;
	message: string;
}

export interface FileBrowserExpandParams {
	ownerUri: string;
	expandPath: string;
}

export interface FileBrowserExpandedParams {
	ownerUri: string;
	expandPath: string;
	children: FileTreeNode[];
	succeeded: boolean;
	message: string;
}

export interface FileBrowserValidateParams {
	ownerUri: string;
	serviceType: string;
	selectedFiles: string[];
}

export interface FileBrowserValidatedParams {
	succeeded: boolean;
	message: string;
}

export interface FileBrowserCloseParams {
	ownerUri: string;
}

export interface FileBrowserCloseResponse {
	succeeded: boolean;
	message: string;
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

export interface RestorePlanResponse {
	sessionId: string;
	backupSetsToRestore: DatabaseFileInfo[];
	canRestore: boolean;
	errorMessage: string;
	dbFiles: RestoreDatabaseFileInfo[];
	databaseNamesFromBackupSets: string[];
	planDetails: { [key: string]: RestorePlanDetailInfo };
}

export interface RestoreResponse {
	result: boolean;
	taskId: string;
	errorMessage: string;
}

// Query Execution types
export interface ResultSetSummary {
	id: number;
	batchId: number;
	rowCount: number;
	columnInfo: IDbColumn[];
}

export interface BatchSummary {
	hasError: boolean;
	id: number;
	selection: ISelectionData;
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

export interface ISelectionData {
	startLine: number;
	startColumn: number;
	endLine: number;
	endColumn: number;
}

export interface QueryExecuteBatchNotificationParams {
	batchSummary: BatchSummary;
	ownerUri: string;
}

export interface DbCellValue {
	displayValue: string;
	isNull: boolean;
}

export enum EditRowState {
	clean = 0,
	dirtyInsert = 1,
	dirtyDelete = 2,
	dirtyUpdate = 3
}

export interface EditRow {
	cells: DbCellValue[];
	id: number;
	isDirty: boolean;
	state: EditRowState;
}

export interface EditCell extends DbCellValue {
	isDirty: boolean;
}

export interface EditCell extends DbCellValue {

}

export class MetadataQueryParams {
	/**
	 * Owner URI of the connection that changed.
	 */
	public ownerUri: string;
}

export enum MetadataType {
	Table = 0,
	View = 1,
	SProc = 2,
	Function = 3
}

export class ObjectMetadata {
	metadataType: MetadataType;

	metadataTypeName: string;

	urn: string;

	name: string;

	schema: string;
}

export class MetadataQueryResult {
	public metadata: ObjectMetadata[];
}

export interface ScriptingParamDetails {
	filePath: string;
	scriptCompatibilityOption: string;
	targetDatabaseEngineEdition: string;
	targetDatabaseEngineType: string;
}

export enum ScriptOperation {
	Select = 0,
	Create = 1,
	Insert = 2,
	Update = 3,
	Delete = 4,
	Execute = 5,
	Alter = 6
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
	operation: ScriptOperation;
}

export interface ScriptingResult {

	operationId: string;
	script: string;
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

export class ColumnMetadata {

	hasExtendedProperties: boolean;

	defaultValue: string;

	/// <summary>
	/// Escaped identifier for the name of the column
	/// </summary>
	escapedName: string;

	/// <summary>
	/// Whether or not the column is computed
	/// </summary>
	isComputed: boolean;

	/// <summary>
	/// Whether or not the column is deterministically computed
	/// </summary>
	isDeterministic: boolean;

	/// <summary>
	/// Whether or not the column is an identity column
	/// </summary>
	isIdentity: boolean;

	/// <summary>
	/// The ordinal ID of the column
	/// </summary>
	ordinal: number;

	/// <summary>
	/// Whether or not the column is calculated on the server side. This could be a computed
	/// column or a identity column.
	/// </summary>
	isCalculated: boolean;

	/// <summary>
	/// Whether or not the column is used in a key to uniquely identify a row
	/// </summary>
	isKey: boolean;

	/// <summary>
	/// Whether or not the column can be trusted for uniqueness
	/// </summary>
	isTrustworthyForUniqueness: boolean;

}

export class TableMetadata {

	columns: ColumnMetadata[];

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
export interface ProfilerEventsAvailableParams
{
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
 * Position in a text document expressed as zero-based line and character offset.
 */
export interface Position {
	/**
	 * Line position in a document (zero-based).
	 */
	line: number;

	/**
	 * Character offset on a line in a document (zero-based).
	 */
	character: number;
}

/**
 * The Position namespace provides helper functions to work with
 * [Position](#Position) literals.
 */
export namespace Position {
	/**
	 * Creates a new Position literal from the given line and character.
	 * @param line The position's line.
	 * @param character The position's character.
	 */
	export function create(line: number, character: number): Position {
		return { line, character };
	}
	/**
	 * Checks whether the given liternal conforms to the [Position](#Position) interface.
	 */
	export function is(value: any): value is Position {
		let candidate = value as Position;
		return Is.defined(candidate) && Is.number(candidate.line) && Is.number(candidate.character);
	}
}

/**
 * A range in a text document expressed as (zero-based) start and end positions.
 */
export interface Range {
	/**
	 * The range's start position
	 */
	start: Position;

	/**
	 * The range's end position
	 */
	end: Position;
}

/**
 * The Range namespace provides helper functions to work with
 * [Range](#Range) literals.
 */
export namespace Range {
	/**
	 * Create a new Range liternal.
	 * @param start The range's start position.
	 * @param end The range's end position.
	 */
	export function create(start: Position, end: Position): Range;
	/**
	 * Create a new Range liternal.
	 * @param startLine The start line number.
	 * @param startCharacter The start character.
	 * @param endLine The end line number.
	 * @param endCharacter The end character.
	 */
	export function create(startLine: number, startCharacter: number, endLine: number, endCharacter: number): Range;
	export function create(one: Position | number, two: Position | number, three?: number, four?: number): Range {
		if (Is.number(one) && Is.number(two) && Is.number(three) && Is.number(four)) {
			return { start: Position.create(one, two), end: Position.create(three, four) };
		} else if (Position.is(one) && Position.is(two)) {
			return { start: one, end: two };
		} else {
			throw new Error(`Range#create called with invalid arguments[${one}, ${two}, ${three}, ${four}]`);
		}
	}
	/**
	 * Checks whether the given literal conforms to the [Range](#Range) interface.
	 */
	export function is(value: any): value is Range {
		let candidate = value as Range;
		return Is.defined(candidate) && Position.is(candidate.start) && Position.is(candidate.end);
	}
}

/**
 * Represents a location inside a resource, such as a line
 * inside a text file.
 */
export interface Location {
	uri: string;
	range: Range;
}

/**
 * The Location namespace provides helper functions to work with
 * [Location](#Location) literals.
 */
export namespace Location {
	/**
	 * Creates a Location literal.
	 * @param uri The location's uri.
	 * @param range The location's range.
	 */
	export function create(uri: string, range: Range): Location {
		return { uri, range };
	}
	/**
	 * Checks whether the given literal conforms to the [Location](#Location) interface.
	 */
	export function is(value: any): value is Location {
		let candidate = value as Location;
		return Is.defined(candidate) && Range.is(candidate.range) && (Is.string(candidate.uri) || Is.undefined(candidate.uri));
	}
}

/**
 * The diagnostic's serverity.
 */
export const enum DiagnosticSeverity {
	/**
	 * Reports an error.
	 */
	Error = 1,
	/**
	 * Reports a warning.
	 */
	Warning = 2,
	/**
	 * Reports an information.
	 */
	Information = 3,
	/**
	 * Reports a hint.
	 */
	Hint = 4
}

/**
 * Represents a diagnostic, such as a compiler error or warning. Diagnostic objects
 * are only valid in the scope of a resource.
 */
export interface Diagnostic {
	/**
	 * The range at which the message applies
	 */
	range: Range;

	/**
	 * The diagnostic's severity. Can be omitted. If omitted it is up to the
	 * client to interpret diagnostics as error, warning, info or hint.
	 */
	severity?: number;

	/**
	 * The diagnostic's code. Can be omitted.
	 */
	code?: number | string;

	/**
	 * A human-readable string describing the source of this
	 * diagnostic, e.g. 'typescript' or 'super lint'.
	 */
	source?: string;

	/**
	 * The diagnostic's message.
	 */
	message: string;
}

/**
 * The Diagnostic namespace provides helper functions to work with
 * [Diagnostic](#Diagnostic) literals.
 */
export namespace Diagnostic {
	/**
	 * Creates a new Diagnostic literal.
	 */
	export function create(range: Range, message: string, severity?: number, code?: number | string, source?: string): Diagnostic {
		let result: Diagnostic = { range, message };
		if (Is.defined(severity)) {
			result.severity = severity;
		}
		if (Is.defined(code)) {
			result.code = code;
		}
		if (Is.defined(source)) {
			result.source = source;
		}
		return result;
	}
	/**
	 * Checks whether the given literal conforms to the [Diagnostic](#Diagnostic) interface.
	 */
	export function is(value: any): value is Diagnostic {
		let candidate = value as Diagnostic;
		return Is.defined(candidate)
			&& Range.is(candidate.range)
			&& Is.string(candidate.message)
			&& (Is.number(candidate.severity) || Is.undefined(candidate.severity))
			&& (Is.number(candidate.code) || Is.string(candidate.code) || Is.undefined(candidate.code))
			&& (Is.string(candidate.source) || Is.undefined(candidate.source));
	}
}


/**
 * Represents a reference to a command. Provides a title which
 * will be used to represent a command in the UI and, optionally,
 * an array of arguments which will be passed to the command handler
 * function when invoked.
 */
export interface Command {
	/**
	 * Title of the command, like `save`.
	 */
	title: string;
	/**
	 * The identifier of the actual command handler.
	 */
	command: string;
	/**
	 * Arguments that the command handler should be
	 * invoked with.
	 */
	arguments?: any[];
}


/**
 * The Command namespace provides helper functions to work with
 * [Command](#Command) literals.
 */
export namespace Command {
	/**
	 * Creates a new Command literal.
	 */
	export function create(title: string, command: string, ...args: any[]): Command {
		let result: Command = { title, command };
		if (Is.defined(args) && args.length > 0) {
			result.arguments = args;
		}
		return result;
	}
	/**
	 * Checks whether the given literal conforms to the [Command](#Command) interface.
	 */
	export function is(value: any): value is Command {
		let candidate = value as Command;
		return Is.defined(candidate) && Is.string(candidate.title) && Is.string(candidate.title);
	}
}

/**
 * A text edit applicable to a text document.
 */
export interface TextEdit {
	/**
	 * The range of the text document to be manipulated. To insert
	 * text into a document create a range where start === end.
	 */
	range: Range;

	/**
	 * The string to be inserted. For delete operations use an
	 * empty string.
	 */
	newText: string;
}

/**
 * The TextEdit namespace provides helper function to create replace,
 * insert and delete edits more easily.
 */
export namespace TextEdit {
	/**
	 * Creates a replace text edit.
	 * @param range The range of text to be replaced.
	 * @param newText The new text.
	 */
	export function replace(range: Range, newText: string): TextEdit {
		return { range, newText };
	}
	/**
	 * Creates a insert text edit.
	 * @param psotion The position to insert the text at.
	 * @param newText The text to be inserted.
	 */
	export function insert(position: Position, newText: string): TextEdit {
		return { range: { start: position, end: position }, newText };
	}
	/**
	 * Creates a delete text edit.
	 * @param range The range of text to be deleted.
	 */
	export function del(range: Range): TextEdit {
		return { range, newText: '' };
	}
}

/**
 * A workspace edit represents changes to many resources managed
 * in the workspace.
 */
export interface WorkspaceEdit {
	// creates: { [uri: string]: string; };
	/**
	 * Holds changes to existing resources.
	 */
	changes: { [uri: string]: TextEdit[]; };
	// deletes: string[];
}

/**
 * A change to capture text edits for existing resources.
 */
export interface TextEditChange {
	/**
	 * Gets all text edits for this change.
	 *
	 * @return An array of text edits.
	 */
	all(): TextEdit[];

	/**
	 * Clears the edits for this change.
	 */
	clear(): void;

	/**
	 * Insert the given text at the given position.
	 *
	 * @param position A position.
	 * @param newText A string.
	 */
	insert(position: Position, newText: string): void;

	/**
	 * Replace the given range with given text for the given resource.
	 *
	 * @param range A range.
	 * @param newText A string.
	 */
	replace(range: Range, newText: string): void;

	/**
	 * Delete the text at the given range.
	 *
	 * @param range A range.
	 */
	delete(range: Range): void;
}

/**
 * A workspace change helps constructing changes to a workspace.
 */
export class WorkspaceChange {
	private workspaceEdit: WorkspaceEdit;
	private textEditChanges: { [uri: string]: TextEditChange };

	constructor() {
		this.workspaceEdit = {
			changes: Object.create(null)
		};
		this.textEditChanges = Object.create(null);
	}

	/**
	 * Returns the underlying [WorkspaceEdit](#WorkspaceEdit) literal
	 * use to be returned from a workspace edit operation like rename.
	 */
	public get edit(): WorkspaceEdit {
		return this.workspaceEdit;
	}

	/**
	 * Returns the [TextEditChange](#TextEditChange) to manage text edits
	 * for resources.
	 */
	public getTextEditChange(uri: string): TextEditChange {
		class TextEditChangeImpl implements TextEditChange {
			private edits: TextEdit[];
			constructor(edits: TextEdit[]) {
				this.edits = edits;
			}
			insert(position: Position, newText: string): void {
				this.edits.push(TextEdit.insert(position, newText));
			}
			replace(range: Range, newText: string): void {
				this.edits.push(TextEdit.replace(range, newText));
			}
			delete(range: Range): void {
				this.edits.push(TextEdit.del(range));
			}
			all(): TextEdit[] {
				return this.edits;
			}
			clear(): void {
				this.edits.splice(0, this.edits.length);
			}
		}
		let result = this.textEditChanges[uri];
		if (!result) {
			let edits: TextEdit[] = [];
			this.workspaceEdit.changes[uri] = edits;
			result = new TextEditChangeImpl(edits);
			this.textEditChanges[uri] = result;
		}
		return result;
	}
}

/**
 * A literal to identify a text document in the client.
 */
export interface TextDocumentIdentifier {
	/**
	 * The text document's uri.
	 */
	uri: string;
}

/**
 * The TextDocumentIdentifier namespace provides helper functions to work with
 * [TextDocumentIdentifier](#TextDocumentIdentifier) literals.
 */
export namespace TextDocumentIdentifier {
	/**
	 * Creates a new TextDocumentIdentifier literal.
	 * @param uri The document's uri.
	 */
	export function create(uri: string): TextDocumentIdentifier {
		return { uri };
	}
	/**
	 * Checks whether the given literal conforms to the [TextDocumentIdentifier](#TextDocumentIdentifier) interface.
	 */
	export function is(value: any): value is TextDocumentIdentifier {
		let candidate = value as TextDocumentIdentifier;
		return Is.defined(candidate) && Is.string(candidate.uri);
	}
}

/**
 * An identifier to denote a specific version of a text document.
 */
export interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
	/**
	 * The version number of this document.
	 */
	version: number;
}

/**
 * The VersionedTextDocumentIdentifier namespace provides helper functions to work with
 * [VersionedTextDocumentIdentifier](#VersionedTextDocumentIdentifier) literals.
 */
export namespace VersionedTextDocumentIdentifier {
	/**
	 * Creates a new VersionedTextDocumentIdentifier literal.
	 * @param uri The document's uri.
	 * @param uri The document's text.
	 */
	export function create(uri: string, version: number): VersionedTextDocumentIdentifier {
		return { uri, version };
	}

	/**
	 * Checks whether the given literal conforms to the [VersionedTextDocumentIdentifier](#VersionedTextDocumentIdentifier) interface.
	 */
	export function is(value: any): value is VersionedTextDocumentIdentifier {
		let candidate = value as VersionedTextDocumentIdentifier;
		return Is.defined(candidate) && Is.string(candidate.uri) && Is.number(candidate.version);
	}
}


/**
 * An item to transfer a text document from the client to the
 * server.
 */
export interface TextDocumentItem {
	/**
	 * The text document's uri.
	 */
	uri: string;

	/**
	 * The text document's language identifier
	 */
	languageId: string;

	/**
	 * The version number of this document (it will strictly increase after each
	 * change, including undo/redo).
	 */
	version: number;

	/**
	 * The content of the opened text document.
	 */
	text: string;
}

/**
 * The TextDocumentItem namespace provides helper functions to work with
 * [TextDocumentItem](#TextDocumentItem) literals.
 */
export namespace TextDocumentItem {
	/**
	 * Creates a new TextDocumentItem literal.
	 * @param uri The document's uri.
	 * @param uri The document's language identifier.
	 * @param uri The document's version number.
	 * @param uri The document's text.
	 */
	export function create(uri: string, languageId: string, version: number, text: string): TextDocumentItem {
		return { uri, languageId, version, text };
	}

	/**
	 * Checks whether the given literal conforms to the [TextDocumentItem](#TextDocumentItem) interface.
	 */
	export function is(value: any): value is TextDocumentItem {
		let candidate = value as TextDocumentItem;
		return Is.defined(candidate) && Is.string(candidate.uri) && Is.string(candidate.languageId) && Is.number(candidate.version) && Is.string(candidate.text);
	}
}

/**
 * The kind of a completion entry.
 */
export const enum CompletionItemKind {
	Text = 1,
	Method = 2,
	Function = 3,
	Constructor = 4,
	Field = 5,
	Variable = 6,
	Class = 7,
	Interface = 8,
	Module = 9,
	Property = 10,
	Unit = 11,
	Value = 12,
	Enum = 13,
	Keyword = 14,
	Snippet = 15,
	Color = 16,
	File = 17,
	Reference = 18
}

/**
 * A completion item represents a text snippet that is
 * proposed to complete text that is being typed.
 */
export interface CompletionItem {
	/**
	 * The label of this completion item. By default
	 * also the text that is inserted when selecting
	 * this completion.
	 */
	label: string;

	/**
	 * The kind of this completion item. Based of the kind
	 * an icon is chosen by the editor.
	 */
	kind?: number;

	/**
	 * A human-readable string with additional information
	 * about this item, like type or symbol information.
	 */
	detail?: string;

	/**
	 * A human-readable string that represents a doc-comment.
	 */
	documentation?: string;

	/**
	 * A string that shoud be used when comparing this item
	 * with other items. When `falsy` the [label](#CompletionItem.label)
	 * is used.
	 */
	sortText?: string;

	/**
	 * A string that should be used when filtering a set of
	 * completion items. When `falsy` the [label](#CompletionItem.label)
	 * is used.
	 */
	filterText?: string;

	/**
	 * A string that should be inserted a document when selecting
	 * this completion. When `falsy` the [label](#CompletionItem.label)
	 * is used.
	 */
	insertText?: string;

	/**
	 * An [edit](#TextEdit) which is applied to a document when selecting
	 * this completion. When an edit is provided the value of
	 * [insertText](#CompletionItem.insertText) is ignored.
	 */
	textEdit?: TextEdit;

	/**
	 * An optional array of additional [text edits](#TextEdit) that are applied when
	 * selecting this completion. Edits must not overlap with the main [edit](#CompletionItem.textEdit)
	 * nor with themselves.
	 */
	additionalTextEdits?: TextEdit[];

	/**
	 * An optional [command](#Command) that is executed *after* inserting this completion. *Note* that
	 * additional modifications to the current document should be described with the
	 * [additionalTextEdits](#CompletionItem.additionalTextEdits)-property.
	 */
	command?: Command;

	/**
	 * An data entry field that is preserved on a completion item between
	 * a [CompletionRequest](#CompletionRequest) and a [CompletionResolveRequest]
	 * (#CompletionResolveRequest)
	 */
	data?: any
}

/**
 * The CompletionItem namespace provides functions to deal with
 * completion items.
 */
export namespace CompletionItem {
	/**
	 * Create a completion item and seed it with a label.
	 * @param label The completion item's label
	 */
	export function create(label: string): CompletionItem {
		return { label };
	}
}

/**
 * Represents a collection of [completion items](#CompletionItem) to be presented
 * in the editor.
 */
export interface CompletionList {
	/**
	 * This list it not complete. Further typing should result in recomputing
	 * this list.
	 */
	isIncomplete: boolean;

	/**
	 * The completion items.
	 */
	items: CompletionItem[];
}

/**
 * The CompletionList namespace provides functions to deal with
 * completion lists.
 */
export namespace CompletionList {
	/**
	 * Creates a new completion list.
	 *
	 * @param items The completion items.
	 * @param isIncomplete The list is not complete.
	 */
	export function create(items?: CompletionItem[], isIncomplete?: boolean): CompletionList {
		return { items: items ? items : [], isIncomplete: !!isIncomplete };
	}
}

/**
 * MarkedString can be used to render human readable text. It is either a markdown string
 * or a code-block that provides a language and a code snippet. Note that
 * markdown strings will be sanitized - that means html will be escaped.
 */
export type MarkedString = string | { language: string; value: string };

export namespace MarkedString {
	/**
	 * Creates a marked string from plain text.
	 *
	 * @param plainText The plain text.
	 */
	export function fromPlainText(plainText: string): MarkedString {
		return plainText.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&"); // escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
	}
}

/**
 * The result of a hove request.
 */
export interface Hover {
	/**
	 * The hover's content
	 */
	contents: MarkedString | MarkedString[];

	/**
	 * An optional range
	 */
	range?: Range;
}

/**
 * Represents a parameter of a callable-signature. A parameter can
 * have a label and a doc-comment.
 */
export interface ParameterInformation {
	/**
	 * The label of this signature. Will be shown in
	 * the UI.
	 */
	label: string;

	/**
	 * The human-readable doc-comment of this signature. Will be shown
	 * in the UI but can be omitted.
	 */
	documentation?: string;
}

/**
 * The ParameterInformation namespace provides helper functions to work with
 * [ParameterInformation](#ParameterInformation) literals.
 */
export namespace ParameterInformation {
	/**
	 * Creates a new parameter information literal.
	 *
	 * @param label A label string.
	 * @param documentation A doc string.
	 */
	export function create(label: string, documentation?: string): ParameterInformation {
		return documentation ? { label, documentation } : { label };
	};
}

/**
 * Represents the signature of something callable. A signature
 * can have a label, like a function-name, a doc-comment, and
 * a set of parameters.
 */
export interface SignatureInformation {
	/**
	 * The label of this signature. Will be shown in
	 * the UI.
	 */
	label: string;

	/**
	 * The human-readable doc-comment of this signature. Will be shown
	 * in the UI but can be omitted.
	 */
	documentation?: string;

	/**
	 * The parameters of this signature.
	 */
	parameters?: ParameterInformation[];
}

/**
 * The SignatureInformation namespace provides helper functions to work with
 * [SignatureInformation](#SignatureInformation) literals.
 */
export namespace SignatureInformation {
	export function create(label: string, documentation?: string, ...parameters: ParameterInformation[]): SignatureInformation {
		let result: SignatureInformation = { label };
		if (Is.defined(documentation)) {
			result.documentation = documentation;
		}
		if (Is.defined(parameters)) {
			result.parameters = parameters;
		} else {
			result.parameters = [];
		}
		return result;
	}
}

/**
 * Signature help represents the signature of something
 * callable. There can be multiple signature but only one
 * active and only one active parameter.
 */
export interface SignatureHelp {
	/**
	 * One or more signatures.
	 */
	signatures: SignatureInformation[];

	/**
	 * The active signature.
	 */
	activeSignature?: number;

	/**
	 * The active parameter of the active signature.
	 */
	activeParameter?: number;
}

/**
 * The definition of a symbol represented as one or many [locations](#Location).
 * For most programming languages there is only one location at which a symbol is
 * defined.
 */
export type Definition = Location | Location[];

/**
 * Value-object that contains additional information when
 * requesting references.
 */
export interface ReferenceContext {
	/**
	 * Include the declaration of the current symbol.
	 */
	includeDeclaration: boolean;
}


/**
 * A document highlight kind.
 */
export const enum DocumentHighlightKind {
	/**
	 * A textual occurrance.
	 */
	Text = 1,

	/**
	 * Read-access of a symbol, like reading a variable.
	 */
	Read = 2,

	/**
	 * Write-access of a symbol, like writing to a variable.
	 */
	Write = 3
}

/**
 * A document highlight is a range inside a text document which deserves
 * special attention. Usually a document highlight is visualized by changing
 * the background color of its range.
 */
export interface DocumentHighlight {
	/**
	 * The range this highlight applies to.
	 */
	range: Range;

	/**
	 * The highlight kind, default is [text](#DocumentHighlightKind.Text).
	 */
	kind?: number;
}

/**
 * DocumentHighlight namespace to provide helper functions to work with
 * [DocumentHighlight](#DocumentHighlight) literals.
 */
export namespace DocumentHighlight {
	/**
	 * Create a DocumentHighlight object.
	 * @param range The range the highlight applies to.
	 */
	export function create(range: Range, kind?: number): DocumentHighlight {
		let result: DocumentHighlight = { range };
		if (Is.number(kind)) {
			result.kind = kind;
		}
		return result;
	}
}

/**
 * A symbol kind.
 */
export const enum SymbolKind {
	File = 1,
	Module = 2,
	Namespace = 3,
	Package = 4,
	Class = 5,
	Method = 6,
	Property = 7,
	Field = 8,
	Constructor = 9,
	Enum = 10,
	Interface = 11,
	Function = 12,
	Variable = 13,
	Constant = 14,
	String = 15,
	Number = 16,
	Boolean = 17,
	Array = 18,
}

/**
 * Represents information about programming constructs like variables, classes,
 * interfaces etc.
 */
export interface SymbolInformation {
	/**
	 * The name of this symbol.
	 */
	name: string;

	/**
	 * The kind of this symbol.
	 */
	kind: number;

	/**
	 * The location of this symbol.
	 */
	location: Location;

	/**
	 * The name of the symbol containing this symbol.
	 */
	containerName?: string;
}

export namespace SymbolInformation {
	/**
	 * Creates a new symbol information literal.
	 *
	 * @param name The name of the symbol.
	 * @param kind The kind of the symbol.
	 * @param range The range of the location of the symbol.
	 * @param uri The resource of the location of symbol, defaults to the current document.
	 * @param containerName The name of the symbol containg the symbol.
	 */
	export function create(name: string, kind: SymbolKind, range: Range, uri?: string, containerName?: string): SymbolInformation {
		let result: SymbolInformation = {
			name,
			kind,
			location: { uri, range }
		}
		if (containerName) {
			result.containerName = containerName;
		}
		return result;
	}
}

/**
 * Parameters for a [DocumentSymbolRequest](#DocumentSymbolRequest).
 */
export interface DocumentSymbolParams {
	/**
	 * The text document.
	 */
	textDocument: TextDocumentIdentifier;
}

/**
 * The parameters of a [WorkspaceSymbolRequest](#WorkspaceSymbolRequest).
 */
export interface WorkspaceSymbolParams {
	/**
	 * A non-empty query string
	 */
	query: string;
}

/**
 * Contains additional diagnostic information about the context in which
 * a [code action](#CodeActionProvider.provideCodeActions) is run.
 */
export interface CodeActionContext {
	/**
	 * An array of diagnostics.
	 */
	diagnostics: Diagnostic[];
}

/**
 * The CodeActionContext namespace provides helper functions to work with
 * [CodeActionContext](#CodeActionContext) literals.
 */
export namespace CodeActionContext {
	/**
	 * Creates a new CodeActionContext literal.
	 */
	export function create(diagnostics: Diagnostic[]): CodeActionContext {
		return { diagnostics };
	}
	/**
	 * Checks whether the given literal conforms to the [CodeActionContext](#CodeActionContext) interface.
	 */
	export function is(value: any): value is CodeActionContext {
		let candidate = value as CodeActionContext;
		return Is.defined(candidate) && Is.typedArray<Diagnostic[]>(candidate.diagnostics, Diagnostic.is);
	}
}

/**
 * A code lens represents a [command](#Command) that should be shown along with
 * source text, like the number of references, a way to run tests, etc.
 *
 * A code lens is _unresolved_ when no command is associated to it. For performance
 * reasons the creation of a code lens and resolving should be done to two stages.
 */
export interface CodeLens {
	/**
	 * The range in which this code lens is valid. Should only span a single line.
	 */
	range: Range;

	/**
	 * The command this code lens represents.
	 */
	command?: Command;

	/**
	 * An data entry field that is preserved on a code lens item between
	 * a [CodeLensRequest](#CodeLensRequest) and a [CodeLensResolveRequest]
	 * (#CodeLensResolveRequest)
	 */
	data?: any
}

/**
 * The CodeLens namespace provides helper functions to work with
 * [CodeLens](#CodeLens) literals.
 */
export namespace CodeLens {
	/**
	 * Creates a new CodeLens literal.
	 */
	export function create(range: Range, data?: any): CodeLens {
		let result: CodeLens = { range };
		if (Is.defined(data)) result.data = data;
		return result;
	}
	/**
	 * Checks whether the given literal conforms to the [CodeLens](#CodeLens) interface.
	 */
	export function is(value: any): value is CodeLens {
		let candidate = value as CodeLens;
		return Is.defined(candidate) && Range.is(candidate.range) && (Is.undefined(candidate.command) || Command.is(candidate.command));
	}
}

/**
 * Value-object describing what options formatting should use.
 */
export interface FormattingOptions {
	/**
	 * Size of a tab in spaces.
	 */
	tabSize: number;

	/**
	 * Prefer spaces over tabs.
	 */
	insertSpaces: boolean;

	/**
	 * Signature for further properties.
	 */
	[key: string]: boolean | number | string;
}

/**
 * The FormattingOptions namespace provides helper functions to work with
 * [FormattingOptions](#FormattingOptions) literals.
 */
export namespace FormattingOptions {
	/**
	 * Creates a new FormattingOptions literal.
	 */
	export function create(tabSize: number, insertSpaces: boolean): FormattingOptions {
		return { tabSize, insertSpaces };
	}
	/**
	 * Checks whether the given literal conforms to the [FormattingOptions](#FormattingOptions) interface.
	 */
	export function is(value: any): value is FormattingOptions {
		let candidate = value as FormattingOptions;
		return Is.defined(candidate) && Is.number(candidate.tabSize) && Is.boolean(candidate.insertSpaces);
	}
}

/**
 * A document link is a range in a text document that links to an internal or external resource, like another
 * text document or a web site.
 */
export class DocumentLink {

	/**
	 * The range this link applies to.
	 */
	range: Range;

	/**
	 * The uri this link points to.
	 */
	target: string;
}

/**
 * The DocumentLink namespace provides helper functions to work with
 * [DocumentLink](#DocumentLink) literals.
 */
export namespace DocumentLink {
	/**
	 * Creates a new DocumentLink literal.
	 */
	export function create(range: Range, target?: string): DocumentLink {
		return { range, target };
	}

	/**
	 * Checks whether the given literal conforms to the [DocumentLink](#DocumentLink) interface.
	 */
	export function is(value: any): value is DocumentLink {
		let candidate = value as DocumentLink;
		return Is.defined(candidate) && Range.is(candidate.range) && (Is.undefined(candidate.target) || Is.string(candidate.target));
	}
}

/**
 * A simple text document. Not to be implemenented.
 */
export interface TextDocument {

	/**
	 * The associated URI for this document. Most documents have the __file__-scheme, indicating that they
	 * represent files on disk. However, some documents may have other schemes indicating that they are not
	 * available on disk.
	 *
	 * @readonly
	 */
	uri: string;

	/**
	 * The identifier of the language associated with this document.
	 *
	 * @readonly
	 */
	languageId: string;

	/**
	 * The version number of this document (it will strictly increase after each
	 * change, including undo/redo).
	 *
	 * @readonly
	 */
	version: number;

	/**
	 * Get the text of this document.
	 *
	 * @return The text of this document.
	 */
	getText(): string;

	/**
	 * Converts a zero-based offset to a position.
	 *
	 * @param offset A zero-based offset.
	 * @return A valid [position](#Position).
	 */
	positionAt(offset: number): Position;

	/**
	 * Converts the position to a zero-based offset.
	 *
	 * The position will be [adjusted](#TextDocument.validatePosition).
	 *
	 * @param position A position.
	 * @return A valid zero-based offset.
	 */
	offsetAt(position: Position): number;

	/**
	 * The number of lines in this document.
	 *
	 * @readonly
	 */
	lineCount: number;
}

export namespace TextDocument {
	/**
	 * Creates a new ITextDocument literal from the given uri and content.
	 * @param uri The document's uri.
	 * @param languageId  The document's language Id.
	 * @param content The document's content.
	 */
	export function create(uri: string, languageId: string, version: number, content: string): TextDocument {
		return new FullTextDocument(uri, languageId, version, content);
	}
	/**
	 * Checks whether the given literal conforms to the [ITextDocument](#ITextDocument) interface.
	 */
	export function is(value: any): value is TextDocument {
		let candidate = value as TextDocument;
		return Is.defined(candidate) && Is.string(candidate.uri) && (Is.undefined(candidate.languageId) || Is.string(candidate.languageId)) && Is.number(candidate.lineCount)
			&& Is.func(candidate.getText) && Is.func(candidate.positionAt) && Is.func(candidate.offsetAt) ? true : false;
	}
}

/**
 * Event to signal changes to a simple text document.
 */
export interface TextDocumentChangeEvent {
	/**
	 * The document that has changed.
	 */
	document: TextDocument;
}

/**
 * An event describing a change to a text document. If range and rangeLength are omitted
 * the new text is considered to be the full content of the document.
 */
export interface TextDocumentContentChangeEvent {
	/**
	 * The range of the document that changed.
	 */
	range?: Range;

	/**
	 * The length of the range that got replaced.
	 */
	rangeLength?: number;

	/**
	 * The new text of the document.
	 */
	text: string;
}

class FullTextDocument implements TextDocument {

	private _uri: string;
	private _languageId: string;
	private _version: number;
	private _content: string;
	private _lineOffsets: number[];

	public constructor(uri: string, languageId: string, version: number, content: string) {
		this._uri = uri;
		this._languageId = languageId;
		this._version = version;
		this._content = content;
		this._lineOffsets = null;
	}

	public get uri(): string {
		return this._uri;
	}

	public get languageId(): string {
		return this._languageId;
	}

	public get version(): number {
		return this._version;
	}

	public getText(): string {
		return this._content;
	}

	public update(event: TextDocumentContentChangeEvent, version: number): void {
		this._content = event.text;
		this._version = version;
		this._lineOffsets = null;
	}

	private getLineOffsets(): number[] {
		if (this._lineOffsets === null) {
			let lineOffsets: number[] = [];
			let text = this._content;
			let isLineStart = true;
			for (let i = 0; i < text.length; i++) {
				if (isLineStart) {
					lineOffsets.push(i);
					isLineStart = false;
				}
				let ch = text.charAt(i);
				isLineStart = (ch === '\r' || ch === '\n');
				if (ch === '\r' && i + 1 < text.length && text.charAt(i + 1) === '\n') {
					i++;
				}
			}
			if (isLineStart && text.length > 0) {
				lineOffsets.push(text.length);
			}
			this._lineOffsets = lineOffsets;
		}
		return this._lineOffsets;
	}

	public positionAt(offset: number) {
		offset = Math.max(Math.min(offset, this._content.length), 0);

		let lineOffsets = this.getLineOffsets();
		let low = 0, high = lineOffsets.length;
		if (high === 0) {
			return Position.create(0, offset);
		}
		while (low < high) {
			let mid = Math.floor((low + high) / 2);
			if (lineOffsets[mid] > offset) {
				high = mid;
			} else {
				low = mid + 1;
			}
		}
		// low is the least x for which the line offset is larger than the current offset
		// or array.length if no line offset is larger than the current offset
		let line = low - 1;
		return Position.create(line, offset - lineOffsets[line]);
	}

	public offsetAt(position: Position) {
		let lineOffsets = this.getLineOffsets();
		if (position.line >= lineOffsets.length) {
			return this._content.length;
		} else if (position.line < 0) {
			return 0;
		}
		let lineOffset = lineOffsets[position.line];
		let nextLineOffset = (position.line + 1 < lineOffsets.length) ? lineOffsets[position.line + 1] : this._content.length;
		return Math.max(Math.min(lineOffset + position.character, nextLineOffset), lineOffset);
	}

	public get lineCount() {
		return this.getLineOffsets().length;
	}
}

namespace Is {

	const toString = Object.prototype.toString;

	export function defined(value: any): boolean {
		return typeof value !== 'undefined';
	}

	export function undefined(value: any): boolean {
		return typeof value === 'undefined';
	}

	export function boolean(value: any): value is boolean {
		return value === true || value === false;
	}

	export function string(value: any): value is string {
		return toString.call(value) === '[object String]';
	}

	export function number(value: any): value is number {
		return toString.call(value) === '[object Number]';
	}

	export function func(value: any): value is Function {
		return toString.call(value) === '[object Function]';
	}

	export function typedArray<T>(value: any, check: (value: any) => boolean): value is T[] {
		return Array.isArray(value) && (<any[]>value).every(check);
	}

}
