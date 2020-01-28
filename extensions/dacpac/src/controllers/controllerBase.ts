/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export default abstract class ControllerBase implements vscode.Disposable {
	protected _context: vscode.ExtensionContext;

	protected constructor(context: vscode.ExtensionContext) {
		this._context = context;
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this._context;
	}

	abstract activate(): Promise<boolean>;

	abstract deactivate(): void;

	public dispose(): void {
		this.deactivate();
	}
}
