/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ErrorAction, CloseAction } from 'vscode-languageclient';
import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';
import * as vscode from 'vscode';

import * as constants from '../common/constants';
import { IMessage } from './contracts';

const packageInfo = vscode.extensions.getExtension(constants.packageName)?.packageJSON;
export const TelemetryReporter = new AdsTelemetryReporter<string, string>(packageInfo?.name, packageInfo?.version, packageInfo?.aiKey);

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
		TelemetryReporter.sendTelemetryEvent(constants.serviceName + 'Crash');
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

