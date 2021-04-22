/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';

const packageJson = require('../package.json');
export const TelemetryReporter = new AdsTelemetryReporter(packageJson.name, packageJson.version, packageJson.aiKey);

export const SqlAssessmentTelemetryView = 'SqlAssessmentTab';

export enum SqlTelemetryActions {
	InvokeServerAssessment = 'SqlAssessmentServerInvoke',
	InvokeDatabaseAssessment = 'SqlAssessmentDatabaseInvoke',
	GetServerAssessmentRules = 'SqlAssessmentServerGetRules',
	GetDatabaseAssessmentRules = 'SqlAssessmentDatabaseGetRules',
	ExportAssessmentResults = 'SqlAssessmentExportResult',
	LearnMoreAssessmentLink = 'SqlAssessmentLearnMoreLink',
	CreateHTMLReport = 'SqlAssessmentHTMLReport',
	OpenHistory = 'SqlAssessmentOpenHistory',
}

