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
	MigrationCutoverDialog = 'MigrationCutoverDialog',
	MigrationStatusDialog = 'MigrationStatusDialog',
	MigrationWizardAccountSelectionPage = 'MigrationWizardAccountSelectionPage',
	MigrationWizardTargetSelectionPage = 'MigrationWizardTargetSelectionPage',
	MigrationWizardSummaryPage = 'MigrationWizardSummaryPage',
	StartMigrationService = 'StartMigrationSerivce'
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
	MigrationStatus = 'MigrationStatus'
}

export function sendSqlMigrationActionEvent(telemetryView: TelemetryViews, telemetryAction: TelemetryAction, additionalProps: TelemetryEventProperties, additionalMeasurements: TelemetryEventMeasures): void {
	TelemetryReporter.createActionEvent(telemetryView, telemetryAction)
		.withAdditionalProperties(additionalProps)
		.withAdditionalMeasurements(additionalMeasurements)
		.send();
}
