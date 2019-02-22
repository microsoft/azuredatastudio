/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { nb, IConnectionProfile } from 'sqlops';
import * as vsExtTypes from 'vs/workbench/api/node/extHostTypes';

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
	Dom,
	Hyperlink
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
	onComponentCreated
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
}

export interface IModelViewTabDetails {
	title: string;
	content: string;
}

export interface IModelViewButtonDetails {
	label: string;
	enabled: boolean;
	hidden: boolean;
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
}

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
	descriptions?: string[];
	status?: StatusIndicator;
	selected?: boolean;
	cardType: CardType;
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
	DacFxServicesProvider = 'DacFxServicesProvider',
	ObjectExplorerNodeProvider = 'ObjectExplorerNodeProvider',
}

export enum DeclarativeDataType {
	string = 'string',
	category = 'category',
	boolean = 'boolean',
	editableCategory = 'editableCategory'
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

export interface ToolbarLayout {
	orientation: Orientation;
}

export class TreeComponentItem extends vsExtTypes.TreeItem {
	label?: string;
	checked?: boolean;
}

export enum AzureResource {
	ResourceManagement = 0,
	Sql = 1
}

export class TreeItem extends vsExtTypes.TreeItem {
	label?: string;
	payload: IConnectionProfile;
	providerHandle: string;
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
		if (typeof (start) !== 'number' || typeof (start) !== 'number' || start < 0 || end < 0) {
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
