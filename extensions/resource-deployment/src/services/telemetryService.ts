/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';

const packageJson = vscode.extensions.getExtension('Microsoft.resource-deployment')!.packageJSON;

export const TelemetryReporter = new AdsTelemetryReporter(packageJson.name, packageJson.version, packageJson.aiKey);

export enum TelemetryView {
	ResourceTypeWizard = 'ResourceTypeWizard'
}

export enum TelemetryAction {
	SelectedDeploymentType = 'SelectedDeploymentType'
}

