/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'sqlops' {
	import * as vscode from 'vscode';

	// EXPORTED NAMESPACES /////////////////////////////////////////////////
	/**
	 * Namespace for Data Management Protocol global methods
	 */
	export namespace dataprotocol {
		export function registerConnectionProvider(provider: ConnectionProvider): vscode.Disposable;

		export function registerBackupProvider(provider: BackupProvider): vscode.Disposable;

		export function registerRestoreProvider(provider: RestoreProvider): vscode.Disposable;

		export function registerScriptingProvider(provider: ScriptingProvider): vscode.Disposable;

		export function registerObjectExplorerProvider(provider: ObjectExplorerProvider): vscode.Disposable;

		export function registerTaskServicesProvider(provider: TaskServicesProvider): vscode.Disposable;

		export function registerFileBrowserProvider(provider: FileBrowserProvider): vscode.Disposable;

		export function registerProfilerProvider(provider: ProfilerProvider): vscode.Disposable;

		export function registerMetadataProvider(provider: MetadataProvider): vscode.Disposable;

		export function registerQueryProvider(provider: QueryProvider): vscode.Disposable;

		export function registerAdminServicesProvider(provider: AdminServicesProvider): vscode.Disposable;

		export function registerCapabilitiesServiceProvider(provider: CapabilitiesProvider): vscode.Disposable;

		/**
		 * An [event](#Event) which fires when the specific flavor of a language used in DMP
		 * connections has changed. And example is for a SQL connection, the flavor changes
		 * to MSSQL
		 */
		export const onDidChangeLanguageFlavor: vscode.Event<DidChangeLanguageFlavorParams>;
	}

	/**
	 * Namespace for credentials management global methods, available to all extensions
	 */
	export namespace credentials {
		/**
		 * Register a credential provider to handle credential requests.
		 * @param {CredentialProvider} provider The provider to register
		 * @return {Disposable} Handle to the provider for disposal
		 */
		export function registerProvider(provider: CredentialProvider): vscode.Disposable;

		/**
		 * Retrieves a provider from the extension host if one has been registered. Any credentials
		 * accessed with the returned provider will have the namespaceId appended to credential ID
		 * to prevent extensions from trampling over each others' credentials.
		 * @param {string} namespaceId ID that will be appended to credential IDs.
		 * @return {Thenable<CredentialProvider>} Promise that returns the namespaced provider
		 */
		export function getProvider(namespaceId: string): Thenable<CredentialProvider>;
	}

	/**
	 * Namespace for serialization management global methods
	 */
	export namespace serialization {
		export function registerProvider(provider: SerializationProvider): vscode.Disposable;
	}

	/**
	 * Namespace for connection management
	 */
	export namespace connection {
		/**
		 * Get the current connection based on the active editor or Object Explorer selection
		*/
		export function getCurrentConnection(): Thenable<Connection>;

		/**
		 * Get all active connections
		*/
		export function getActiveConnections(): Thenable<Connection[]>;

		/**
		 * Get the credentials for an active connection
		 * @param {string} connectionId The id of the connection
		 * @returns {{ [name: string]: string}} A dictionary containing the credentials as they would be included in the connection's options dictionary
		 */
		export function getCredentials(connectionId: string): Thenable<{ [name: string]: string }>;

		/**
		 * Interface for representing a connection when working with connection APIs
		*/
		export interface Connection extends ConnectionInfo {
			/**
			 * The name of the provider managing the connection (e.g. MSSQL)
			*/
			providerName: string;

			/**
			 * A unique identifier for the connection
			*/
			connectionId: string;
		}
	}

	// EXPORTED INTERFACES /////////////////////////////////////////////////
	export interface ConnectionInfo {

		options: { [name: string]: any };
	}

	export interface ConnectionInfoSummary {

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
	 * Summary that identifies a unique database connection.
	 */
	export interface ConnectionSummary {
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
	 * Information about a Server instance.
	 */
	export interface ServerInfo {
		/**
		 * The major version of the instance.
		 */
		serverMajorVersion: number;
		/**
		 * The minor version of the instance.
		 */
		serverMinorVersion: number;
		/**
		 * The build of the instance.
		 */
		serverReleaseVersion: number;
		/**
		 * The ID of the engine edition of the instance.
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
		 * The edition of the instance.
		 */
		serverEdition: string;
		/**
		 * Whether the instance is running in the cloud (Azure) or not.
		 */
		isCloud: boolean;
		/**
		 * The version of Azure that the instance is running on, if applicable.
		 */
		azureVersion: number;
		/**
		 * The Operating System version string of the machine running the instance.
		 */
		osVersion: string;
	}

	export interface DataProvider {
		handle?: number;
		readonly providerId: string;
	}

	export interface ConnectionProvider extends DataProvider {

		connect(connectionUri: string, connectionInfo: ConnectionInfo): Thenable<boolean>;

		disconnect(connectionUri: string): Thenable<boolean>;

		cancelConnect(connectionUri: string): Thenable<boolean>;

		listDatabases(connectionUri: string): Thenable<ListDatabasesResult>;

		changeDatabase(connectionUri: string, newDatabase: string): Thenable<boolean>;

		rebuildIntelliSenseCache(connectionUri: string): Thenable<void>;

		registerOnConnectionComplete(handler: (connSummary: ConnectionInfoSummary) => any): void;

		registerOnIntelliSenseCacheComplete(handler: (connectionUri: string) => any): void;

		registerOnConnectionChanged(handler: (changedConnInfo: ChangedConnectionInfo) => any): void;
	}

	export enum ServiceOptionType {
		string = 0,
		multistring = 1,
		password = 2,
		number = 3,
		category = 4,
		boolean = 5,
		object = 6
	}

	export enum ConnectionOptionSpecialType {
		serverName = 'serverName',
		databaseName = 'databaseName',
		authType = 'authType',
		userName = 'userName',
		password = 'password',
		appName = 'appName'
	}

	export interface CategoryValue {
		displayName: string;
		name: string;
	}

	export interface ConnectionOption {
		name: string;

		displayName: string;

		description: string;

		groupName: string;

		valueType: ServiceOptionType;

		specialValueType: ConnectionOptionSpecialType;

		defaultValue: string;

		categoryValues: CategoryValue[];

		isIdentity: boolean;

		isRequired: boolean;
	}

	export interface ConnectionProviderOptions {
		options: ConnectionOption[];
	}

	export interface ServiceOption {
		name: string;

		displayName: string;

		description: string;

		groupName: string;

		valueType: ServiceOptionType;

		defaultValue: string;

		objectType: string;

		categoryValues: CategoryValue[];

		isRequired: boolean;

		isArray: boolean;
	}

	export interface AdminServicesOptions {
		databaseInfoOptions: ServiceOption[];

		databaseFileInfoOptions: ServiceOption[];

		fileGroupInfoOptions: ServiceOption[];
	}


	// List Databases Request ----------------------------------------------------------------------
	export interface ListDatabasesResult {
		databaseNames: Array<string>;
	}

	/**
	 * Information about a connection changed event for a resource represented by a URI
	 */
	export interface ChangedConnectionInfo {
		/**
		 * Owner URI of the connection that changed.
		 */
		connectionUri: string;

		/**
		 * Summary of details containing any connection changes.
		 */
		connection: ConnectionSummary;
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

		adminServicesProvider: AdminServicesOptions;

		features: FeatureMetadataProvider[];
	}

	export interface DataProtocolClientCapabilities {
		hostName: string;

		hostVersion: string;
	}

	export interface CapabilitiesProvider extends DataProvider {
		getServerCapabilities(client: DataProtocolClientCapabilities): Thenable<DataProtocolServerCapabilities>;
	}

	export enum MetadataType {
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

	export interface ColumnMetadata {

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

	export interface TableMetadata {

		columns: ColumnMetadata;

	}

	export interface ProviderMetadata {
		objectMetadata: ObjectMetadata[];
	}

	export interface MetadataProvider extends DataProvider {
		getMetadata(connectionUri: string): Thenable<ProviderMetadata>;

		getDatabases(connectionUri: string): Thenable<string[]>;

		getTableInfo(connectionUri: string, metadata: ObjectMetadata): Thenable<ColumnMetadata[]>;

		getViewInfo(connectionUri: string, metadata: ObjectMetadata): Thenable<ColumnMetadata[]>;
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

	export interface ScriptingResult {
		operationId: string;
		script: string;
	}

	export interface ScriptingParamDetails {
		filePath: string;
		scriptCompatibilityOption: string;
		targetDatabaseEngineEdition: string;
		targetDatabaseEngineType: string;
	}

	export interface ScriptingProvider extends DataProvider {

		scriptAsOperation(connectionUri: string, operation: ScriptOperation, metadata: ObjectMetadata, paramDetails: ScriptingParamDetails): Thenable<ScriptingResult>;

		registerOnScriptingComplete(handler: (scriptingCompleteResult: ScriptingCompleteResult) => any);
	}

	export interface ScriptingCompleteResult {
		errorDetails: string;

		errorMessage: string;

		hasError: boolean;

		canceled: boolean;

		success: boolean;

		operationId: string;
	}

	/**
	 * Parameters to initialize a connection to a database
	 */
	export interface Credential {
		/**
		 * Unique ID identifying the credential
		 */
		credentialId: string;

		/**
		 * password
		 */
		password: string;
	}

	export interface CredentialProvider {
		handle: number;

		saveCredential(credentialId: string, password: string): Thenable<boolean>;

		readCredential(credentialId: string): Thenable<Credential>;

		deleteCredential(credentialId: string): Thenable<boolean>;
	}

	export interface SerializationProvider {
		handle: number;
		saveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Thenable<SaveResultRequestResult>;
	}


	export interface DidChangeLanguageFlavorParams {
		uri: string;
		language: string;
		flavor: string;
	}

	export interface QueryProvider extends DataProvider {
		cancelQuery(ownerUri: string): Thenable<QueryCancelResult>;
		runQuery(ownerUri: string, selection: ISelectionData, runOptions?: ExecutionPlanOptions): Thenable<void>;
		runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void>;
		runQueryString(ownerUri: string, queryString: string): Thenable<void>;
		runQueryAndReturn(ownerUri: string, queryString: string): Thenable<SimpleExecuteResult>;
		getQueryRows(rowData: QueryExecuteSubsetParams): Thenable<QueryExecuteSubsetResult>;
		disposeQuery(ownerUri: string): Thenable<void>;
		saveResults(requestParams: SaveResultsRequestParams): Thenable<SaveResultRequestResult>;

		// Notifications
		registerOnQueryComplete(handler: (result: QueryExecuteCompleteNotificationResult) => any): void;
		registerOnBatchStart(handler: (batchInfo: QueryExecuteBatchNotificationParams) => any): void;
		registerOnBatchComplete(handler: (batchInfo: QueryExecuteBatchNotificationParams) => any): void;
		registerOnResultSetComplete(handler: (resultSetInfo: QueryExecuteResultSetCompleteNotificationParams) => any): void;
		registerOnMessage(handler: (message: QueryExecuteMessageParams) => any): void;

		// Edit Data Requests
		commitEdit(ownerUri: string): Thenable<void>;
		createRow(ownerUri: string): Thenable<EditCreateRowResult>;
		deleteRow(ownerUri: string, rowId: number): Thenable<void>;
		disposeEdit(ownerUri: string): Thenable<void>;
		initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number): Thenable<void>;
		revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<EditRevertCellResult>;
		revertRow(ownerUri: string, rowId: number): Thenable<void>;
		updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<EditUpdateCellResult>;
		getEditRows(rowData: EditSubsetParams): Thenable<EditSubsetResult>;

		// Edit Data Notifications
		registerOnEditSessionReady(handler: (ownerUri: string, success: boolean, message: string) => any): void;
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

	export interface QueryExecuteCompleteNotificationResult {
		ownerUri: string;
		batchSummaries: BatchSummary[];
	}

	export interface ExecutionPlanOptions {
		displayEstimatedQueryPlan?: boolean;
		displayActualQueryPlan?: boolean;
	}

	export interface SimpleExecuteParams {
		queryString: string;
		ownerUri: string;
	}

	export interface SimpleExecuteResult {
		rowCount: number;
		columnInfo: IDbColumn[];
		rows: DbCellValue[][];
	}

	// Query Batch Notification -----------------------------------------------------------------------
	export interface QueryExecuteBatchNotificationParams {
		batchSummary: BatchSummary;
		ownerUri: string;
	}


	export interface QueryExecuteResultSetCompleteNotificationParams {
		resultSetSummary: ResultSetSummary;
		ownerUri: string;
	}


	export interface QueryExecuteMessageParams {
		message: IResultMessage;
		ownerUri: string;
	}

	export interface QueryExecuteSubsetParams {
		ownerUri: string;
		batchIndex: number;
		resultSetIndex: number;
		rowsStartIndex: number;
		rowsCount: number;
	}

	export interface DbCellValue {
		displayValue: string;
		isNull: boolean;
	}

	export interface ResultSetSubset {
		rowCount: number;
		rows: DbCellValue[][];
	}

	export interface QueryExecuteSubsetResult {
		message: string;
		resultSubset: ResultSetSubset;
	}

	export interface QueryCancelResult {
		messages: string;
	}

	// Save Results ===============================================================================
	export interface SaveResultsRequestParams {
		/**
		 * 'csv', 'json', 'excel'
		 */
		resultFormat: string;
		ownerUri: string;
		filePath: string;
		batchIndex: number;
		resultSetIndex: number;
		rowStartIndex: number;
		rowEndIndex: number;
		columnStartIndex: number;
		columnEndIndex: number;
		includeHeaders?: boolean;
	}

	export interface SaveResultRequestResult {
		messages: string;
	}

	// Edit Data ==================================================================================
	// Shared Interfaces --------------------------------------------------------------------------
	export interface IEditSessionOperationParams {
		ownerUri: string;
	}

	export interface IEditRowOperationParams extends IEditSessionOperationParams {
		rowId: number;
	}

	export interface EditCellResult {
		cell: EditCell;
		isRowDirty: boolean;
	}

	// edit/commit --------------------------------------------------------------------------------
	export interface EditCommitParams extends IEditSessionOperationParams { }
	export interface EditCommitResult { }

	// edit/createRow -----------------------------------------------------------------------------
	export interface EditCreateRowParams extends IEditSessionOperationParams { }
	export interface EditCreateRowResult {
		defaultValues: string[];
		newRowId: number;
	}

	// edit/deleteRow -----------------------------------------------------------------------------
	export interface EditDeleteRowParams extends IEditRowOperationParams { }
	export interface EditDeleteRowResult { }

	// edit/dispose -------------------------------------------------------------------------------
	export interface EditDisposeParams extends IEditSessionOperationParams { }
	export interface EditDisposeResult { }

	// edit/initialize ----------------------------------------------------------------------------
	export interface EditInitializeFiltering {
		LimitResults?: number;
	}

	export interface EditInitializeParams extends IEditSessionOperationParams {
		filters: EditInitializeFiltering;
		objectName: string;
		schemaName: string;
		objectType: string;
	}


	export interface EditInitializeResult { }

	// edit/revertCell ----------------------------------------------------------------------------
	export interface EditRevertCellParams extends IEditRowOperationParams {
		columnId: number;
	}
	export interface EditRevertCellResult extends EditCellResult {
	}

	// edit/revertRow -----------------------------------------------------------------------------
	export interface EditRevertRowParams extends IEditRowOperationParams { }
	export interface EditRevertRowResult { }

	// edit/sessionReady Event --------------------------------------------------------------------
	export interface EditSessionReadyParams {
		ownerUri: string;
		success: boolean;
		message: string;
	}

	// edit/updateCell ----------------------------------------------------------------------------
	export interface EditUpdateCellParams extends IEditRowOperationParams {
		columnId: number;
		newValue: string;
	}

	export interface EditUpdateCellResult extends EditCellResult {
	}

	// edit/subset --------------------------------------------------------------------------------
	export interface EditSubsetParams extends IEditSessionOperationParams {
		rowStartIndex: number;
		rowCount: number;
	}
	export interface EditSubsetResult {
		rowCount: number;
		subset: EditRow[];
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

	// Object Explorer interfaces  -----------------------------------------------------------------------
	export interface ObjectExplorerSession {
		success: boolean;
		sessionId: string;
		rootNode: NodeInfo;
		errorMessage: string;
	}

	export interface ObjectExplorerSessionResponse {
		sessionId: string;
	}

	export interface ObjectExplorerExpandInfo {
		sessionId: string;
		nodePath: string;
		nodes: NodeInfo[];
		errorMessage: string;
	}

	export interface ExpandNodeInfo {
		sessionId: string;
		nodePath: string;
	}

	export interface ObjectExplorerCloseSessionInfo {
		sessionId: string;
	}

	export interface ObjectExplorerCloseSessionResponse {
		sessionId: string;
		success: boolean;
	}

	export interface ObjectExplorerProvider extends DataProvider {
		createNewSession(connInfo: ConnectionInfo): Thenable<ObjectExplorerSessionResponse>;

		expandNode(nodeInfo: ExpandNodeInfo): Thenable<boolean>;

		refreshNode(nodeInfo: ExpandNodeInfo): Thenable<boolean>;

		closeSession(closeSessionInfo: ObjectExplorerCloseSessionInfo): Thenable<ObjectExplorerCloseSessionResponse>;

		registerOnSessionCreated(handler: (response: ObjectExplorerSession) => any);

		registerOnExpandCompleted(handler: (response: ObjectExplorerExpandInfo) => any);

	}

	// Admin Services interfaces  -----------------------------------------------------------------------
	export interface DatabaseInfo {
		options: {};
	}

	export interface LoginInfo {
		name: string;
	}

	export interface CreateDatabaseResponse {
		result: boolean;
		taskId: number;
	}

	export interface CreateLoginResponse {
		result: boolean;
		taskId: number;
	}

	export interface AdminServicesProvider extends DataProvider {
		createDatabase(connectionUri: string, database: DatabaseInfo): Thenable<CreateDatabaseResponse>;

		createLogin(connectionUri: string, login: LoginInfo): Thenable<CreateLoginResponse>;

		getDefaultDatabaseInfo(connectionUri: string): Thenable<DatabaseInfo>;

		getDatabaseInfo(connectionUri: string): Thenable<DatabaseInfo>;
	}

	// Task service interfaces ----------------------------------------------------------------------------
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

	export interface ListTasksParams {
		listActiveTasksOnly: boolean;
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

	export interface TaskServicesProvider extends DataProvider {
		getAllTasks(listTasksParams: ListTasksParams): Thenable<ListTasksResponse>;

		cancelTask(cancelTaskParams: CancelTaskParams): Thenable<boolean>;

		registerOnTaskCreated(handler: (response: TaskInfo) => any);

		registerOnTaskStatusChanged(handler: (response: TaskProgressInfo) => any);
	}

	// Disaster Recovery interfaces  -----------------------------------------------------------------------

	export interface BackupConfigInfo {
		recoveryModel: string;
		defaultBackupFolder: string;
		backupEncryptors: {};
	}

	export interface BackupResponse {
		result: boolean;
		taskId: number;
	}

	export interface BackupProvider extends DataProvider {
		backup(connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: TaskExecutionMode): Thenable<BackupResponse>;
		getBackupConfigInfo(connectionUri: string): Thenable<BackupConfigInfo>;
	}

	export interface RestoreProvider extends DataProvider {
		getRestorePlan(connectionUri: string, restoreInfo: RestoreInfo): Thenable<RestorePlanResponse>;
		cancelRestorePlan(connectionUri: string, restoreInfo: RestoreInfo): Thenable<boolean>;
		restore(connectionUri: string, restoreInfo: RestoreInfo): Thenable<RestoreResponse>;
		getRestoreConfigInfo(connectionUri: string): Thenable<RestoreConfigInfo>;
	}

	export interface RestoreInfo {
		options: { [key: string]: any };
		taskExecutionMode: TaskExecutionMode;
	}

	export interface RestoreDatabaseFileInfo {
		fileType: string;

		logicalFileName: string;

		originalFileName: string;

		restoreAsFileName: string;
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

	export interface RestoreConfigInfo {
		configInfo: { [key: string]: any };
	}

	export interface RestoreResponse {
		result: boolean;
		taskId: string;
		errorMessage: string;
	}

	export interface ProfilerProvider extends DataProvider {
		startSession(sessionId: string): Thenable<boolean>;
		stopSession(sessionId: string): Thenable<boolean>;
		pauseSession(sessionId: string): Thenable<boolean>;
		connectSession(sessionId: string): Thenable<boolean>;
		disconnectSession(sessionId: string): Thenable<boolean>;

		registerOnSessionEventsAvailable(handler: (response: ProfilerSessionEvents) => any);
	}

	export interface IProfilerTableRow {
		/**
		 * Name of the event; known issue this is not camel case, need to figure
		 * out a better way to determine column id's from rendered column names
		 */
		EventClass: string;
	}

	export interface IProfilerMoreRowsNotificationParams {
		uri: string;
		rowCount: number;
		data: IProfilerTableRow;
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

	export interface ProfilerSessionEvents {
		sessionId: string;

		events: ProfilerEvent[];
	}

	// File browser interfaces  -----------------------------------------------------------------------

	export interface FileBrowserProvider extends DataProvider {
		openFileBrowser(ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Thenable<boolean>;
		registerOnFileBrowserOpened(handler: (response: FileBrowserOpenedParams) => any);
		expandFolderNode(ownerUri: string, expandPath: string): Thenable<boolean>;
		registerOnFolderNodeExpanded(handler: (response: FileBrowserExpandedParams) => any);
		validateFilePaths(ownerUri: string, serviceType: string, selectedFiles: string[]): Thenable<boolean>;
		registerOnFilePathsValidated(handler: (response: FileBrowserValidatedParams) => any);
		closeFileBrowser(ownerUri: string): Thenable<FileBrowserCloseResponse>;
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

	export interface FileBrowserExpandedParams {
		ownerUri: string;
		expandPath: string;
		children: FileTreeNode[];
		succeeded: boolean;
		message: string;
	}

	export interface FileBrowserValidatedParams {
		succeeded: boolean;
		message: string;
	}

	export interface FileBrowserCloseResponse {
		succeeded: boolean;
		message: string;
	}

	// ACCOUNT MANAGEMENT //////////////////////////////////////////////////
	export namespace accounts {
		export function registerAccountProvider(providerMetadata: AccountProviderMetadata, provider: AccountProvider): vscode.Disposable;

		/**
		 * Launches a flyout dialog that will display the information on how to complete device
		 * code OAuth login to the user. Only one flyout can be opened at once and each must be closed
		 * by calling {@link endAutoOAuthDeviceCode}.
		 * @param {string} providerId	ID of the provider that's requesting the flyout be opened
		 * @param {string} title
		 * @param {string} message
		 * @param {string} userCode
		 * @param {string} uri
		 */
		export function beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void>;

		/**
		 * Closes the flyout dialog opened by {@link beginAutoOAuthDeviceCode}
		 */
		export function endAutoOAuthDeviceCode(): void;

		/**
		 * Notifies the account management service that an account has updated (usually due to the
		 * account going stale).
		 * @param {Account} updatedAccount Account object with updated properties
		 */
		export function accountUpdated(updatedAccount: Account): void;
	}

	/**
	 * Represents display information for an account.
	 */
	export interface AccountDisplayInfo {
		/**
		 * A display name that offers context for the account, such as "Contoso".
		 */
		contextualDisplayName: string;

		/**
		 * account provider (eg, Work/School vs Microsoft Account)
		 */
		accountType: string;

		/**
		 * A display name that identifies the account, such as "user@contoso.com".
		 */
		displayName: string;
	}

	/**
	 * Represents a key that identifies an account.
	 */
	export interface AccountKey {
		/**
		 * Identifier of the provider
		 */
		providerId: string;

		/**
		 * Any arguments that identify an instantiation of the provider
		 */
		providerArgs?: any;

		/**
		 * Identifier for the account, unique to the provider
		 */
		accountId: string;
	}

	/**
	 * Represents an account.
	 */
	export interface Account {
		/**
		 * The key that identifies the account
		 */
		key: AccountKey;

		/**
		 * Display information for the account
		 */
		displayInfo: AccountDisplayInfo;

		/**
		 * Custom properties stored with the account
		 */
		properties: any;

		/**
		 * Indicates if the account needs refreshing
		 */
		isStale: boolean;
	}

	// - ACCOUNT PROVIDER //////////////////////////////////////////////////
	/**
	 * Error to be used when the user has cancelled the prompt or refresh methods. When
	 * AccountProvider.refresh or AccountProvider.prompt are rejected with this error, the error
	 * will not be reported to the user.
	 */
	export interface UserCancelledSignInError extends Error {
		/**
		 * Type guard for differentiating user cancelled sign in errors from other errors
		 */
		userCancelledSignIn: boolean;
	}

	/**
	 * Represents a provider of accounts.
	 */
	export interface AccountProviderMetadata {
		/**
		 * The identifier of the provider
		 */
		id: string;

		/**
		 * Display name of the provider
		 */
		displayName: string;

		/**
		 * Any arguments that identify an instantiation of the provider
		 */
		args?: any;

		/**
		 * Optional settings that identify an instantiation of a provider
		 */
		settings?: {};
	}

	/**
	 * Represents a provider of accounts for use with the account management service
	 */
	export interface AccountProvider {
		/**
		 * Initializes the account provider with the accounts restored from the memento,
		 * @param {Account[]} storedAccounts Accounts restored from the memento
		 * @return {Thenable<Account[]>} Account objects after being rehydrated (if necessary)
		 */
		initialize(storedAccounts: Account[]): Thenable<Account[]>;

		/**
		 * Generates a security token for the provided account
		 * @param {Account} account The account to generate a security token for
		 * @return {Thenable<{}>} Promise to return a security token object
		 */
		getSecurityToken(account: Account): Thenable<{}>;

		/**
		 * Prompts the user to enter account information.
		 * Returns an error if the user canceled the operation.
		 */
		prompt(): Thenable<Account>;

		/**
		 * Refreshes a stale account.
		 * Returns an error if the user canceled the operation.
		 * Otherwise, returns a new updated account instance.
		 * @param account - An account.
		 */
		refresh(account: Account): Thenable<Account>;

		/**
		 * Clears sensitive information for an account. To be called when account is removed
		 * @param accountKey - Key that uniquely identifies the account to clear
		 */
		clear(accountKey: AccountKey): Thenable<void>;

		/**
		 * Called from the account management service when the user has cancelled an auto OAuth
		 * authorization process. Implementations should use this to cancel any polling process
		 * and call the end OAuth method.
		 */
		autoOAuthCancelled(): Thenable<void>;
	}

	// Resource provider interfaces  -----------------------------------------------------------------------

	// - ACCOUNT PROVIDER //////////////////////////////////////////////////
	/**
	 * Represents a provider of accounts.
	 */
	export interface ResourceProviderMetadata {
		/**
		 * The identifier of the provider
		 */
		id: string;

		/**
		 * Display name of the provider
		 */
		displayName: string;

		/**
		 * Optional settings that identify an instantiation of a provider
		 */
		settings?: {};
	}

	export namespace resources {
		/**
		 * Registers a resource provider that can suport
		 */
		export function registerResourceProvider(providerMetadata: ResourceProviderMetadata, provider: ResourceProvider): vscode.Disposable;
	}

	/**
	 * Represents a provider of resource
	 */
	export interface ResourceProvider {
		createFirewallRule(account: Account, firewallruleInfo: FirewallRuleInfo): Thenable<CreateFirewallRuleResponse>;
		handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<HandleFirewallRuleResponse>;
	}

	export interface FirewallRuleInfo {
		startIpAddress: string;
		endIpAddress: string;
		serverName: string;
		securityTokenMappings: {};
	}

	export interface CreateFirewallRuleResponse {
		result: boolean;
		errorMessage: string;
	}

	export interface HandleFirewallRuleResponse {
		result: boolean;
		ipAddress: string;
	}

	export interface ModalDialog {
		/**
		 * Title of the webview.
		 */
		title: string;

		/**
		 * Contents of the dialog body.
		 */
		html: string;

		/**
		 * The caption of the OK button.
		 */
		okTitle: string;

		/**
		 * The caption of the Close button.
		 */
		closeTitle: string;

		/**
		 * Opens the dialog.
		 */
		open(): void;

		/**
		 * Closes the dialog.
		 */
		close(): void;

		/**
		 * Raised when the webview posts a message.
		 */
		readonly onMessage: vscode.Event<any>;

		/**
		 * Raised when dialog closed.
		 */
		readonly onClosed: vscode.Event<any>;

		/**
		 * Post a message to the dialog.
		 *
		 * @param message Body of the message.
		 */
		postMessage(message: any): Thenable<any>;
	}

	export interface DashboardWebview {

		/**
		 * Raised when the webview posts a message.
		 */
		readonly onMessage: vscode.Event<any>;

		/**
		 * Raised when the webview closed.
		 */
		readonly onClosed: vscode.Event<any>;

		/**
		 * Post a message to the webview.
		 *
		 * @param message Body of the message.
		 */
		postMessage(message: any): Thenable<any>;

		/**
		 * The connection info for the dashboard the webview exists on
		 */
		readonly connection: connection.Connection;

		/**
		 * The info on the server for the webview dashboard
		 */
		readonly serverInfo: ServerInfo;

		/**
		 * Contents of the dialog body.
		 */
		html: string;
	}

	export namespace dashboard {
		/**
		 * Register a provider for a webview widget
		 */
		export function registerWebviewProvider(widgetId: string, handler: (webview: DashboardWebview) => void): void;
	}

	export namespace window {
		/**
		 * creates a dialog
		 * @param title
		 */
		export function createDialog(
			title: string
		): ModalDialog;
	}
}
