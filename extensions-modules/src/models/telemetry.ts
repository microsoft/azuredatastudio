/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import vscode = require('vscode');
import TelemetryReporter from 'vscode-extension-telemetry';
import { Utils } from './utils';
import { PlatformInformation, Runtime, LinuxDistribution } from './platform';
import { IExtensionConstants } from './contracts/contracts';

export interface ITelemetryEventProperties {
	[key: string]: string;
}

export interface ITelemetryEventMeasures {
	[key: string]: number;
}

/**
 * Filters error paths to only include source files. Exported to support testing
 */
export function FilterErrorPath(line: string): string {
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
	private static userId: string;
	private static platformInformation: PlatformInformation;
	private static disabled: boolean;
	private static _getRuntimeId: (platform: string, architecture: string, distribution: LinuxDistribution) => Runtime;

	public static get getRuntimeId() {
		return this._getRuntimeId;
	}

	public static set getRuntimeId(runtimeIdGetter: (platform: string, architecture: string, distribution: LinuxDistribution) => Runtime) {
		this._getRuntimeId = runtimeIdGetter;
	}

	// Get the unique ID for the current user of the extension
	public static getUserId(): Promise<string> {
		return new Promise<string>(resolve => {
			// Generate the user id if it has not been created already
			if (typeof this.userId === 'undefined') {
				let id = Utils.generateUserId();
				id.then(newId => {
					this.userId = newId;
					resolve(this.userId);
				});
			} else {
				resolve(this.userId);
			}
		});
	}

	public static getPlatformInformation(): Promise<PlatformInformation> {
		if (this.platformInformation) {
			return Promise.resolve(this.platformInformation);
		} else {
			return new Promise<PlatformInformation>(resolve => {
				PlatformInformation.getCurrent(this.getRuntimeId, 'telemetry').then(info => {
					this.platformInformation = info;
					resolve(this.platformInformation);
				});
			});
		}
	}



	/**
	 * Disable telemetry reporting
	 */
	public static disable(): void {
		this.disabled = true;
	}

	/**
	 * Initialize the telemetry reporter for use.
	 */
	public static initialize(context: vscode.ExtensionContext, extensionConstants: IExtensionConstants): void {
		if (typeof this.reporter === 'undefined') {
			// Check if the user has opted out of telemetry
			if (!vscode.workspace.getConfiguration('telemetry').get<boolean>('enableTelemetry', true)) {
				this.disable();
				return;
			}

			let packageInfo = Utils.getPackageInfo(context);
			this.reporter = new TelemetryReporter(extensionConstants.telemetryExtensionName, packageInfo.version, packageInfo.aiKey);
		}
	}

	/**
	 * Send a telemetry event for an exception
	 */
	public static sendTelemetryEventForException(
		err: any, methodName: string, extensionConfigName: string): void {
		try {
			let stackArray: string[];
			let firstLine: string = '';
			if (err !== undefined && err.stack !== undefined) {
				stackArray = err.stack.split('\n');
				if (stackArray !== undefined && stackArray.length >= 2) {
					firstLine = stackArray[1]; // The fist line is the error message and we don't want to send that telemetry event
					firstLine = FilterErrorPath(firstLine);
				}
			}

			// Only adding the method name and the fist line of the stack trace. We don't add the error message because it might have PII
			this.sendTelemetryEvent('Exception', { methodName: methodName, errorLine: firstLine });
			Utils.logDebug('Unhandled Exception occurred. error: ' + err + ' method: ' + methodName, extensionConfigName);
		} catch (telemetryErr) {
			// If sending telemetry event fails ignore it so it won't break the extension
			Utils.logDebug('Failed to send telemetry event. error: ' + telemetryErr, extensionConfigName);
		}
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

		// Augment the properties structure with additional common properties before sending
		Promise.all([this.getUserId, this.getPlatformInformation]).then(() => {
			properties['userId'] = this.userId;
			properties['distribution'] = (this.platformInformation && this.platformInformation.distribution) ?
				`${this.platformInformation.distribution.name}, ${this.platformInformation.distribution.version}` : '';

			this.reporter.sendTelemetryEvent(eventName, properties, measures);
		});
	}
}
