/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for API experiments and proposal.

import * as vscode from 'vscode';

declare module 'azdata' {

	export namespace queryeditor {
		/**
		 * Opens an untitled text document. The editor will prompt the user for a file
		 * path when the document is to be saved. The `options` parameter allows to
		 * specify the *content* of the document.
		 *
		 * @param options Options to control how the document will be created.
		 * @param providerId Optional provider ID this editor will be associated with. Defaults to MSSQL.
		 * @return A promise that resolves to a [document](#QueryDocument).
		 */
		export function openQueryDocument(options?: { content?: string; }, providerId?: string): Thenable<QueryDocument>;
	}

	export namespace nb {
		export interface NotebookDocument {
			/**
			 * Sets the trust mode for the notebook document.
			 */
			setTrusted(state: boolean): void;
		}

		export interface IStandardKernel {
			readonly blockedOnSAW?: boolean;
		}

		export interface IKernelChangedArgs {
			nbKernelAlias?: string
		}

		export interface IExecuteResult {
			data: any;
		}

		export interface IExecuteResultUpdate {
			output_type: string;
			resultSet: ResultSetSummary;
			data: any;
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

	export interface ModelBuilder {
		radioCardGroup(): ComponentBuilder<RadioCardGroupComponent, RadioCardGroupComponentProperties>;
		listView(): ComponentBuilder<ListViewComponent, ListViewComponentProperties>;
		tabbedPanel(): TabbedPanelComponentBuilder;
		slider(): ComponentBuilder<SliderComponent, SliderComponentProperties>;
	}

	export interface RadioCard {
		id: string;
		descriptions: RadioCardDescription[];
		icon?: IconPath;
	}

	export interface RadioCardDescription {
		textValue: string;
		linkDisplayValue?: string;
		displayLinkCodicon?: boolean;
		textStyles?: CssStyles;
		linkStyles?: CssStyles;
		linkCodiconStyles?: CssStyles;
	}

	export interface RadioCardGroupComponentProperties extends ComponentProperties, TitledComponentProperties {
		cards: RadioCard[];
		cardWidth: string;
		cardHeight: string;
		iconWidth?: string;
		iconHeight?: string;
		selectedCardId?: string;
		orientation?: Orientation; // Defaults to horizontal
		iconPosition?: 'top' | 'left'; // Defaults to top
	}

	export type RadioCardSelectionChangedEvent = { cardId: string; card: RadioCard };
	export type RadioCardLinkClickEvent = { cardId: string, card: RadioCard, description: RadioCardDescription };

	export interface RadioCardGroupComponent extends Component, RadioCardGroupComponentProperties {
		/**
		 * The card object returned from this function is a clone of the internal representation - changes will not impact the original object
		 */
		onSelectionChanged: vscode.Event<RadioCardSelectionChangedEvent>;

		onLinkClick: vscode.Event<RadioCardLinkClickEvent>;

	}

	export interface ListViewComponentProperties extends ComponentProperties {
		title?: ListViewTitle;
		options: ListViewOption[];
		selectedOptionId?: string;
	}

	export interface ListViewTitle {
		text?: string;
		style?: CssStyles;
	}

	export interface ListViewOption {
		label: string;
		id: string;
	}

	export type ListViewClickEvent = { id: string };

	export interface ListViewComponent extends Component, ListViewComponentProperties {
		onDidClick: vscode.Event<ListViewClickEvent>;
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
	 * Panel component with tabs
	 */
	export interface TabbedPanelComponent extends Container<TabbedPanelLayout, any> {
		/**
		 * An event triggered when the selected tab is changed.
		 * The event argument is the id of the selected tab.
		 */
		onTabChanged: vscode.Event<string>;

		/**
		 * update the tabs.
		 * @param tabs new tabs
		 */
		updateTabs(tabs: (Tab | TabGroup)[]): void;

		/**
		 * Selects the tab with the specified id
		 * @param id The id of the tab to select
		 */
		selectTab(id: string): void;
	}

	/**
	 * Defines the tab orientation of TabbedPanelComponent
	 */
	export enum TabOrientation {
		Vertical = 'vertical',
		Horizontal = 'horizontal'
	}

	/**
	 * Layout of TabbedPanelComponent, can be used to initialize the component when using ModelBuilder
	 */
	export interface TabbedPanelLayout {
		/**
		 * Tab orientation. Default horizontal.
		 */
		orientation?: TabOrientation;

		/**
		 * Whether to show the tab icon. Default false.
		 */
		showIcon?: boolean;

		/**
		 * Whether to show the tab navigation pane even when there is only one tab. Default false.
		 */
		alwaysShowTabs?: boolean;
	}

