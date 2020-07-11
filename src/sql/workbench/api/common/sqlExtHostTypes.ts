/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, IConnectionProfile } from 'azdata';
import * as vsExtTypes from 'vs/workbench/api/common/extHostTypes';

// SQL added extension host types
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

export enum MetadataType {
	Table = 0,
	View = 1,
	SProc = 2,
	Function = 3
}

export enum EditRowState {
	clean = 0,
	dirtyInsert = 1,
	dirtyDelete = 2,
	dirtyUpdate = 3
}

export enum ExtensionNodeType {
	Server = 'Server',
	Database = 'Database'
}

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

export enum ScriptOperation {
	Select = 0,
	Create = 1,
	Insert = 2,
	Update = 3,
	Delete = 4,
	Execute = 5,
	Alter = 6
}

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

export enum JobCompletionActionCondition {
	Never = 0,
	OnSuccess = 1,
	OnFailure = 2,
	Always = 3
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

export enum AlertType {
	sqlServerEvent = 1,
	sqlServerPerformanceCondition = 2,
	nonSqlServerEvent = 3,
	wmiEvent = 4
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

export enum ModelComponentTypes {
	NavContainer,
	DivContainer,
	FlexContainer,
	SplitViewContainer,
	Card,
	InputBox,
	DropDown,
	DeclarativeTable,
	ListBox,
	Button,
	CheckBox,
	RadioButton,
	WebView,
	Text,
	Table,
	DashboardWidget,
	DashboardWebview,
	Form,
	Group,
	Toolbar,
	LoadingComponent,
	TreeComponent,
	FileBrowserTree,
	Editor,
	DiffEditor,
	Dom,
	Hyperlink,
	Image,
	RadioCardGroup,
	TabbedPanel,
	Separator,
	PropertiesContainer
}

export enum ModelViewAction {
	SelectTab = 'selectTab'
}

export enum ColumnSizingMode {
	ForceFit = 0,	// all columns will be sized to fit in viewable space, no horiz scroll bar
	AutoFit = 1,	// columns will be ForceFit up to a certain number; currently 3.  At 4 or more the behavior will switch to NO force fit
	DataFit = 2		// columns use sizing based on cell data, horiz scroll bar present if more cells than visible in view area
}

export enum AgentSubSystem {
	TransactSql = 1,
	ActiveScripting = 2,
	CmdExec = 3,
	Snapshot = 4,
	LogReader = 5,
	Distribution = 6,
	Merge = 7,
	QueueReader = 8,
	AnalysisQuery = 9,
	AnalysisCommands = 10,
	Ssis = 11,
	PowerShell = 12
}

export enum StepCompletionAction {
	QuitWithSuccess = 1,
	QuitWithFailure = 2,
	GoToNextStep = 3,
	GoToStep = 4
}

export interface CheckBoxInfo {
	row: number;
	columnName: string;
	checked: boolean;
}

export interface IComponentShape {
	type: ModelComponentTypes;
	id: string;
	properties?: { [key: string]: any };
	layout?: any;
	itemConfigs?: IItemConfig[];
}

export interface IItemConfig {
	componentShape: IComponentShape;
	config: any;
}

export enum ComponentEventType {
	PropertiesChanged,
	onDidChange,
	onDidClick,
	validityChanged,
	onMessage,
	onSelectedRowChanged,
	onComponentCreated,
	onCellAction,
	onEnterKeyPressed
}

export interface IComponentEventArgs {
	eventType: ComponentEventType;
	args: any;
}

export interface IModelViewDialogDetails {
	title: string;
	content: string | number[];
	okButton: number;
	cancelButton: number;
	customButtons: number[];
	message: DialogMessage;
	width: DialogWidth;
}

export interface IModelViewTabDetails {
	title: string;
	content: string;
}

export interface IModelViewButtonDetails {
	label: string;
	enabled: boolean;
	hidden: boolean;
	focused?: boolean;
	position?: 'left' | 'right';
}

export interface IModelViewWizardPageDetails {
	title: string;
	content: string;
	enabled: boolean;
	customButtons: number[];
	description: string;
}

export interface IModelViewWizardDetails {
	title: string;
	pages: number[];
	currentPage: number;
	doneButton: number;
	cancelButton: number;
	generateScriptButton: number;
	nextButton: number;
	backButton: number;
	customButtons: number[];
	message: DialogMessage;
	displayPageTitles: boolean;
	width: DialogWidth;
}

export type DialogWidth = 'narrow' | 'medium' | 'wide' | number;

export enum MessageLevel {
	Error = 0,
	Warning = 1,
	Information = 2
}

export interface DialogMessage {
	text: string;
	level?: MessageLevel;
	description?: string;
}

/// Card-related APIs that need to be here to avoid early load issues
// with enums causing requiring of sqlops API to fail.
export enum StatusIndicator {
	None = 0,
	Ok = 1,
	Warning = 2,
	Error = 3
}

export interface CardProperties {
	label: string;
	value?: string;
	actions?: ActionDescriptor[];
	descriptions?: CardDescriptionItem[];
	status?: StatusIndicator;
	selected?: boolean;
	cardType: CardType;
}

export interface CardDescriptionItem {
	label: string;
	value?: string;
}

export interface ActionDescriptor {
	label: string;
	actionTitle?: string;
	callbackData?: any;
}

export enum DataProviderType {
	ConnectionProvider = 'ConnectionProvider',
	BackupProvider = 'BackupProvider',
	RestoreProvider = 'RestoreProvider',
	ScriptingProvider = 'ScriptingProvider',
	ObjectExplorerProvider = 'ObjectExplorerProvider',
	TaskServicesProvider = 'TaskServicesProvider',
	FileBrowserProvider = 'FileBrowserProvider',
	ProfilerProvider = 'ProfilerProvider',
	MetadataProvider = 'MetadataProvider',
	QueryProvider = 'QueryProvider',
	AdminServicesProvider = 'AdminServicesProvider',
	AgentServicesProvider = 'AgentServicesProvider',
	CapabilitiesProvider = 'CapabilitiesProvider',
	ObjectExplorerNodeProvider = 'ObjectExplorerNodeProvider',
	SerializationProvider = 'SerializationProvider',
	IconProvider = 'IconProvider',
	SqlAssessmentServicesProvider = 'SqlAssessmentServicesProvider'
}

export enum DeclarativeDataType {
	string = 'string',
	category = 'category',
	boolean = 'boolean',
	editableCategory = 'editableCategory',
	component = 'component'
}

export enum CardType {
	VerticalButton = 'VerticalButton',
	Details = 'Details',
	ListItem = 'ListItem'
}

export enum Orientation {
	Horizontal = 'horizontal',
	Vertical = 'vertial'
}

/**
 * The possible values of the server engine edition
 */
export enum DatabaseEngineEdition {
	Unknown = 0,
	Personal = 1,
	Standard = 2,
	Enterprise = 3,
	Express = 4,
	SqlDatabase = 5,
	SqlDataWarehouse = 6,
	SqlStretchDatabase = 7,
	SqlManagedInstance = 8,
	SqlOnDemand = 11
}

export interface ToolbarLayout {
	orientation: Orientation;
}

export class TreeComponentItem extends vsExtTypes.TreeItem {
	checked?: boolean;
}

export enum AzureResource {
	ResourceManagement = 0,
	Sql = 1,
	OssRdbms = 2,
	AzureKeyVault = 3,
	Graph = 4,
	MicrosoftResourceManagement = 5,
	AzureDevOps = 6
}

export class TreeItem extends vsExtTypes.TreeItem {
	payload?: IConnectionProfile;
	providerHandle?: string;
}

export interface ServerInfoOption {
	isBigDataCluster: boolean;
	clusterEndpoints: ClusterEndpoint;
}

export interface ClusterEndpoint {
	serviceName: string;
	ipAddress: string;
	port: number;
}

export class SqlThemeIcon {

