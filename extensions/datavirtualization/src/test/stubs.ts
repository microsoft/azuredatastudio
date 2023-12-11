/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';

import { IPrompter, IQuestion, IPromptCallback } from '../prompts/question';
import { CheckboxTreeNode } from '../wizards/virtualizeData/virtualizeDataTree';
import { ObjectMappingPage } from '../wizards/virtualizeData/objectMappingPage';
import { ConnectionDetailsPage } from '../wizards/virtualizeData/connectionDetailsPage';
import { CreateMasterKeyPage, MasterKeyUiElements } from '../wizards/virtualizeData/createMasterKeyPage';
import { SelectDataSourcePage } from '../wizards/virtualizeData/selectDataSourcePage';
import {
	DataSourceWizardService, DataSourceWizardConfigInfoResponse, VirtualizeDataInput,
	ValidateVirtualizeDataInputResponse, GetDatabaseInfoResponse, GetDatabaseInfoRequestParams,
	ProcessVirtualizeDataInputResponse, GenerateScriptResponse, GetSourceDatabasesResponse, GetSourceTablesRequestParams,
	GetSourceTablesResponse, GetSourceColumnDefinitionsRequestParams, GetSourceColumnDefinitionsResponse,
	ColumnDefinition, ProseDiscoveryParams, ProseDiscoveryResponse, ExternalTableInfo, DataSourceType, SchemaTables,
	ExecutionResult, DataSourceBrowsingParams, SchemaViews, DatabaseOverview
} from '../services/contracts';
import { VirtualizeDataModel } from '../wizards/virtualizeData/virtualizeDataModel';
import { AppContext } from '../appContext';
import { ApiWrapper } from '../apiWrapper';
import { VDIManager } from '../wizards/virtualizeData/virtualizeDataInputManager';
import { VirtualizeDataWizard } from '../wizards/virtualizeData/virtualizeDataWizard';

// Dummy implementation to simplify mocking
export class TestPrompter implements IPrompter {
	public promptSingle<T>(question: IQuestion): Promise<T> {
		return Promise.resolve(undefined);
	}
	public prompt<T>(questions: IQuestion[]): Promise<{ [key: string]: T }> {
		return Promise.resolve(undefined);
	}
	public promptCallback(questions: IQuestion[], callback: IPromptCallback): void {
		callback({});
	}
}

export class MockExtensionContext implements vscode.ExtensionContext {
	logger: undefined;
	logDirectory: './';
	subscriptions: { dispose(): any; }[];
	workspaceState: vscode.Memento;
	globalState: vscode.Memento & { setKeysForSync(keys: readonly string[]): void; };
	extensionPath: string;
	asAbsolutePath(relativePath: string): string {
		return relativePath;
	}
	storagePath: string;

	constructor() {
		this.subscriptions = [];
	}
	secrets: vscode.SecretStorage;
	extension: vscode.Extension<any>;
	extensionUri: vscode.Uri;
	environmentVariableCollection: vscode.GlobalEnvironmentVariableCollection;
	storageUri: vscode.Uri;
	globalStorageUri: vscode.Uri;
	globalStoragePath: string;
	logUri: vscode.Uri;
	logPath: string;
	extensionMode: vscode.ExtensionMode;
}

export class MockWizard implements azdata.window.Wizard {
	displayPageTitles: boolean;
	title: string;
	pages: azdata.window.WizardPage[];
	currentPage: number;
	doneButton: azdata.window.Button;
	cancelButton: azdata.window.Button;
	generateScriptButton: azdata.window.Button;
	nextButton: azdata.window.Button;
	backButton: azdata.window.Button;
	customButtons: azdata.window.Button[];
	onPageChanged: vscode.Event<azdata.window.WizardPageChangeInfo>;
	message: azdata.window.DialogMessage;

	backgroundOpRegistered: boolean;

