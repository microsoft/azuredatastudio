/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';
import { ErrorAction, ErrorHandler, Message, CloseAction } from 'vscode-languageclient';

import * as Constants from './constants';
import * as nls from 'vscode-nls';


const localize = nls.loadMessageBundle();
const viewKnownIssuesAction = localize('viewKnownIssuesText', "View Known Issues");

const packageInfo = vscode.extensions.getExtension(Constants.packageName)?.packageJSON;
export const TelemetryReporter = new AdsTelemetryReporter<string, string>(packageInfo?.name, packageInfo?.version, packageInfo?.aiKey);

/**
 * Handle Language Service client errors
 */
export class LanguageClientErrorHandler implements ErrorHandler {

	/**
	 * Show an error message prompt with a link to known issues wiki page
	 * @memberOf LanguageClientErrorHandler
	 */
	showOnErrorPrompt(): void {
		TelemetryReporter.sendTelemetryEvent(Constants.serviceName + 'Crash');
		void vscode.window.showErrorMessage(
			localize('serviceCrashMessage', "{0} component exited unexpectedly. Please restart Azure Data Studio.", Constants.serviceName),
			viewKnownIssuesAction).then(action => {
				if (action && action === viewKnownIssuesAction) {
					void vscode.env.openExternal(vscode.Uri.parse(Constants.serviceCrashLink));
				}
			});
	}

	/**
	 * Callback for language service client error
	 *
	 * @memberOf LanguageClientErrorHandler
	 */
	error(_error: Error, _message: Message, _count: number): ErrorAction {
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
