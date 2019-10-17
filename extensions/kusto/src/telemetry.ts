/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { ErrorAction, ErrorHandler, Message, CloseAction } from 'vscode-languageclient';

import * as Utils from './utils';
import * as Constants from './constants';
import { localize } from './localize';

const packageJson = require('../package.json');
const viewKnownIssuesAction = localize('viewKnownIssuesText', "View Known Issues");

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
	return undefined;
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
	 * Send a telemetry event for an exception
	 */
	public static sendTelemetryEventForException(
		err: any, methodName: string, extensionConfigName: string): void {
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

/**
 * Handle Language Service client errors
 */
export class LanguageClientErrorHandler implements ErrorHandler {

	/**
	 * Show an error message prompt with a link to known issues wiki page
	 * @memberOf LanguageClientErrorHandler
	 */
	showOnErrorPrompt(): void {
		Telemetry.sendTelemetryEvent(Constants.serviceName + 'Crash');
		vscode.window.showErrorMessage(
			localize('serviceCrashMessage', "{0} component exited unexpectedly. Please restart Azure Data Studio.", Constants.serviceName),
			viewKnownIssuesAction).then(action => {
				if (action && action === viewKnownIssuesAction) {
					vscode.env.openExternal(vscode.Uri.parse(Constants.serviceCrashLink));
				}
			});
	}

	/**
	 * Callback for language service client error
	 *
	 * @memberOf LanguageClientErrorHandler
	 */
	error(error: Error, message: Message, count: number): ErrorAction {
		this.showOnErrorPrompt();

		// we don't retry running the service since crashes leave the extension
		// in a bad, unrecovered state
		return ErrorAction.Shutdown;
	}

	/**
	 * Callback for language service client closed
	 *
	 * @memberOf LanguageClientErrorHandler
	 */
	closed(): CloseAction {
		this.showOnErrorPrompt();

		// we don't retry running the service since crashes leave the extension
		// in a bad, unrecovered state
		return CloseAction.DoNotRestart;
	}
}

Telemetry.initialize();