	addPage(page: azdata.window.WizardPage, index?: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	removePage(index: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	setCurrentPage(index: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	open(): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	close(): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	registerNavigationValidator(validator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean | Thenable<boolean>): void {
		throw new Error('Method not implemented.');
	}
	registerOperation(operationInfo: azdata.BackgroundOperationInfo): void {
		throw new Error('Method not implemented.');
	}
}

export class MockWizardPage implements azdata.window.WizardPage {
	title: string;
	content: string;
	customButtons: azdata.window.Button[];
	enabled: boolean;
	description: string;
	modelView: azdata.ModelView;
	valid: boolean;
	onValidityChanged: vscode.Event<boolean>;
	dispose() { }
	registerContent(handler: (view: azdata.ModelView) => void): void {
		throw new Error('Method not implemented.');
	}
}

export class MockDataSourceService implements DataSourceWizardService {
	providerId?: string;

	createDataSourceWizardSession(requestParams: azdata.connection.ConnectionProfile): Thenable<DataSourceWizardConfigInfoResponse> {
		return Promise.resolve<DataSourceWizardConfigInfoResponse>({
			sessionId: 'TestSessionId',
			supportedSourceTypes: [{
				typeName: 'SQL Server',
				authenticationTypes: ['SqlLogin']
			}],
			databaseList: [{ name: 'TestDb', hasMasterKey: false }],
			serverMajorVersion: 15,
			productLevel: 'CTP3.1'
		});
	}

	disposeWizardSession(sessionId: string): Thenable<boolean> {
		return Promise.resolve(true);
	}

	validateVirtualizeDataInput(requestParams: VirtualizeDataInput): Thenable<ValidateVirtualizeDataInputResponse> {
		throw new Error('Method not implemented.');
	}

	getDatabaseInfo(requestParams: GetDatabaseInfoRequestParams): Thenable<GetDatabaseInfoResponse> {
		return Promise.resolve({
			isSuccess: true,
			errorMessages: undefined,
			databaseInfo: {
				hasMasterKey: false,
				defaultSchema: 'TestSchema',
				schemaList: ['TestSchema'],
				existingCredentials: undefined,
				externalDataSources: [{
					name: 'TestSource',
					location: 'sqlhdfs://controller-svc/default/',
					authenticationType: undefined,
					username: undefined
				}],
				externalTables: [{
					schemaName: 'TestSchema',
					tableName: 'TestExternalTable'
				}],
				externalFileFormats: ['TestExternalFileFormat'],
			}
		});
	}

	processVirtualizeDataInput(virtualizeDataInput: VirtualizeDataInput): Thenable<ProcessVirtualizeDataInputResponse> {
		return Promise.resolve<ProcessVirtualizeDataInputResponse>({
			isSuccess: true,
			errorMessages: []
		});
	}

	generateScript(requestParams: VirtualizeDataInput): Thenable<GenerateScriptResponse> {
		throw new Error('Method not implemented.');
	}

	getSourceDatabases(requestParams: VirtualizeDataInput): Thenable<GetSourceDatabasesResponse> {
		throw new Error('Method not implemented.');
	}

	getSourceTables(requestParams: GetSourceTablesRequestParams): Thenable<GetSourceTablesResponse> {
		throw new Error('Method not implemented.');
	}

	getSourceViewList(requestParams: DataSourceBrowsingParams<string>): Thenable<ExecutionResult<SchemaViews[]>> {
		throw new Error("Method not implemented.");
	}

	getSourceColumnDefinitions(requestParams: GetSourceColumnDefinitionsRequestParams): Thenable<GetSourceColumnDefinitionsResponse> {
		throw new Error('Method not implemented.');
	}

	getSourceOriginalColumnDefinitions(requestParams: GetSourceColumnDefinitionsRequestParams): Thenable<GetSourceColumnDefinitionsResponse> {
		throw new Error("Method not implemented.");
	}

	public readonly proseTestData: string = 'TestId, TestStr\n1, abc';
	sendProseDiscoveryRequest(requestParams: ProseDiscoveryParams): Thenable<ProseDiscoveryResponse> {
		return Promise.resolve<ProseDiscoveryResponse>({
			dataPreview: [['1', 'abc']],
			columnInfo: [{
				name: 'TestId',
				sqlType: 'int',
				isNullable: false
			}, {
				name: 'TestStr',
				sqlType: 'varchar(50)',
				isNullable: false
			}],
			columnDelimiter: ',',
			firstRow: 2,
			quoteCharacter: '"'
		});
	}
}

export class MockUIComponent implements azdata.Component {
	height?: string | number;
	width?: string | number;
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	ariaHidden?: boolean;
	CSSStyles?: azdata.CssStyles;
	dispose() {
		throw new Error('Method not implemented.');
	}
	id: string;
	enabled: boolean;
	onValidityChanged: vscode.Event<boolean>;
	valid: boolean;
	validate(): Thenable<boolean> {
		return Promise.resolve(undefined);
	}
	updateProperties(properties: { [key: string]: any }): Thenable<void> {
		Object.assign(this, properties);
		return Promise.resolve();
	}
	updateProperty(key: string, value: any): Thenable<void> {
		return Promise.resolve();
	}
	updateCssStyles(cssStyles: { [key: string]: string }): Thenable<void> {
		Object.assign('CSSStyles', cssStyles);
		return Promise.resolve();
	}
	focus(): Thenable<void> {
		return Promise.resolve();
	}
}

export class MockInputBoxComponent extends MockUIComponent implements azdata.InputBoxComponent {
	display?: azdata.DisplayType;
	ariaRole?: string;
	ariaSelected?: boolean;
	ariaHidden?: boolean;
	dispose() {
		throw new Error('Method not implemented.');
	}
	validationErrorMessage?: string;
	readOnly?: boolean;
	title?: string;
	maxLength?: number;
	onEnterKeyPressed: vscode.Event<string>;
	value?: string;
	ariaLabel?: string;
	ariaLive?: azdata.AriaLiveValue;
	placeHolder?: string;
	inputType?: azdata.InputBoxInputType;
	required?: boolean;
	multiline?: boolean;
	rows?: number;
	columns?: number;
	min?: number;
	max?: number;
	stopEnterPropagation?: boolean;
	height?: string | number;
	width?: string | number;
	position?: azdata.PositionType;
	CSSStyles?: { [key: string]: string; };
	onTextChanged: vscode.Event<any>;
}

export class MockDropdownComponent extends MockUIComponent implements azdata.DropDownComponent {
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	ariaHidden?: boolean;
	CSSStyles?: azdata.CssStyles;
	dispose() {
		throw new Error('Method not implemented.');
	}
	fireOnTextChange?: boolean;
	required?: boolean;
	placeholder?: string;
	validationErrorMessages?: string[];
	strictSelection?: boolean;
	loading?: boolean;
	showText?: boolean;
	loadingText?: string;
	loadingCompletedText?: string;
	onValueChanged: vscode.Event<any>;
	value: string | azdata.CategoryValue;
	values: string[] | azdata.CategoryValue[];
	editable?: boolean;
	height?: number | string;
	width?: number | string;
}

export class MockTableComponent extends MockUIComponent implements azdata.TableComponent {
	dispose() {
		throw new Error('Method not implemented.');
	}
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaSelected?: boolean;
	ariaHidden?: boolean;
	updateCells?: azdata.TableCell[];
	headerFilter?: boolean;
	onRowSelected: vscode.Event<any>;
	onCellAction?: vscode.Event<azdata.ICellActionEventArgs>;
	data: any[][];
	columns: string[] | azdata.TableColumn[];
	fontSize?: string | number;
	selectedRows?: number[];
	forceFitColumns?: azdata.ColumnSizingMode;
	title?: string;
	ariaRowCount?: number;
	ariaColumnCount?: number;
	ariaRole?: string;
	focused?: boolean;
	moveFocusOutWithTab?: boolean;
	height?: string | number;
	width?: string | number;
	position?: azdata.PositionType;
	CSSStyles?: { [key: string]: string; };
	appendData(data: any[][]): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	setActiveCell(row: number, column: number): void {
		throw new Error('Method not implemented.');
	}
}

export class MockDeclarativeTableComponent extends MockUIComponent implements azdata.DeclarativeTableComponent {
	dispose() {
		throw new Error('Method not implemented.');
	}
	enableRowSelection?: boolean;
	selectedRow?: number;
	onRowSelected: vscode.Event<azdata.DeclarativeTableRowSelectedEvent>;
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	CSSStyles?: { [key: string]: string; };
	ariaHidden?: boolean;
	dataValues?: azdata.DeclarativeTableCellValue[][];
	selectEffect?: boolean;
	onDataChanged: vscode.Event<any>;
	data: any[][];
	columns: azdata.DeclarativeTableColumn[];
	height?: number | string;
	width?: number | string;
	setFilter(rowIndexes: number[]): void {
		throw new Error('Method not implemented.');
	}
	setDataValues(v: azdata.DeclarativeTableCellValue[][]): Promise<void> {
		throw new Error('Method not implemented.');
	}
}

export class MockTreeComponent extends MockUIComponent implements azdata.TreeComponent<any> {
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	ariaHidden?: boolean;
	CSSStyles?: azdata.CssStyles;
	dispose() {
		throw new Error('Method not implemented.');
	}
	withCheckbox: boolean;
	height?: number | string;
	width?: number | string;
	registerDataProvider<T>(dataProvider: azdata.TreeComponentDataProvider<T>): azdata.TreeComponentView<T> {
		return new MockTreeComponentView(() => { }) as azdata.TreeComponentView<T>;
	}
}

export class MockTreeComponentView extends vscode.Disposable implements azdata.TreeComponentView<any> {
	onCheckChangedEmitter = new vscode.EventEmitter<azdata.NodeCheckedEventParameters<CheckboxTreeNode>>();
	onNodeCheckedChanged: vscode.Event<azdata.NodeCheckedEventParameters<any>> = this.onCheckChangedEmitter.event;
	onDidChangeSelectionEmitter = new vscode.EventEmitter<vscode.TreeViewSelectionChangeEvent<CheckboxTreeNode[]>>();
	onDidChangeSelection: vscode.Event<vscode.TreeViewSelectionChangeEvent<any>> = this.onDidChangeSelectionEmitter.event;
}

export class MockTextComponent extends MockUIComponent implements azdata.TextComponent {
	height?: string | number;
	width?: string | number;
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	ariaHidden?: boolean;
	CSSStyles?: azdata.CssStyles;
	dispose() {
		throw new Error('Method not implemented.');
	}
	links?: azdata.LinkArea[];
	description?: string;
	requiredIndicator?: boolean;
	headingLevel?: azdata.HeadingLevel;
	textType?: azdata.TextType;
	ariaLive?: azdata.AriaLiveValue;
	title?: string;
	value: string;
	id: string;
	enabled: boolean;
	onValidityChanged: vscode.Event<boolean>;
	valid: boolean;
	onDidClick: vscode.Event<any>;
}

export class MockContainer<TLayout, TItemLayout> extends MockUIComponent implements azdata.Container<TLayout, TItemLayout> {
	dispose() {
		throw new Error('Method not implemented.');
	}
	setItemLayout(component: azdata.Component, layout: TItemLayout): void {
		throw new Error('Method not implemented.');
	}
	height?: string | number;
	width?: string | number;
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	CSSStyles?: { [key: string]: string; };
	ariaHidden?: boolean;
	items: azdata.Component[] = [];
	clearItems(): void {
		this.items = [];
	}
	addItems(itemConfigs: azdata.Component[], itemLayout?: any): void {
		this.items.push(...itemConfigs);
	}
	addItem(component: azdata.Component, itemLayout?: any): void {
		this.items.push(component);
	}
	setLayout(layout: any): void {
		// Do nothing.
	}
	insertItem(component: azdata.Component, index: number, itemLayout?: TItemLayout): void {
		throw new Error('Method not implemented.');
	}
	removeItem(component: azdata.Component): boolean {
		throw new Error('Method not implemented.');
	}
}
export class MockToolbarContainer extends MockContainer<any, any> implements azdata.ToolbarContainer {
	dispose() {
		throw new Error('Method not implemented.');
	}
	setItemLayout(component: azdata.Component, layout: any): void {
		throw new Error('Method not implemented.');
	}
	height?: string | number;
	width?: string | number;
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	CSSStyles?: { [key: string]: string; };
	ariaHidden?: boolean;
}

export class MockDivContainer extends MockContainer<azdata.DivLayout, azdata.DivItemLayout> implements azdata.DivContainer {
	dispose() {
		throw new Error('Method not implemented.');
	}
	ariaLive?: azdata.AriaLiveValue;
	setItemLayout(component: azdata.Component, layout: azdata.DivItemLayout): void {
		throw new Error('Method not implemented.');
	}
	height?: string | number;
	width?: string | number;
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	CSSStyles?: { [key: string]: string; };
	ariaHidden?: boolean;
	overflowY?: string;
	yOffsetChange?: number;
	clickable?: boolean;
	onDidClick: vscode.Event<any>;
}

export class MockFlexContainer extends MockContainer<azdata.FlexLayout, azdata.FlexItemLayout> implements azdata.FlexContainer {
	dispose() {
		throw new Error('Method not implemented.');
	}
	setItemLayout(component: azdata.Component, layout: azdata.FlexItemLayout): void {
		throw new Error('Method not implemented.');
	}
	height?: string | number;
	width?: string | number;
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	CSSStyles?: { [key: string]: string; };
	ariaHidden?: boolean;
}

export class MockFormContainer extends MockContainer<azdata.FormLayout, azdata.FormItemLayout> implements azdata.FormContainer {
	dispose() {
		throw new Error('Method not implemented.');
	}
	setItemLayout(component: azdata.Component, layout: azdata.FormItemLayout): void {
		throw new Error('Method not implemented.');
	}
	height?: string | number;
	width?: string | number;
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	CSSStyles?: { [key: string]: string; };
	ariaHidden?: boolean;
}

export class MockLoadingComponent extends MockUIComponent implements azdata.LoadingComponent {
	height?: string | number;
	width?: string | number;
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	ariaHidden?: boolean;
	CSSStyles?: azdata.CssStyles;
	dispose() {
		throw new Error('Method not implemented.');
	}
	showText?: boolean;
	loadingText?: string;
	loadingCompletedText?: string;
	loading: boolean;
	component: azdata.Component;
}

export class MockComponentBuilder implements azdata.ComponentBuilder<any, any> {
	public properties: any;
	constructor(private _component?: azdata.Component) { }
	withProps(properties: any): azdata.ComponentBuilder<any, any> {
		throw new Error('Method not implemented.');
	}
	component(): any {
		return this._component;
	}

	withProperties<U>(properties: U): azdata.ComponentBuilder<any, any> {
		this.properties = properties;
		return this;
	}

	withValidation(validation: (component: any) => boolean): azdata.ComponentBuilder<any, any> {
		return this;
	}
}

export class MockModelBuilder implements azdata.ModelBuilder {
	executionPlan(): azdata.ComponentBuilder<azdata.ExecutionPlanComponent, azdata.ExecutionPlanComponentProperties> {
		throw new Error('Method not implemented.');
	}
	infoBox(): azdata.ComponentBuilder<azdata.InfoBoxComponent, azdata.InfoBoxComponentProperties> {
		throw new Error('Method not implemented.');
	}
	listView(): azdata.ComponentBuilder<azdata.ListViewComponent, azdata.ListViewComponentProperties> {
		throw new Error('Method not implemented.');
	}
	chart<TChartType extends azdata.ChartType, TData extends azdata.ChartData<TChartType>, TOptions extends azdata.ChartOptions<TChartType>>(): azdata.ComponentBuilder<azdata.ChartComponent<TChartType, TData, TOptions>, azdata.ChartComponentProperties<TChartType, TData, TOptions>> {
		throw new Error('Method not implemented.');
	}
	slider(): azdata.ComponentBuilder<azdata.SliderComponent, azdata.SliderComponentProperties> {
		throw new Error('Method not implemented.');
	}
	propertiesContainer(): azdata.ComponentBuilder<azdata.PropertiesContainerComponent, azdata.PropertiesContainerComponentProperties> {
		throw new Error('Method not implemented.');
	}
	splitViewContainer(): azdata.SplitViewBuilder {
		throw new Error("Method not implemented.");
	}
	diffeditor(): azdata.ComponentBuilder<azdata.DiffEditorComponent, any> {
		throw new Error("Method not implemented.");
	}
	hyperlink(): azdata.ComponentBuilder<azdata.HyperlinkComponent, any> {
		throw new Error("Method not implemented.");
	}
	navContainer(): azdata.ContainerBuilder<azdata.NavContainer, any, any, any> {
		throw new Error('Method not implemented.');
	}
	divContainer(): azdata.DivBuilder {
		throw new Error('Method not implemented.');
	}
	flexContainer(): azdata.FlexBuilder {
		throw new Error('Method not implemented.');
	}
	card(): azdata.ComponentBuilder<azdata.CardComponent, any> {
		throw new Error('Method not implemented.');
	}
	inputBox(): azdata.ComponentBuilder<azdata.InputBoxComponent, any> {
		throw new Error('Method not implemented.');
	}
	checkBox(): azdata.ComponentBuilder<azdata.CheckBoxComponent, any> {
		throw new Error('Method not implemented.');
	}
	radioButton(): azdata.ComponentBuilder<azdata.RadioButtonComponent, any> {
		throw new Error('Method not implemented.');
	}
	webView(): azdata.ComponentBuilder<azdata.WebViewComponent, any> {
		throw new Error('Method not implemented.');
	}
	editor(): azdata.ComponentBuilder<azdata.EditorComponent, any> {
		throw new Error('Method not implemented.');
	}
	text(): azdata.ComponentBuilder<azdata.TextComponent, any> {
		throw new Error('Method not implemented.');
	}
	image(): azdata.ComponentBuilder<azdata.ImageComponent, any> {
		throw new Error('Method not implemented.');
	}
	button(): azdata.ComponentBuilder<azdata.ButtonComponent, any> {
		throw new Error('Method not implemented.');
	}
	dropDown(): azdata.ComponentBuilder<azdata.DropDownComponent, any> {
		throw new Error('Method not implemented.');
	}
	tree<T>(): azdata.ComponentBuilder<azdata.TreeComponent<T>, any> {
		return new MockComponentBuilder(new MockTreeComponent());
	}
	listBox(): azdata.ComponentBuilder<azdata.ListBoxComponent, any> {
		throw new Error('Method not implemented.');
	}
	table(): azdata.ComponentBuilder<azdata.TableComponent, any> {
		throw new Error('Method not implemented.');
	}
	declarativeTable(): azdata.ComponentBuilder<azdata.DeclarativeTableComponent, any> {
		throw new Error('Method not implemented.');
	}
	dashboardWidget(widgetId: string): azdata.ComponentBuilder<azdata.DashboardWidgetComponent, any> {
		throw new Error('Method not implemented.');
	}
	dashboardWebview(webviewId: string): azdata.ComponentBuilder<azdata.DashboardWebviewComponent, any> {
		throw new Error('Method not implemented.');
	}
	formContainer(): azdata.FormBuilder {
		throw new Error('Method not implemented.');
	}
	groupContainer(): azdata.GroupBuilder {
		throw new Error('Method not implemented.');
	}
	toolbarContainer(): azdata.ToolbarBuilder {
		throw new Error('Method not implemented.');
	}
	loadingComponent(): azdata.LoadingComponentBuilder {
		throw new Error('Method not implemented.');
	}
	fileBrowserTree(): azdata.ComponentBuilder<azdata.FileBrowserTreeComponent, any> {
		throw new Error('Method not implemented.');
	}
	radioCardGroup(): azdata.ComponentBuilder<azdata.RadioCardGroupComponent, any> {
		throw new Error('Method not implemented');
	}
	tabbedPanel(): azdata.TabbedPanelComponentBuilder {
		throw new Error('Method not implemented');
	}
	separator(): azdata.ComponentBuilder<azdata.SeparatorComponent, any> {
		throw new Error('Method not implemented');
	}
}

export class MockModelViewEditor implements azdata.workspace.ModelViewEditor {
	dispose() {
		throw new Error('Method not implemented.');
	}
	contentHandler: (view: azdata.ModelView) => void;
	saveHandler: () => Thenable<boolean>;
	openEditor(position?: vscode.ViewColumn): Thenable<void> {
		return Promise.resolve();
	}
	registerContent(handler: (view: azdata.ModelView) => void): void {
		this.contentHandler = handler;
	}
	registerSaveHandler(handler: () => Thenable<boolean>) {
		this.saveHandler = handler;
	}
	modelView: azdata.ModelView;
	valid: boolean;
	onValidityChanged: vscode.Event<boolean>;
	isDirty: boolean;
}

export class MockModelView implements azdata.ModelView {
	dispose() {
		throw new Error('Method not implemented.');
	}
	private onClosedEmitter = new vscode.EventEmitter<any>();
	public get onClosed(): vscode.Event<any> {
		return this.onClosedEmitter.event;
	}
	public get connection(): azdata.connection.Connection {
		return undefined;
	}
	public get serverInfo(): azdata.ServerInfo {
		return undefined;
	}
	public get modelBuilder(): azdata.ModelBuilder {
		return undefined;
	}
	public get valid(): boolean {
		return undefined;
	}
	public get onValidityChanged(): vscode.Event<boolean> {
		return undefined;
	}
	validate(): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}
	initializeModel<T extends azdata.Component>(root: T): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}

export class MockButtonComponent extends MockUIComponent implements azdata.ButtonComponent {
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	ariaHidden?: boolean;
	CSSStyles?: azdata.CssStyles;
	dispose() {
		throw new Error('Method not implemented.');
	}
	buttonType?: azdata.ButtonType;
	description?: string;
	secondary?: boolean;
	fileType?: string;
	label: string;
	title: string;
	iconPath: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri; };
	isFile?: boolean;
	fileContent?: string;
	height?: string | number;
	width?: string | number;
	iconHeight?: string | number;
	iconWidth?: string | number;
	public onDidClickEmitter = new vscode.EventEmitter<any>();
	public get onDidClick(): vscode.Event<any> {
		return this.onDidClickEmitter.event;
	}
}

export class MockEditorComponent extends MockUIComponent implements azdata.EditorComponent {
	height?: string | number;
	width?: string | number;
	position?: azdata.PositionType;
	display?: azdata.DisplayType;
	ariaLabel?: string;
	ariaRole?: string;
	ariaSelected?: boolean;
	ariaHidden?: boolean;
	dispose() {
		throw new Error('Method not implemented.');
	}
	content: string;
	languageMode: string;
	editorUri: string;
	CSSStyles: { [key: string]: string };
	onContentChanged: vscode.Event<any>;
	onEditorCreated: vscode.Event<any>;
	isAutoResizable: boolean;
	minimumHeight: 106;
}

export interface ISqlServerEnv {
	databases: {
		dbName: string;
		tables?: {
			schemaName: string;
			tableName: string;
			columnDefinitionList: ColumnDefinition[];
		}[];
		views?: {
			schemaName: string;
			viewName: string;
			columnDefinitionList: ColumnDefinition[];
		}[];
	}[];
}

export class SqlServerEnvFactory {
	private static sqlServerEnv: ISqlServerEnv =
		{
			databases:
				[
					{
						dbName: 'NorthWind',
						tables:
							[
								{
									schemaName: 'dbo',
									tableName: 'Employees',
									columnDefinitionList:
										[
											{ columnName: 'ID', dataType: 'INT', collationName: undefined, isNullable: false },
											{ columnName: 'FirstName', dataType: 'NVARCHAR(10)', collationName: 'SQL_Latin1_General_CP1_CI_AS', isNullable: false },
											{ columnName: 'LastName', dataType: 'NVARCHAR(20)', collationName: 'SQL_Latin1_General_CP1_CI_AS', isNullable: false },
											{ columnName: 'BirthDate', dataType: 'DATETIME2(3)', collationName: undefined, isNullable: true }
										]
								},
								{
									schemaName: 'dbo',
									tableName: 'Customers',
									columnDefinitionList:
										[
											{ columnName: 'ID', dataType: 'INT', collationName: undefined, isNullable: false },
											{ columnName: 'LoginID', dataType: 'NVARCHAR(10)', collationName: 'SQL_Latin1_General_CP1_CI_AS', isNullable: false },
											{ columnName: 'Nickname', dataType: 'NVARCHAR(20)', collationName: 'SQL_Latin1_General_CP1_CI_AS', isNullable: false },
											{ columnName: 'JoinDate', dataType: 'DATETIME2(3)', collationName: undefined, isNullable: true }
										]
								}
							],
						views:
							[
								{
									schemaName: 'dbo',
									viewName: 'MyView1',
									columnDefinitionList:
										[
											{ columnName: 'ID', dataType: 'INT', collationName: undefined, isNullable: false },
											{ columnName: 'FirstName', dataType: 'NVARCHAR(10)', collationName: 'SQL_Latin1_General_CP1_CI_AS', isNullable: false },
											{ columnName: 'LastName', dataType: 'NVARCHAR(20)', collationName: 'SQL_Latin1_General_CP1_CI_AS', isNullable: false },
											{ columnName: 'BirthDate', dataType: 'DATETIME2(3)', collationName: undefined, isNullable: true }
										]
								},
								{
									schemaName: 'dbo',
									viewName: 'MyView2',
									columnDefinitionList:
										[
											{ columnName: 'ID', dataType: 'INT', collationName: undefined, isNullable: false },
											{ columnName: 'LoginID', dataType: 'NVARCHAR(10)', collationName: 'SQL_Latin1_General_CP1_CI_AS', isNullable: false },
											{ columnName: 'Nickname', dataType: 'NVARCHAR(20)', collationName: 'SQL_Latin1_General_CP1_CI_AS', isNullable: false },
											{ columnName: 'JoinDate', dataType: 'DATETIME2(3)', collationName: undefined, isNullable: true }
										]
								}
							],
					},
					{
						dbName: 'pub',
						tables:
							[
								{
									schemaName: 'dbo',
									tableName: 'Orders',
									columnDefinitionList:
										[
											{ columnName: 'OrderID', dataType: 'INT', collationName: undefined, isNullable: false },
											{ columnName: 'CustomerID', dataType: 'INT', collationName: undefined, isNullable: false },
											{ columnName: 'ProductID', dataType: 'INT', collationName: undefined, isNullable: false },
											{ columnName: 'SoldPrice', dataType: 'INT', collationName: undefined, isNullable: false },
											{ columnName: 'Note', dataType: 'NVARCHAR(10)', collationName: 'SQL_Latin1_General_CP1_CI_AS', isNullable: false },
											{ columnName: 'OrderDate', dataType: 'DATETIME2(3)', collationName: undefined, isNullable: true }
										]
								},
								{
									schemaName: 'dbo',
									tableName: 'Products',
									columnDefinitionList:
										[
											{ columnName: 'ProductID', dataType: 'INT', collationName: undefined, isNullable: false },
											{ columnName: 'ProductName', dataType: 'NVARCHAR(20)', collationName: 'SQL_Latin1_General_CP1_CI_AS', isNullable: false },
											{ columnName: 'MSRP', dataType: 'INT', collationName: undefined, isNullable: false },
											{ columnName: 'ManufacturedDate', dataType: 'DATETIME2(3)', collationName: undefined, isNullable: true },
											{ columnName: 'StockCount', dataType: 'INT', collationName: undefined, isNullable: false }
										]
								}
							]
					}
				]
		};

