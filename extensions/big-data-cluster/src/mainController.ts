/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import { CreateClusterWizard } from './wizards/create-cluster/createClusterWizard';

/**
 * The main controller class that initializes the extension
 */
export class MainController {
	protected _context: vscode.ExtensionContext;

	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
	}

	/**
	 * Activates the extension
	 */
	public activate(): void {
		vscode.commands.registerCommand('mssql.cluster.create', () => {
			let wizard = new CreateClusterWizard(this._context);
			wizard.open();
		});
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void { }
}
