/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for API experiments and proposal.

import * as vscode from 'vscode';

declare module 'azdata' {

	export namespace nb {
		export interface NotebookDocument {
			/**
			 * Sets the trust mode for the notebook document.
			 */
			setTrusted(state: boolean): void;
		}

		export interface ISessionOptions {
			/**
			 * The spec for the kernel being used to create this session.
			 */
			kernelSpec?: IKernelSpec;
		}

		export interface IKernelSpec {
			/**
			 * The list of languages that are supported for this kernel.
			 */
			supportedLanguages?: string[];
		}

		export interface IStandardKernel {
			/**
			 * The list of languages that are supported for this kernel.
			 */
			supportedLanguages: string[];
			readonly blockedOnSAW?: boolean;
		}

		export interface IKernelChangedArgs {
			nbKernelAlias?: string
		}

		export interface ICellOutput {
			/**
			 * Unique identifier for this cell output.
			 */
			id?: string;
		}

		export interface IExecuteResult {
			data: any;
		}

		export interface IExecuteResultUpdate {
			output_type: string;
			resultSet: ResultSetSummary;
			data: any;
		}

		export interface IExecuteRequest {
			/**
			 * The language of the notebook document that is executing this request.
			 */
			language: string;
		}

		export interface INotebookMetadata {
			connection_name?: string;
			multi_connection_mode?: boolean;
		}

		export interface ICellMetadata {
			connection_name?: string;
		}

		export interface ICellContents {
			attachments?: ICellAttachments;
		}

		export type ICellAttachments = { [key: string]: ICellAttachment };
		export type ICellAttachment = { [key: string]: string };

		export interface SessionManager {
			/**
			 * Shutdown all sessions.
			 */
			shutdownAll(): Thenable<void>;
			/**
			 * Disposes the session manager.
			 */
			dispose(): void;
		}

		/**
		 * An event that is emitted when a {@link NotebookDocument} is closed.
		 */
		export const onDidCloseNotebookDocument: vscode.Event<NotebookDocument>;

		export interface IKernel {

			/**
			 * Restart a kernel.
			 *
			 * #### Notes
			 * Uses the [Jupyter Notebook API](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/jupyter/notebook/4.x/notebook/services/api/api.yaml#!/kernels).
			 *
			 * The promise is fulfilled on a valid response and rejected otherwise.
			 *
			 * It is assumed that the API call does not mutate the kernel id or name.
			 *
			 * The promise will be rejected if the kernel status is `Dead` or if the
			 * request fails or the response is invalid.
			 */
			restart(): Thenable<void>;
		}
	}

	export interface LoadingComponentBase {
		/**
		* When true, the component will display a loading spinner.
		*/
		loading?: boolean;

		/**
		 * This sets the alert text which gets announced when the loading spinner is shown.
		 */
		loadingText?: string;

		/**
		 * The text to display while loading is set to false. Will also be announced through screen readers
		 * once loading is completed.
		 */
		loadingCompletedText?: string;
	}

	/**
	 * The column information of a data set.
	 */
	export interface SimpleColumnInfo {
		/**
		 * The column name.
		 */
		name: string;
		/**
		 * The data type of the column.
		 */
		dataTypeName: string;
	}

	/**
	 * The parameters for start data serialization request.
	 */
	export interface SerializeDataStartRequestParams {
		/**
		 * 'csv', 'json', 'excel', 'xml'
		 */
		saveFormat: string;
		/**
		 * The path of the target file.
		 */
		filePath: string;
		/**
		 * Whether the request is the last batch of the data set to be serialized.
		 */
		isLastBatch: boolean;
		/**
		 * Data to be serialized.
		 */
		rows: DbCellValue[][];
		/**
		 * The columns of the data set.
		 */
		columns: SimpleColumnInfo[];
		/**
		 * Whether to include column headers to the target file.
		 */
		includeHeaders?: boolean;
		/**
		 * The delimiter to seperate the cells.
		 */
		delimiter?: string;
		/**
		 * The line seperator.
		 */
		lineSeperator?: string;
		/**
		 * Character used for enclosing text fields when saving results as CSV.
		 */
		textIdentifier?: string;
		/**
		 * File encoding used when saving results as CSV.
		 */
		encoding?: string;
		/**
		 * When true, XML output will be formatted when saving results as XML.
		 */
		formatted?: boolean;
	}

	/**
	 * The parameters for continue data serialization request.
	 */
	export interface SerializeDataContinueRequestParams {
		/**
		 * The path of the target file.
		 */
		filePath: string;
		/**
		 * Whether the request is the last batch.
		 */
		isLastBatch: boolean;
		/**
		 * Data to be serialized.
		 */
		rows: DbCellValue[][];
	}

	/**
	 * The result of data serialization data request.
	 */
	export interface SerializeDataResult {
		/**
		 * The output message.
		 */
		messages?: string;
		/**
		 * Whether the serialization is succeeded.
		 */
		succeeded: boolean;
	}

	/**
	 * The serialization provider.
	 */
	export interface SerializationProvider extends DataProvider {
		/**
		 * Start the data serialization.
		 * @param requestParams the request parameters.
		 */
		startSerialization(requestParams: SerializeDataStartRequestParams): Thenable<SerializeDataResult>;
		/**
		 * Continue the data serialization.
		 * @param requestParams the request parameters.
		 */
		continueSerialization(requestParams: SerializeDataContinueRequestParams): Thenable<SerializeDataResult>;
	}

	export namespace dataprotocol {
		/**
		 * Registers a SerializationProvider.
		 * @param provider The data serialization provider.
		 */
		export function registerSerializationProvider(provider: SerializationProvider): vscode.Disposable;
		export function registerSqlAssessmentServicesProvider(provider: SqlAssessmentServicesProvider): vscode.Disposable;
		/**
		 * Registers a DataGridProvider which is used to provide lists of items to a data grid
		 * @param provider The provider implementation
		 */
		export function registerDataGridProvider(provider: DataGridProvider): vscode.Disposable;
	}

	export enum DataProviderType {
		DataGridProvider = 'DataGridProvider'
	}

	/**
	 * The type of the DataGrid column
	 */
	export type DataGridColumnType = 'hyperlink' | 'text' | 'image';

	/**
	 * A column in a data grid
	 */
	export interface DataGridColumn {
		/**
		* The text to display on the column heading.
		 */
		name: string;

		/**
		* The property name in the DataGridItem
		 */
		field: string;

		/**
		* A unique identifier for the column within the grid.
		*/
		id: string;

		/**
		 * The type of column this is. This is used to determine how to render the contents.
		 */
		type: DataGridColumnType;

		/**
		 * Whether this column is sortable.
		 */
		sortable?: boolean;

		/**
		 * Whether this column is filterable
		 */
		filterable?: boolean;

		/**
		 * If false, column can no longer be resized.
		 */
		resizable?: boolean;

		/**
		 * If set to a non-empty string, a tooltip will appear on hover containing the string.
		 */
		tooltip?: string;

		/**
		 * Width of the column in pixels.
		 */
		width?: number
	}

	/**
	 * Info for a command to execute
	 */
	export interface ExecuteCommandInfo {
		/**
		 * The ID of the command to execute
		 */
		id: string;
		/**
		 * The text to display for the action
		 */
		displayText?: string;
		/**
		 * The optional args to pass to the command
		 */
		args?: any[];
	}

	/**
	 * Info for displaying a hyperlink value in a Data Grid table
	 */
	export interface DataGridHyperlinkInfo {
		/**
		 * The text to display for the link
		 */
		displayText: string;
		/**
		 * The URL to open or command to execute
		 */
		linkOrCommand: string | ExecuteCommandInfo;
	}

	/**
	 * An item for displaying in a data grid
	 */
	export interface DataGridItem {
		/**
		 * A unique identifier for this item
		 */
		id: string;

		/**
		 * The other properties that will be displayed in the grid columns
		 */
		[key: string]: string | DataGridHyperlinkInfo;
	}

	/**
	 * A data provider that provides lists of resource items for a data grid
	 */
	export interface DataGridProvider extends DataProvider {
		/**
		 * Gets the list of data grid items for this provider
		 */
		getDataGridItems(): Thenable<DataGridItem[]>;
		/**
		 * Gets the list of data grid columns for this provider
		 */
		getDataGridColumns(): Thenable<DataGridColumn[]>;

		/**
		 * The user visible string to use for the title of the grid
		 */
		title: string;
	}

	export interface ConnectionProvider extends DataProvider {
		/**
		 * Changes a user's password for the scenario of password expiration during SQL Authentication. (for Azure Data Studio use only)
		 */
		changePassword?(connectionUri: string, connectionInfo: ConnectionInfo, newPassword: string): Thenable<PasswordChangeResult>;
	}