	public static getSqlServerEnv(): ISqlServerEnv {
		return SqlServerEnvFactory.sqlServerEnv;
	}
}

interface IMockEnvConstants {
	sessionId: string;
	destDatabaseList: DatabaseOverview[];
	destDbNameSelected: string;
	sourceServerType: string;
	newDataSourceName: string;
	sourceServerName: string;
	sourceDatabaseName: string;
	sourceAuthenticationType: string;
	newCredentialName: string;
	sourceUsername: string;
	sourcePassword: string;
	destDbMasterKeyPwd: string;
	externalTableInfoList: ExternalTableInfo[];
	supportedSourceTypes: DataSourceType[];
	sqlServerEnv: ISqlServerEnv;
	serverMajorVersion: number;
	productLevel: string;
}

export class MockEnvConstantsFactory {
	private static mockEnvConstants: IMockEnvConstants = {
		sessionId: 'datasourcewizard://ade21baa-df28-4b03-b8e4-90e9c01c0142',
		destDatabaseList: [{ name: 'DestDB1', hasMasterKey: false }, { name: 'DestDB2', hasMasterKey: true }],
		destDbNameSelected: 'DestDB1',
		sourceServerType: 'SQL Server',
		destDbMasterKeyPwd: 'Pwd1234#', // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Unit test - not actually used to authenticate")]
		newDataSourceName: 'MyDataSource',
		sourceServerName: '192.168.0.11:1433',
		sourceDatabaseName: 'NorthWind',
		sourceAuthenticationType: undefined,
		newCredentialName: 'MyCred',
		sourceUsername: 'testuser',
		sourcePassword: 'GiveMe$500', // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Unit test - not actually used to authenticate")]
		externalTableInfoList: undefined,
		supportedSourceTypes: undefined,
		sqlServerEnv: undefined,
		serverMajorVersion: 15,
		productLevel: 'CTP2.5'
	};

