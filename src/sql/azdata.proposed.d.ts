/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for API experiments and proposal.

import * as vscode from 'vscode';

declare module 'azdata' {
	/**
	 * Namespace for connection management
	 */
	export namespace connection {
		/**
		 * Supported connection event types
		 */
		export type ConnectionEventType =
			| 'onConnect'
			| 'onDisconnect'
			| 'onConnectionChanged';

		/**
		 * Connection Event Lister
		 */
		export interface ConnectionEventListener {
			/**
			 * Connection event handler
			 * @param type Connection event type
			 * @param ownerUri Connection's owner uri
			 * @param args Connection profile
			 */
			onConnectionEvent(type: ConnectionEventType, ownerUri: string, args: IConnectionProfile): void;
		}

		/**
		 * Register a connection event listener
		 * @param listener The connection event listener
		 */
		export function registerConnectionEventListener(listener: connection.ConnectionEventListener): vscode.Disposable;

		/**
		 * Get connection profile by its owner uri
		 * @param ownerUri The owner uri of the connection
		 * @returns Promise to return the connection profile matching the ownerUri
		 */
		export function getConnection(ownerUri: string): Thenable<ConnectionProfile>;
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

	export interface HyperlinkComponent {
		/**
		 * An event called when the hyperlink is clicked
		 */
		onDidClick: vscode.Event<any>;
	}

	export interface HyperlinkComponentProperties {
		showLinkIcon?: boolean;
	}

	export interface RadioButtonComponent {
		/**
		 * An event called when the value of radio button changes
		 */
		onDidChangeCheckedState: vscode.Event<boolean>;
	}

	export interface DeclarativeTableColumn {
		headerCssStyles?: CssStyles;
		rowCssStyles?: CssStyles;
		ariaLabel?: string;
		showCheckAll?: boolean;
		isChecked?: boolean;
	}


	export enum DeclarativeDataType {
		component = 'component'
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
		separator(): ComponentBuilder<SeparatorComponent, SeparatorComponentProperties>;
		propertiesContainer(): ComponentBuilder<PropertiesContainerComponent, PropertiesContainerComponentProperties>;
		infoBox(): ComponentBuilder<InfoBoxComponent, InfoBoxComponentProperties>;
	}

	export interface ComponentBuilder<TComponent extends Component, TPropertyBag extends ComponentProperties> {
		withProps(properties: TPropertyBag): ComponentBuilder<TComponent, TPropertyBag>;
	}

	export interface DropDownProperties extends LoadingComponentProperties {
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

	export type CssStyles = { [key: string]: string | number };

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
	export type RadioCardLinkClickEvent = { cardId: string, card: RadioCard, selectorText: RadioCardDescription };

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

	export interface SeparatorComponent extends Component {
	}
	export interface SeparatorComponentProperties extends ComponentProperties {

	}

	export interface DeclarativeTableProperties {
		/**
		 * dataValues will only be used if data is an empty array
		 */
		dataValues?: DeclarativeTableCellValue[][];

		/**
		 * Should the table react to user selections
		 */
		selectEffect?: boolean; // Defaults to false
	}

	export interface DeclarativeTableCellValue {
		value: string | number | boolean | Component;
		ariaLabel?: string;
		style?: CssStyles
	}

	export interface ComponentProperties {
		ariaHidden?: boolean;
	}

	export interface ComponentWithIconProperties extends ComponentProperties {
		/**
		 * The path for the icon with optional dark-theme away alternative
		 */
		iconPath?: IconPath;
		/**
		 * The height of the icon
		 */
		iconHeight?: number | string;
		/**
		 * The width of the icon
		 */
		iconWidth?: number | string;
		/**
		 * The title for the icon. This title will show when hovered over
		 */
		title?: string;
	}

	export interface ComponentWithIcon extends ComponentWithIconProperties {
	}

	export interface ImageComponent extends ComponentWithIcon {
	}

	export interface ImageComponentProperties extends ComponentProperties, ComponentWithIconProperties {
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

	export interface InputBoxProperties extends ComponentProperties {
		validationErrorMessage?: string;
		readOnly?: boolean;
		/**
		* This title will show when hovered over
		*/
		title?: string;
	}

	export interface CheckBoxProperties {
		required?: boolean;
	}

	/**
	 * A property to be displayed in the PropertiesContainerComponent
	 */
	export interface PropertiesContainerItem {
		/**
		 * The name of the property to display
		 */
		displayName: string;
		/**
		 * The value of the property to display
		 */
		value: string;
	}

	/**
	 * Component to display a list of property values.
	 */
	export interface PropertiesContainerComponent extends Component, PropertiesContainerComponentProperties {

	}

	/**
	 * Properties for configuring a PropertiesContainerComponent
	 */
	export interface PropertiesContainerComponentProperties extends ComponentProperties {
		/**
		 * The properties to display
		 */
		propertyItems?: PropertiesContainerItem[];
	}

	/**
	 * Component to display text with an icon representing the severity
	 */
	export interface InfoBoxComponent extends Component, InfoBoxComponentProperties {
	}

	export type InfoBoxStyle = 'information' | 'warning' | 'error' | 'success';

	/**
	 * Properties for configuring a InfoBoxComponent
	 */
	export interface InfoBoxComponentProperties extends ComponentProperties {
		/**
		 * The style of the InfoBox
		 */
		style: InfoBoxStyle;
		/**
		 * The display text of the InfoBox
		 */
		text: string;
		/**
		 * Controls whether the text should be announced by the screen reader. Default value is false.
		 */
		announceText?: boolean;
	}

