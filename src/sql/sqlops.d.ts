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

		export function registerObjectExplorerNodeProvider(provider: ObjectExplorerNodeProvider): vscode.Disposable;

		export function registerTaskServicesProvider(provider: TaskServicesProvider): vscode.Disposable;

		export function registerFileBrowserProvider(provider: FileBrowserProvider): vscode.Disposable;

		export function registerProfilerProvider(provider: ProfilerProvider): vscode.Disposable;

		export function registerMetadataProvider(provider: MetadataProvider): vscode.Disposable;

		export function registerQueryProvider(provider: QueryProvider): vscode.Disposable;

		export function registerAdminServicesProvider(provider: AdminServicesProvider): vscode.Disposable;

		export function registerAgentServicesProvider(provider: AgentServicesProvider): vscode.Disposable;

		export function registerCapabilitiesServiceProvider(provider: CapabilitiesProvider): vscode.Disposable;

		export function registerDacFxServicesProvider(provider: DacFxServicesProvider): vscode.Disposable;

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
		 * Get connection string
		*/
		export function getConnectionString(connectionId: string, includePassword: boolean): Thenable<string>;

		/**
		 * Get the credentials for an active connection
		 * @param {string} connectionId The id of the connection
		 * @returns {{ [name: string]: string}} A dictionary containing the credentials as they would be included in the connection's options dictionary
		 */
		export function getCredentials(connectionId: string): Thenable<{ [name: string]: string }>;

		/**
		 * Get ServerInfo for a connectionId
		 * @param {string} connectionId The id of the connection
		 * @returns ServerInfo
		 */
		export function getServerInfo(connectionId: string): Thenable<ServerInfo>;

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

	/**
	 * Namespace for interacting with Object Explorer
	*/
	export namespace objectexplorer {
		/**
		 * Get an Object Explorer node corresponding to the given connection and path. If no path
		 * is given, it returns the top-level node for the given connection. If there is no node at
		 * the given path, it returns undefined.
		 * @param {string} connectionId The id of the connection that the node exists on
		 * @param {string?} nodePath The path of the node to get
		 * @returns {ObjectExplorerNode} The node corresponding to the given connection and path,
		 * or undefined if no such node exists.
		*/
		export function getNode(connectionId: string, nodePath?: string): Thenable<ObjectExplorerNode>;

		/**
		 * Get all active Object Explorer connection nodes
		 * @returns {ObjectExplorerNode[]} The Object Explorer nodes for each saved connection
		*/
		export function getActiveConnectionNodes(): Thenable<ObjectExplorerNode[]>;

		/**
		 * Find Object Explorer nodes that match the given information
		 * @param {string} connectionId The id of the connection that the node exists on
		 * @param {string} type The type of the object to retrieve
		 * @param {string} schema The schema of the object, if applicable
		 * @param {string} name The name of the object
		 * @param {string} database The database the object exists under, if applicable
		 * @param {string[]} parentObjectNames A list of names of parent objects in the tree, ordered from highest to lowest level
		 * (for example when searching for a table's column, provide the name of its parent table for this argument)
		 */
		export function findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames: string[]): Thenable<ObjectExplorerNode[]>;

		/**
		 * Get connectionProfile from sessionId
		 * *@param {string} sessionId The id of the session that the node exists on
		 * @returns {IConnectionProfile} The IConnecitonProfile for the session
		 */
		export function getSessionConnectionProfile(sessionId: string): Thenable<IConnectionProfile>;

		/**
		 * Interface for representing and interacting with items in Object Explorer
		*/
		export interface ObjectExplorerNode extends NodeInfo {
			/**
			 * The id of the connection that the node exists under
			 */
			connectionId: string;

			/**
			 * Whether the node is currently expanded in Object Explorer
			 */
			isExpanded(): Thenable<boolean>;

			/**
			 * Set whether the node is expanded or collapsed
			 * @param expandedState The new state of the node. If 'None', the node will not be changed
			 */
			setExpandedState(expandedState: vscode.TreeItemCollapsibleState): Thenable<void>;

			/**
			 * Set whether the node is selected
			 * @param selected Whether the node should be selected
			 * @param clearOtherSelections If true, clear any other selections. If false, leave any existing selections.
			 * Defaults to true when selected is true and false when selected is false.
			 */
			setSelected(selected: boolean, clearOtherSelections?: boolean): Thenable<void>;

			/**
			 * Get all the child nodes. Returns an empty list if there are no children.
			 */
			getChildren(): Thenable<ObjectExplorerNode[]>;

			/**
			 * Get the parent node. Returns undefined if there is none.
			 */
			getParent(): Thenable<ObjectExplorerNode>;

			/**
			 * Refresh the node, expanding it if it has children
			 */
			refresh(): Thenable<void>;
		}
	}

	// EXPORTED INTERFACES /////////////////////////////////////////////////
	export interface ConnectionInfo {

		options: { [name: string]: any };
	}

	export interface IConnectionProfile extends ConnectionInfo {
		connectionName: string;
		serverName: string;
		databaseName: string;
		userName: string;
		password: string;
		authenticationType: string;
		savePassword: boolean;
		groupFullName: string;
		groupId: string;
		providerName: string;
		saveProfile: boolean;
		id: string;
		azureTenantId?: string;
	}

	/**
	* Options for the actions that could happen after connecting is complete
	*/
	export interface IConnectionCompletionOptions {
		/**
		 * Save the connection to MRU and settings (only save to setting if profile.saveProfile is set to true)
		 * Default is true.
		 */
		saveConnection: boolean;

		/**
		 * If true, open the dashboard after connection is complete.
		 * If undefined / false, dashboard won't be opened after connection completes.
		 * Default is false.
		 */
		showDashboard?: boolean;

		/**
		 * If undefined / true, open the connection dialog if connection fails.
		 * If false, connection dialog won't be opened even if connection fails.
		 * Default is true.
		 */
		showConnectionDialogOnError?: boolean;

		/**
		 * If undefined / true, open the connection firewall rule dialog if connection fails.
		 * If false, connection firewall rule dialog won't be opened even if connection fails.
		 * Default is true.
		 */
		showFirewallRuleOnError?: boolean;
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
		/**
		 * options for all new server properties.
		 */
		options: {};
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

		getConnectionString(connectionUri: string, includePassword: boolean): Thenable<string>;

		buildConnectionInfo?(connectionString: string): Thenable<ConnectionInfo>;

		registerOnConnectionComplete(handler: (connSummary: ConnectionInfoSummary) => any): void;

		registerOnIntelliSenseCacheComplete(handler: (connectionUri: string) => any): void;

		registerOnConnectionChanged(handler: (changedConnInfo: ChangedConnectionInfo) => any): void;
	}

	export enum ServiceOptionType {
		string = 'string',
		multistring = 'multistring',
		password = 'password',
		number = 'number',
		category = 'category',
		boolean = 'boolean',
		object = 'object'
	}

	export enum ConnectionOptionSpecialType {
		connectionName = 'connectionName',
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

		registerOnScriptingComplete(handler: (scriptingCompleteResult: ScriptingCompleteResult) => any): void;
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
		parseSyntax(ownerUri: string, query: string): Thenable<SyntaxParseResult>;
		getQueryRows(rowData: QueryExecuteSubsetParams): Thenable<QueryExecuteSubsetResult>;
		disposeQuery(ownerUri: string): Thenable<void>;
		saveResults(requestParams: SaveResultsRequestParams): Thenable<SaveResultRequestResult>;

		// Notifications
		registerOnQueryComplete(handler: (result: QueryExecuteCompleteNotificationResult) => any): void;
		registerOnBatchStart(handler: (batchInfo: QueryExecuteBatchNotificationParams) => any): void;
		registerOnBatchComplete(handler: (batchInfo: QueryExecuteBatchNotificationParams) => any): void;
		registerOnResultSetAvailable(handler: (resultSetInfo: QueryExecuteResultSetNotificationParams) => any): void;
		registerOnResultSetUpdated(handler: (resultSetInfo: QueryExecuteResultSetNotificationParams) => any): void;
		registerOnMessage(handler: (message: QueryExecuteMessageParams) => any): void;

		// Edit Data Requests
		commitEdit(ownerUri: string): Thenable<void>;
		createRow(ownerUri: string): Thenable<EditCreateRowResult>;
		deleteRow(ownerUri: string, rowId: number): Thenable<void>;
		disposeEdit(ownerUri: string): Thenable<void>;
		initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void>;
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
		complete: boolean;
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

	export interface SyntaxParseParams {
		ownerUri: string;
		query: string;
	}

	export interface SyntaxParseResult {
		parseable: boolean;
		errors: string[];
	}

	// Query Batch Notification -----------------------------------------------------------------------
	export interface QueryExecuteBatchNotificationParams {
		batchSummary: BatchSummary;
		ownerUri: string;
	}


	export interface QueryExecuteResultSetNotificationParams {
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
		invariantCultureDisplayValue: string;
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
		 * 'csv', 'json', 'excel', 'xml'
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
		delimiter?: string;
		lineSeperator?: string;
		textIdentifier?: string;
		encoding?: string;
		formatted?: boolean;
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
		queryString: string;
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

	/**
	 * A NodeInfo object represents an element in the Object Explorer tree under
	 * a connection.
	 */
	export interface NodeInfo {
		nodePath: string;
		nodeType: string;
		nodeSubType: string;
		nodeStatus: string;
		label: string;
		isLeaf: boolean;
		metadata: ObjectMetadata;
		errorMessage: string;
		/**
		 * Optional iconType for the object in the tree. Currently this only supports
		 * an icon name or SqlThemeIcon name, rather than a path to an icon.
		 * If not defined, the nodeType + nodeStatus / nodeSubType values
		 * will be used instead.
		 */
		iconType?: string | SqlThemeIcon;
		/**
		 * Informs who provides the children to a node, used by data explorer tree view api
		 */
		childProvider?: string;
		/**
		 * Holds the connection profile for nodes, used by data explorer tree view api
		 */
		payload?: any;
	}

	/**
	 * A reference to a named icon. Currently only a subset of the SQL icons are available.
	 * Using a theme icon is preferred over a custom icon as it gives theme authors the possibility to change the icons.
	 */
	export class SqlThemeIcon {
		static readonly Folder: SqlThemeIcon;
		static readonly Root: SqlThemeIcon;
		static readonly Database: SqlThemeIcon;
		static readonly Server: SqlThemeIcon;
		static readonly ScalarValuedFunction: SqlThemeIcon;
		static readonly TableValuedFunction: SqlThemeIcon;
		static readonly AggregateFunction: SqlThemeIcon;
		static readonly FileGroup: SqlThemeIcon;
		static readonly StoredProcedure: SqlThemeIcon;
		static readonly UserDefinedTableType: SqlThemeIcon;
		static readonly View: SqlThemeIcon;
		static readonly Table: SqlThemeIcon;
		static readonly HistoryTable: SqlThemeIcon;
		static readonly ServerLevelLinkedServerLogin: SqlThemeIcon;
		static readonly ServerLevelServerAudit: SqlThemeIcon;
		static readonly ServerLevelCryptographicProvider: SqlThemeIcon;
		static readonly ServerLevelCredential: SqlThemeIcon;
		static readonly ServerLevelServerRole: SqlThemeIcon;
		static readonly ServerLevelLogin: SqlThemeIcon;
		static readonly ServerLevelServerAuditSpecification: SqlThemeIcon;
		static readonly ServerLevelServerTrigger: SqlThemeIcon;
		static readonly ServerLevelLinkedServer: SqlThemeIcon;
		static readonly ServerLevelEndpoint: SqlThemeIcon;
		static readonly Synonym: SqlThemeIcon;
		static readonly DatabaseTrigger: SqlThemeIcon;
		static readonly Assembly: SqlThemeIcon;
		static readonly MessageType: SqlThemeIcon;
		static readonly Contract: SqlThemeIcon;
		static readonly Queue: SqlThemeIcon;
		static readonly Service: SqlThemeIcon;
		static readonly Route: SqlThemeIcon;
		static readonly DatabaseAndQueueEventNotification: SqlThemeIcon;
		static readonly RemoteServiceBinding: SqlThemeIcon;
		static readonly BrokerPriority: SqlThemeIcon;
		static readonly FullTextCatalog: SqlThemeIcon;
		static readonly FullTextStopList: SqlThemeIcon;
		static readonly SqlLogFile: SqlThemeIcon;
		static readonly PartitionFunction: SqlThemeIcon;
		static readonly PartitionScheme: SqlThemeIcon;
		static readonly SearchPropertyList: SqlThemeIcon;
		static readonly User: SqlThemeIcon;
		static readonly Schema: SqlThemeIcon;
		static readonly AsymmetricKey: SqlThemeIcon;
		static readonly Certificate: SqlThemeIcon;
		static readonly SymmetricKey: SqlThemeIcon;
		static readonly DatabaseEncryptionKey: SqlThemeIcon;
		static readonly MasterKey: SqlThemeIcon;
		static readonly DatabaseAuditSpecification: SqlThemeIcon;
		static readonly Column: SqlThemeIcon;
		static readonly Key: SqlThemeIcon;
		static readonly Constraint: SqlThemeIcon;
		static readonly Trigger: SqlThemeIcon;
		static readonly Index: SqlThemeIcon;
		static readonly Statistic: SqlThemeIcon;
		static readonly UserDefinedDataType: SqlThemeIcon;
		static readonly UserDefinedType: SqlThemeIcon;
		static readonly XmlSchemaCollection: SqlThemeIcon;
		static readonly SystemExactNumeric: SqlThemeIcon;
		static readonly SystemApproximateNumeric: SqlThemeIcon;
		static readonly SystemDateAndTime: SqlThemeIcon;
		static readonly SystemCharacterString: SqlThemeIcon;
		static readonly SystemUnicodeCharacterString: SqlThemeIcon;
		static readonly SystemBinaryString: SqlThemeIcon;
		static readonly SystemOtherDataType: SqlThemeIcon;
		static readonly SystemClrDataType: SqlThemeIcon;
		static readonly SystemSpatialDataType: SqlThemeIcon;
		static readonly UserDefinedTableTypeColumn: SqlThemeIcon;
		static readonly UserDefinedTableTypeKey: SqlThemeIcon;
		static readonly UserDefinedTableTypeConstraint: SqlThemeIcon;
		static readonly StoredProcedureParameter: SqlThemeIcon;
		static readonly TableValuedFunctionParameter: SqlThemeIcon;
		static readonly ScalarValuedFunctionParameter: SqlThemeIcon;
		static readonly AggregateFunctionParameter: SqlThemeIcon;
		static readonly DatabaseRole: SqlThemeIcon;
		static readonly ApplicationRole: SqlThemeIcon;
		static readonly FileGroupFile: SqlThemeIcon;
		static readonly SystemMessageType: SqlThemeIcon;
		static readonly SystemContract: SqlThemeIcon;
		static readonly SystemService: SqlThemeIcon;
		static readonly SystemQueue: SqlThemeIcon;
		static readonly Sequence: SqlThemeIcon;
		static readonly SecurityPolicy: SqlThemeIcon;
		static readonly DatabaseScopedCredential: SqlThemeIcon;
		static readonly ExternalResource: SqlThemeIcon;
		static readonly ExternalDataSource: SqlThemeIcon;
		static readonly ExternalFileFormat: SqlThemeIcon;
		static readonly ExternalTable: SqlThemeIcon;
		static readonly ColumnMasterKey: SqlThemeIcon;
		static readonly ColumnEncryptionKey: SqlThemeIcon;

		private constructor(id: string);

		/**
		 * Gets the ID for the theme icon for help in cases where string comparison is needed
		 */
		public readonly id: string;
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

	export interface FindNodesInfo {
		sessionId: string;
		type: string;
		schema: string;
		name: string;
		database: string;
		parentObjectNames: string[];
	}

	export interface ObjectExplorerCloseSessionInfo {
		sessionId: string;
	}

	export interface ObjectExplorerCloseSessionResponse {
		sessionId: string;
		success: boolean;
	}

	export interface ObjectExplorerFindNodesResponse {
		nodes: NodeInfo[];
	}

	export interface ObjectExplorerProviderBase extends DataProvider {
		expandNode(nodeInfo: ExpandNodeInfo): Thenable<boolean>;

		refreshNode(nodeInfo: ExpandNodeInfo): Thenable<boolean>;

		findNodes(findNodesInfo: FindNodesInfo): Thenable<ObjectExplorerFindNodesResponse>;

		registerOnExpandCompleted(handler: (response: ObjectExplorerExpandInfo) => any): void;
	}

	export interface ObjectExplorerProvider extends ObjectExplorerProviderBase {
		createNewSession(connInfo: ConnectionInfo): Thenable<ObjectExplorerSessionResponse>;

		closeSession(closeSessionInfo: ObjectExplorerCloseSessionInfo): Thenable<ObjectExplorerCloseSessionResponse>;

		registerOnSessionCreated(handler: (response: ObjectExplorerSession) => any): void;

		registerOnSessionDisconnected?(handler: (response: ObjectExplorerSession) => any): void;
	}

	export interface ObjectExplorerNodeProvider extends ObjectExplorerProviderBase {
		/**
		 * The providerId for whichever type of ObjectExplorer connection this can add folders and objects to
		 */
		readonly supportedProviderId: string;

		/**
		 * Optional group name used to sort nodes in the tree. If not defined, the node order will be added in order based on provider ID, with
		 * nodes from the main ObjectExplorerProvider for this provider type added first
		 */
		readonly group?: string;

		handleSessionOpen(session: ObjectExplorerSession): Thenable<boolean>;

		handleSessionClose(closeSessionInfo: ObjectExplorerCloseSessionInfo): void;
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

	// Agent Services types
	export enum WeekDays {
		sunday = 1,
		monday = 2,
		tuesday = 4,
		wednesday = 8,
		thursday = 16,
		friday = 32,
		weekDays = 62,
		saturday = 64,
		weekEnds = 65,
		everyDay = 127
	}

	export enum NotifyMethods {
		none = 0,
		notifyEmail = 1,
		pager = 2,
		netSend = 4,
		notifyAll = 7
	}

	export enum AlertType {
		sqlServerEvent = 1,
		sqlServerPerformanceCondition = 2,
		nonSqlServerEvent = 3,
		wmiEvent = 4
	}

	export enum JobCompletionActionCondition {
		Never = 0,
		OnSuccess = 1,
		OnFailure = 2,
		Always = 3
	}

	export enum FrequencyTypes {
		Unknown,
		OneTime = 1 << 1,
		Daily = 1 << 2,
		Weekly = 1 << 3,
		Monthly = 1 << 4,
		MonthlyRelative = 1 << 5,
		AutoStart = 1 << 6,
		OnIdle = 1 << 7
	}

	export enum FrequencySubDayTypes {
		Unknown = 0,
		Once = 1,
		Second = 2,
		Minute = 4,
		Hour = 8
	}

	export enum FrequencyRelativeIntervals {
		First = 1,
		Second = 2,
		Third = 4,
		Fourth = 8,
		Last = 16
	}

	export enum JobExecutionStatus {
		Executing = 1,
		WaitingForWorkerThread = 2,
		BetweenRetries = 3,
		Idle = 4,
		Suspended = 5,
		WaitingForStepToFinish = 6,
		PerformingCompletionAction = 7
	}

	export interface AgentJobInfo {
		name: string;
		owner: string;
		description: string;
		currentExecutionStatus: number;
		lastRunOutcome: number;
		currentExecutionStep: string;
		enabled: boolean;
		hasTarget: boolean;
		hasSchedule: boolean;
		hasStep: boolean;
		runnable: boolean;
		category: string;
		categoryId: number;
		categoryType: number;
		lastRun: string;
		nextRun: string;
		jobId: string;
		startStepId: number;
		emailLevel: JobCompletionActionCondition;
		pageLevel: JobCompletionActionCondition;
		eventLogLevel: JobCompletionActionCondition;
		deleteLevel: JobCompletionActionCondition;
		operatorToEmail: string;
		operatorToPage: string;
		jobSteps: AgentJobStepInfo[];
		jobSchedules: AgentJobScheduleInfo[];
		alerts: AgentAlertInfo[];
	}

	export interface AgentJobScheduleInfo {
		id: number;
		name: string;
		jobName: string;
		isEnabled: boolean;
		frequencyTypes: FrequencyTypes;
		frequencySubDayTypes: FrequencySubDayTypes;
		frequencySubDayInterval: number;
		frequencyRelativeIntervals: FrequencyRelativeIntervals;
		frequencyRecurrenceFactor: number;
		frequencyInterval: number;
		dateCreated: string;
		activeStartTimeOfDay: string;
		activeStartDate: string;
		activeEndTimeOfDay: string;
		jobCount: number;
		activeEndDate: string;
		scheduleUid: string;
		description: string;
	}

	export interface AgentJobStep {
		jobId: string;
		stepId: string;
		stepName: string;
		message: string;
		runDate: string;
		runStatus: number;
		stepDetails: AgentJobStepInfo;
	}

	export interface AgentJobStepInfo {
		jobId: string;
		jobName: string;
		script: string;
		scriptName: string;
		stepName: string;
		subSystem: string;
		id: number;
		failureAction: string;
		successAction: string;
		failStepId: number;
		successStepId: number;
		command: string;
		commandExecutionSuccessCode: number;
		databaseName: string;
		databaseUserName: string;
		server: string;
		outputFileName: string;
		appendToLogFile: boolean;
		appendToStepHist: boolean;
		writeLogToTable: boolean;
		appendLogToTable: boolean;
		retryAttempts: number;
		retryInterval: number;
		proxyName: string;
	}

	export interface AgentJobHistoryInfo {
		instanceId: number;
		sqlMessageId: string;
		message: string;
		stepId: string;
		stepName: string;
		sqlSeverity: string;
		jobId: string;
		jobName: string;
		runStatus: number;
		runDate: string;
		runDuration: string;
		operatorEmailed: string;
		operatorNetsent: string;
		operatorPaged: string;
		retriesAttempted: string;
		server: string;
		steps: AgentJobStep[];
	}

	export interface AgentProxyInfo {
		id: number;
		accountName: string;
		description: string;
		credentialName: string;
		credentialIdentity: string;
		credentialId: number;
		isEnabled: boolean;
	}

	export interface AgentAlertInfo {
		id: number;
		name: string;
		delayBetweenResponses: number;
		eventDescriptionKeyword: string;
		eventSource: string;
		hasNotification: number;
		includeEventDescription: NotifyMethods;
		isEnabled: boolean;
		jobId: string;
		jobName: string;
		lastOccurrenceDate: string;
		lastResponseDate: string;
		messageId: number;
		notificationMessage: string;
		occurrenceCount: number;
		performanceCondition: string;
		severity: number;
		databaseName: string;
		countResetDate: string;
		categoryName: string;
		alertType: AlertType;
		wmiEventNamespace: string;
		wmiEventQuery: string;
	}

	export interface AgentOperatorInfo {
		name: string;
		id: number;
		emailAddress: string;
		enabled: boolean;
		lastEmailDate: string;
		lastNetSendDate: string;
		lastPagerDate: string;
		pagerAddress: string;
		categoryName: string;
		pagerDays: WeekDays;
		saturdayPagerEndTime: string;
		saturdayPagerStartTime: string;
		sundayPagerEndTime: string;
		sundayPagerStartTime: string;
		netSendAddress: string;
		weekdayPagerStartTime: string;
		weekdayPagerEndTime: string;
	}

	export interface ResultStatus {
		success: boolean;
		errorMessage: string;
	}

	export interface AgentJobsResult extends ResultStatus {
		jobs: AgentJobInfo[];
	}

	export interface AgentJobHistoryResult extends ResultStatus {
		histories: AgentJobHistoryInfo[];
		steps: AgentJobStepInfo[];
		schedules: AgentJobScheduleInfo[];
		alerts: AgentAlertInfo[];
	}

	export interface CreateAgentJobResult extends ResultStatus {
		job: AgentJobInfo;
	}

	export interface UpdateAgentJobResult extends ResultStatus {
		job: AgentJobInfo;
	}

	export interface AgentJobCategory {
		id: string;
		name: string;
	}

	export interface AgentJobDefaultsResult extends ResultStatus {
		owner: string;
		categories: AgentJobCategory[];
	}

	export interface CreateAgentJobStepResult extends ResultStatus {
		step: AgentJobStepInfo;
	}

	export interface UpdateAgentJobStepResult extends ResultStatus {
		step: AgentJobStepInfo;
	}

	export interface CreateAgentProxyResult extends ResultStatus {
		step: AgentJobStepInfo;
	}

	export interface UpdateAgentProxyResult extends ResultStatus {
		step: AgentJobStepInfo;
	}

	export interface AgentAlertsResult extends ResultStatus {
		alerts: AgentAlertInfo[];
	}

	export interface CreateAgentAlertResult extends ResultStatus {
		alert: AgentJobStepInfo;
	}

	export interface UpdateAgentAlertResult extends ResultStatus {
		alert: AgentJobStepInfo;
	}

	export interface AgentOperatorsResult extends ResultStatus {
		operators: AgentOperatorInfo[];
	}

	export interface CreateAgentOperatorResult extends ResultStatus {
		operator: AgentOperatorInfo;
	}

	export interface UpdateAgentOperatorResult extends ResultStatus {
		operator: AgentOperatorInfo;
	}

	export interface AgentProxiesResult extends ResultStatus {
		proxies: AgentProxyInfo[];
	}

	export interface CreateAgentProxyResult extends ResultStatus {
		proxy: AgentProxyInfo;
	}

	export interface UpdateAgentProxyResult extends ResultStatus {
		proxy: AgentProxyInfo;
	}

	export interface AgentJobSchedulesResult extends ResultStatus {
		schedules: AgentJobScheduleInfo[];
	}

	export interface CreateAgentJobScheduleResult extends ResultStatus {
		schedule: AgentJobScheduleInfo;
	}

	export interface UpdateAgentJobScheduleResult extends ResultStatus {
		schedule: AgentJobScheduleInfo;
	}

	export interface AgentServicesProvider extends DataProvider {
		// Job management methods
		getJobs(ownerUri: string): Thenable<AgentJobsResult>;
		getJobHistory(ownerUri: string, jobId: string, jobName: string): Thenable<AgentJobHistoryResult>;
		jobAction(ownerUri: string, jobName: string, action: string): Thenable<ResultStatus>;
		createJob(ownerUri: string, jobInfo: AgentJobInfo): Thenable<CreateAgentJobResult>;
		updateJob(ownerUri: string, originalJobName: string, jobInfo: AgentJobInfo): Thenable<UpdateAgentJobResult>;
		deleteJob(ownerUri: string, jobInfo: AgentJobInfo): Thenable<ResultStatus>;
		getJobDefaults(ownerUri: string): Thenable<AgentJobDefaultsResult>;

		// Job Step management methods
		createJobStep(ownerUri: string, stepInfo: AgentJobStepInfo): Thenable<CreateAgentJobStepResult>;
		updateJobStep(ownerUri: string, originalJobStepName: string, stepInfo: AgentJobStepInfo): Thenable<UpdateAgentJobStepResult>;
		deleteJobStep(ownerUri: string, stepInfo: AgentJobStepInfo): Thenable<ResultStatus>;

		// Alert management methods
		getAlerts(ownerUri: string): Thenable<AgentAlertsResult>;
		createAlert(ownerUri: string, alertInfo: AgentAlertInfo): Thenable<CreateAgentAlertResult>;
		updateAlert(ownerUri: string, originalAlertName: string, alertInfo: AgentAlertInfo): Thenable<UpdateAgentAlertResult>;
		deleteAlert(ownerUri: string, alertInfo: AgentAlertInfo): Thenable<ResultStatus>;

		// Operator management methods
		getOperators(ownerUri: string): Thenable<AgentOperatorsResult>;
		createOperator(ownerUri: string, operatorInfo: AgentOperatorInfo): Thenable<CreateAgentOperatorResult>;
		updateOperator(ownerUri: string, originalOperatorName: string, operatorInfo: AgentOperatorInfo): Thenable<UpdateAgentOperatorResult>;
		deleteOperator(ownerUri: string, operatorInfo: AgentOperatorInfo): Thenable<ResultStatus>;

		// Proxy management methods
		getProxies(ownerUri: string): Thenable<AgentProxiesResult>;
		createProxy(ownerUri: string, proxyInfo: AgentProxyInfo): Thenable<CreateAgentOperatorResult>;
		updateProxy(ownerUri: string, originalProxyName: string, proxyInfo: AgentProxyInfo): Thenable<UpdateAgentOperatorResult>;
		deleteProxy(ownerUri: string, proxyInfo: AgentProxyInfo): Thenable<ResultStatus>;

		// Credential method
		getCredentials(ownerUri: string): Thenable<GetCredentialsResult>;

		// Job Schedule management methods
		getJobSchedules(ownerUri: string): Thenable<AgentJobSchedulesResult>;
		createJobSchedule(ownerUri: string, scheduleInfo: AgentJobScheduleInfo): Thenable<CreateAgentJobScheduleResult>;
		updateJobSchedule(ownerUri: string, originalScheduleName: string, scheduleInfo: AgentJobScheduleInfo): Thenable<UpdateAgentJobScheduleResult>;
		deleteJobSchedule(ownerUri: string, scheduleInfo: AgentJobScheduleInfo): Thenable<ResultStatus>;

		registerOnUpdated(handler: () => any): void;
	}

	// DacFx interfaces  -----------------------------------------------------------------------
	export interface DacFxResult extends ResultStatus {
		operationId: string;
	}

	export interface GenerateDeployPlanResult extends DacFxResult {
		report: string;
	}

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
		taskExecutionMode: TaskExecutionMode;
	}

	export interface DeployParams {
		packageFilePath: string;
		databaseName: string;
		upgradeExisting: boolean;
		ownerUri: string;
		taskExecutionMode: TaskExecutionMode;
	}

	export interface GenerateDeployScriptParams {
		packageFilePath: string;
		databaseName: string;
		scriptFilePath: string;
		ownerUri: string;
		taskExecutionMode: TaskExecutionMode;
	}

	export interface GenerateDeployPlan {
		packageFilePath: string;
		databaseName: string;
		ownerUri: string;
		taskExecutionMode: TaskExecutionMode;
	}

	export interface DacFxServicesProvider extends DataProvider {
		exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
		importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
		extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
		deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
		generateDeployScript(packageFilePath: string, databaseName: string, scriptFilePath: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
		generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<GenerateDeployPlanResult>;
	}

	// Security service interfaces ------------------------------------------------------------------------
	export interface CredentialInfo {
		id: number;
		identity: string;
		name: string;
		dateLastModified: string;
		createDate: string;
		providerName: string;
	}

	export interface GetCredentialsResult extends ResultStatus {
		credentials: CredentialInfo[];
	}

	// Task service interfaces ----------------------------------------------------------------------------
	export enum TaskStatus {
		NotStarted = 0,
		InProgress = 1,
		Succeeded = 2,
		SucceededWithWarning = 3,
		Failed = 4,
		Canceled = 5,
		Canceling = 6
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
		connection?: connection.Connection;
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
		script?: string;
	}

	export interface TaskServicesProvider extends DataProvider {
		getAllTasks(listTasksParams: ListTasksParams): Thenable<ListTasksResponse>;

		cancelTask(cancelTaskParams: CancelTaskParams): Thenable<boolean>;

		registerOnTaskCreated(handler: (response: TaskInfo) => any): void;

		registerOnTaskStatusChanged(handler: (response: TaskProgressInfo) => any): void;
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
		createSession(sessionId: string, sessionName: string, template: ProfilerSessionTemplate): Thenable<boolean>;
		startSession(sessionId: string, sessionName: string): Thenable<boolean>;
		stopSession(sessionId: string): Thenable<boolean>;
		pauseSession(sessionId: string): Thenable<boolean>;
		getXEventSessions(sessionId: string): Thenable<string[]>;
		connectSession(sessionId: string): Thenable<boolean>;
		disconnectSession(sessionId: string): Thenable<boolean>;

		registerOnSessionEventsAvailable(handler: (response: ProfilerSessionEvents) => any): void;
		registerOnSessionStopped(handler: (response: ProfilerSessionStoppedParams) => any): void;
		registerOnProfilerSessionCreated(handler: (response: ProfilerSessionCreatedParams) => any): void;
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

	/**
	 * Profiler Session Template
	 */
	export interface ProfilerSessionTemplate {
		/**
		 * Template name
		 */
		name: string;

		/**
		 * Default view for template
		 */
		defaultView: string;

		/**
		 * TSQL for creating a session
		 */
		createStatement: string;
	}

	export interface ProfilerSessionEvents {
		sessionId: string;

		events: ProfilerEvent[];

		eventsLost: boolean;
	}

	export interface ProfilerSessionStoppedParams {

		ownerUri: string;

		sessionId: number;
	}

	export interface ProfilerSessionCreatedParams {
		ownerUri: string;
		sessionName: string;
		templateName: string;
	}

	// File browser interfaces  -----------------------------------------------------------------------

	export interface FileBrowserProvider extends DataProvider {
		openFileBrowser(ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Thenable<boolean>;
		registerOnFileBrowserOpened(handler: (response: FileBrowserOpenedParams) => any): void;
		expandFolderNode(ownerUri: string, expandPath: string): Thenable<boolean>;
		registerOnFolderNodeExpanded(handler: (response: FileBrowserExpandedParams) => any): void;
		validateFilePaths(ownerUri: string, serviceType: string, selectedFiles: string[]): Thenable<boolean>;
		registerOnFilePathsValidated(handler: (response: FileBrowserValidatedParams) => any): void;
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

		/**
		 * Gets all added accounts.
		 * @returns {Thenable<Account>} Promise to return the accounts
		 */
		export function getAllAccounts(): Thenable<Account[]>;

		/**
		 * Generates a security token by asking the account's provider
		 * @param {Account} account Account to generate security token for (defaults to
		 * AzureResource.ResourceManagement if not given)
		 * @return {Thenable<{}>} Promise to return the security token
		 */
		export function getSecurityToken(account: Account, resource?: AzureResource): Thenable<{}>;

		/**
		 * An [event](#Event) which fires when the accounts have changed.
		 */
		export const onDidChangeAccounts: vscode.Event<DidChangeAccountsParams>;
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

	export enum AzureResource {
		ResourceManagement = 0,
		Sql = 1
	}

	export interface DidChangeAccountsParams {
		// Updated accounts
		accounts: Account[];
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
		 * @param {AzureResource} resource The resource to get the token for
		 * @return {Thenable<{}>} Promise to return a security token object
		 */
		getSecurityToken(account: Account, resource: AzureResource): Thenable<{}>;

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
		 * @deprecated this method has been deprecated and will be removed in a future release, please use sqlops.window.createWebViewDialog instead.
		 * @param title
		 */
		export function createDialog(
			title: string
		): ModalDialog;
	}

	export namespace workspace {
		/**
		 * An event that is emitted when a [dashboard](#DashboardDocument) is opened.
		 */
		export const onDidOpenDashboard: vscode.Event<DashboardDocument>;

		/**
		 * An event that is emitted when a [dashboard](#DashboardDocument) is focused.
		 */
		export const onDidChangeToDashboard: vscode.Event<DashboardDocument>;
	}

	export interface DashboardDocument {
		profile: IConnectionProfile;
		serverInfo: ServerInfo;
	}

	export class TreeItem extends vscode.TreeItem {
		payload?: IConnectionProfile;
		childProvider?: string;
	}

	export namespace tasks {

		export interface ITaskHandler {
			(profile: IConnectionProfile, ...args: any[]): any;
		}

		/**
		* Registers a task that can be invoked via a keyboard shortcut,
		* a menu item, an action, or directly.
		*
		* Registering a task with an existing task identifier twice
		* will cause an error.
		*
		* @param task A unique identifier for the task.
		* @param callback A task handler function.
		* @param thisArg The `this` context used when invoking the handler function.
		* @return Disposable which unregisters this task on disposal.
		*/
		export function registerTask(task: string, callback: ITaskHandler, thisArg?: any): vscode.Disposable;
	}
}