	public static getMockEnvConstants(sqlServerEnv: ISqlServerEnv): IMockEnvConstants {
		MockEnvConstantsFactory.mockEnvConstants.sqlServerEnv = sqlServerEnv;

		let externalTableInfoList: ExternalTableInfo[] = [];
		sqlServerEnv.databases.forEach(db => {
			db.tables.forEach(table => {
				let externalTableName: string[] = [];
				let location: string[] = [db.dbName];
				for (let i = 0; i < table.tableName.length; ++i) {
					externalTableName.push(i < table.tableName.length - 1 ? table.tableName[i] : `v${table.tableName[i]}`);
					location.push(table.tableName[i]);
				}
				externalTableInfoList.push(
					{
						externalTableName: externalTableName,
						columnDefinitionList: table.columnDefinitionList,
						sourceTableLocation: location,
						fileFormat: undefined
					}
				);
			});
		});
		MockEnvConstantsFactory.mockEnvConstants.externalTableInfoList = externalTableInfoList;

		return MockEnvConstantsFactory.mockEnvConstants;
	}
}

export class VirtualizeDataMockEnv {
	private _virtualizeDataWizardlMock: TypeMoq.IMock<VirtualizeDataWizard>;
	private _virtualizeDataModelMock: TypeMoq.IMock<VirtualizeDataModel>;
	private _wizardMock: TypeMoq.IMock<MockWizard>;
	private _wizardPageMock: TypeMoq.IMock<MockWizardPage>;
	private _apiWrapperMock: TypeMoq.IMock<ApiWrapper>;
	private _vdiManagerMock: TypeMoq.IMock<VDIManager>;
	private _selectDataSourcePageMock: TypeMoq.IMock<SelectDataSourcePage>;