	/**
	 * Represents the tab of TabbedPanelComponent
	 */
	export interface Tab {
		/**
		 * Title of the tab
		 */
		title: string;

		/**
		 * Content component of the tab
		 */
		content: Component;

		/**
		 * Id of the tab
		 */
		id: string;

		/**
		 * Icon of the tab
		 */
		icon?: IconPath;
	}

	/**
	 * Represents the tab group of TabbedPanelComponent
	 */
	export interface TabGroup {
		/**
		 * Title of the tab group
		 */
		title: string;

		/**
		 * children of the tab group
		 */
		tabs: Tab[];
	}

	/**
	 * Builder for TabbedPanelComponent
	 */
	export interface TabbedPanelComponentBuilder extends ContainerBuilder<TabbedPanelComponent, TabbedPanelLayout, any, ComponentProperties> {
		/**
		 * Add the tabs to the component
		 * @param tabs tabs/tab groups to be added
		 */
		withTabs(tabs: (Tab | TabGroup)[]): ContainerBuilder<TabbedPanelComponent, TabbedPanelLayout, any, ComponentProperties>;
	}

	export interface SliderComponentProperties extends ComponentProperties {
		/**
		 * The value selected on the slider. Default initial value is the minimum value.
		 */
		value?: number,
		/**
		 * The minimum value of the slider. Default value is 1.
		 */
		min?: number,
		/**
		 * The maximum value of the slider. Default value is 100.
		 */
		max?: number,
		/**
		 * The value between each "tick" of the slider. Default is 1.
		 */
		step?: number,
		/**
		 * Whether to show the tick marks on the slider. Default is false.
		 */
		showTicks?: boolean
		/**
		 * The width of the slider, not including the value box.
		 */
		width?: number | string;
	}

	export interface SliderComponent extends Component, SliderComponentProperties {
		onChanged: vscode.Event<number>;
		onInput: vscode.Event<number>;
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

	export namespace window {

		export interface Dialog {
			/**
			 * Width of the dialog.
			 * Default is 'narrow'.
			 */
			width?: DialogWidth;
			/**
			 * Dialog style type: normal, flyout, callout.
			 * Default is 'flyout'.
			 */
			dialogStyle?: DialogStyle;
			/**
			 * Dialog position type: left, below and undefined.
			 * Default is undefined.
			 */
			dialogPosition?: DialogPosition;
			/**
			 * Specify whether or not to render the Dialog header.
			 * Default is true.
			 */
			renderHeader?: boolean;
			/**
			 * Specify whether or not to render the Dialog footer.
			 * Default is true.
			 */
			renderFooter?: boolean;
			/**
			 * Positional data prior to opening of dialog.
			 * Default is undefined.
			 */
			dialogProperties?: IDialogProperties;
		}

		export interface Wizard {
			/**
			 * Width of the wizard
			 */
			width?: DialogWidth;
		}

		/**
		 * These dialog styles affect how the dialog displays in the application.
		 * normal: Positioned top and centered.
		 * flyout (default): Positioned full screen height, opens from the right side of the application.
		 * callout: Opens below or beside parent element, contains footer section with buttons.
		 */
		export type DialogStyle = 'normal' | 'flyout' | 'callout';

		/**
		 * Where to position the dialog relative to the parent element
		 */
		export type DialogPosition = 'left' | 'below';

		/**
		 * The p
		 * They are needed for positioning relative to the element which triggers the opening of the dialog.
		 */
		export interface IDialogProperties {
			/**
			 * x position of the dialog relative to the parent element
			 */
			xPos: number,
			/**
			 * y position of the dialog relative to the parent element
			 */
			yPos: number,
			/**
			 * width of the dialog
			 */
			width: number,
			/**
			 * height of the dialog
			 */
			height: number
		}

		/**
		 * Create a dialog with the given title
		 * @param title Title of the dialog, displayed at the top.
		 * @param dialogName Name of the dialog.
		 * @param width Width of the dialog, default is 'narrow'.
		 * @param dialogStyle Defines the dialog style, default is 'flyout'.
		 * @param dialogPosition Defines the dialog position, default is undefined
		 * @param renderHeader Specify whether or not to render the Dialog header, default is true.
		 * @param renderFooter Specify whether or not to render the Dialog footer, default is true.
		 * @param dialogProperties Positional data prior to opening of dialog, default is undefined.
		 */
		export function createModelViewDialog(title: string, dialogName?: string, width?: DialogWidth, dialogStyle?: DialogStyle, dialogPosition?: DialogPosition, renderHeader?: boolean, renderFooter?: boolean, dialogProperties?: IDialogProperties): Dialog;

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