	export namespace nb {
		/**
		 * An event that is emitted when the active Notebook editor is changed.
		 */
		export const onDidChangeActiveNotebookEditor: vscode.Event<NotebookEditor>;
	}
	export namespace window {
		export interface ModelViewDashboard {
			registerTabs(handler: (view: ModelView) => Thenable<(DashboardTab | DashboardTabGroup)[]>): void;
			open(): Thenable<void>;
			updateTabs(tabs: (DashboardTab | DashboardTabGroup)[]): void;
			selectTab(id: string): void;
		}

		/**
		 *
		 * @param title The title displayed in the editor tab for the dashboard
		 * @param name The name used to identify this dashboard in telemetry
		 * @param options Options to configure the dashboard
		 */
		export function createModelViewDashboard(title: string, name?: string, options?: ModelViewDashboardOptions): ModelViewDashboard;

		export interface Dialog {
			/**
			 * Width of the dialog.
			 * Default is 'narrrow'.
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
			 * The name used to identify the wizard in telemetry
			 */
			name?: string;
			/**
			 * Width of the wizard
			 */
			width?: DialogWidth;
		}

		export interface WizardPage extends ModelViewPanel {
			/**
			 * An optional name for the page. If provided it will be used for telemetry
			 */
			pageName?: string;
		}

		export type DialogWidth = 'narrow' | 'medium' | 'wide' | number;

		/**
		 * These dialog styles affect how the dialog dispalys in the application.
		 * normal: Positioned top and centered.
		 * flyout (default): Existing panel appearance - positioned full screen height, opens from the right side of the application.
		 * callout: Opens below or beside button clicked, contains footer section with buttons.
		 */
		export type DialogStyle = 'normal' | 'flyout' | 'callout';

		export type DialogPosition = 'left' | 'below';

		/**
		 * These are positional data prior to opening of dialog.
		 * They are needed for positioning relative to the button which triggers the opening of the dialog.
		 * Default is undefined.
		 */
		export interface IDialogProperties {
			xPos: number,
			yPos: number,
			width: number,
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

		/**
		 * Create a wizard with the given title and width
		 * @param title The title of the wizard
		 * @param name The name used to identify the wizard in telemetry
		 * @param width The width of the wizard, default value is 'narrow'
		 */
		export function createWizard(title: string, name?: string, width?: DialogWidth): Wizard;

		/**
		 * Create a wizard page with the given title, for inclusion in a wizard
		 * @param title The title of the page
		 * @param pageName The optional page name parameter will be used for telemetry
		 */
		export function createWizardPage(title: string, pageName?: string): WizardPage;

		export interface Button {
			/**
			 * Specifies whether this is a secondary button. Default is false.
			 */
			secondary?: boolean;
		}
	}

	export namespace workspace {
		/**
		 * Create a new ModelView editor
		 * @param title The title shown in the editor tab
		 * @param options Options to configure the editor
		 * @param name The name used to identify the editor in telemetry
		 */
		export function createModelViewEditor(title: string, options?: ModelViewEditorOptions, name?: string,): ModelViewEditor;
	}

	export interface DashboardTab extends Tab {
		/**
		 * Toolbar of the tab, optional.
		 */
		toolbar?: ToolbarContainer;
	}

	export interface DashboardTabGroup {
		/**
		 * * Title of the tab group
		 */
		title: string;

		/**
		 * children of the tab group
		 */
		tabs: DashboardTab[];
	}

	export interface ModelViewDashboardOptions {
		/**
		 * Whether to show the tab icon, default is true
		 */
		showIcon?: boolean;

		/**
		 * Whether to show the tab navigation pane even when there is only one tab, default is false
		 */
		alwaysShowTabs?: boolean;
	}

	export interface Container<TLayout, TItemLayout> extends Component {
		setItemLayout(component: Component, layout: TItemLayout): void;
	}

	export interface TaskInfo {
		targetLocation?: string;
	}

	export interface ButtonColumnOption {
		icon?: IconPath;
	}

	export interface ButtonCell extends TableCell {
		columnName: string;
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
		getAccountSecurityToken(account: Account, tenant: string, resource: AzureResource): Thenable<{ token: string } | undefined>;
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

	export interface ButtonProperties {
		/**
		* Specifies whether to use expanded layout or not.
		*/
		buttonType?: ButtonType;
		/**
		* Description text to display inside button element.
		*/
		description?: string;
		/**
		 * Specifies whether this is a secondary button. Default value is false.
		 */
		secondary?: boolean;
	}

	export enum ButtonType {
		File = 'File',
		Normal = 'Normal',
		Informational = 'Informational'
	}

	export interface DiffEditorComponent {
		/**
		 * Title of editor
		 */
		title: string;
	}

	export namespace workspace {
		/**
		 * Creates and enters a workspace at the specified location
		 */
		export function createWorkspace(location: vscode.Uri, workspaceFile?: vscode.Uri): Promise<void>;

		/**
		 * Enters the workspace with the provided path
		 * @param workspacefile
		 */
		export function enterWorkspace(workspaceFile: vscode.Uri): Promise<void>;
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
		appendData(data: any[][]): void;
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

	export enum AzureResource {
		/**
		 * Microsoft Graph
		 */
		MsGraph = 7
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
}
