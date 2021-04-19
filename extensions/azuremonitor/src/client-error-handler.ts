// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ErrorAction, ErrorHandler, CloseAction } from 'vscode-languageclient';
import { localize } from './localization';
import * as Strings from './strings';
import { output, showErrorMessage } from './ui-references';

/**
 * Handle Language Service client errors
 * @class ClientErrorHandler
 */
export class ClientErrorHandler implements ErrorHandler {

	error(error: Error): ErrorAction {
		output.appendLine(error && error.stack || 'Unknown error');
		showErrorMessage(
			localize('errorHandler.serviceCrashMessage', '{0} component exited unexpectedly. Please restart Azure Data Studio.', Strings.serviceName),
			Strings.okButtonCaption);
		return ErrorAction.Continue;
	}

	closed(): CloseAction {
		return CloseAction.DoNotRestart;
	}
}
