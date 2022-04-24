/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import { VSBuffer } from 'vs/base/common/buffer';
import { CancellationToken } from 'vs/base/common/cancellation';
import { convertToADSNotebookContents, convertToVSCodeNotebookData } from 'sql/workbench/api/common/notebooks/notebookUtils';

export class VSCodeContentManager implements azdata.nb.ContentManager {
	constructor(private readonly _serializer: vscode.NotebookSerializer) {
	}

	public async deserializeNotebook(contents: string): Promise<azdata.nb.INotebookContents> {
		let buffer = VSBuffer.fromString(contents);
		let notebookData = await this._serializer.deserializeNotebook(buffer.buffer, CancellationToken.None);
		return convertToADSNotebookContents(notebookData);
	}

	public async serializeNotebook(notebook: azdata.nb.INotebookContents): Promise<string> {
		let notebookData = convertToVSCodeNotebookData(notebook);
		let bytes = await this._serializer.serializeNotebook(notebookData, CancellationToken.None);
		let buffer = VSBuffer.wrap(bytes);
		return buffer.toString();
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

/**
 * A Notebook Serialization Provider that is used to convert VS Code notebook extension APIs into ADS equivalents.
 */
export class VSCodeSerializationProvider implements azdata.nb.NotebookSerializationProvider {
	private _manager: VSCodeSerializationManager;

	constructor(public readonly providerId: string, serializer: vscode.NotebookSerializer) {
		this._manager = new VSCodeSerializationManager(serializer);
	}

	public getSerializationManager(notebookUri: vscode.Uri): Thenable<azdata.nb.SerializationManager> {
		return Promise.resolve(this._manager);
	}
}
