/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for API experiments and proposal.

import * as vscode from 'vscode';

declare module 'azdata' {

	export namespace env {
		/**
		 * Well-known app quality values
		 */
		export enum AppQuality {
			stable = 'stable',
			insider = 'insider',
			dev = 'dev'
		}

		/**
		 * The version of Azure Data Studio this is currently running as - such as `stable`, or `insider`
		 */
		export const quality: AppQuality | string | undefined;
	}

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
		/**
		 * The type of authentication to use when connecting
		 */
		authenticationType: string | connection.AuthenticationType;
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
		 * Well-known Authentication types commonly supported by connection providers.
		 */
		export enum AuthenticationType {
			/**
			 * Username and password
			 */
			SqlLogin = 'SqlLogin',
			/**
			 * Windows Authentication
			 */
			Integrated = 'Integrated',
			/**
			 * Azure Active Directory - Universal with MFA support
			 */
			AzureMFA = 'AzureMFA',
			/**
			 * Azure Active Directory - Password
			 */
			AzureMFAAndUser = 'AzureMFAAndUser',
			/**
			 * Datacenter Security Token Service Authentication
			 */
			DSTSAuth = 'dstsAuth',
			/**
			 * No authentication required
			 */
			None = 'None'
		}

		/**
		 * Opens the change password dialog.
		 * @param profile The connection profile to change the password for.
		 * @returns The new password that is returned from the operation or undefined if unsuccessful.
		 */
		export function openChangePasswordDialog(profile: IConnectionProfile): Thenable<string | undefined>;
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

	export interface AccountKey {
		/**
		 * Auth Library used to add the account
		 */
		authLibrary?: string;
	}

	export namespace workspace {
		/**
		 * Creates and enters a workspace at the specified location
		 */
		export function createAndEnterWorkspace(location: vscode.Uri, workspaceFile?: vscode.Uri): Promise<void>;

		/**
		 * Enters the workspace with the provided path
		 * @param workspacefile
		 */
		export function enterWorkspace(workspaceFile: vscode.Uri): Promise<void>;

		/**
		 * Saves and enters the workspace with the provided path
		 * @param workspacefile
		 */
		export function saveAndEnterWorkspace(workspaceFile: vscode.Uri): Promise<void>;
	}

	export interface TableComponentProperties {
		/**
		 * Specifies whether to use headerFilter plugin
		 */
		headerFilter?: boolean,
	}

	export interface TableComponent {
		/**
		 * Append data to an existing table data.
		 */
		appendData(data: any[][]): Thenable<void>;
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

	export interface QueryProvider {
		/**
		 * Notify clients that the URI for a connection has been changed.
		 */
		connectionUriChanged(newUri: string, oldUri: string): Thenable<void>;
	}

	export enum DataProviderType {
		TableDesignerProvider = 'TableDesignerProvider',
		ExecutionPlanProvider = 'ExecutionPlanProvider'
	}

	export namespace dataprotocol {
		export function registerTableDesignerProvider(provider: designers.TableDesignerProvider): vscode.Disposable;
		export function registerExecutionPlanProvider(provider: executionPlan.ExecutionPlanProvider): vscode.Disposable;
	}

	export namespace designers {
		/**
		 * Open a table designer window.
		 * @param providerId The table designer provider Id.
		 * @param tableInfo The table information. The object will be passed back to the table designer provider as the unique identifier for the table.
		 * @param telemetryInfo: Optional Key-value pair containing any extra information that needs to be sent via telemetry
		 */
		export function openTableDesigner(providerId: string, tableInfo: TableInfo, telemetryInfo?: { [key: string]: string }): Thenable<void>;

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
			 * Used as the table designer editor's tab header text.
			 */
			title: string;
			/**
			 * Used as the table designer editor's tab header hover text.
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
		ariaLive?: string;
	}

	export interface ContainerBuilder<TComponent extends Component, TLayout, TItemLayout, TPropertyBag extends ContainerProperties> extends ComponentBuilder<TComponent, TPropertyBag> {
		/**
		 * Sets the initial set of properties for the container being created
		 * @param properties The properties to apply to the container
		 */
		withProps(properties: TPropertyBag): ContainerBuilder<TComponent, TLayout, TItemLayout, TPropertyBag>;
	}

	export interface ContainerProperties extends ComponentProperties {
		/**
		 * Corresponds to the aria-live accessibility attribute for this component
		 */
		ariaLive?: string;
	}
	export namespace queryeditor {

		export interface QueryMessage {
			/**
			 * The message string
			 */
			message: string;
			/**
			 * Whether this message is an error message or not
			 */
			isError: boolean;
			/**
			 * The timestamp for when this message was sent
			 */
			time?: string;
		}

		/**
		 * Information about a query that was executed
		 */
		export interface QueryInfo {
			/**
			 * Any messages that have been received from the query provider
			 */
			messages: QueryMessage[];
			/**
			 * The ranges for each batch that has executed so far
			 */
			batchRanges: vscode.Range[];
		}

		export interface QueryEventListener {
			/**
			 * An event that is fired for query events
			 * @param type The type of query event
			 * @param document The document this event was sent by
			 * @param args The extra information for the event, if any
			 * The args sent depend on the type of event :
			 * queryStart: undefined
			 * queryStop: undefined
			 * executionPlan: string (the plan itself)
			 * visualize: ResultSetSummary (the result set to be visualized)
			 * @param queryInfo The information about the query that triggered this event
			 */
			onQueryEvent(type: QueryEventType, document: QueryDocument, args: ResultSetSummary | string | undefined, queryInfo: QueryInfo): void;
		}
	}

	export interface NodeInfo {
		/**
		 * The object type of the node. Node type is used to determine the icon, the object type is the actual type of the node, e.g. for Tables node
		 * under the database, the nodeType is Folder, the objectType is be Tables.
		 */
		objectType?: string;
	}

	export namespace window {
		export interface Wizard extends LoadingComponentBase {
		}

		export interface Dialog extends LoadingComponentBase {
		}

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
	}
}