	// Password Change Request ----------------------------------------------------------------------
	export interface PasswordChangeResult {
		/**
		 * Whether the password change was successful
		 */
		result: boolean;
		/**
		 * Error message if the password change was unsuccessful
		 */
		errorMessage?: string;
	}

	export interface IConnectionProfile extends ConnectionInfo {
		azureAccount?: string;
		azureResourceId?: string;
		azurePortalEndpoint?: string;
	}

	export interface PromptFailedResult extends ProviderError { }

	export interface ProviderError {
		/**
		 * Error name
		 */
		name?: string;

		/**
		 * Error code
		 */
		errorCode?: string;

		/**
		 * Error message
		 */
		errorMessage?: string;
	}


	export namespace diagnostics {
		/**
		 * Represents a diagnostics provider of accounts.
		 */
		export interface ErrorDiagnosticsProviderMetadata {
			/**
			 * The id of the provider (ex. a connection provider) that a diagnostics provider will handle errors for.
			 * Note: only ONE diagnostic provider per id/name at a time.
			 */
			targetProviderId: string;
		}

		export interface ConnectionDiagnosticsResult {
			/**
			 * Whether the error was handled or not.
			 */
			handled: boolean,
			/**
			 * Whether reconnect should be attempted.
			 */
			reconnect?: boolean,
			/**
			 * If given, the new set of connection options to assign to the original connection profile, overwriting any previous options.
			 */
			options?: { [name: string]: any };
		}

		/**
		 * Provides error information
		 */
		export interface IErrorInformation {
			/**
			 * Error code
			 */
			errorCode: number,
			/**
			 * Error Message
			 */
			errorMessage: string,
			/**
			 * Stack trace of error
			 */
			messageDetails: string
		}

		/**
		 * Diagnostics object for handling errors for a provider.
		 */
		export interface ErrorDiagnosticsProvider {
			/**
			 * Called when a connection error occurs, allowing the provider to optionally handle the error and fix any issues before continuing with completing the connection.
			 * @param errorInfo The error information of the connection error.
			 * @param connection The connection profile that caused the error.
			 * @returns ConnectionDiagnosticsResult: The result from the provider for whether the error was handled.
			 */
			handleConnectionError(errorInfo: IErrorInformation, connection: connection.ConnectionProfile): Thenable<ConnectionDiagnosticsResult>;
		}

		/**
		 * Registers provider with instance of Diagnostic Provider implementation.
		 * Note: only ONE diagnostic provider object can be assigned to a specific provider at a time.
		 * @param providerMetadata Additional data used to register the provider
		 * @param errorDiagnostics The provider's diagnostic object that handles errors.
		 * @returns  A disposable that when disposed will unregister the provider
		 */
		export function registerDiagnosticsProvider(providerMetadata: ErrorDiagnosticsProviderMetadata, errorDiagnostics: ErrorDiagnosticsProvider): vscode.Disposable;
	}

	export namespace connection {

		/**
		 * Opens the change password dialog.
		 * @param profile The connection profile to change the password for.
		 * @returns The new password that is returned from the operation or undefined if unsuccessful.
		 */
		export function openChangePasswordDialog(profile: IConnectionProfile): Thenable<string | undefined>;

		/**
		 * Gets the non default options of the connection profile.
		 * @param profile The connection profile to get the options for.
		 * @returns The string key containing the non default options (if any) for the profile.
		 */
		export function getNonDefaultOptions(profile: IConnectionProfile): Thenable<string>;
	}

	export interface ConnectionInfoSummary {
		/**
		 * ID used to identify the connection on the server, if available.
		 */
		serverConnectionId?: string | undefined;
	}

	export interface QueryExecuteCompleteNotificationResult {
		/**
		 * ID used to identify the connection used to run the query on the server, if available.
		 */
		serverConnectionId?: string | undefined;
	}

	/*
	 * Add optional per-OS default value.
	 */
	export interface DefaultValueOsOverride {
		os: string;

		defaultValueOverride: string;
	}

	export interface ConnectionOption {
		defaultValueOsOverrides?: DefaultValueOsOverride[];

		/**
		 * Used to define placeholder text
		 */
		placeholder?: string;

		/**
		 * When set to true, the respective connection option will be rendered on the main connection dialog
		 * and not the Advanced Options window.
		 */
		showOnConnectionDialog?: boolean;

		/**
		 * Used to define list of values based on which another option is rendered visible/hidden.
		 */
		onSelectionChange?: SelectionChangeEvent[];
	}

	export interface ServiceOption {
		/**
		 * Used to define placeholder text
		 */
		placeholder?: string;

		/**
		 * Used to define list of values based on which another option is rendered visible/hidden.
		 */
		onSelectionChange?: SelectionChangeEvent[];
	}
	/**
	 * This change event defines actions
	 */
	export interface SelectionChangeEvent {
		/**
		 * Values that affect actions defined in this event.
		 */
		values: string[];

		/**
		 * Action to be taken on another option when selected value matches to the list of values provided.
		 */
		dependentOptionActions: DependentOptionAction[];
	}

	export interface DependentOptionAction {
		/**
		 * Name of option affected by defined action.
		 */
		optionName: string,

		/**
		 * Action to be taken, Supported values: 'show', 'hide'.
		 */
		action: string;

		/**
		 * Whether or not the option should be set to required when visible. Defaults to false.
		 * NOTE: Since this is dynamically defined, option values are not updated on 'show' and validation is not performed.
		 * When set to true, providers must handle property validation.
		 */
		required?: boolean;
	}

	// Object Explorer interfaces  --------------------------------
	export interface ObjectExplorerSession {
		/**
		 * Authentication token for the current session.
		 */
		securityToken?: accounts.AccountSecurityToken | undefined;
	}

	export interface ExpandNodeInfo {
		/**
		 * Authentication token for the current session.
		 */
		securityToken?: accounts.AccountSecurityToken | undefined;

		/**
		 * Filters to apply to the child nodes being returned
		 */
		filters?: NodeFilter[];
	}
	// End Object Explorer interfaces  ----------------------------

	export interface TaskInfo {
		targetLocation?: string;
	}

	export interface ButtonColumnOption {
		icon?: IconPath;
	}

	export namespace sqlAssessment {

		export enum SqlAssessmentTargetType {
			Server = 1,
			Database = 2
		}

		export enum SqlAssessmentResultItemKind {
			RealResult = 0,
			Warning = 1,
			Error = 2
		}
	}
	// Assessment interfaces

	export interface SqlAssessmentResultItem {
		rulesetVersion: string;
		rulesetName: string;
		targetType: sqlAssessment.SqlAssessmentTargetType;
		targetName: string;
		checkId: string;
		tags: string[];
		displayName: string;
		description: string;
		message: string;
		helpLink: string;
		level: string;
		timestamp: string;
		kind: sqlAssessment.SqlAssessmentResultItemKind;
	}

	export interface SqlAssessmentResult extends ResultStatus {
		items: SqlAssessmentResultItem[];
		apiVersion: string;
	}

	export interface SqlAssessmentServicesProvider extends DataProvider {
		assessmentInvoke(ownerUri: string, targetType: sqlAssessment.SqlAssessmentTargetType): Promise<SqlAssessmentResult>;
		getAssessmentItems(ownerUri: string, targetType: sqlAssessment.SqlAssessmentTargetType): Promise<SqlAssessmentResult>;
		generateAssessmentScript(items: SqlAssessmentResultItem[]): Promise<ResultStatus>;
	}

	export interface TreeItem2 extends vscode.TreeItem {
		payload?: IConnectionProfile;
		childProvider?: string;
		type?: ExtensionNodeType;
	}

	export interface Component extends vscode.Disposable { }

	export namespace workspace {
		/**
		 * Creates and enters a workspace at the specified location
		 */
		export function createAndEnterWorkspace(location: vscode.Uri, workspaceFile?: vscode.Uri): Promise<void>;

		/**
		 * Enters the workspace with the provided path
		 * @param workspaceFile
		 */
		export function enterWorkspace(workspaceFile: vscode.Uri): Promise<void>;

		/**
		 * Saves and enters the workspace with the provided path
		 * @param workspaceFile
		 */
		export function saveAndEnterWorkspace(workspaceFile: vscode.Uri): Promise<void>;
	}

	export interface TableComponentProperties {
		/**
		 * Specifies whether to use headerFilter plugin
		 */
		headerFilter?: boolean,
	}

	export type ExecutionPlanData = executionPlan.ExecutionPlanGraphInfo | executionPlan.ExecutionPlanGraph[];

