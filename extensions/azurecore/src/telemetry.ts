/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';
import { IPackageInfo } from './utils';
import * as Constants from './constants';


const packageInfo = vscode.extensions.getExtension(Constants.PackageName)?.packageJSON as IPackageInfo | undefined;

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
export const TelemetryReporter = new AdsTelemetryReporter<TelemetryViews, TelemetryAction>(packageInfo!.name, packageInfo!.version, packageInfo!.aiKey);

export enum TelemetryViews {
	AzureCore = 'AzureCore'
}

export enum TelemetryAction {
	LoadCustomEndpointsError = 'LoadCustomEndpointsError',
	LoadCustomEndpointsSuccess = 'LoadCustomEndpointsSuccess',
	ReloadAdsCustomEndpoints = 'ReloadAdsCustomEndpoints'
}
