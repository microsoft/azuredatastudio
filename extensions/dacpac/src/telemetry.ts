/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';

import * as Utils from './utils';

const packageJson = require('../package.json');

let packageInfo = Utils.getPackageInfo(packageJson);

export const TelemetryReporter = new AdsTelemetryReporter<TelemetryViews, TelemetryAction>(packageInfo.name, packageInfo.version, packageInfo.aiKey);

export enum TelemetryViews {
	DataTierApplicationWizard = 'DataTierApplicationWizard'
}

export enum TelemetryAction {
	DeployDacpac = 'DeployDacpacOperation',
	GenerateScript = 'GenerateDeployScriptOperation',
	GenerateDeployPlan = 'GenerateDeployPlan',
	ExtractDacpac = 'ExtractDacpacOperation',
	ExportBacpac = 'ExportBacpacOperation',
	ImportBacpac = 'ImportBacpacOperation',
	ConnectionDialogCancelled = 'ConnectionDialogCancelled',
	WizardCanceled = 'WizardCanceled'
}