	export interface ExecutionPlanComponentProperties extends ComponentProperties {
		/**
		 * Provide the execution plan file to be displayed. In case of execution plan graph info, the file type will determine the provider to be used to generate execution plan graphs
		 */
		data?: ExecutionPlanData;
	}

	/**
	 * Defines the executionPlan component
	 */
	export interface ExecutionPlanComponent extends Component, ExecutionPlanComponentProperties {
	}

	export interface ModelBuilder {
		executionPlan(): ComponentBuilder<ExecutionPlanComponent, ExecutionPlanComponentProperties>;
	}

	export interface ListViewOption {
		/**
		 * The optional accessibility label for the column. Default is the label for the list view option.
		 */
		ariaLabel?: string;
		/**
		 * Specify the icon for the option. The value could the path to the icon or and ADS icon defined in {@link SqlThemeIcon}.
		 */
		icon?: IconPath;
	}

	export interface IconColumnCellValue {
		/**
		 * The icon to be displayed.
		 */
		icon: IconPath;
		/**
		 * The title of the icon.
		 */
		title: string;
	}

	export interface ButtonColumnCellValue {
		/**
		 * The icon to be displayed.
		 */
		icon?: IconPath;
		/**
		 * The title of the button.
		 */
		title?: string;
	}

	export interface HyperlinkColumnCellValue {
		/**
		 * The icon to be displayed.
		 */
		icon?: IconPath;
		/**
		 * The title of the hyperlink.
		 */
		title?: string;

		/**
		 * The url to open.
		 */
		url?: string;
		/**
		 * The role of the hyperlink. By default, the role is 'link' and the url will be opened in a new tab.
		 */
		role?: 'button' | 'link';
	}

	export interface ContextMenuColumnCellValue {
		/**
		 * The title of the hyperlink. By default, the title is 'Show Actions'
		 */
		title?: string;
		/**
		 * commands for the menu. Use an array for a group and menu separators will be added.
		 */
		commands: (string | string[])[];
		/**
		 * context that will be passed to the commands.
		 */
		context?: { [key: string]: string | boolean | number } | string | boolean | number | undefined
	}

	export enum ColumnType {
		icon = 3,
		hyperlink = 4,
		contextMenu = 5
	}

	export interface TableColumn {
		/**
		 * The text to display on the column heading. 'value' property will be used, if not specified
		 */
		name?: string;

		/**
		 * whether the column is resizable. Default value is true.
		 */
		resizable?: boolean;
	}

	export interface IconColumnOptions {
		/**
		 * The icon to use for all the cells in this column.
		 */
		icon?: IconPath;
	}

	export interface ButtonColumn extends IconColumnOptions, TableColumn {
		/**
		 * Whether to show the text, default value is false.
		 */
		showText?: boolean;
	}

	export interface HyperlinkColumn extends IconColumnOptions, TableColumn {
	}

	export interface CheckboxColumn extends TableColumn {
		action: ActionOnCellCheckboxCheck;
	}

	export interface ContextMenuColumn extends TableColumn {
	}

	export interface QueryExecuteResultSetNotificationParams {
		/**
		 * Contains execution plans returned by the database in ResultSets.
		 */
		executionPlans: executionPlan.ExecutionPlanGraph[];
	}

	export interface ObjectMetadata {
		/*
		 * Parent object name for subobjects such as triggers, indexes, etc.
		 */
		parentName?: string;

		/*
		 * Parent object type name, such as Table, View, etc.
		 */
		parentTypeName?: string;
	}

	/**
	 * Represents a selected range in the result grid.
	 */
	export interface SelectionRange {
		fromRow: number;
		toRow: number;
		fromColumn: number;
		toColumn: number;
	}

	/**
	 * Parameters for the copy results request.
	 */
	export interface CopyResultsRequestParams {
		/**
		 * URI of the editor.
		 */
		ownerUri: string;
		/**
		 * Index of the batch.
		 */
		batchIndex: number;
		/**
		 * Index of the result set.
		 */
		resultSetIndex: number;
		/**
		 * Whether to include the column headers.
		 */
		includeHeaders: boolean
		/**
		 * The selected ranges to be copied.
		 */
		selections: SelectionRange[];
	}

	export interface QueryProvider {
		/**
		 * Notify clients that the URI for a connection has been changed.
		 */
		connectionUriChanged?(newUri: string, oldUri: string): Thenable<void>;
		/**
		 * Copy the selected data to the clipboard.
		 * This is introduced to address the performance issue of large amount of data to ADS side.
		 * ADS will use this if 'supportCopyResultsToClipboard' property is set to true in the provider contribution point in extension's package.json.
		 * Otherwise, The default handler will load all the selected data to ADS and perform the copy operation.
		 */
		copyResults?(requestParams: CopyResultsRequestParams): Thenable<void>;
	}

	export enum DataProviderType {
		TableDesignerProvider = 'TableDesignerProvider',
		ExecutionPlanProvider = 'ExecutionPlanProvider',
		ServerContextualizationProvider = 'ServerContextualizationProvider'
	}

	export namespace dataprotocol {
		export function registerTableDesignerProvider(provider: designers.TableDesignerProvider): vscode.Disposable;
		export function registerExecutionPlanProvider(provider: executionPlan.ExecutionPlanProvider): vscode.Disposable;
		/**
		 * Registers a server contextualization provider, which can provide context about a server to extensions like GitHub
		 * Copilot for improved suggestions.
		 * @param provider The provider to register
		 */
		export function registerServerContextualizationProvider(provider: contextualization.ServerContextualizationProvider): vscode.Disposable;
	}

	export namespace designers {
		/**
		 * Open a table designer window.
		 * @param providerId The table designer provider Id.
		 * @param tableInfo The table information. The object will be passed back to the table designer provider as the unique identifier for the table.
		 * @param telemetryInfo Optional Key-value pair containing any extra information that needs to be sent via telemetry
		 * @param objectExplorerContext Optional The context used to refresh Object Explorer after the table is created or edited
		 */
		export function openTableDesigner(providerId: string, tableInfo: TableInfo, telemetryInfo?: { [key: string]: string }, objectExplorerContext?: ObjectExplorerContext): Thenable<void>;

		/**
		 * Definition for the table designer provider.
		 */
		export interface TableDesignerProvider extends DataProvider {
			/**
			 * Initialize the table designer for the specified table.
			 * @param table the table information.
			 */
			initializeTableDesigner(table: TableInfo): Thenable<TableDesignerInfo>;

			/**
			 * Process the table change.
			 * @param table the table information
			 * @param tableChangeInfo the information about the change user made through the UI.
			 */
			processTableEdit(table: TableInfo, tableChangeInfo: DesignerEdit): Thenable<DesignerEditResult<TableDesignerView>>;

			/**
			 * Publish the changes.
			 * @param table the table information
			 */
			publishChanges(table: TableInfo): Thenable<PublishChangesResult>;

			/**
			 * Generate script for the changes.
			 * @param table the table information
			 */
			generateScript(table: TableInfo): Thenable<string>;

			/**
			 * Generate preview report describing the changes to be made.
			 * @param table the table information
			 */
			generatePreviewReport(table: TableInfo): Thenable<GeneratePreviewReportResult>;

			/**
			 * Notify the provider that the table designer has been closed.
			 * @param table the table information
			 */
			disposeTableDesigner(table: TableInfo): Thenable<void>;
		}

		/**
		 * The information of the table.
		 */
		export interface TableInfo {
			/**
			 * Used as the table designer editor's tab header text (as well as the base value of the tooltip).
			 */
			title: string;
			/**
			 * Used as the table designer editor's tab header name text.
			 */
			tooltip: string;
			/**
			 * Unique identifier of the table. Will be used to decide whether a designer is already opened for the table.
			 */
			id: string;
			/**
			 * A boolean value indicates whether a new table is being designed.
			 */
			isNewTable: boolean;
			/**
			 * Extension can store additional information that the provider needs to uniquely identify a table.
			 */
			[key: string]: any;
			/**
			 * Table icon type that's shown in the editor tab. Default is the basic
			 * table icon.
			 */
			tableIcon?: TableIcon;
			/**
			 * Additional information for tooltip on hover displaying the full information of the connection.
			 */
			additionalInfo?: string;
		}

		/**
		 * The information to populate the table designer UI.
		 */
		export interface TableDesignerInfo {
			/**
			 * The view definition.
			 */
			view: TableDesignerView;
			/**
			 * The initial state of the designer.
			 */
			viewModel: DesignerViewModel;
			/**
			 * The new table info after initialization.
			 */
			tableInfo: TableInfo;
			/**
			 * The issues.
			 */
			issues?: DesignerIssue[];
		}