	static readonly Folder = new SqlThemeIcon('Folder');
	static readonly Root = new SqlThemeIcon('root');
	static readonly Database = new SqlThemeIcon('Database');
	static readonly Server = new SqlThemeIcon('Server');
	static readonly ScalarValuedFunction = new SqlThemeIcon('ScalarValuedFunction');
	static readonly TableValuedFunction = new SqlThemeIcon('TableValuedFunction');
	static readonly AggregateFunction = new SqlThemeIcon('AggregateFunction');
	static readonly FileGroup = new SqlThemeIcon('FileGroup');
	static readonly StoredProcedure = new SqlThemeIcon('StoredProcedure');
	static readonly UserDefinedTableType = new SqlThemeIcon('UserDefinedTableType');
	static readonly View = new SqlThemeIcon('View');
	static readonly Table = new SqlThemeIcon('Table');
	static readonly HistoryTable = new SqlThemeIcon('HistoryTable');
	static readonly ServerLevelLinkedServerLogin = new SqlThemeIcon('ServerLevelLinkedServerLogin');
	static readonly ServerLevelServerAudit = new SqlThemeIcon('ServerLevelServerAudit');
	static readonly ServerLevelCryptographicProvider = new SqlThemeIcon('ServerLevelCryptographicProvider');
	static readonly ServerLevelCredential = new SqlThemeIcon('ServerLevelCredential');
	static readonly ServerLevelServerRole = new SqlThemeIcon('ServerLevelServerRole');
	static readonly ServerLevelLogin = new SqlThemeIcon('ServerLevelLogin');
	static readonly ServerLevelServerAuditSpecification = new SqlThemeIcon('ServerLevelServerAuditSpecification');
	static readonly ServerLevelServerTrigger = new SqlThemeIcon('ServerLevelServerTrigger');
	static readonly ServerLevelLinkedServer = new SqlThemeIcon('ServerLevelLinkedServer');
	static readonly ServerLevelEndpoint = new SqlThemeIcon('ServerLevelEndpoint');
	static readonly Synonym = new SqlThemeIcon('Synonym');
	static readonly DatabaseTrigger = new SqlThemeIcon('DatabaseTrigger');
	static readonly Assembly = new SqlThemeIcon('Assembly');
	static readonly MessageType = new SqlThemeIcon('MessageType');
	static readonly Contract = new SqlThemeIcon('Contract');
	static readonly Queue = new SqlThemeIcon('Queue');
	static readonly Service = new SqlThemeIcon('Service');
	static readonly Route = new SqlThemeIcon('Route');
	static readonly DatabaseAndQueueEventNotification = new SqlThemeIcon('DatabaseAndQueueEventNotification');
	static readonly RemoteServiceBinding = new SqlThemeIcon('RemoteServiceBinding');
	static readonly BrokerPriority = new SqlThemeIcon('BrokerPriority');
	static readonly FullTextCatalog = new SqlThemeIcon('FullTextCatalog');
	static readonly FullTextStopList = new SqlThemeIcon('FullTextStopList');
	static readonly SqlLogFile = new SqlThemeIcon('SqlLogFile');
	static readonly PartitionFunction = new SqlThemeIcon('PartitionFunction');
	static readonly PartitionScheme = new SqlThemeIcon('PartitionScheme');
	static readonly SearchPropertyList = new SqlThemeIcon('SearchPropertyList');
	static readonly User = new SqlThemeIcon('User');
	static readonly Schema = new SqlThemeIcon('Schema');
	static readonly AsymmetricKey = new SqlThemeIcon('AsymmetricKey');
	static readonly Certificate = new SqlThemeIcon('Certificate');
	static readonly SymmetricKey = new SqlThemeIcon('SymmetricKey');
	static readonly DatabaseEncryptionKey = new SqlThemeIcon('DatabaseEncryptionKey');
	static readonly MasterKey = new SqlThemeIcon('MasterKey');
	static readonly DatabaseAuditSpecification = new SqlThemeIcon('DatabaseAuditSpecification');
	static readonly Column = new SqlThemeIcon('Column');
	static readonly Key = new SqlThemeIcon('Key');
	static readonly Constraint = new SqlThemeIcon('Constraint');
	static readonly Trigger = new SqlThemeIcon('Trigger');
	static readonly Index = new SqlThemeIcon('Index');
	static readonly Statistic = new SqlThemeIcon('Statistic');
	static readonly UserDefinedDataType = new SqlThemeIcon('UserDefinedDataType');
	static readonly UserDefinedType = new SqlThemeIcon('UserDefinedType');
	static readonly XmlSchemaCollection = new SqlThemeIcon('XmlSchemaCollection');
	static readonly SystemExactNumeric = new SqlThemeIcon('SystemExactNumeric');
	static readonly SystemApproximateNumeric = new SqlThemeIcon('SystemApproximateNumeric');
	static readonly SystemDateAndTime = new SqlThemeIcon('SystemDateAndTime');
	static readonly SystemCharacterString = new SqlThemeIcon('SystemCharacterString');
	static readonly SystemUnicodeCharacterString = new SqlThemeIcon('SystemUnicodeCharacterString');
	static readonly SystemBinaryString = new SqlThemeIcon('SystemBinaryString');
	static readonly SystemOtherDataType = new SqlThemeIcon('SystemOtherDataType');
	static readonly SystemClrDataType = new SqlThemeIcon('SystemClrDataType');
	static readonly SystemSpatialDataType = new SqlThemeIcon('SystemSpatialDataType');
	static readonly UserDefinedTableTypeColumn = new SqlThemeIcon('UserDefinedTableTypeColumn');
	static readonly UserDefinedTableTypeKey = new SqlThemeIcon('UserDefinedTableTypeKey');
	static readonly UserDefinedTableTypeConstraint = new SqlThemeIcon('UserDefinedTableTypeConstraint');
	static readonly StoredProcedureParameter = new SqlThemeIcon('StoredProcedureParameter');
	static readonly TableValuedFunctionParameter = new SqlThemeIcon('TableValuedFunctionParameter');
	static readonly ScalarValuedFunctionParameter = new SqlThemeIcon('ScalarValuedFunctionParameter');
	static readonly AggregateFunctionParameter = new SqlThemeIcon('AggregateFunctionParameter');
	static readonly DatabaseRole = new SqlThemeIcon('DatabaseRole');
	static readonly ApplicationRole = new SqlThemeIcon('ApplicationRole');
	static readonly FileGroupFile = new SqlThemeIcon('FileGroupFile');
	static readonly SystemMessageType = new SqlThemeIcon('SystemMessageType');
	static readonly SystemContract = new SqlThemeIcon('SystemContract');
	static readonly SystemService = new SqlThemeIcon('SystemService');
	static readonly SystemQueue = new SqlThemeIcon('SystemQueue');
	static readonly Sequence = new SqlThemeIcon('Sequence');
	static readonly SecurityPolicy = new SqlThemeIcon('SecurityPolicy');
	static readonly DatabaseScopedCredential = new SqlThemeIcon('DatabaseScopedCredential');
	static readonly ExternalResource = new SqlThemeIcon('ExternalResource');
	static readonly ExternalDataSource = new SqlThemeIcon('ExternalDataSource');
	static readonly ExternalFileFormat = new SqlThemeIcon('ExternalFileFormat');
	static readonly ExternalTable = new SqlThemeIcon('ExternalTable');
	static readonly ColumnMasterKey = new SqlThemeIcon('ColumnMasterKey');
	static readonly ColumnEncryptionKey = new SqlThemeIcon('ColumnEncryptionKey');

