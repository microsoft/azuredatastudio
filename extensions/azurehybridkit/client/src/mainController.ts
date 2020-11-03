/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { CreateSessionDialog } from './dialogs/profilerCreateSessionDialog';

/**
 * The main controller class that initializes the extension
 */
export class MainController {
	protected _context: vscode.ExtensionContext;

	// PUBLIC METHODS
	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
	}

	public activate(): void {
		vscode.commands.registerCommand('profiler.openCreateSessionDialog', (ownerUri: string, providerType: string, templates: Array<azdata.ProfilerSessionTemplate>) => {
			let dialog = new CreateSessionDialog(ownerUri, providerType, templates);
			dialog.showDialog();
		});
	}
}
