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
	ExtensionHost = 'ExtensionHost',
	ExtensionRecommendationDialog = 'ExtensionRecommendationDialog',
	Notebook = 'Notebook',
	ResultsPanel = 'ResultsPanel',
	QueryEditor = 'QueryEditor',
	Shell = 'Shell',
	SqlAssessment = 'SqlAssessment',
	TableDesigner = 'TableDesigner'
}

export const enum TelemetryError {
	DatabaseConnectionError = 'DatabaseConnectionError'
}

export const enum TelemetryAction {
	ActualQueryExecutionPlan = 'ActualQueryExecutionPlan',
	AddServerGroup = 'AddServerGroup',
	adsCommandExecuted = 'adsCommandExecuted',
	ConnectToServer = 'ConnectToServer',
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
	EstimatedQueryExecutionPlan = 'EstimatedQueryExecutionPlan',
	CancelQuery = 'CancelQuery',
	ChartCreated = 'ChartCreated',
	Click = 'Click',
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
	PublishChanges = 'PublishChanges',
	RestoreRequested = 'RestoreRequested',
	RunAgentJob = 'RunAgentJob',
	RunQuery = 'RunQuery',
	RunQueryStatement = 'RunQueryStatement',
	RunQueryString = 'RunQueryString',
	ShowChart = 'ShowChart',
	StopAgentJob = 'StopAgentJob',
	WizardPagesNavigation = 'WizardPagesNavigation',
	SearchStarted = 'SearchStarted',
	SearchCompleted = 'SearchCompleted'
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

