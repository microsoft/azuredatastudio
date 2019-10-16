/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as path from 'path';
import { isString } from 'util';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { IPlatformService } from './platformService';
import { NotebookInfo } from '../interfaces';
const localize = nls.loadMessageBundle();

export interface INotebookService {
	launchNotebook(notebook: string | NotebookInfo): Thenable<azdata.nb.NotebookEditor>;
}

export class NotebookService implements INotebookService {

	constructor(private platformService: IPlatformService, private extensionPath: string) { }

	/**
	 * Copy the notebook to the user's home directory and launch the notebook from there.
	 * @param notebook the path of the notebook
	 */
	launchNotebook(notebook: string | NotebookInfo): Thenable<azdata.nb.NotebookEditor> {
		const notebookPath = this.getNotebook(notebook);
		const notebookFullPath = path.join(this.extensionPath, notebookPath);
		return this.platformService.fileExists(notebookPath).then((notebookPathExists) => {
			if (notebookPathExists) {
				return this.showNotebookAsUntitled(notebookPath);
			} else {
				return this.platformService.fileExists(notebookFullPath).then(notebookFullPathExists => {
					if (notebookFullPathExists) {
						return this.showNotebookAsUntitled(notebookFullPath);
					} else {
						throw localize('resourceDeployment.notebookNotFound', "The notebook {0} does not exist", notebookPath);
					}
				});
			}
		});
	}

	/**
	 * get the notebook path for current platform
	 * @param notebook the notebook path
	 */
	getNotebook(notebook: string | NotebookInfo): string {
		let notebookPath;
		if (notebook && !isString(notebook)) {
			const platform = this.platformService.platform();
			if (platform === 'win32') {
				notebookPath = notebook.win32;
			} else if (platform === 'darwin') {
				notebookPath = notebook.darwin;
			} else {
				notebookPath = notebook.linux;
			}
		} else {
			notebookPath = notebook;
		}
		return notebookPath;
	}

	findNextUntitledEditorName(filePath: string): string {
		const fileExtension = path.extname(filePath);
		const baseName = path.basename(filePath, fileExtension);
		let idx = 0;
		let title = `${baseName}`;
		do {
			const suffix = idx === 0 ? '' : `-${idx}`;
			title = `${baseName}${suffix}`;
			idx++;
		} while (this.platformService.isNotebookNameUsed(title));

		return title;
	}

	showNotebookAsUntitled(notebookPath: string): Thenable<azdata.nb.NotebookEditor> {
		let targetFileName: string = this.findNextUntitledEditorName(notebookPath);
		const untitledFileName: vscode.Uri = vscode.Uri.parse(`untitled:${targetFileName}`);
		return vscode.workspace.openTextDocument(notebookPath).then((document) => {
			let initialContent = document.getText();
			return azdata.nb.showNotebookDocument(untitledFileName, {
				connectionProfile: undefined,
				preview: false,
				initialContent: initialContent,
				initialDirtyState: false
			});
		});
	}
}