	export interface ResultSetSummary {
		/**
		 * The visualization options for the result set.
		 */
		visualization?: VisualizationOptions;
	}

	/**
	 * Defines all the supported visualization types
	 */
	export type VisualizationType = 'bar' | 'count' | 'doughnut' | 'horizontalBar' | 'image' | 'line' | 'pie' | 'scatter' | 'table' | 'timeSeries';

	/**
	 * Defines the configuration options for visualization
	 */
	export interface VisualizationOptions {
		type: VisualizationType;
	}

	export interface PropertiesContainerComponentProperties {
		/**
		 * Whether to show the button that will hide/show the content of the container. Default value is false.
		 */
		showToggleButton?: boolean;
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

	export interface NodeInfo {
		/**
		 * Specify the icon for the node. The value could the path to the icon or and ADS icon defined in {@link SqlThemeIcon}.
		 */
		icon?: IconPath | SqlThemeIcon;
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

		export function openTableDesigner(providerId: string, tableInfo: TableInfo): Promise<void>;

		export interface TableDesignerProvider extends DataProvider {
			getTableDesignerInfo(table: TableInfo): Promise<TableDesignerInfo>;
			processTableEdit(table: TableInfo, data: DesignerData, edit: DesignerEdit): Promise<DesignerEditResult>;
		}

		/**
		 * The information of the table.
		 */
		export interface TableInfo {
			server: string;
			database: string;
			schema?: string;
			name?: string;
			isNewTable: boolean;
			[key: string]: any;
		}

		export interface TableDesignerInfo {
			view: TableDesignerView;
			data: DesignerData;
			columnTypes: string[];
		}

		export enum TableProperties {
			Columns = 'columns',
			Description = 'description',
			Name = 'name',
			Schema = 'schema'
		}

		export enum TableColumnProperties {
			AllowNull = 'allowNull',
			DefaultValue = 'defaultValue',
			Length = 'length',
			Name = 'name',
			Type = 'type'
		}

		export interface TableDesignerView {
			additionalTableProperties?: DesignerComponentType[];
			addtionalTableColumnProperties?: DesignerComponentType[];
			addtionalTabs?: DesignerTab[];
		}

		export interface DesignerData {
			[key: string]: InputComponentData | CheckboxComponentData | DropdownComponentData | TableComponentData;
		}

		export interface ComponentData {
			enabled?: boolean;
		}

		export interface InputComponentData extends ComponentData {
			value: string | number;
		}

		export interface CheckboxComponentData extends ComponentData {
			value: boolean;
		}

		export interface DropdownComponentData extends ComponentData {
			value: string;
			optionalValues: CategoryValue[];
		}

		export interface TableComponentData extends ComponentData {
			rows: TableComponentRowData[];
		}

		export interface TableComponentRowData {
			[key: string]: InputComponentData | CheckboxComponentData | DropdownComponentData | TableComponentData;
		}

		export enum DesignerEditTypes {
			Add = 0,
			Remove = 1,
			Update = 2
		}

		export interface DesignerEdit {
			type: DesignerEditTypes;
			property: string | { parent: string, row: number, property: string };
			value: any;
		}

		export interface DesignerEditResult {
			data: DesignerData;
			isValid: boolean;
			errorMessages?: string[];
		}

		export interface DesignerTab {
			title: string;
			/**
			 * Whether the label should be place on top of the component or on the left side of component. Default value is false.
			 */
			labelOnTop?: boolean;
			components: DesignerComponentType[];
		}

		export type DesignerComponentType = InputComponentInfo | CheckboxComponentInfo | DropdownComponentInfo | TableComponentInfo;

		export type DesignerComponentTypeName = 'input' | 'checkbox' | 'dropdown' | 'table';

		export interface UIComponentInfo {
			/**
			 * The name of the property that the component is bound to.
			 */
			property: string;

			type: DesignerComponentTypeName;

			title?: string;

			ariaLabel?: string;

			description?: string;

			group?: string;
		}

		export interface InputComponentInfo extends UIComponentInfo {
			placeholder?: string;
			inputType?: 'text' | 'number';
		}

		export interface DropdownComponentInfo extends UIComponentInfo {
		}

		export interface CheckboxComponentInfo extends UIComponentInfo {
		}

		export interface TableComponentInfo extends UIComponentInfo {
			/**
			 * the name of the properties to be displayed, properties not in this list will be accessible in details view.
			 */
			columns: string[];

			/**
				 * the properties of the table data item
				 */
			itemProperties: DesignerComponentType[];
		}
	}
}
