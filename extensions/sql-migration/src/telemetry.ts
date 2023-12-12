/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter, { TelemetryEventMeasures, TelemetryEventProperties } from '@microsoft/ads-extension-telemetry';
import { MigrationStateModel } from './models/stateMachine';
const packageJson = require('../package.json');
let packageInfo = {
	name: packageJson.name,
	version: packageJson.version,
	aiKey: packageJson.aiKey
};

export const TelemetryReporter = new AdsTelemetryReporter<TelemetryViews, TelemetryAction>(packageInfo.name, packageInfo.version, packageInfo.aiKey);

export enum TelemetryViews {
	SqlServerDashboard = 'SqlServerDashboard',
	CreateDataMigrationServiceDialog = 'CreateDataMigrationServiceDialog',
	AssessmentsDialog = 'AssessmentsDialog',
	DatabaseBackupPage = 'DatabaseBackupPage',
	IntegrationRuntimePage = 'IntegrationRuntimePage',
	MigrationCutoverDialog = 'MigrationCutoverDialog',
	MigrationStatusDialog = 'MigrationStatusDialog',
	DashboardTab = 'DashboardTab',
	MigrationsTab = 'MigrationsTab',
	MigrationDetailsTab = 'MigrationDetailsTab',
	MigrationWizardAccountSelectionPage = 'MigrationWizardAccountSelectionPage',
	MigrationWizardSkuRecommendationPage = 'MigrationWizardSkuRecommendationPage',
	MigrationWizardTargetSelectionPage = 'MigrationWizardTargetSelectionPage',
	MigrationWizardIntegrationRuntimePage = 'MigrationWizardIntegrationRuntimePage',
	MigrationWizardSummaryPage = 'MigrationWizardSummaryPage',
	MigrationWizardController = 'MigrationWizardController',
	StartMigrationService = 'StartMigrationSerivce',
	SqlMigrationWizard = 'SqlMigrationWizard',
	MigrationLocalStorage = 'MigrationLocalStorage',
	SkuRecommendationWizard = 'SkuRecommendationWizard',
	DataCollectionWizard = 'GetAzureRecommendationDialog',
	SelectMigrationServiceDialog = 'SelectMigrationServiceDialog',
	Utils = 'Utils',
	LoginMigrationWizardController = 'LoginMigrationWizardController',
	LoginMigrationWizard = 'LoginMigrationWizard',
	LoginMigrationTargetSelectionPage = 'LoginMigrationTargetSelectionPage',
	LoginMigrationSelectorPage = 'LoginMigrationSelectorPage',
	LoginMigrationStatusPage = 'LoginMigrationStatusPage',
	TdeConfigurationDialog = 'TdeConfigurationDialog',
	TdeMigrationDialog = 'TdeMigrationDialog',
	ValidIrDialog = 'validIrDialog',
	ImportAssessmentDialog = 'ImportAssessmentDialog',
}

export enum TelemetryAction {
	ServerAssessment = 'ServerAssessment',
	ServerAssessmentIssues = 'ServerAssessmentIssues',
	ServerAssessmentError = 'ServerAssessmentError',
	DatabaseAssessment = 'DatabaseAsssessment',
	DatabaseAssessmentWarning = 'DatabaseAssessmentWarning',
	DatabaseAssessmentError = 'DatabaseAssessmentError',
	StartMigration = 'StartMigration',
	CutoverMigration = 'CutoverMigration',
	CancelMigration = 'CancelMigration',
	DeleteMigration = 'DeleteMigration',
	MigrationStatus = 'MigrationStatus',
	PageButtonClick = 'PageButtonClick',
	Prev = 'prev',
	Next = 'next',
	Done = 'done',
	Cancel = 'cancel',
	OnPageLeave = 'OnPageLeave',
	GetMISkuRecommendation = 'GetMISkuRecommendation',
	GetVMSkuRecommendation = 'GetVMSkuRecommendation',
	GetDBSkuRecommendation = 'GetDBSkuRecommendation',
	GetInstanceRequirements = 'GetInstanceRequirements',
	StartDataCollection = 'StartDataCollection',
	StopDataCollection = 'StopDataCollection',
	GetDatabasesListFailed = 'GetDatabasesListFailed',
	ConnectToTarget = 'ConnectToTarget',
	OpenLoginMigrationWizard = 'OpenLoginMigrationWizard',
	LoginMigrationStarted = 'LoginMigrationStarted',
	LoginMigrationCompleted = 'LoginMigrationCompleted',
	LoginMigrationError = 'LoginMigrationError',
	TdeMigrationSuccess = 'TdeMigrationSuccess',
	TdeMigrationFailures = 'TdeMigrationFailures',
	TdeMigrationClientException = 'TdeMigrationClientException',
	TdeConfigurationUseADS = 'TdeConfigurationUseADS',
	TdeConfigurationAlreadyMigrated = 'TdeConfigurationAlreadyMigrated',
	TdeConfigurationCancelled = 'TdeConfigurationCancelled',
	ImportAssessmentSuccess = 'ImportAssessmentSuccess',
	ImportAssessmentFailed = 'ImportAssessmentFailed'
}

export function logError(telemetryView: TelemetryViews, err: string, error: any): void {
	console.log(error);
	TelemetryReporter.sendErrorEvent(telemetryView, err);
}

export function sendSqlMigrationActionEvent(telemetryView: TelemetryViews, telemetryAction: TelemetryAction, additionalProps: TelemetryEventProperties, additionalMeasurements: TelemetryEventMeasures): void {
	TelemetryReporter.createActionEvent(telemetryView, telemetryAction)
		.withAdditionalProperties(additionalProps)
		.withAdditionalMeasurements(additionalMeasurements)
		.send();
}

export function getTelemetryProps(migrationStateModel: MigrationStateModel): TelemetryEventProperties {
	const tenantId = migrationStateModel._azureTenant?.id ??
		migrationStateModel._azureAccount?.properties?.tenants?.length > 0
		? migrationStateModel._azureAccount?.properties?.tenants[0]?.id
		: '';
	return {
		'sessionId': migrationStateModel._sessionId,
		'subscriptionId': migrationStateModel._targetSubscription?.id,
		'resourceGroup': migrationStateModel._resourceGroup?.name,
		'targetType': migrationStateModel._targetType,
		'tenantId': tenantId,
	};
}

export function sendButtonClickEvent(migrationStateModel: MigrationStateModel, telemetryView: TelemetryViews, buttonPressed: TelemetryAction, pageTitle: string, newPageTitle: string): void {
	sendSqlMigrationActionEvent(
		telemetryView,
		TelemetryAction.PageButtonClick,
		{
			...getTelemetryProps(migrationStateModel),
			'buttonPressed': buttonPressed,
			'pageTitle': pageTitle,
			'newPageTitle': newPageTitle
		},
		{});
}
