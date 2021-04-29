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
	MigrationWizard = 'MigrationWizard',
	CreateDataMigrationServiceDialog = 'CreateDataMigrationServiceDialog',
	AssessmentsDialog = 'AssessmentsDialog',
	MigrationCutoverDialog = 'MigrationCutoverDialog',
	MigrationStatusDialog = 'MigrationStatusDialog',
	AssessmentsPage = 'AssessmentsPage'
}

export function sendSqlMigrationActionEvent(telemetryView: string, telemetryAction: string, additionalProps: TelemetryEventProperties, additionalMeasurements: TelemetryEventMeasures): void {
	TelemetryReporter.createActionEvent(telemetryView, telemetryAction)
		.withAdditionalProperties(additionalProps)
		.withAdditionalMeasurements(additionalMeasurements)
		.send();
}
