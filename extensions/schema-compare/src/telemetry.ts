/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

import * as Utils from './utils';

const packageJson = require('../package.json');

export interface ITelemetryEventProperties {
	[key: string]: string;
}

export interface ITelemetryEventMeasures {
	[key: string]: number;
}

/**
 * Filters error paths to only include source files. Exported to support testing
 */
export function filterErrorPath(line: string): string {
	if (line) {
		let values: string[] = line.split('/out/');
		if (values.length <= 1) {
			// Didn't match expected format
			return line;
		} else {
			return values[1];
		}
	}
}

export class Telemetry {
	private static reporter: TelemetryReporter;
	private static disabled: boolean;

	/**
	 * Disable telemetry reporting
	 */
	public static disable(): void {
		this.disabled = true;
	}

	/**
	 * Initialize the telemetry reporter for use.
	 */
	public static initialize(): void {
		if (typeof this.reporter === 'undefined') {
			// Check if the user has opted out of telemetry
			if (!vscode.workspace.getConfiguration('telemetry').get<boolean>('enableTelemetry', true)) {
				this.disable();
				return;
			}

			let packageInfo = Utils.getPackageInfo(packageJson);
			this.reporter = new TelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);
		}
	}

	/**
		 * Send a telemetry event for a general error
		 * @param err The error to log
		 */
	public static sendTelemetryEventForError(err: string, properties?: ITelemetryEventProperties): void {
		this.sendTelemetryEvent('Error', { error: err, ...properties });
	}

	/**
	 * Send a telemetry event using application insights
	 */
	public static sendTelemetryEvent(
		eventName: string,
		properties?: ITelemetryEventProperties,
		measures?: ITelemetryEventMeasures): void {

		if (typeof this.disabled === 'undefined') {
			this.disabled = false;
		}

		if (this.disabled || typeof (this.reporter) === 'undefined') {
			// Don't do anything if telemetry is disabled
			return;
		}

		if (!properties || typeof properties === 'undefined') {
			properties = {};
		}

		try {
			this.reporter.sendTelemetryEvent(eventName, properties, measures);
		} catch (telemetryErr) {
			// If sending telemetry event fails ignore it so it won't break the extension
			console.error('Failed to send telemetry event. error: ' + telemetryErr);
		}
	}
}

Telemetry.initialize();
