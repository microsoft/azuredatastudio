/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as vscode from 'vscode';

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

	}


	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
	}
}