	private _mockedWizard: MockWizard;
	private _mockedWizardPage: MockWizardPage;
	private _mockedApiWrapper: ApiWrapper;
	private _mockedAppContext: AppContext;
	private _mockedVirtualizeDataWizard: VirtualizeDataWizard;
	private _mockedVirtualizeDataModel: VirtualizeDataModel;
	private _mockedVDIManager: VDIManager;

	private _mockedSelectDataSourcePage: SelectDataSourcePage;
	private _mockedCreateMasterKeyPage: CreateMasterKeyPage;
	private _mockedConnectionDetailsPage: ConnectionDetailsPage;
	private _mockedObjectMappingPage: ObjectMappingPage;

	private _mockEnvConstants: IMockEnvConstants;

	constructor(mockEnvConstants?: IMockEnvConstants) {
		if (mockEnvConstants) {
			this._mockEnvConstants = mockEnvConstants;
		} else {
			this._mockEnvConstants = MockEnvConstantsFactory.getMockEnvConstants(SqlServerEnvFactory.getSqlServerEnv());
		}
	}

	public getMockEnvConstants(): IMockEnvConstants {
		return this._mockEnvConstants;
	}

	public getWizardMock(): TypeMoq.IMock<MockWizard> {
		if (!this._wizardMock) {
			this._wizardMock = TypeMoq.Mock.ofType(MockWizard);
			this._wizardMock
				.setup(x => x.registerOperation(TypeMoq.It.isAny()));
		}
		return this._wizardMock;
	}

