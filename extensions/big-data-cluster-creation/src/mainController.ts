/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
"use strict";

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

const localize = nls.loadMessageBundle();

/**
 * The main controller class that initializes the extension
 */
export class MainController {
	protected _context: vscode.ExtensionContext;

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
	}

	/**
	 * Activates the extension
	 */
	public activate(): void {
		vscode.commands.registerCommand('aris.create-big-data-cluster', () => {
			let wizard = sqlops.window.modelviewdialog.createWizard(
				localize('aris.createClusterTitle','Create a big data cluster')
            );
            //wizard.open();
		});
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {}
}
