/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter, { TelemetryEventMeasures, TelemetryEventProperties } from '@microsoft/ads-extension-telemetry';
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
	LoginMigrationStatusWizard = 'LoginMigrationStatusWizard',
	TdeConfigurationDialog = 'TdeConfigurationDialog',
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
	LoginMigrationCompleted = 'LoginMigrationCompleted'
}

export enum TelemetryErrorName {
	StartMigrationFailed = 'StartMigrationFailed'
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