	public readonly id: string;

	private constructor(id: string) {
		this.id = id;
	}
}

export interface INotebookManagerDetails {
	handle: number;
	hasContentManager: boolean;
	hasServerManager: boolean;
}

export interface INotebookSessionDetails {
	readonly sessionId: number;
	readonly canChangeKernels: boolean;
	readonly id: string;
	readonly path: string;
	readonly name: string;
	readonly type: string;
	readonly status: string;
	readonly kernelDetails: INotebookKernelDetails;
}

export interface INotebookKernelDetails {
	readonly kernelId: number;
	readonly id: string;
	readonly name: string;
	readonly supportsIntellisense: boolean;
	readonly requiresConnection: boolean;
	readonly info?: any;
}

export interface INotebookFutureDetails {
	readonly futureId: number;
	readonly msg: any;
}

export enum FutureMessageType {
	Reply = 0,
	StdIn = 1,
	IOPub = 2
}

export interface INotebookFutureDone {
	succeeded: boolean;
	rejectReason: string;
	message: nb.IShellMessage;
}

export interface ICellRange {
	readonly start: number;
	readonly end: number;
}

export class CellRange {

	protected _start: number;
	protected _end: number;

	get start(): number {
		return this._start;
	}

	get end(): number {
		return this._end;
	}

