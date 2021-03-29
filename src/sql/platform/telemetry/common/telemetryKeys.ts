/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum ModalDialogName {
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
	CalloutDialog = 'CalloutDialog'
}

export enum TelemetryView {
	Agent = 'Agent',
	AgentJobs = 'AgentJobs',
	AgentJobHistory = 'AgentJobHistory',
	AgentJobSteps = 'AgentJobSteps',
	AgentNotebookHistory = 'AgentNotebookHistory',
	AgentNotebooks = 'AgentNotebooks',
	Shell = 'Shell',
	ExtensionRecommendationDialog = 'ExtensionRecommendationDialog',
	ResultsPanel = 'ResultsPanel',
	Notebook = 'Notebook',
	SqlAssessment = 'SqlAssessment'
}

export enum TelemetryError {
	DatabaseConnectionError = 'DatabaseConnectionError'
}

export enum TelemetryAction {
	AddServerGroup = 'AddServerGroup',
	adsCommandExecuted = 'adsCommandExecuted',
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
	FirewallRuleRequested = 'FirewallRuleCreated',
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
	RestoreRequested = 'RestoreRequested',
	RunAgentJob = 'RunAgentJob',
	RunQuery = 'RunQuery',
	RunQueryStatement = 'RunQueryStatement',
	RunQueryString = 'RunQueryString',
	StopAgentJob = 'StopAgentJob',
	WizardPagesNavigation = 'WizardPagesNavigation'
}

export enum NbTelemetryAction {
	RunCell = 'RunCell',
	RunAll = 'RunNotebook'
}

