/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ErrorAction, CloseAction } from 'vscode-languageclient';
import TelemetryReporter from 'vscode-extension-telemetry';
import * as vscode from 'vscode';

import * as constants from '../common/constants';
import { IMessage, ITelemetryEventProperties, ITelemetryEventMeasures } from './contracts';


/**
 * Handle Language Service client errors
 */
export class LanguageClientErrorHandler {

	/**
	 * Creates an instance of LanguageClientErrorHandler.
	 * @memberOf LanguageClientErrorHandler
	 */
	constructor() {

	}

	/**
	 * Show an error message prompt with a link to known issues wiki page
	 * @memberOf LanguageClientErrorHandler
	 */
	showOnErrorPrompt(): void {
		// TODO add telemetry
		// Telemetry.sendTelemetryEvent('SqlToolsServiceCrash');
		vscode.window.showErrorMessage(
			constants.serviceCrashMessageText,
			constants.crashButtonText
		).then(action => {
			if (action && action === constants.crashButtonText) {
				vscode.env.openExternal(vscode.Uri.parse(constants.serviceCrashLink));
			}
		});
	}

	/**
	 * Callback for language service client error
	 *
	 * @memberOf LanguageClientErrorHandler
	 */
	error(error: Error, message: IMessage, count: number): ErrorAction {
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
			let packageInfo = vscode.extensions.getExtension('Microsoft.import').packageJSON;
			this.reporter = new TelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);
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

		try {
			this.reporter.sendTelemetryEvent(eventName, properties, measures);
		} catch (telemetryErr) {
			// If sending telemetry event fails ignore it so it won't break the extension
			console.error('Failed to send telemetry event. error: ' + telemetryErr);
		}
	}
}

Telemetry.initialize();