	public getMockedWizard(): MockWizard {
		if (!this._mockedWizard) {
			this._mockedWizard = this.getWizardMock().object;
		}
		return this._mockedWizard;
	}

	public getWizardPageMock(): TypeMoq.IMock<MockWizardPage> {
		if (!this._wizardPageMock) {
			this._wizardPageMock = TypeMoq.Mock.ofType(MockWizardPage);
			this._wizardPageMock
				.setup(x => x.registerContent(TypeMoq.It.isAny()));
		}
		return this._wizardPageMock;
	}

	public getMockedWizardPage(): MockWizardPage {
		if (!this._mockedWizardPage) {
			this._mockedWizardPage = this.getWizardPageMock().object;
		}
		return this._mockedWizardPage;
	}

	public getApiWrapperMock(): TypeMoq.IMock<ApiWrapper> {
		if (!this._apiWrapperMock) {
			this._apiWrapperMock = TypeMoq.Mock.ofType(ApiWrapper);
			this._apiWrapperMock
				.setup(x => x.createWizardPage(TypeMoq.It.isAnyString()))
				.returns(() => {
					return this.getMockedWizardPage();
				});
		}
		return this._apiWrapperMock;
	}

	public getMockedApiWrapper(): ApiWrapper {
		if (!this._mockedApiWrapper) {
			this._mockedApiWrapper = this.getApiWrapperMock().object;
		}
		return this._mockedApiWrapper;
	}

	public getMockedAppContext(): AppContext {
		if (!this._mockedAppContext) {
			let extensionContext = new MockExtensionContext();
			this._mockedAppContext = new AppContext(extensionContext, this.getApiWrapperMock().object);
		}
		return this._mockedAppContext;
	}

	public getVirtualizeDataWizardMock(): TypeMoq.IMock<VirtualizeDataWizard> {
		if (!this._virtualizeDataWizardlMock) {
			this._virtualizeDataWizardlMock = TypeMoq.Mock.ofType(VirtualizeDataWizard, TypeMoq.MockBehavior.Loose);

			this._virtualizeDataWizardlMock
				.setup(x => x.dataModel)
				.returns(() => {
					return this.getMockedVirtualizeDataModel();
				});

			this._virtualizeDataWizardlMock
				.setup(x => x.appContext)
				.returns(() => {
					return this.getMockedAppContext();
				});

			this._virtualizeDataWizardlMock
				.setup(x => x.vdiManager)
				.returns(() => {
					return this.getMockedVDIManager();
				});
		}
		return this._virtualizeDataWizardlMock;
	}

