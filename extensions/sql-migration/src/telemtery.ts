/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter, { TelemetryEventMeasures, TelemetryEventProperties } from '@microsoft/ads-extension-telemetry';
import { getPackageInfo } from './api/utils';
const packageJson = require('../package.json');
let packageInfo = getPackageInfo(packageJson)!;

export const TelemetryReporter = new AdsTelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);

export enum TelemetryViews {
	SqlServerDashboard = 'SqlServerDashboard',
	CreateDataMigrationServiceDialog = 'CreateDataMigrationServiceDialog',
	AssessmentsDialog = 'AssessmentsDialog',
	DatabaseBackupPage = 'DatabaseBackupPage',
	IntegrationRuntimePage = 'IntegrationRuntimePage',
	MigrationCutoverDialog = 'MigrationCutoverDialog',
	MigrationStatusDialog = 'MigrationStatusDialog',
	MigrationWizardAccountSelectionPage = 'MigrationWizardAccountSelectionPage',
	MigrationWizardTargetSelectionPage = 'MigrationWizardTargetSelectionPage',
	MigrationWizardIntegrationRuntimePage = 'MigrationWizardIntegrationRuntimePage',
	MigrationWizardSummaryPage = 'MigrationWizardSummaryPage',
	MigrationWizardController = 'MigrationWizardController',
	StartMigrationService = 'StartMigrationSerivce',
	SqlMigrationWizard = 'SqlMigrationWizard',
	MigrationLocalStorage = 'MigrationLocalStorage'
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
