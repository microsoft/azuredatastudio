/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter from 'ads-extension-telemetry';

import { GetPackageInfo } from './utils';

const packageInfo = GetPackageInfo()!;

export const TelemetryReporter = new AdsTelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);

export enum TelemetryViews {
}