		/**
		 * Table icon that's shown on the editor tab
		 */
		export enum TableIcon {
			Basic = 'Basic',
			Temporal = 'Temporal',
			GraphNode = 'GraphNode',
			GraphEdge = 'GraphEdge'
		}

		/**
		 * Name of the common table properties.
		 * Extensions can use the names to access the designer view model.
		 */
		export enum TableProperty {
			Columns = 'columns',
			Description = 'description',
			Name = 'name',
			Schema = 'schema',
			Script = 'script',
			ForeignKeys = 'foreignKeys',
			CheckConstraints = 'checkConstraints',
			Indexes = 'indexes',
			PrimaryKey = 'primaryKey',
			PrimaryKeyName = 'primaryKeyName',
			PrimaryKeyDescription = 'primaryKeyDescription',
			PrimaryKeyColumns = 'primaryKeyColumns'
		}
		/**
		 * Name of the common table column properties.
		 * Extensions can use the names to access the designer view model.
		 */
		export enum TableColumnProperty {
			AllowNulls = 'allowNulls',
			DefaultValue = 'defaultValue',
			Length = 'length',
			Name = 'name',
			Description = 'description',
			Type = 'type',
			AdvancedType = 'advancedType',
			IsPrimaryKey = 'isPrimaryKey',
			Precision = 'precision',
			Scale = 'scale'
		}

		/**
		 * Name of the common foreign key constraint properties.
		 * Extensions can use the names to access the designer view model.
		 */
		export enum TableForeignKeyProperty {
			Name = 'name',
			Description = 'description',
			ForeignTable = 'foreignTable',
			OnDeleteAction = 'onDeleteAction',
			OnUpdateAction = 'onUpdateAction',
			Columns = 'columns'
		}

		/**
		 * Name of the columns mapping properties for foreign key.
		 */
		export enum ForeignKeyColumnMappingProperty {
			Column = 'column',
			ForeignColumn = 'foreignColumn'
		}

		/**
		 * Name of the common check constraint properties.
		 * Extensions can use the name to access the designer view model.
		 */
		export enum TableCheckConstraintProperty {
			Name = 'name',
			Description = 'description',
			Expression = 'expression'
		}

		/**
		 * Name of the common index properties.
		 * Extensions can use the name to access the designer view model.
		 */
		export enum TableIndexProperty {
			Name = 'name',
			Description = 'description',
			Columns = 'columns'
		}

		/**
		 * Name of the common properties of table index column specification.
		 */
		export enum TableIndexColumnSpecificationProperty {
			Column = 'column'
		}

		/**
		 * The table designer view definition.
		 */
		export interface TableDesignerView {
			/**
			 * Additional table properties. Common table properties are handled by Azure Data Studio. see {@link TableProperty}
			 */
			additionalTableProperties?: DesignerDataPropertyInfo[];
			/**
			 * Additional tabs.
			 */
			additionalTabs?: DesignerTab[];
			/**
			 * Columns table options.
			 * Common table columns properties are handled by Azure Data Studio. see {@link TableColumnProperty}.
			 * Default columns to display values are: Name, Type, Length, Precision, Scale, IsPrimaryKey, AllowNulls, DefaultValue.
			 */
			columnTableOptions?: TableDesignerBuiltInTableViewOptions;
			/**
			 * Foreign keys table options.
			 * Common foreign key properties are handled by Azure Data Studio. see {@link TableForeignKeyProperty}.
			 * Default columns to display values are: Name, PrimaryKeyTable.
			 */
			foreignKeyTableOptions?: TableDesignerBuiltInTableViewOptions;
			/**
			 * Foreign key column mapping table options.
			 * Common foreign key column mapping properties are handled by Azure Data Studio. see {@link ForeignKeyColumnMappingProperty}.
			 * Default columns to display values are: Column, ForeignColumn.
			 */
			foreignKeyColumnMappingTableOptions?: TableDesignerBuiltInTableViewOptions;
			/**
			 * Check constraints table options.
			 * Common check constraint properties are handled by Azure Data Studio. see {@link TableCheckConstraintProperty}
			 * Default columns to display values are: Name, Expression.
			 */
			checkConstraintTableOptions?: TableDesignerBuiltInTableViewOptions;
			/**
			 * Indexes table options.
			 * Common index properties are handled by Azure Data Studio. see {@link TableIndexProperty}
			 * Default columns to display values are: Name.
			 */
			indexTableOptions?: TableDesignerBuiltInTableViewOptions;
			/**
			* Index column specification table options.
			* Common index properties are handled by Azure Data Studio. see {@link TableIndexColumnSpecificationProperty}
			* Default columns to display values are: Column.
			*/
			indexColumnSpecificationTableOptions?: TableDesignerBuiltInTableViewOptions;
			/**
			* Primary column specification table options.
			* Common index properties are handled by Azure Data Studio. see {@link TableIndexColumnSpecificationProperty}
			* Default columns to display values are: Column.
			*/
			primaryKeyColumnSpecificationTableOptions?: TableDesignerBuiltInTableViewOptions;
			/**
			 * Additional primary key properties. Common primary key properties: primaryKeyName, primaryKeyDescription.
			 */
			additionalPrimaryKeyProperties?: DesignerDataPropertyInfo[];
			/**
			 * Components to be placed under the pre-defined tabs.
			 */
			additionalComponents?: DesignerDataPropertyWithTabInfo[];
			/**
			 * Whether to use advanced save mode. for advanced save mode, a publish changes dialog will be opened with preview of changes.
			 */
			useAdvancedSaveMode: boolean;
		}

		export interface TableDesignerBuiltInTableViewOptions extends DesignerTablePropertiesBase {
			/**
			 * Whether to show the table. Default value is false.
			 */
			showTable?: boolean;
			/**
			 * Properties to be displayed in the table, other properties can be accessed in the properties view.
			 */
			propertiesToDisplay?: string[];
			/**
			 * Additional properties for the entity.
			 */
			additionalProperties?: DesignerDataPropertyInfo[];
		}

		/**
		 * The view model of the designer.
		 */
		export interface DesignerViewModel {
			[key: string]: InputBoxProperties | CheckBoxProperties | DropDownProperties | DesignerTableProperties;
		}

		/**
		 * The definition of a designer tab.
		 */
		export interface DesignerTab {
			/**
			 * The title of the tab.
			 */
			title: string;
			/**
			 * the components to be displayed in this tab.
			 */
			components: DesignerDataPropertyInfo[];
		}

		/**
		 * The definition of the property in the designer.
		 */
		export interface DesignerDataPropertyInfo {
			/**
			 * The property name.
			 */
			propertyName: string;
			/**
			 * The description of the property.
			 */
			description?: string;
			/**
			 * The component type.
			 */
			componentType: DesignerComponentTypeName;
			/**
			 * The group name, properties with the same group name will be displayed under the same group on the UI.
			 */
			group?: string;
			/**
			 * Whether the property should be displayed in the properties view. The default value is true.
			 */
			showInPropertiesView?: boolean;
			/**
			 * The properties of the component.
			 */
			componentProperties: InputBoxProperties | CheckBoxProperties | DropDownProperties | DesignerTableProperties;
		}

		/**
		 * The definition of the property in the designer with tab info.
		 */
		export interface DesignerDataPropertyWithTabInfo extends DesignerDataPropertyInfo {
			/**
			 * The tab info where this property belongs to.
			 */
			tab: TableProperty.Columns | TableProperty.PrimaryKey | TableProperty.ForeignKeys | TableProperty.CheckConstraints | TableProperty.Indexes;
		}

		/**
		 * The child component types supported by designer.
		 */
		export type DesignerComponentTypeName = 'input' | 'checkbox' | 'dropdown' | 'table';

		export interface DesignerTablePropertiesBase {
			/**
			 * Whether user can add new rows to the table. The default value is true.
			 */
			canAddRows?: boolean;
			/**
			 * Whether user can remove rows from the table. The default value is true.
			 */
			canRemoveRows?: boolean;
			/**
			 * Whether user can move rows from one index to another. The default value is true.
			 */
			canMoveRows?: boolean;
			/**
			 * Whether user can insert rows at a given index to the table. The default value is true.
			 */
			canInsertRows?: boolean;
			/**
			 * Whether to show confirmation when user removes a row. The default value is false.
			 */
			showRemoveRowConfirmation?: boolean;
			/**
			 * The confirmation message to be displayed when user removes a row.
			 */
			removeRowConfirmationMessage?: string;
			/**
			 * Whether to show the item detail in properties view. The default value is true.
			 */
			showItemDetailInPropertiesView?: boolean;
			/**
			 * The label of the add new button. The default value is 'Add New'.
			 */
			labelForAddNewButton?: string;
		}

