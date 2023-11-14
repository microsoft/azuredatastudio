/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';

export interface PackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

const packageInfo = require('../package.json') as PackageInfo;

export const TelemetryReporter = new AdsTelemetryReporter<TelemetryViews, TelemetryActions>(packageInfo.name, packageInfo.version, packageInfo.aiKey);

/**
 * Send an event indicating that a setting changed along with the new and old values. Core has a setting changed
 * event already, but that doesn't capture the values so we make our own here.
 * @param setting The name of the setting
 * @param oldValue The original value
 * @param newValue The new value
 */
export function sendSettingChangedEvent(setting: string, oldValue: string, newValue: string): void {
	TelemetryReporter.createActionEvent(TelemetryViews.QueryHistoryProvider, TelemetryActions.SettingChanged, setting)
		.withAdditionalProperties({
			oldValue,
			newValue
		})
		.send();
}

export enum TelemetryViews {
	QueryHistory = 'QueryHistory',
	QueryHistoryProvider = 'QueryHistoryProvider'
}

export enum TelemetryActions {
	DoubleClick = 'DoubleClick',
	Initialize = 'Initialize',
	ReadStorageFile = 'ReadStorageFile',
	SettingChanged = 'SettingChanged',
	WriteStorageFile = 'WriteStorageFile'
}
