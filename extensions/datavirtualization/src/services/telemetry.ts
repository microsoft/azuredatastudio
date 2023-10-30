/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ErrorAction, CloseAction } from 'vscode-languageclient';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ApiWrapper } from '../apiWrapper';
import * as constants from '../constants';
import { IMessage } from './contracts';
import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';

const packageInfo = vscode.extensions.getExtension(constants.packageName)?.packageJSON;
export const TelemetryReporter = new AdsTelemetryReporter<string, string>(packageInfo?.name, packageInfo?.version, packageInfo?.aiKey);

/**
 * Handle Language Service client errors
 * @class LanguageClientErrorHandler
 */
export class LanguageClientErrorHandler {

	/**
	 * Creates an instance of LanguageClientErrorHandler.
	 * @memberOf LanguageClientErrorHandler
	 */
	constructor(private apiWrapper?: ApiWrapper) {
		if (!this.apiWrapper) {
			this.apiWrapper = new ApiWrapper();
		}
	}

	/**
	 * Show an error message prompt with a link to known issues wiki page
	 * @memberOf LanguageClientErrorHandler
	 */
	public showOnErrorPrompt(): void {
		TelemetryReporter.sendTelemetryEvent(constants.serviceName + 'Crash');
		let crashButtonText = localize('serviceCrashButton', 'View Known Issues');
		this.apiWrapper.showErrorMessage(
			localize('serviceCrashMessage', 'service component could not start'),
			crashButtonText
		).then(action => {
			if (action && action === crashButtonText) {
				vscode.env.openExternal(vscode.Uri.parse(constants.serviceCrashLink));
			}
		});
	}

	/**
	 * Callback for language service client error
	 *
	 * @param error
	 * @param message
	 * @param count
	 * @returns
	 *
	 * @memberOf LanguageClientErrorHandler
	 */
	public error(error: Error, message: IMessage, count: number): ErrorAction {
		this.showOnErrorPrompt();

		// we don't retry running the service since crashes leave the extension
		// in a bad, unrecovered state
		return ErrorAction.Shutdown;
	}

	/**
	 * Callback for language service client closed
	 *
	 * @returns
	 *
	 * @memberOf LanguageClientErrorHandler
	 */
	public closed(): CloseAction {
		this.showOnErrorPrompt();

		// we don't retry running the service since crashes leave the extension
		// in a bad, unrecovered state
		return CloseAction.DoNotRestart;
	}
}