	constructor(start: number, end: number) {
		if (typeof (start) !== 'number' || typeof (end) !== 'number' || start < 0 || end < 0) {
			throw new Error('Invalid arguments');
		}

		// Logic taken from range handling.
		if (start <= end) {
			this._start = start;
			this._end = end;
		} else {
			this._start = end;
			this._end = start;
		}
	}
}

export interface ISingleNotebookEditOperation {
	range: ICellRange;
	cell: Partial<nb.ICellContents>;
	forceMoveMarkers: boolean;
}

export class ConnectionProfile {
	get providerId(): string {
		return this.options['providerId'];
	}

	set providerId(value: string) {
		this.options['providerId'] = value;
	}

	get connectionId(): string {
		return this.options['connectionId'];
	}

	set connectionId(value: string) {
		this.options['connectionId'] = value;
	}

	get connectionName(): string {
		return this.options['connectionName'];
	}

	set connectionName(value: string) {
		this.options['connectionName'] = value;
	}

	get serverName(): string {
		return this.options['serverName'];
	}

	set serverName(value: string) {
		this.options['serverName'] = value;
	}

	get databaseName(): string {
		return this.options['databaseName'];
	}

	set databaseName(value: string) {
		this.options['databaseName'] = value;
	}

	get userName(): string {
		return this.options['userName'];
	}

	set userName(value: string) {
		this.options['userName'] = value;
	}

	get password(): string {
		return this.options['password'];
	}

	set password(value: string) {
		this.options['password'] = value;
	}

	get authenticationType(): string {
		return this.options['authenticationType'];
	}

