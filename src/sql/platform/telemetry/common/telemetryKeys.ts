/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Telemetry Event Names

export const DatabaseConnected = 'DatabaseConnected';
export const DatabaseDisconnected = 'DatabaseDisconnected';
export const DeleteConnection = 'DeleteConnection';
export const AddServerGroup = 'AddServerGroup';
export const MoveServerGroup = 'MoveServerGroup';
export const MoveServerConnection = 'MoveServerConnection';
export const DeleteServerGroup = 'DeleteServerGroup';
export const ModalDialogClosed = 'ModalDialogClosed';
export const ModalDialogOpened = 'ModalDialogOpened';
export const BackupCreated = 'BackupCreated';
export const RestoreRequested = 'RestoreRequested';
export const ChartCreated = 'ChartCreated';
export const ObjectExplorerExpand = 'ObjectExplorerExpand';
export const RunQuery = 'RunQuery';
export const RunQueryStatement = 'RunQueryStatement';
export const RunQueryString = 'RunQueryString';
export const CancelQuery = 'CancelQuery';
export const NewQuery = 'NewQuery';
export const FirewallRuleRequested = 'FirewallRuleCreated';
export const DashboardNavigated = 'DashboardNavigated';

// Telemetry Properties

// Modal Dialogs:
export const ErrorMessage = 'ErrorMessage';
export const WebView = 'WebView';
export const ConnectionAdvancedProperties = 'ConnectionAdvancedProperties';
export const Connection = 'Connection';
export const Backup = 'Backup';
export const Restore = 'Restore';
export const Insights = 'Insights';
export const Profiler = 'Profiler';
export const ServerGroups = 'ServerGroups';
export const Accounts = 'Accounts';
export const FireWallRule = 'FirewallRule';
export const AutoOAuth = 'AutoOAuth';
export const AddNewDashboardTab = 'AddNewDashboardTab';
export const ProfilerFilter = 'ProfilerFilter';

// SQL Agent Events:

// Views
export const JobsView = 'JobsViewOpened';
export const JobHistoryView = 'JobHistoryViewOpened';
export const JobStepsView = 'JobStepsViewOpened';

// Actions
export const RunAgentJob = 'RunAgentJob';
export const StopAgentJob = 'StopAgentJob';
export const DeleteAgentJob = 'DeleteAgentJob';
export const DeleteAgentJobStep = 'DeleteAgentJobStep';
export const DeleteAgentAlert = 'DeleteAgentAlert';
export const DeleteAgentOperator = 'DeleteAgentOperator';
export const DeleteAgentProxy = 'DeleteAgentProxy';

export enum TelemetryView {
	Shell = 'Shell',
	ExtensionRecommendationDialog = 'ExtensionRecommendationDialog',
	ResultsPanel = 'ResultsPanel',
	Notebook = 'Notebook',
	SqlAssessment = 'SqlAssessment'
}

export enum TelemetryAction {
	Click = 'Click',
	Open = 'Open'
}

