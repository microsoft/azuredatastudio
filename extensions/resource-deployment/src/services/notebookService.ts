/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { NotebookInfo } from '../interfaces';
import { isString } from 'util';
import * as os from 'os';
import * as path from 'path';
import * as nls from 'vscode-nls';
import { IPlatformService } from './platformService';
const localize = nls.loadMessageBundle();

export interface INotebookService {
	launchNotebook(notebook: string | NotebookInfo): void;
}

export class NotebookService implements INotebookService {

	constructor(private platformService: IPlatformService) { }

	/**
	 * Copy the notebook to the user's home directory and launch the notebook from there.
	 * @param notebook the path of the notebook
	 */
	launchNotebook(notebook: string | NotebookInfo): void {
		const notebookRelativePath = this.getNotebook(notebook);
		const notebookFullPath = path.join(__dirname, '../../', notebookRelativePath);
		if (notebookRelativePath && this.platformService.fileExists(notebookFullPath)) {
			const targetFileName = this.getTargetNotebookFileName(notebookFullPath, os.homedir());
			this.platformService.copyFile(notebookFullPath, targetFileName);
			this.platformService.openFile(targetFileName);
		}
		else {
			this.platformService.showErrorMessage(localize('resourceDeployment.notebookNotFound', 'The notebook {0} does not exist', notebookFullPath));
		}
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

	/**
	 * Get a file name that is not already used in the target directory
	 * @param notebook source notebook file name
	 * @param targetDirectory target directory
	 */
	getTargetNotebookFileName(notebook: string, targetDirectory: string): string {
		const notebookFileExtension = '.ipynb';
		const baseName = path.basename(notebook, notebookFileExtension);
		let targetFileName;
		let idx = 0;
		do {
			const suffix = idx === 0 ? '' : `-${idx}`;
			targetFileName = path.join(targetDirectory, `${baseName}${suffix}${notebookFileExtension}`);
			idx++;
		} while (this.platformService.fileExists(targetFileName));

		return targetFileName;
	}
}