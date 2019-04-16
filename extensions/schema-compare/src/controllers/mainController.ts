/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { SchemaCompareDialog } from '../dialogs/schemaCompareDialog';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	protected _context: vscode.ExtensionContext;

	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this._context;
	}

	public deactivate(): void {
	}

	public activate(): Promise<boolean> {
		this.initializeSchemaCompareDialog();
		return Promise.resolve(true);
	}

	private initializeSchemaCompareDialog(): void {
		azdata.tasks.registerTask('schemaCompare.start', (profile: azdata.IConnectionProfile) => new SchemaCompareDialog().openDialog(profile));
	}

	public dispose(): void {
		this.deactivate();
	}
}
