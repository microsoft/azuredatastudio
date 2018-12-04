/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { ApiWrapper } from './apiWrapper';
import { CreateSessionDialog } from './dialogs/profilerCreateSessionDialog';

/**
 * The main controller class that initializes the extension
 */
export class MainController {
	protected _apiWrapper: ApiWrapper;
	protected _context: vscode.ExtensionContext;

	// PUBLIC METHODS
	public constructor(context: vscode.ExtensionContext, apiWrapper?: ApiWrapper) {
		this._apiWrapper = apiWrapper || new ApiWrapper();
		this._context = context;
	}

    /**
     * Deactivates the extension
     */
	public deactivate(): void {
	}

	public activate(): void {
		vscode.commands.registerCommand('profiler.openCreateSessionDialog', (ownerUri: string, providerType: string, templates: Array<sqlops.ProfilerSessionTemplate>) => {
			let dialog = new CreateSessionDialog(ownerUri, providerType, templates);
			dialog.showDialog();
		});
	}
}