	set authenticationType(value: string) {
		this.options['authenticationType'] = value;
	}

	get savePassword(): boolean {
		return this.options['savePassword'];
	}

	set savePassword(value: boolean) {
		this.options['savePassword'] = value;
	}

	get groupFullName(): string {
		return this.options['groupFullName'];
	}

	set groupFullName(value: string) {
		this.options['groupFullName'] = value;
	}

	get groupId(): string {
		return this.options['groupId'];
	}

	set groupId(value: string) {
		this.options['groupId'] = value;
	}

	get saveProfile(): boolean {
		return this.options['groupId'];
	}

	set saveProfile(value: boolean) {
		this.options['groupId'] = value;
	}

	get azureTenantId(): string {
		return this.options['azureTenantId'];
	}

	set azureTenantId(value: string) {
		this.options['azureTenantId'] = value;
	}

	get azureAccount(): string {
		return this.options['azureAccount'];
	}

	set azureAccount(value: string) {
		this.options['azureAccount'] = value;
	}

	options: { [key: string]: any } = {};

	static createFrom(options: { [key: string]: any }): ConnectionProfile {
		let profile = new ConnectionProfile();
		profile.options = options;
		return profile;
	}
}

export enum SchemaUpdateAction {
	Delete = 0,
	Change = 1,
	Add = 2
}

export enum SchemaDifferenceType {
	Object = 0,
	Property = 1
}

export enum SchemaCompareEndpointType {
	Database = 0,
	Dacpac = 1
}

export enum SchemaObjectType {
	Aggregates = 0,
	ApplicationRoles = 1,
	Assemblies = 2,
	AssemblyFiles = 3,
	AsymmetricKeys = 4,
	BrokerPriorities = 5,
	Certificates = 6,
	ColumnEncryptionKeys = 7,
	ColumnMasterKeys = 8,
	Contracts = 9,
	DatabaseOptions = 10,
	DatabaseRoles = 11,
	DatabaseTriggers = 12,
	Defaults = 13,
	ExtendedProperties = 14,
	ExternalDataSources = 15,
	ExternalFileFormats = 16,
	ExternalTables = 17,
	Filegroups = 18,
	FileTables = 19,
	FullTextCatalogs = 20,
	FullTextStoplists = 21,
	MessageTypes = 22,
	PartitionFunctions = 23,
	PartitionSchemes = 24,
	Permissions = 25,
	Queues = 26,
	RemoteServiceBindings = 27,
	RoleMembership = 28,
	Rules = 29,
	ScalarValuedFunctions = 30,
	SearchPropertyLists = 31,
	SecurityPolicies = 32,
	Sequences = 33,
	Services = 34,
	Signatures = 35,
	StoredProcedures = 36,
	SymmetricKeys = 37,
	Synonyms = 38,
	Tables = 39,
	TableValuedFunctions = 40,
	UserDefinedDataTypes = 41,
	UserDefinedTableTypes = 42,
	ClrUserDefinedTypes = 43,
	Users = 44,
	Views = 45,
	XmlSchemaCollections = 46,
	Audits = 47,
	Credentials = 48,
	CryptographicProviders = 49,
	DatabaseAuditSpecifications = 50,
	DatabaseEncryptionKeys = 51,
	DatabaseScopedCredentials = 52,
	Endpoints = 53,
	ErrorMessages = 54,
	EventNotifications = 55,
	EventSessions = 56,
	LinkedServerLogins = 57,
	LinkedServers = 58,
	Logins = 59,
	MasterKeys = 60,
	Routes = 61,
	ServerAuditSpecifications = 62,
	ServerRoleMembership = 63,
	ServerRoles = 64,
	ServerTriggers = 65
}

export enum ColumnType {
	text = 0,
	checkBox = 1,
	button = 2
}

export enum ActionOnCellCheckboxCheck {
	selectRow = 0,
	customAction = 1
}

export enum NotebookChangeKind {
	ContentUpdated = 0,
	MetadataUpdated = 1,
	Save = 2,
	CellExecuted = 3
}

export type QueryEventType =
	| 'queryStart'
	| 'queryStop'
	| 'executionPlan'
	| 'visualize';

export enum TabOrientation {
	Vertical = 'vertical',
	Horizontal = 'horizontal'
}

export interface TabbedPanelLayout {
	orientation: TabOrientation;
	showIcon: boolean;
	alwaysShowTabs: boolean;
}

export enum SqlAssessmentTargetType {
	Server = 1,
	Database = 2
}

export enum SqlAssessmentResultItemKind {
	RealResult = 0,
	Warning = 1,
	Error = 2
}
