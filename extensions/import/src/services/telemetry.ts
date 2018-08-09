/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ErrorAction, CloseAction } from 'vscode-languageclient';
import TelemetryReporter from 'vscode-extension-telemetry';
import { PlatformInformation } from 'service-downloader/out/platform';
import * as opener from 'opener';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as constants from '../constants';
import * as serviceUtils from './serviceUtils';
import { IMessage, ITelemetryEventProperties, ITelemetryEventMeasures } from './contracts';


/**
 * Handle Language Service client errors
 * @class LanguageClientErrorHandler
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
		let crashButtonText = localize('import.serviceCrashButton', 'Give Feedback');
		vscode.window.showErrorMessage(
			localize('serviceCrashMessage', 'service component could not start'),
			crashButtonText
		).then(action => {
			if (action && action === crashButtonText) {
				opener(constants.serviceCrashLink);
			}
		});
	}

    /**
     * Callback for language service client error
     *
     * @param {Error} error
     * @param {Message} message
     * @param {number} count
     * @returns {ErrorAction}
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
     * @returns {CloseAction}
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

	// Get the unique ID for the current user of the extension
	public static getUserId(): Promise<string> {
		return new Promise<string>(resolve => {
			// Generate the user id if it has not been created already
			if (typeof this.userId === 'undefined') {
				let id = serviceUtils.generateUserId();
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
				PlatformInformation.getCurrent().then(info => {
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
			// Utils.logDebug('Unhandled Exception occurred. error: ' + err + ' method: ' + methodName, extensionConfigName);
		} catch (telemetryErr) {
			// If sending telemetry event fails ignore it so it won't break the extension
			// Utils.logDebug('Failed to send telemetry event. error: ' + telemetryErr, extensionConfigName);
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
		Promise.all([this.getUserId(), this.getPlatformInformation()]).then(() => {
			properties['userId'] = this.userId;
			properties['distribution'] = (this.platformInformation && this.platformInformation.distribution) ?
				`${this.platformInformation.distribution.name}, ${this.platformInformation.distribution.version}` : '';

			this.reporter.sendTelemetryEvent(eventName, properties, measures);
		});
	}
}

Telemetry.initialize();
