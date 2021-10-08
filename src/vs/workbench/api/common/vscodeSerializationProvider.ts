/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

class VSCodeContentManager implements azdata.nb.ContentManager {
	constructor(serializer: vscode.NotebookSerializer) {

	}
	public deserializeNotebook(contents: string): Thenable<azdata.nb.INotebookContents> {
		throw new Error('Method not implemented.');
	}
	public serializeNotebook(notebook: azdata.nb.INotebookContents): Thenable<string> {
		throw new Error('Method not implemented.');
	}
}

class VSCodeSerializationManager implements azdata.nb.SerializationManager {
	private _manager: VSCodeContentManager;

	constructor(serializer: vscode.NotebookSerializer) {
		this._manager = new VSCodeContentManager(serializer);
	}

	public get contentManager(): azdata.nb.ContentManager {
		return this._manager;
	}
}

export class VSCodeSerializationProvider implements azdata.nb.NotebookSerializationProvider {
	private _manager: VSCodeSerializationManager;

	constructor(private readonly _providerId: string, serializer: vscode.NotebookSerializer) {
		this._manager = new VSCodeSerializationManager(serializer);
	}

	public get providerId(): string {
		return this._providerId;
	}

	public getSerializationManager(notebookUri: vscode.Uri): Thenable<azdata.nb.SerializationManager> {
		return Promise.resolve(this._manager);
	}
}
