/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { NotebookInfo } from '../interfaces';
import { isString } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export interface INotebookService {
	launchNotebook(notebook: string | NotebookInfo): void;
}

export class NotebookService implements INotebookService {
	/**
	 * Copy the notebook to the user's home directory and launch the notebook from there.
	 * @param notebook the path of the notebook
	 */
	launchNotebook(notebook: string | NotebookInfo): void {
		const notebookRelativePath = this.getNotebook(notebook, () => process.platform);
		const notebookFullPath = path.join('../', notebookRelativePath);
		if (notebookRelativePath && fs.existsSync(notebookFullPath)) {
			const targetFileName = this.getTargetNotebookName(notebookFullPath, os.homedir(), fs.existsSync);
			fs.copyFileSync(notebookFullPath, targetFileName);
			vscode.commands.executeCommand('vscode.open', vscode.Uri.file(targetFileName));
		} else {
			vscode.window.showErrorMessage(localize('resourceDeployment.notebookNotFound', 'The notebook {0} does not exist', notebookFullPath));
		}
	}

	getNotebook(notebook: string | NotebookInfo, getPlatform: () => string): string {
		const currentPlatform = getPlatform();
		let notebookPath;
		// get the notebook path for current platform
		if (isString(notebook)) {
			notebookPath = notebook;
		} else {
			if (currentPlatform === 'win32') {
				notebookPath = notebook.win32;
			} else if (currentPlatform === 'darwin') {
				notebookPath = notebook.darwin;
			} else {
				notebookPath = notebook.linux;
			}
		}
		return notebookPath;
	}

	getTargetNotebookName(notebook: string, targetDirectory: string, validateName: (name: string) => boolean): string {
		const notebookFileExtension = '.ipynb';
		const baseName = path.basename(notebook, notebookFileExtension);
		let targetFileName;
		let idx = 1;
		do {
			targetFileName = path.join(targetDirectory, `${baseName}-${idx}${notebookFileExtension}`);
			idx++;
		}
		while (validateName(targetFileName));

		return targetFileName;
	}
}