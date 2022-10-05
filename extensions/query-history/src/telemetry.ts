/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter, { TelemetryEventMeasures, TelemetryEventProperties } from '@microsoft/ads-extension-telemetry';

export interface PackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

const packageInfo = require('../package.json') as PackageInfo;

export const TelemetryReporter = new AdsTelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);

/**
 * A helper class to send an Action event with a duration, timer starts on construction and ends when send() is called.
 */
export class TimedAction {
	/**
	 * Additional properties to send along with the final message once send is called.
	 */
	public readonly additionalProperties: TelemetryEventProperties = {};
	/**
	 * Additional measures to send along with the final message once send is called.
	 */
	public readonly additionalMeasures: TelemetryEventMeasures = {};

	private _start: number = Date.now();

	/**
	 * Creates a new TimedAction and sets the start time to Date.now().
	 * @param _view The view this action originates from
	 * @param _action The name of the action
	 * @param properties Additional properties to send along with the final message once send is called
	 * @param measures Additional measures to send along with the final message once send is called
	 */
	constructor(private _view: TelemetryViews, private _action: TelemetryActions, properties: TelemetryEventProperties = {}, measures: TelemetryEventMeasures = {}) {
		Object.assign(this.additionalProperties, properties);
		Object.assign(this.additionalMeasures, measures);
	}

	/**
	 * Sends the event with the duration being the difference between when this TimedAction was created and now.
	 * @param properties Additional properties to send along with the event
	 * @param measures Additional measures to send along with the event
	 */
	public send(properties: TelemetryEventProperties = {}, measures: TelemetryEventMeasures = {}): void {
		Object.assign(this.additionalProperties, properties);
		Object.assign(this.additionalMeasures, measures);
		TelemetryReporter.createActionEvent(this._view, this._action, undefined, undefined, Date.now() - this._start)
			.withAdditionalProperties(this.additionalProperties)
			.withAdditionalMeasurements(this.additionalMeasures)
			.send();
	}
}

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