		/**
		 * The properties for the table component in the designer.
		 */
		export interface DesignerTableProperties extends ComponentProperties, DesignerTablePropertiesBase {
			/**
			 * the name of the properties to be displayed, properties not in this list will be accessible in properties pane.
			 */
			columns?: string[];
			/**
			 * The display name of the object type.
			 */
			objectTypeDisplayName: string;
			/**
			 * the properties of the table data item.
			 */
			itemProperties?: DesignerDataPropertyInfo[];
			/**
			 * The data to be displayed.
			 */
			data?: DesignerTableComponentDataItem[];
		}

		/**
		 * The data item of the designer's table component.
		 */
		export interface DesignerTableComponentDataItem {
			[key: string]: InputBoxProperties | CheckBoxProperties | DropDownProperties | DesignerTableProperties | boolean;
			/**
			 * Whether the row can be deleted. The default value is true.
			 */
			canBeDeleted?: boolean;
		}

		/**
		 * Type of the edit originated from the designer UI.
		 */
		export enum DesignerEditType {
			/**
			 * Add a row to a table.
			 */
			Add = 0,
			/**
			 * Remove a row from a table.
			 */
			Remove = 1,
			/**
			 * Update a property.
			 */
			Update = 2,
			/**
			 * Change the position of an item in the collection.
			 */
			Move = 3
		}

		/**
		 * Information of the edit originated from the designer UI.
		 */
		export interface DesignerEdit {
			/**
			 * The edit type.
			 */
			type: DesignerEditType;
			/**
			 * the path of the edit target.
			 */
			path: DesignerPropertyPath;
			/**
			 * the new value.
			 */
			value?: any;
		}

		/**
		 * The path of the property.
		 * Below are the 3 scenarios and their expected path.
		 * Note: 'index-{x}' in the description below are numbers represent the index of the object in the list.
		 * 1. 'Add' scenario
		 *     a. ['propertyName1']. Example: add a column to the columns property: ['columns'].
		 *     b. ['propertyName1',index-1,'propertyName2']. Example: add a column mapping to the first foreign key: ['foreignKeys',0,'mappings'].
		 * 2. 'Update' scenario
		 *     a. ['propertyName1']. Example: update the name of the table: ['name'].
		 *     b. ['propertyName1',index-1,'propertyName2']. Example: update the name of a column: ['columns',0,'name'].
		 *     c. ['propertyName1',index-1,'propertyName2',index-2,'propertyName3']. Example: update the source column of an entry in a foreign key's column mapping table: ['foreignKeys',0,'mappings',0,'source'].
		 * 3. 'Remove' scenario
		 *     a. ['propertyName1',index-1]. Example: remove a column from the columns property: ['columns',0'].
		 *     b. ['propertyName1',index-1,'propertyName2',index-2]. Example: remove a column mapping from a foreign key's column mapping table: ['foreignKeys',0,'mappings',0].
		 */
		export type DesignerPropertyPath = (string | number)[];

		/**
		 * Severity of the messages returned by the provider after processing an edit.
		 * 'error': The issue must be fixed in order to commit the changes.
		 * 'warning': Inform the user the potential risks with the current state. e.g. Having multiple edge constraints is only useful as a temporary state.
		 * 'information': Informational message.
		 */
		export type DesignerIssueSeverity = 'error' | 'warning' | 'information';

		/**
		 * Represents the issue in the designer
		 */
		export interface DesignerIssue {
			/**
			 * Severity of the issue.
			 */
			severity: DesignerIssueSeverity,
			/**
			 * Path of the property that is associated with the issue.
			 */
			propertyPath?: DesignerPropertyPath,
			/**
			 * Description of the issue.
			 */
			description: string,
			/**
			 * Url to a web page that has the explaination of the issue.
			 */
			moreInfoLink?: string;
		}

		/**
		 * The result returned by the table designer provider after handling an edit request.
		 */
		export interface DesignerEditResult<T> {
			/**
			 * The new view information if the view needs to be refreshed.
			 */
			view?: T;
			/**
			 * The view model object.
			 */
			viewModel: DesignerViewModel;
			/**
			 * Whether the current state is valid.
			 */
			isValid: boolean;
			/**
			 * Issues of current state.
			 */
			issues?: DesignerIssue[];
			/**
			 * The input validation error.
			 */
			inputValidationError?: string;
			/**
			 * Metadata related to the table
			 */
			metadata?: { [key: string]: string };
		}

		/**
		 * The result returned by the table designer provider after handling the publish changes request.
		 */
		export interface PublishChangesResult {
			/**
			 * The new table information after the changes are published.
			 */
			newTableInfo: TableInfo;
			/**
			 * The new view model.
			 */
			viewModel: DesignerViewModel;
			/**
			 * The new view.
			 */
			view: TableDesignerView;
			/**
			 * Metadata related to the table to be captured
			 */
			metadata?: { [key: string]: string };
		}

		export interface GeneratePreviewReportResult {
			/**
			 * Report generated for generate preview
			 */
			report: string;
			/**
			 * Format (mimeType) of the report
			 */
			mimeType: string;
			/**
			 * Whether user confirmation is required, the default value is false.
			 */
			requireConfirmation?: boolean;
			/**
			 * The confirmation text.
			 */
			confirmationText?: string;
			/**
			 * The table schema validation error.
			 */
			schemaValidationError?: string;
			/**
			 * Metadata related to the table to be captured
			 */
			metadata?: { [key: string]: string };
		}
	}

	export namespace executionPlan {
		export interface ExecutionPlanGraph {
			/**
			 * Root of the execution plan tree
			 */
			root: ExecutionPlanNode;
			/**
			 * Underlying query for the execution plan graph.
			 */
			query: string;
			/**
			 * String representation of graph
			 */
			graphFile: ExecutionPlanGraphInfo;
			/**
			 * Query recommendations for optimizing performance
			 */
			recommendations: ExecutionPlanRecommendations[];
		}

		export interface ExecutionPlanNode {
			/**
			 * Unique id given to node by the provider
			 */
			id: string;
			/**
			 * Type of the node. This property determines the icon that is displayed for it
			 */
			type: string;
			/**
			 * Cost associated with the node
			 */
			cost: number;
			/**
			 * Cost of the node subtree
			 */
			subTreeCost: number;
			/**
			 * Relative cost of the node compared to its siblings.
			 */
			relativeCost: number;
			/**
			 * Time take by the node operation in milliseconds
			 */
			elapsedTimeInMs: number;
			/**
			 * CPU time taken by the node operation in milliseconds
			 */
			elapsedCpuTimeInMs: number;
			/**
			 * Node properties to be shown in the tooltip
			 */
			properties: ExecutionPlanGraphElementProperty[];
			/**
			 * Display name for the node
			 */
			name: string;
			/**
			 * Description associated with the node.
			 */
			description: string;
			/**
			 * Subtext displayed under the node name
			 */
			subtext: string[];
			/**
			 * Direct children of the nodes.
			 */
			children: ExecutionPlanNode[];
			/**
			 * Edges corresponding to the children.
			 */
			edges: ExecutionPlanEdge[];
			/**
			 * Warning/parallelism badges applicable to the current node
			 */
			badges: ExecutionPlanBadge[];
			/**
			 * Data to show in top operations table for the node.
			 */
			topOperationsData: TopOperationsDataItem[];
			/**
			 * Output row count associated with the node
			 */
			rowCountDisplayString: string;
			/**
			 * Cost string for the node
			 */
			costDisplayString: string;
			/**
			 * Cost metrics for the node
			 */
			costMetrics: CostMetric[];
		}

		export interface CostMetric {
			/**
			 * Name of the cost metric.
			 */
			name: string;
			/**
			 * The value of the cost metric
			 */
			value: number | undefined;
		}

		export interface ExecutionPlanBadge {
			/**
			 * Type of the node overlay. This determines the icon that is displayed for it
			 */
			type: BadgeType;
			/**
			 * Text to display for the overlay tooltip
			 */
			tooltip: string;
		}

		export enum BadgeType {
			Warning = 0,
			CriticalWarning = 1,
			Parallelism = 2
		}

		export interface ExecutionPlanEdge {
			/**
			 * Count of the rows returned by the subtree of the edge.
			 */
			rowCount: number;
			/**
			 * Size of the rows returned by the subtree of the edge.
			 */
			rowSize: number;
			/**
			 * Edge properties to be shown in the tooltip.
			 */
			properties: ExecutionPlanGraphElementProperty[]
		}

