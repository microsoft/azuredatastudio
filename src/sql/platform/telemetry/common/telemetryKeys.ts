/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const enum EventName {
	Action = 'action',
	Error = 'error',
	Metrics = 'metrics',
	View = 'view'
}

export const enum ModalDialogName {
	ErrorMessage = 'ErrorMessage',
	WebView = 'WebView',
	ConnectionAdvancedProperties = 'ConnectionAdvancedProperties',
	Connection = 'Connection',
	Backup = 'Backup',
	FileBrowser = 'FileBrowser',
	UrlBrowser = 'UrlBrowser',
	Restore = 'Restore',
	Insights = 'Insights',
	Profiler = 'Profiler',
	ServerGroups = 'ServerGroups',
	Accounts = 'Accounts',
	FireWallRule = 'FirewallRule',
	AutoOAuth = 'AutoOAuth',
	AddNewDashboardTab = 'AddNewDashboardTab',
	ProfilerFilter = 'ProfilerFilter',
	CalloutDialog = 'CalloutDialog',
	TableDesignerPublishDialog = 'TableDesignerPublishDialog'
}

export const enum TelemetryView {
	Agent = 'Agent',
	AgentJobs = 'AgentJobs',
	AgentJobHistory = 'AgentJobHistory',
	AgentJobSteps = 'AgentJobSteps',
	AgentNotebookHistory = 'AgentNotebookHistory',
	AgentNotebooks = 'AgentNotebooks',
	ConnectionDialog = 'ConnectionDialog',
	ExecutionPlan = 'ExecutionPlan',
	ExtensionHost = 'ExtensionHost',
	ExtensionRecommendationDialog = 'ExtensionRecommendationDialog',
	Notebook = 'Notebook',
	ResultsPanel = 'ResultsPanel',
	Shell = 'Shell',
	SqlAssessment = 'SqlAssessment',
	TableDesigner = 'TableDesigner'
}

export const enum TelemetryError {
	DatabaseConnectionError = 'DatabaseConnectionError',
	ObjectExplorerExpandError = 'ObjectExplorerExpandError'
}

export const enum TelemetryAction {
	AddServerGroup = 'AddServerGroup',
	adsCommandExecuted = 'adsCommandExecuted',
	ConnectToServer = 'ConnectToServer',
	CustomZoom = 'CustomZoom',
	BackupCreated = 'BackupCreated',
	DashboardNavigated = 'DashboardNavigated',
	DatabaseConnected = 'DatabaseConnected',
	DatabaseDisconnected = 'DatabaseDisconnected',
	DeleteAgentJob = 'DeleteAgentJob',
	DeleteAgentJobStep = 'DeleteAgentJobStep',
	DeleteAgentAlert = 'DeleteAgentAlert',
	DeleteAgentOperator = 'DeleteAgentOperator',
	DeleteAgentProxy = 'DeleteAgentProxy',
	DeleteConnection = 'DeleteConnection',
	DeleteServerGroup = 'DeleteServerGroup',
	CancelQuery = 'CancelQuery',
	ChartCreated = 'ChartCreated',
	Click = 'Click',
	FindNode = 'FindNode',
	FirewallRuleRequested = 'FirewallRuleCreated',
	GenerateScript = 'GenerateScript',
	GeneratePreviewReport = 'GeneratePreviewReport',
	GetDataGridItems = 'GetDataGridItems',
	GetDataGridColumns = 'GetDataGridColumns',
	ModelViewDashboardOpened = 'ModelViewDashboardOpened',
	ModalDialogClosed = 'ModalDialogClosed',
	ModalDialogOpened = 'ModalDialogOpened',
	MoveServerConnection = 'MoveServerConnection',
	MoveServerGroup = 'MoveServerGroup',
	NewQuery = 'NewQuery',
	ObjectExplorerExpand = 'ObjectExplorerExpand',
	Open = 'Open',
	OpenQuery = 'OpenQuery',
	OpenExecutionPlanProperties = 'OpenExecutionPlanProperties',
	PublishChanges = 'PublishChanges',
	RestoreRequested = 'RestoreRequested',
	RunAgentJob = 'RunAgentJob',
	RunQuery = 'RunQuery',
	RunQueryStatement = 'RunQueryStatement',
	RunQueryString = 'RunQueryString',
	ShowChart = 'ShowChart',
	StopAgentJob = 'StopAgentJob',
	ViewTopOperations = 'ViewTopOperations',
	WizardPagesNavigation = 'WizardPagesNavigation',
	SearchStarted = 'SearchStarted',
	SearchCompleted = 'SearchCompleted',
	ZoomIn = 'ZoomIn',
	ZoomOut = 'ZoomOut',
	ZoomToFit = 'ZoomToFIt'
}

export const enum NbTelemetryAction {
	RunCell = 'RunCell',
	RunAll = 'RunNotebook',
	AddCell = 'AddCell',
	KernelChanged = 'KernelChanged',
	NewNotebookFromConnections = 'NewNotebookWithConnectionProfile',
	UndoCell = 'UndoCell',
	RedoCell = 'RedoCell',
	MIMETypeRendererNotFound = 'MIMETypeRendererNotFound'
}

export const enum TelemetryPropertyName {
	ChartMaxRowCountExceeded = 'chartMaxRowCountExceeded',
	ConnectionSource = 'connectionSource'
}

