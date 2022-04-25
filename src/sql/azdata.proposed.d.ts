/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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
			/**
			 * The original name for this kernel.
			 */
			oldName?: string;
			/**
			 * The original display name for this kernel.
			 */
			oldDisplayName?: string;
			/**
			 * The original language name for this kernel.
			 */
			oldLanguage?: string;
		}

		export interface ILanguageInfo {
			/**
			 * The original name for this language.
			 */
			oldName?: string;
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
			 * URI of the notebook document that is sending this execute request.
			 */
			notebookUri: vscode.Uri;
			/**
			 * URI of the notebook cell that is sending this execute request.
			 */
			cellUri: vscode.Uri;
			/**
			 * The language of the notebook document that is executing this request.
			 */
			language: string;
			/**
			 * The index of the cell which the code being executed is from.
			 */
			cellIndex: number;
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
		 * An event that is emitted when a [notebook document](#NotebookDocument) is closed.
		 */
		export const onDidCloseNotebookDocument: vscode.Event<NotebookDocument>;
	}

	export type SqlDbType = 'BigInt' | 'Binary' | 'Bit' | 'Char' | 'DateTime' | 'Decimal'
		| 'Float' | 'Image' | 'Int' | 'Money' | 'NChar' | 'NText' | 'NVarChar' | 'Real'
		| 'UniqueIdentifier' | 'SmallDateTime' | 'SmallInt' | 'SmallMoney' | 'Text' | 'Timestamp'
		| 'TinyInt' | 'VarBinary' | 'VarChar' | 'Variant' | 'Xml' | 'Udt' | 'Structured' | 'Date'
		| 'Time' | 'DateTime2' | 'DateTimeOffset';

	export interface SimpleColumnInfo {
		name: string;
		/**
		 * This is expected to match the SqlDbTypes for serialization purposes
		 */
		dataTypeName: SqlDbType;
	}
	export interface SerializeDataStartRequestParams {
		/**
		 * 'csv', 'json', 'excel', 'xml'
		 */
		saveFormat: string;
		filePath: string;
		isLastBatch: boolean;
		rows: DbCellValue[][];
		columns: SimpleColumnInfo[];
		includeHeaders?: boolean;
		delimiter?: string;
		lineSeperator?: string;
		textIdentifier?: string;
		encoding?: string;
		formatted?: boolean;
	}

	export interface SerializeDataContinueRequestParams {
		filePath: string;
		isLastBatch: boolean;
		rows: DbCellValue[][];
	}

	export interface SerializeDataResult {
		messages?: string;
		succeeded: boolean;
	}

	export interface SerializationProvider extends DataProvider {
		startSerialization(requestParams: SerializeDataStartRequestParams): Thenable<SerializeDataResult>;
		continueSerialization(requestParams: SerializeDataContinueRequestParams): Thenable<SerializeDataResult>;
	}

	export namespace dataprotocol {
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

	export interface DeclarativeTableColumn {
		headerCssStyles?: CssStyles;
		rowCssStyles?: CssStyles;
		ariaLabel?: string;
		showCheckAll?: boolean;
		hidden?: boolean;
	}


	export enum DeclarativeDataType {
		component = 'component',
		menu = 'menu'
	}

	export type DeclarativeTableRowSelectedEvent = {
		row: number
	};

	export interface DeclarativeTableComponent extends Component, DeclarativeTableProperties {
		onRowSelected: vscode.Event<DeclarativeTableRowSelectedEvent>;
		/**
		 * Sets the filter currently applied to this table - only rows with index in the given array will be visible. undefined
		 * will clear the filter
		 */
		setFilter(rowIndexes: number[] | undefined): void;

		/**
		 * Sets the data values.
		 * @param v The new data values
		 */
		setDataValues(v: DeclarativeTableCellValue[][]): Promise<void>;
	}

	/*
	 * Add optional azureAccount for connectionWidget.
	 */
	export interface IConnectionProfile extends ConnectionInfo {
		azureAccount?: string;
		azureResourceId?: string;
		azurePortalEndpoint?: string;
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
	}


	export interface DeclarativeTableProperties {
		/**
		 * dataValues will only be used if data is an empty array.
		 * To set the dataValues, it is recommended to use the setDataValues method that returns a promise.
		 */
		dataValues?: DeclarativeTableCellValue[][];

		/**
		 * Gets a boolean value determines whether the row selection is enabled. Default value is false.
		 */
		enableRowSelection?: boolean;

		/**
		 * Gets or sets the selected row number of the table. -1 means to no selected row.
		 */
		selectedRow?: number;
	}


	export interface DeclarativeTableMenuCellValue {
		/**
		 * commands for the menu. Use an array for a group and menu separators will be added.
		 */
		commands: (string | string[])[];
		/**
		 * context that will be passed to the commands.
		 */
		context: { [key: string]: string | boolean | number } | string | boolean | number | undefined
	}

	export interface DeclarativeTableCellValue {
		/**
		 * The cell value
		 */
		value: string | number | boolean | Component | DeclarativeTableMenuCellValue;
		/**
		 * The aria-label of the cell
		 */
		ariaLabel?: string;
		/**
		 * The CSS style of the cell
		 */
		style?: CssStyles;
		/**
		 * A boolean value indicates whether the cell is enabled. Default value is true.
		 * Note: this is currently only implemented for boolean type (checkbox).
		 */
		enabled?: boolean;
	}

	export interface DropDownProperties {
		/**
		 * Adds a short hint that describes the expected value for the editable dropdown
		 */
		placeholder?: string;
		/**
		 * Define error messages to show when custom validation fails. Note: For empty required dropdowns we use a default error message.
		 */
		validationErrorMessages?: string[];
	}

	/**
	 * The heading levels an HTML heading element can be.
	 */
	export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

	/**
	 * The type of text this is - used to determine display color.
	 */
	export enum TextType {
		Normal = 'Normal',
		Error = 'Error',
		UnorderedList = 'UnorderedList',
		OrderedList = 'OrderedList'
	}

	export interface TextComponentProperties {
		/**
		 * The heading level for this component - if set the text component will be created as an h#
		 * HTML element with this value being the #.
		 */
		headingLevel?: HeadingLevel;
		/**
		 * Sets the type of text box to be displayed
		 */
		textType?: TextType;
	}

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

	export interface AccountDisplayInfo {
		email?: string;
		name?: string;
	}

	export interface AccountProvider {
		/**
		 * Generates a security token for the provided account and tenant
		 * @param account The account to generate a security token for
		 * @param resource The resource to get the token for
		 * @return Promise to return a security token object
		 */
		getAccountSecurityToken(account: Account, tenant: string, resource: AzureResource): Thenable<accounts.AccountSecurityToken | undefined>;
	}

	export interface AccountKey {
		/**
		 * A version string for an account
		 */
		accountVersion?: string;
	}

	export interface Account {
		/**
		 * Specifies if an account should be deleted
		 */
		delete?: boolean;
	}

	export enum CardType {
		/**
		 * Card with the icon as a background image
		 */
		Image = 'Image'
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

	export interface LinkArea {
		/*
		* Accessibility information used when screen reader interacts with this link.
		* Generally, a link has no need to set the `role` of the accessibilityInformation;
		* but it is exposed for situations that may require it.
		*/
		accessibilityInformation?: vscode.AccessibilityInformation
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
	}

	export enum ColumnType {
		icon = 3,
		hyperlink = 4
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

	export interface QueryExecuteResultSetNotificationParams {
		/**
		 * Contains execution plans returned by the database in ResultSets.
		 */
		executionPlans: ExecutionPlanGraph[];
	}


	export interface ServerInfo {
		/**
		 * The CPU count of the host running the server.
		 */
		cpuCount?: number;
		/**
		 * The physical memory of the host running the server.
		 */
		physicalMemoryInMb?: number;
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

	export namespace accounts {
		export interface AccountSecurityToken {
			/**
			 * Access token expiry timestamp
			 */
			expiresOn?: number
		}
	}

	export enum DataProviderType {
		TableDesignerProvider = 'TableDesignerProvider'
	}

	export namespace dataprotocol {
		export function registerTableDesignerProvider(provider: designers.TableDesignerProvider): vscode.Disposable;
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
			 * The server name.
			 */
			server: string;
			/**
			 * The database name
			 */
			database: string;
			/**
			 * The schema name, only required for existing table.
			 */
			schema?: string;
			/**
			 * The table name, only required for existing table.
			 */
			name?: string;
			/**
			 * A boolean value indicates whether a new table is being designed.
			 */
			isNewTable: boolean;
			/**
			 * Unique identifier of the table. Will be used to decide whether a designer is already opened for the table.
			 */
			id: string;
			/**
			 * Extension can store additional information that the provider needs to uniquely identify a table.
			 */
			[key: string]: any;
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
			PrimaryKeyName = 'primaryKeyName',
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
			Type = 'type',
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
			Expression = 'expression'
		}

		/**
		 * Name of the common index properties.
		 * Extensions can use the name to access the designer view model.
		 */
		export enum TableIndexProperty {
			Name = 'name',
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
			 * Additional primary key properties. Common primary key properties: primaryKeyName.
			 */
			additionalPrimaryKeyProperties?: DesignerDataPropertyInfo[];
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
			Update = 2
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
			path: DesignerEditPath;
			/**
			 * the new value.
			 */
			value?: any;
		}

		/**
		 * The path of the edit target.
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
		export type DesignerEditPath = (string | number)[];

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
			 * Error messages of current state, and the property the caused the error.
			 */
			errors?: { message: string, propertyPath?: DesignerEditPath }[];
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
		}
	}

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
		graphFile: ExecutionPlanGraphFile;
		/**
		 * Query recommendations for optimizing performance
		 */
		recommendations: ExecutionPlanRecommendations[];
	}

	export interface ExecutionPlanNode {
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

	export interface ExecutionPlanGraphFile {
		/**
		 * File contents
		 */
		graphFileContent: string;
		/**
		 * File type for execution plan. This will be the file type of the editor when the user opens the graph file
		 */
		graphFileType: string;
	}

	/**
	 * Component to display text with an icon representing the severity
	 */
	export interface InfoBoxComponent extends Component, InfoBoxComponentProperties {
		/**
		 * An event called when the InfoBox is clicked
		 */
		onDidClick: vscode.Event<void>;
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
	}
}