	public getMockedVirtualizeDataWizard(): VirtualizeDataWizard {
		if (!this._mockedVirtualizeDataWizard) {
			this._mockedVirtualizeDataWizard = this.getVirtualizeDataWizardMock().object;
		}
		return this._mockedVirtualizeDataWizard;
	}

	public getVirtualizeDataModelMock(): TypeMoq.IMock<VirtualizeDataModel> {
		if (!this._virtualizeDataModelMock) {
			this._virtualizeDataModelMock = TypeMoq.Mock.ofType(VirtualizeDataModel, TypeMoq.MockBehavior.Loose);

			this._virtualizeDataModelMock
				.setup(x => x.configInfoResponse)
				.returns(() => {
					return {
						sessionId: this._mockEnvConstants.sessionId,
						supportedSourceTypes: this._mockEnvConstants.supportedSourceTypes,
						databaseList: this._mockEnvConstants.destDatabaseList,
						serverMajorVersion: this._mockEnvConstants.serverMajorVersion,
						productLevel: this._mockEnvConstants.productLevel
					};
				});

			this._virtualizeDataModelMock
				.setup(x => x.destDatabaseList)
				.returns(() => {
					return this._mockEnvConstants.destDatabaseList;
				});

			this._virtualizeDataModelMock
				.setup(x => x.sessionId)
				.returns(() => this._mockEnvConstants.sessionId);

			this._virtualizeDataModelMock
				.setup(x => x.getSourceDatabases(TypeMoq.It.isAny()))
				.returns(_ => {
					return Promise.resolve<GetSourceDatabasesResponse>({
						isSuccess: true,
						errorMessages: undefined,
						databaseNames: this._mockEnvConstants.sqlServerEnv.databases.map(e => e.dbName)
					});
				});

			this._virtualizeDataModelMock
				.setup(x => x.getSourceTables(TypeMoq.It.isAny()))
				.returns(_ => {
					let tables = this._mockEnvConstants.sqlServerEnv.databases[0].tables;
					let schemaTablesList: SchemaTables[] = [];
					tables.forEach(table => {
						let correspondingSchemaTables: SchemaTables = schemaTablesList.find(e => e.schemaName === table.schemaName);
						if (correspondingSchemaTables) {
							correspondingSchemaTables.tableNames.push(table.tableName);
						} else {
							schemaTablesList.push({ schemaName: table.schemaName, tableNames: [table.tableName] });
						}
					});

					return Promise.resolve<GetSourceTablesResponse>({
						isSuccess: true,
						errorMessages: undefined,
						schemaTablesList: schemaTablesList
					});
				});

			this._virtualizeDataModelMock
				.setup(x => x.getSourceViewList(TypeMoq.It.isAny()))
				.returns(_ => {
					let views = this._mockEnvConstants.sqlServerEnv.databases[0].views;
					let schemaViewsList: SchemaViews[] = [];
					views.forEach(view => {
						let correspondingSchemaViews: SchemaViews = schemaViewsList.find(e => e.schemaName === view.schemaName);
						if (correspondingSchemaViews) {
							correspondingSchemaViews.viewNames.push(view.viewName);
						} else {
							schemaViewsList.push({ schemaName: view.schemaName, viewNames: [view.viewName] });
						}
					});

					return Promise.resolve<ExecutionResult<SchemaViews[]>>({
						isSuccess: true,
						errorMessages: undefined,
						returnValue: schemaViewsList
					});
				});

			this._virtualizeDataModelMock
				.setup(x => x.getSourceColumnDefinitions(TypeMoq.It.isAny()))
				.returns(() => {
					return Promise.resolve<ExecutionResult<ColumnDefinition[]>>({
						isSuccess: true,
						errorMessages: undefined,
						returnValue: this._mockEnvConstants.sqlServerEnv.databases[0].tables[0].columnDefinitionList
					});
				});

			this._virtualizeDataModelMock
				.setup(x => x.defaultSchema)
				.returns(() => { return 'dbo'; });

			this._virtualizeDataModelMock
				.setup(x => x.hasMasterKey())
				.returns(() => {
					return Promise.resolve(this._mockEnvConstants.destDbMasterKeyPwd === undefined);
				});

			this._virtualizeDataModelMock
				.setup(x => x.showWizardError(TypeMoq.It.isAny()));

			this._virtualizeDataModelMock
				.setup(x => x.validateInput(TypeMoq.It.isAny()))
				.returns(() => {
					return Promise.resolve(true);
				});

			this._virtualizeDataModelMock
				.setup(x => x.wizard)
				.returns(() => {
					return this.getMockedWizard();
				});

			this._virtualizeDataModelMock
				.setup(x => x.schemaList)
				.returns(() => {
					return ['TestSchema'];
				});
		}
		return this._virtualizeDataModelMock;
	}

	public getMockedVirtualizeDataModel(): VirtualizeDataModel {
		if (!this._mockedVirtualizeDataModel) {
			this._mockedVirtualizeDataModel = this.getVirtualizeDataModelMock().object;
		}
		return this._mockedVirtualizeDataModel;
	}

	private getVirtualizedDataInput(): VirtualizeDataInput {
		return {
			sessionId: this._mockEnvConstants.sessionId,
			destDatabaseName: this._mockEnvConstants.destDbNameSelected,
			sourceServerType: this._mockEnvConstants.sourceServerType,
			destDbMasterKeyPwd: this._mockEnvConstants.destDbMasterKeyPwd,
			existingDataSourceName: undefined,
			newDataSourceName: this._mockEnvConstants.newDataSourceName,
			sourceServerName: this._mockEnvConstants.sourceServerName,
			sourceDatabaseName: this._mockEnvConstants.sourceDatabaseName,
			sourceAuthenticationType: this._mockEnvConstants.sourceAuthenticationType,
			existingCredentialName: undefined,
			newCredentialName: this._mockEnvConstants.newCredentialName,
			sourceUsername: this._mockEnvConstants.sourceUsername,
			sourcePassword: this._mockEnvConstants.sourcePassword,
			externalTableInfoList: this._mockEnvConstants.externalTableInfoList,
			newSchemas: undefined
		};
	}