		export interface ExecutionPlanGraphElementProperty {
			/**
			 * Name of the property
			 */
			name: string;
			/**
			 * value for the property
			 */
			value: string | ExecutionPlanGraphElementProperty[];
			/**
			 * Flag to show/hide props in tooltip
			 */
			showInTooltip: boolean;
			/**
			 * Display order of property
			 */
			displayOrder: number;
			/**
			 *  Flag to indicate if the property has a longer value so that it will be shown at the bottom of the tooltip
			 */
			positionAtBottom: boolean;
			/**
			 * Display value of property to show in tooltip and other UI element.
			 */
			displayValue: string;
			/**
			 * Data type of the property value
			 */
			dataType: ExecutionPlanGraphElementPropertyDataType;
			/**
			 * Indicates which value is better when 2 similar properties are compared.
			 */
			betterValue: ExecutionPlanGraphElementPropertyBetterValue;
		}

		export enum ExecutionPlanGraphElementPropertyDataType {
			Number = 0,
			String = 1,
			Boolean = 2,
			Nested = 3
		}

		export enum ExecutionPlanGraphElementPropertyBetterValue {
			LowerNumber = 0,
			HigherNumber = 1,
			True = 2,
			False = 3,
			None = 4
		}

		export interface ExecutionPlanRecommendations {
			/**
			 * Text displayed in the show plan graph control description
			 */
			displayString: string;
			/**
			 * Query that is recommended to the user
			 */
			queryText: string;
			/**
			 * Query that will be opened in a new file once the user click on the recommendation
			 */
			queryWithDescription: string;
		}

		export interface ExecutionPlanGraphInfo {
			/**
			 * File contents
			 */
			graphFileContent: string;
			/**
			 * File type for execution plan. This will be the file type of the editor when the user opens the graph file
			 */
			graphFileType: string;
			/**
			 * Index of the execution plan in the file content
			 */
			planIndexInFile?: number;
		}

		export interface GetExecutionPlanResult extends ResultStatus {
			graphs: ExecutionPlanGraph[]
		}

		export interface ExecutionGraphComparisonResult {
			/**
			 * The base ExecutionPlanNode for the ExecutionGraphComparisonResult.
			 */
			baseNode: ExecutionPlanNode;
			/**
			 * The children of the ExecutionGraphComparisonResult.
			 */
			children: ExecutionGraphComparisonResult[];
			/**
			 * The group index of the ExecutionGraphComparisonResult.
			 */
			groupIndex: number;
			/**
			 * Flag to indicate if the ExecutionGraphComparisonResult has a matching node in the compared execution plan.
			 */
			hasMatch: boolean;
			/**
			 * List of matching nodes for the ExecutionGraphComparisonResult.
			 */
			matchingNodesId: number[];
			/**
			 * The parent of the ExecutionGraphComparisonResult.
			 */
			parentNode: ExecutionGraphComparisonResult;
		}

		export interface ExecutionPlanComparisonResult extends ResultStatus {
			firstComparisonResult: ExecutionGraphComparisonResult;
			secondComparisonResult: ExecutionGraphComparisonResult;
		}

		export interface IsExecutionPlanResult {
			isExecutionPlan: boolean;
			queryExecutionPlanFileExtension: string;
		}

		export interface ExecutionPlanProvider extends DataProvider {
			// execution plan service methods

			/**
			 * Gets the execution plan graph from the provider for a given plan file
			 * @param planFile file that contains the execution plan
			 */
			getExecutionPlan(planFile: ExecutionPlanGraphInfo): Thenable<GetExecutionPlanResult>;
			/**
			 * Compares two execution plans and identifies matching regions in both execution plans.
			 * @param firstPlanFile file that contains the first execution plan.
			 * @param secondPlanFile file that contains the second execution plan.
			 */
			compareExecutionPlanGraph(firstPlanFile: ExecutionPlanGraphInfo, secondPlanFile: ExecutionPlanGraphInfo): Thenable<ExecutionPlanComparisonResult>;
			/**
			 * Determines if the provided value is an execution plan and returns the appropriate file extension.
			 * @param value String that needs to be checked.
			 */
			isExecutionPlan(value: string): Thenable<IsExecutionPlanResult>;
		}

		export interface TopOperationsDataItem {
			/**
			 * Column name for the top operation data item
			 */
			columnName: string;
			/**
			 * Cell data type for the top operation data item
			 */
			dataType: ExecutionPlanGraphElementPropertyDataType;
			/**
			 * Cell value for the top operation data item
			 */
			displayValue: string | number | boolean;
		}
	}

	export namespace contextualization {
		export interface GetServerContextualizationResult {
			/**
			 * The retrieved server context.
			 */
			context: string | undefined;
		}

		export interface ServerContextualizationProvider extends DataProvider {
			/**
			 * Gets server context, which can be in the form of create scripts but is left up each provider.
			 * @param ownerUri The URI of the connection to get context for.
			 */
			getServerContextualization(ownerUri: string): Thenable<GetServerContextualizationResult>;
		}
	}

	/**
	 * Component to display text with an icon representing the severity
	 */
	export interface InfoBoxComponent extends Component, InfoBoxComponentProperties {
		/**
		 * An event fired when the InfoBox is clicked
		 */
		onDidClick: vscode.Event<void>;
		/**
		 * An event fired when the Infobox link is clicked
		 */
		onLinkClick: vscode.Event<InfoBoxLinkClickEventArgs>;
	}

	export interface InfoBoxComponentProperties {
		/**
		 * Sets whether the infobox is clickable or not. This will display a right arrow at the end of infobox text.
		 * Default value is false.
		 */
		isClickable?: boolean | undefined;

		/**
		 * Sets the ariaLabel for the right arrow button that shows up in clickable infoboxes
		 */
		clickableButtonAriaLabel?: string;

		/**
		 * List of links to embed within the text. If links are specified there must be placeholder
		 * values in the value indicating where the links should be placed, in the format {i}
		 *
		 * e.g. "Click {0} for more information!""
		 */
		links?: LinkArea[];
	}

	/**
	 * Event argument for infobox link click event.
	 */
	export interface InfoBoxLinkClickEventArgs {
		/**
		 * Index of the link selected
		 */
		index: number;
		/**
		 * Link that is clicked
		 */
		link: LinkArea;
	}

	export interface TextComponentProperties {
		/**
		 * Corresponds to the aria-live accessibility attribute for this component
		 */
		ariaLive?: AriaLiveValue;
	}

	export interface ContainerProperties extends ComponentProperties {
		/**
		 * Corresponds to the aria-live accessibility attribute for this component
		 */
		ariaLive?: AriaLiveValue;
	}

	export interface DropDownProperties {
		/**
		 * Whether or not an option in the list must be selected or a "new" option can be set. Only applicable when 'editable' is true. Default false.
		 */
		strictSelection?: boolean;
	}

	export interface NodeInfo {
		/**
		 * The object type of the node. Node type is used to determine the icon, the object type is the actual type of the node, e.g. for Tables node
		 * under the database, the nodeType is Folder, the objectType is be Tables.
		 */
		objectType?: string;
		/*
		 * The path of the parent node.
		 */
		parentNodePath: string;
		/**
		 * Filterable properties that this node supports
		 */
		filterableProperties?: NodeFilterProperty[];
	}

	export interface NodeFilterProperty {
		/**
		 * The non-localized name of the filter property
		 */
		name: string;
		/**
		 * The name of the filter property displayed to the user
		 */
		displayName: string;
		/**
		 * The type of the filter property
		 */
		type: NodeFilterPropertyDataType;
		/**
		 * The description of the filter property
		 */
		description: string;
	}

	/**
	 * NodeFilterChoiceProperty is used to define the choices for the filter property if the type is choice
	 */
	export interface NodeFilterChoiceProperty extends NodeFilterProperty {
		/**
		 * The list of choices for the filter property if the type is choice
		 */
		choices: NodeFilterChoicePropertyValue[];
	}

	export interface NodeFilterChoicePropertyValue {
		/**
		 * The value of the choice
		 */
		value: string;
		/**
		 * The display name of the choice
		 * If not specified, the value will be used as the display name
		 * If specified, the display name will be used in the dropdown
		 */
		displayName?: string;
	}

	export interface NodeFilter {
		/**
		 * The name of the filter property
		 */
		name: string;
		/**
		 * The operator of the filter property
		 */
		operator: NodeFilterOperator;
		/**
		 * The applied values of the filter property
		 */
		value: string | string[] | number | number[] | boolean | undefined;
	}

