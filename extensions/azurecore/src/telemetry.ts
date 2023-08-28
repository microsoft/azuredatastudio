/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';

import { getPackageInfo, IPackageInfo } from './utils';

const packageJson = require('../package.json') as { name: string, version: string, aiKey: string };

let packageInfo: IPackageInfo | undefined = getPackageInfo(packageJson);

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
export const TelemetryReporter = new AdsTelemetryReporter<TelemetryViews, TelemetryAction>(packageInfo!.name, packageInfo!.version, packageInfo!.aiKey);

export enum TelemetryViews {
	AzureCore = 'AzureCore'
}

export enum TelemetryAction {
	LoadCustomEndpointsError = 'LoadCustomEndpointsError',
	LoadCustomEndpointsSuccess = 'LoadCustomEndpointsSuccess',
}
