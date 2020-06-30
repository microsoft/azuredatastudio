/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ApiWrapper } from './apiWrapper';
import { NotebookUtils } from './notebookUtils';

/**
 * Global context for the application
 */
export class AppContext {

	public readonly notebookUtils: NotebookUtils;

	constructor(public readonly extensionContext: vscode.ExtensionContext, public readonly apiWrapper: ApiWrapper) {
		this.apiWrapper = apiWrapper || new ApiWrapper();
		this.notebookUtils = new NotebookUtils(apiWrapper);
	}
}