	export enum NodeFilterPropertyDataType {
		String = 0,
		Number = 1,
		Boolean = 2,
		Date = 3,
		Choice = 4
	}

	export enum NodeFilterOperator {
		Equals = 0,
		NotEquals = 1,
		LessThan = 2,
		LessThanOrEquals = 3,
		GreaterThan = 4,
		GreaterThanOrEquals = 5,
		Between = 6,
		NotBetween = 7,
		Contains = 8,
		NotContains = 9,
		StartsWith = 10,
		NotStartsWith = 11,
		EndsWith = 12,
		NotEndsWith = 13
	}

	export interface ModelView extends vscode.Disposable { }

	export interface DeclarativeTableMenuCellValue extends vscode.Disposable { }

	export namespace window {
		export interface Wizard extends LoadingComponentBase { }

		export interface Dialog extends LoadingComponentBase, vscode.Disposable { }

		export interface ModelViewPanel extends vscode.Disposable { }

		export interface ModelViewDashboard extends vscode.Disposable { }

		/**
		 * Opens the error dialog with customization options provided.
		 * @param options Dialog options to customize error dialog.
		 * @returns Id of action button clicked by user, e.g. ok, cancel
		 */
		export function openCustomErrorDialog(options: IErrorDialogOptions): Thenable<string | undefined>;

		/**
		 * Provides dialog options to customize modal dialog content and layout
		 */
		export interface IErrorDialogOptions {
			/**
			 * Severity Level to identify icon of modal dialog.
			 */
			severity: MessageLevel;
			/**
			 * Title of modal dialog header.
			 */
			headerTitle: string;
			/**
			 * Message text to show on dialog.
			 */
			message: string;
			/**
			 * (Optional) Detailed message, e.g stack trace of error.
			 */
			messageDetails?: string;
			/**
			 * Telemetry View to be used for emitting telemetry events.
			 */
			telemetryView?: string,
			/**
			 * (Optional) List of custom actions to include in modal dialog alongwith a 'Cancel' button.
			 * If custom 'actions' are not provided, 'OK' button will be shown by default.
			 */
			actions?: IDialogAction[];
			/**
			 * (Optional) If provided, instruction text is shown in bold below message.
			 */
			instructionText?: string;
			/**
			 * (Optional) If provided, appends read more link after instruction text.
			 */
			readMoreLink?: string;
		}

		/**
		 * An action that will be rendered as a button on the dialog.
		 */
		export interface IDialogAction {
			/**
			 * Identifier of action.
			 */
			id: string;
			/**
			 * Label of Action button.
			 */
			label: string;
			/**
			 * Defines if button styling and focus should be based on primary action.
			 */
			isPrimary: boolean;
		}

		export interface FileFilters {
			/**
			 * The label to display in the file filter field next to the list of filters.
			 */
			label: string;
			/**
			 * The filters to limit what files are visible in the file browser (e.g. '*.sql' for SQL files).
			 */
			filters: string[];
		}

		/**
		 * Opens a dialog to select a file path on the specified server's machine. Note: The dialog for just browsing local
		 * files without any connection is opened via vscode.window.showOpenDialog.
		 * @param connectionUri The URI of the connection to the target server
		 * @param targetPath The file path on the server machine to open by default in the dialog
		 * @param fileFilters The filters used to limit which files are displayed in the file browser
		 * @param showFoldersOnly Optional argument to specify whether the browser should only show folders
		 * @returns The path of the file chosen from the dialog, and undefined if the dialog is closed without selecting anything.
		 */
		export function openServerFileBrowserDialog(connectionUri: string, targetPath: string, fileFilters: FileFilters[], showFoldersOnly?: boolean): Thenable<string | undefined>;

		/**
		 * Opens a dialog to select a file from a blob storage account to use for backing up a database.
		 * @param connectionUri The URI of the connection to the target server.
		 * @param defaultBackupName The default backup file name to search for.
		 * @param isRestore Whether to pick a file to use for a restore operation, rather than a backup operation.
		 * @returns The URL for the blob storage file chosen from the dialog, and undefined if the dialog is closed without selecting anything.
		 */
		export function openBackupUrlBrowserDialog(connectionUri: string, defaultBackupName: string, isRestore: boolean): Thenable<string | undefined>;
	}

	export interface FileBrowserProvider extends DataProvider {
		/**
		 * Opens a file browser for selecting file paths on a local or remote machine.
		 * @param ownerUri The connection URI of the machine whose files are to be browsed.
		 * @param expandPath The initial path to open in the file browser.
		 * @param fileFilters The list of filters to apply to the file browser (e.g. '*.sql' for SQL files). Ignored if showFoldersOnly is set to true.
		 * @param changeFilter Whether to update the list of file filters from the last time the dialog was opened for this connection URI.
		 * @param showFoldersOnly (Optional) Whether to only show folders in the file browser. Default value is false.
		 */
		openFileBrowser(ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean, showFoldersOnly?: boolean): Thenable<boolean>;
	}

	//#region Chart component model types

	export type ChartType = 'bar' | 'bubble' | 'doughnut' | 'horizontalBar' | 'line' | 'pie' | 'polarArea' | 'radar' | 'scatter';

	export interface ModelBuilder {
		chart<TChartType extends ChartType, TData extends ChartData<TChartType>, TOptions extends ChartOptions<TChartType>>(): ComponentBuilder<ChartComponent<TChartType, TData, TOptions>, ChartComponentProperties<TChartType, TData, TOptions>>;
	}

	export interface ChartComponent<TChartType extends ChartType, TData extends ChartData<TChartType>, TOptions extends ChartOptions<TChartType>> extends Component, ChartComponentProperties<TChartType, TData, TOptions> {
		onDidClick: vscode.Event<any>;
	}

	export interface ChartComponentProperties<TChartType extends ChartType, TData extends ChartData<TChartType>, TOptions extends ChartOptions<TChartType>> extends ComponentProperties {
		/**
		 * Type of chart to build.  Must match the ChartType parameter used to construct the chart.
		 */
		chartType: TChartType; // Necessary because all typing information from the generic parameters is lost after compilation

		/**
		 * Datasets and labels (if applicable) for the chart
		 */
		data: TData;

		/**
		 * Options for the chart configuration
		 */
		options?: TOptions;
	}

	/**
	 * Base type for chart data
	 */
	export interface ChartData<TChartType extends ChartType> {
		/**
		 * Never needs to be set or used.  Only present for the TypeScript compiler to recognize the pairing between same-chart Data and Options types.
		 */
		// DevNote:
		// This works because it gets compiled to (e.g.) `'bar' | undefined, forcing it to be associated with BarChartOptions
		// and preventing it from being paired with PieChartOptions.
		type?: TChartType;
	}

	//#region Chart general data types

	export interface ChartDataEntryBase {
		/**
		 * For Pie, Doughnut, Polar Area charts, it is the label associated with the data value.
		 * For Bar, Horizontal Bar, Line, Scatterplot, Bubble, and Radial, it is the label name for dataset.
		 */
		dataLabel: string;
		/**
		 * Background color for chart elements.  May be a name ('red'), hex ('#FFFFFF[77]), or RGB ('rgb(255, 255, 255[, 0.5])).
		 * Bracketed portions are optional for alpha/transparency.
		 */
		backgroundColor: string;
		/**
		 * Border color for chart elements.  May be a name ('red'), hex ('#FFFFFF[77]), or RGB ('rgb(255, 255, 255[, 0.5])).
		 * Bracketed portions are optional for alpha/transparency.
		 */
		borderColor?: string;
	}

	export interface ChartDataEntry extends ChartDataEntryBase {
		/**
		 * Value of one-dimensional data point
		 */
		value: Chart1DPoint | number;
	}

	export interface ChartDataSet<TVal extends Chart1DPoint | number> extends ChartDataEntryBase {
		data: TVal[];
	}

	/**
	 * One-dimensional data point
	 */
	export interface Chart1DPoint {
		/**
		 * Value for a one-dimensional data point, or the x-coordinate for a multi-dimensional data point
		 */
		x: number;
	}

	/**
	 * Two-dimensional data point
	 */
	export interface Chart2DPoint extends Chart1DPoint {
		/**
		 * Y-coordiate for a multi-dimensional data point
		 */
		y: number;
	}

	/**
	 * Three-dimensional data point
	 */
	export interface Chart3DPoint extends Chart2DPoint {
		/**
		 * Radius for a bubble data point, in pixels
		 */
		r: number;
	}

	//#endregion

	//#region Chart general option types

