/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import * as vscode from 'vscode';
import { Contents } from '@jupyterlab/services';

export class RemoteContentManager implements nb.ContentManager {

	constructor(private contents: Contents.IManager) {
	}

	public getNotebookContents(notebookUri: vscode.Uri): Thenable<nb.INotebookContents> {
		return this.getNotebookContentsAsync(notebookUri.fsPath);
	}

	private async getNotebookContentsAsync(path: string): Promise<nb.INotebookContents> {
		if (!path) {
			return undefined;
		}
		// Note: intentionally letting caller handle exceptions
		let contentsModel = await this.contents.get(path);
		if (!contentsModel) {
			return undefined;
		}
		return <nb.INotebookContents>contentsModel.content;
	}

	public async save(notebookUri: vscode.Uri, notebook: nb.INotebookContents): Promise<nb.INotebookContents> {
		let path = notebookUri.fsPath;
		await this.contents.save(path, {
			path: path,
			content: notebook,
			type: 'notebook',
			format: 'json'
		});
		return notebook;
	}
}