	public getVDIManagerMock(): TypeMoq.IMock<VDIManager> {
		if (!this._vdiManagerMock) {
			this._vdiManagerMock = TypeMoq.Mock.ofType(VDIManager, TypeMoq.MockBehavior.Loose);

			this._vdiManagerMock
				.setup(x => x.getVirtualizeDataInput(TypeMoq.It.isAny()))
				.returns(() => this.getVirtualizedDataInput());

			this._vdiManagerMock
				.setup(x => x.inputUptoConnectionDetailsPage)
				.returns(() => {
					let inputValues = this.getVirtualizedDataInput();
					inputValues.externalTableInfoList = undefined;
					return inputValues;
				});

			this._vdiManagerMock
				.setup(x => x.dataSourceName)
				.returns(() => { return this._mockEnvConstants.newDataSourceName; });

			this._vdiManagerMock
				.setup(x => x.sourceServerName)
				.returns(() => { return this._mockEnvConstants.sourceServerName; });
		}
		return this._vdiManagerMock;
	}

	public getMockedVDIManager(): VDIManager {
		if (!this._mockedVDIManager) {
			this._mockedVDIManager = this.getVDIManagerMock().object;
		}
		return this._mockedVDIManager;
	}

	public getMockedSelecteDataSourcePage(): SelectDataSourcePage {
		if (!this._mockedSelectDataSourcePage) {
			let virtualizeDataWizard = this.getMockedVirtualizeDataWizard();
			let selectDataSourcePage = new SelectDataSourcePage(virtualizeDataWizard);
			let sdsPage = <any>selectDataSourcePage;
			sdsPage._destDBDropDown = new MockDropdownComponent();
			sdsPage._destDBDropDown.value = 'MyDestinationDB';
			sdsPage._selectedSourceType = 'SQL Server';
			this._mockedSelectDataSourcePage = selectDataSourcePage;
		}
		return this._mockedSelectDataSourcePage;
	}

	public getMockedCreateMasterKeyPage(): CreateMasterKeyPage {
		if (!this._mockedCreateMasterKeyPage) {
			let dataModel = this.getMockedVirtualizeDataModel();
			let vdiManager = this.getMockedVDIManager();
			let appContext = this.getMockedAppContext();
			let createMasterKeyPage = new CreateMasterKeyPage(dataModel, vdiManager, appContext);
			let cmkPage = <any>createMasterKeyPage;
			cmkPage._uiElements = new MasterKeyUiElements();
			cmkPage._uiElements.masterKeyPasswordInput = new MockInputBoxComponent();
			cmkPage._uiElements.masterKeyPasswordConfirmInput = new MockInputBoxComponent();
			cmkPage._uiElements.masterKeyPasswordInput.value = 'GiveMe$500';
			cmkPage._uiElements.masterKeyPasswordConfirmInput.value = 'GiveMe$500';
			this._mockedCreateMasterKeyPage = createMasterKeyPage;
		}
		return this._mockedCreateMasterKeyPage;
	}

	public getMockedConnectionDetailsPage(): ConnectionDetailsPage {
		if (!this._mockedConnectionDetailsPage) {
			let dataModel = this.getMockedVirtualizeDataModel();
			let vdiManager = this.getMockedVDIManager();
			let appContext = this.getMockedAppContext();
			let connectionDetailsPage = new ConnectionDetailsPage(dataModel, vdiManager, appContext);
			let cdPage = <any>connectionDetailsPage;
			cdPage._sourceNameInput = new MockInputBoxComponent();
			cdPage._serverNameInput = new MockInputBoxComponent();
			cdPage._databaseNameInput = new MockInputBoxComponent();
			cdPage._existingCredDropdown = new MockDropdownComponent();
			cdPage._credentialNameInput = new MockInputBoxComponent();
			cdPage._usernameInput = new MockInputBoxComponent();
			cdPage._passwordInput = new MockInputBoxComponent();
			cdPage._sourceNameInput.value = 'MyDataSource';
			cdPage._serverNameInput.value = '192.168.0.101';
			cdPage._databaseNameInput.value = undefined;
			cdPage._existingCredDropdown.value = cdPage._createCredLabel;
			cdPage._credentialNameInput.value = 'MyCred';
			cdPage._usernameInput.value = 'testuser';
			cdPage._passwordInput.value = 'Pwd1234!';
			this._mockedConnectionDetailsPage = connectionDetailsPage;
		}
		return this._mockedConnectionDetailsPage;
	}

	public getMockedObjectMappingPage(): ObjectMappingPage {
		if (!this._mockedObjectMappingPage) {
			let dataModel = this.getMockedVirtualizeDataModel();
			let appContext = this.getMockedAppContext();
			let vdiManager = this.getMockedVDIManager();
			let objectMappingPage = new ObjectMappingPage(dataModel, vdiManager, appContext);
			let omPage = <any>objectMappingPage;
			omPage._modelBuilder = new MockModelBuilder();
			omPage._dataSourceTreeContainer = new MockFlexContainer();
			omPage._dataSourceTableTree = new MockTreeComponent();

			const mockSpinner = TypeMoq.Mock.ofType<azdata.LoadingComponent>();
			mockSpinner.setup(x => x.loading);
			omPage._objectMappingWrapperSpinner = mockSpinner;
			omPage._objectMappingWrapper = new MockFlexContainer();
			omPage._objectMappingContainer = new MockFlexContainer();
			omPage._tableHelpTextContainer = new MockFlexContainer();

			omPage._tableNameMappingContainer = new MockFlexContainer();
			omPage._sourceTableNameContainer = new MockFlexContainer();
			omPage._sourceSchemaInputBox = new MockInputBoxComponent();
			omPage._sourceTableNameInputBox = new MockInputBoxComponent();
			omPage._destTableNameInputContainer = new MockFormContainer();
			omPage._destTableSchemaDropdown = new MockDropdownComponent();
			omPage._destTableNameInputBox = new MockInputBoxComponent();

			omPage._columnMappingTableSpinner = mockSpinner;
			omPage._columnMappingTableContainer = new MockFormContainer();
			omPage._columnMappingTable = new MockDeclarativeTableComponent();

			let treeComponentView = new MockTreeComponentView(undefined);
			let treeComponentMock = TypeMoq.Mock.ofType(MockTreeComponent);
			treeComponentMock
				.setup(x => x.registerDataProvider(TypeMoq.It.isAny()))
				.returns(() => {
					return treeComponentView;
				});
			omPage._dataSourceTableTree = treeComponentMock.object;

			this._mockedObjectMappingPage = objectMappingPage;
		}
		return this._mockedObjectMappingPage;
	}
}

export class MockConnectionProfile extends azdata.connection.ConnectionProfile {
	providerId: 'TestProvider';
	connectionName: 'TestConnectionId';
	databaseName: undefined;
	userName: undefined;
	password: undefined;
	authenticationType: undefined;
	savePassword: false;
	groupFullName: undefined;
	groupId: undefined;
	saveProfile: false;
	azureTenantId?: undefined;
	serverName: 'TestServer';
}