	/**
	 * Base options for a chart
	 */
	export interface ChartOptions<TChartType extends ChartType> {
		/**
		 * Never needs to be set or used.  Only present for the TypeScript compiler to recognize the pairing between same-chart Data and Options types.
		 */
		// DevNote:
		// This works because it gets compiled to (e.g.) `'bar' | undefined, forcing it to be associated with BarChartData
		// and preventing it from being paired with PieChartData.
		type?: TChartType;

		/**
		 * Title of the chart.  Set to `undefined` to not display the title.
		 */
		chartTitle?: string;

		/**
		 * Whether to display the legend.  Defaults to true.
		 */
		legendVisible?: boolean;
	}

	/**
	 * Base options for scales
	 */
	export interface ScaleOptions {
		/**
		 * Whether to begin the scale at zero
		 */
		beginAtZero?: boolean;

		/**
		 * Minimum value of the scale
		 */
		min?: number;

		/**
		 * Maxium value of the scale
		 */
		max?: number;

		/**
		 * Whether to add extra space between the scale and the chart
		 */
		offset?: boolean;

		/**
		 * Whether to stack charted values
		 */
		stacked?: boolean;
	}

	//#endregion

	//#region Chart-specific types

	//#region Bar/Horizontal Bar charts

	export interface BarChartDataSet extends ChartDataSet<Chart1DPoint | number> { }

	export interface BarChartDataBase {
		/**
		 * Array of datasets for the chart
		 */
		datasets: BarChartDataSet[];

		/**
		 * Labels for the base axis.  Only data that aligns with a label is shown.  If there are fewer labels than data, then not all data is displayed; if there are more labels than data, then empty chart entries are appended
		 */
		labels: string[];
	}

	export interface BarChartOptionsBase {
		/**
		 * Options for the scales
		 */
		scales?: {
			/**
			 * Options for the X-axis
			 */
			x?: ScaleOptions;

			/**
			 * Options for the Y-axis
			 */
			y?: ScaleOptions;
		}
	}

	/**
	 * Data for a vertical bar chart
	 */
	export interface BarChartData extends ChartData<'bar'>, BarChartDataBase { }

	/**
	 * Options for a vertical bar chart
	 */
	export interface BarChartOptions extends ChartOptions<'bar'>, BarChartOptionsBase { }

	/**
	 * Data for a horizontal bar chart
	 */
	export interface HorizontalBarChartData extends ChartData<'horizontalBar'>, BarChartDataBase { }

	/**
	 * Options for a horizontal bar chart
	 */
	export interface HorizontalBarChartOptions extends ChartOptions<'horizontalBar'>, BarChartOptionsBase { }

	//#endregion

	//#region Line chart

	/**
	 * Data for a line chart
	 */
	export interface LineChartData extends ChartData<'line'>, BarChartDataBase { }

	/**
	 * Options for a line chart
	 */
	export interface LineChartOptions extends ChartOptions<'line'>, BarChartOptionsBase {
		/**
		 * Which axis to use as the base, x or y; defaults to x
		 */
		indexAxis?: string;

		/**
		 * Bezier curve tension between points, 0 for straight lines.  Recommended range: 0.0-1.0
		 */
		tension?: number;
	}

	//#endregion

	//#region Pie/Doughnut charts

	export interface PieChartDataBase {
		/**
		 * Dataset for the chart
		 */
		dataset: ChartDataEntry[];
	}

	export interface PieChartOptionsBase {
		circumference?: number;
		/**
		 * Size of the cutout for a pie/doughnut chart, in pixels or percentage.  Pie chart defaults to 0.  Doughnut chart defaults to 50%.
		 */
		cutout?: number | string;

		/**
		 * Size of the outer radius for a pie/doughnut chart, in pixels or percentage of chart area
		 */
		radius?: number | string;

		/**
		 * Degrees of rotation to start drawing the first data entry from
		 */
		rotation?: number;
	}

	/**
	 * Data for a Pie chart
	 */
	export interface PieChartData extends ChartData<'pie'>, PieChartDataBase { }

	/**
	 * Options for a Pie chart
	 */
	export interface PieChartOptions extends ChartOptions<'pie'>, PieChartOptionsBase { }

	/**
	 * Data for a Doughnut chart
	 */
	export interface DoughnutChartData extends ChartData<'doughnut'>, PieChartDataBase { }

	/**
	 * Options for a Doughnut chart
	 */
	export interface DoughnutChartOptions extends ChartOptions<'doughnut'>, PieChartOptionsBase { }

	//#endregion

	//#region Scatterplot

	export interface ScatterplotOptionBase {
		/**
		 * Options for scales
		 */
		scales?: {
			/**
			 * Options for the X-axis
			 */
			x?: ScaleOptions & { position?: 'left' | 'top' | 'right' | 'bottom' | 'center' };

			/**
			 * Options for the Y-axis
			 */
			y?: ScaleOptions & { position?: 'left' | 'top' | 'right' | 'bottom' | 'center' };
		}
	}

	/**
	 * Data for a scatter plot chart
	 */
	export interface ScatterplotData extends ChartData<'scatter'> {
		/**
		 * Array of datasets for the chart
		 */
		datasets: ScatterplotDataSet[];
	}

	export interface ScatterplotDataSet extends ChartDataSet<Chart2DPoint> { }

	export interface ScatterplotOptions extends ChartOptions<'scatter'>, ScatterplotOptionBase { }

	//#endregion

	//#region Bubble chart

	/**
	 * Data for a bubble chart
	 */
	export interface BubbleChartData extends ChartData<'bubble'> {
		/**
		 * Array of datasets for the chart
		 */
		datasets: BubbleChartDataSet[];
	}

	export interface BubbleChartDataSet extends ChartDataSet<Chart3DPoint> { }

	export interface BubbleChartOptions extends ChartOptions<'bubble'>, ScatterplotOptionBase { }

	//#endregion

	//#region Polar Area chart

	/**
	 * Data for a polar area chart
	 */
	export interface PolarAreaChartData extends ChartData<'polarArea'> {
		/**
		 * Dataset for the chart
		 */
		dataset: ChartDataEntry[];
	}

	export interface PolarAreaChartOptions extends ChartOptions<'polarArea'> {
		/**
		 * Whether to display data areas with circular edges.  Defaults to true.
		 */
		circular?: boolean;
	}

	//#endregion

	//#region Radar chart

	/**
	 * Data for a radar chart
	 */
	export interface RadarChartData extends ChartData<'radar'> {
		/**
		 * Array of datasets for the chart
		 */
		datasets: BarChartDataSet[];
		/**
		 * Labels for the perimeter.  Only data that aligns with a label is shown.  If there are fewer labels than data, then not all data is displayed; if there are more labels than data, then empty chart entries are appended
		 */
		labels: string[];
	}

	export interface RadarChartOptions extends ChartOptions<'radar'> {
		/**
		 * Options for scales
		 */
		scales?: {
			/**
			 * Options for the radial axis
			 */
			r?: {
				/**
				 * Angle to start the first data entry from.  Defaults to 0
				 */
				startAngle?: number;

				/**
				 * Value to start the radial axis from.  Calculated if not set.
				 */
				beginAtZero?: boolean;

				/**
				 * Minimum value for the radial axis.  Calculated if not set.
				 */
				min?: number;

				/**
				 * Maximum value for the radial axis.  Calculated if not set.
				 */
				max?: number;
			}
		}
		/**
		 * Bezier curve tension between points, 0 for straight lines.  Recommended range: 0.0-1.0
		 */
		tension?: number;
	}

	//#endregion

	//#endregion

	//#endregion

	export interface TableComponent {
		/**
		 * Set active cell.
		 */
		setActiveCell(row: number, column: number): void;
	}

	export interface ProfilerProvider {
		startSession(sessionId: string, sessionName: string, sessionType?: ProfilingSessionType): Thenable<boolean>;
	}

	export enum ProfilingSessionType {
		RemoteSession = 0,
		LocalFile = 1
	}

	export interface SplitViewLayout extends FlexLayout {
		/**
		 * SplitView size. Height if the orientation is vertical, width if the orientation is horizontal
		 * If undefined, the size of the model view container is used
		 */
		splitViewSize?: number | string | undefined;
	}

	export interface SaveResultsRequestParams {
		/**
		 * Whether to freeze the header row when saving as Excel.
		 */
		freezeHeaderRow?: boolean | undefined;

		/**
		 * Whether to bold the header row when saving as Excel.
		 */
		boldHeaderRow?: boolean | undefined;

		/**
		 * Whether to enable auto filter on the header row when saving as Excel.
		 */
		autoFilterHeaderRow?: boolean | undefined;

		/**
		 * Whether to auto size columns when saving as Excel.
		 */
		autoSizeColumns?: boolean | undefined;
	}
}
