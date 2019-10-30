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
import { getErrorMessage, getDateTimeString } from '../utils';
const localize = nls.loadMessageBundle();

export interface Notebook {
	cells: NotebookCell[];
}

export interface NotebookCell {
	cell_type: 'code';
	source: string[];
	metadata: {};
	outputs: string[];
	execution_count: number;
}

export interface NotebookExecutionResult {
	succeeded: boolean;
	outputNotebook?: string;
	errorMessage?: string;
}

export interface INotebookService {
	launchNotebook(notebook: string | NotebookInfo): Thenable<azdata.nb.NotebookEditor>;
	launchNotebookWithContent(title: string, content: string): Thenable<azdata.nb.NotebookEditor>;
	getNotebook(notebook: string | NotebookInfo): Promise<Notebook>;
	executeNotebook(notebook: any, env?: NodeJS.ProcessEnv): Promise<NotebookExecutionResult>;
}

export class NotebookService implements INotebookService {

	constructor(private platformService: IPlatformService, private extensionPath: string) { }

	/**
	 * Launch notebook with file path
	 * @param notebook the path of the notebook
	 */
	launchNotebook(notebook: string | NotebookInfo): Thenable<azdata.nb.NotebookEditor> {
		return this.getNotebookFullPath(notebook).then(notebookPath => {
			return this.showNotebookAsUntitled(notebookPath);
		});
	}

	/**
	 * Launch notebook with file path
	 * @param title the title of the notebook
	 * @param content the notebook content
	 */
	launchNotebookWithContent(title: string, content: string): Thenable<azdata.nb.NotebookEditor> {
		const uri: vscode.Uri = vscode.Uri.parse(`untitled:${title}`);
		return azdata.nb.showNotebookDocument(uri, {
			connectionProfile: undefined,
			preview: false,
			initialContent: content,
			initialDirtyState: false
		});
	}


	async getNotebook(notebook: string | NotebookInfo): Promise<Notebook> {
		const notebookPath = await this.getNotebookFullPath(notebook);
		return <Notebook>JSON.parse(await this.platformService.readTextFile(notebookPath));
	}

	async executeNotebook(notebook: Notebook, env?: NodeJS.ProcessEnv): Promise<NotebookExecutionResult> {
		const content = JSON.stringify(notebook, undefined, 4);
		const fileName = `nb-${getDateTimeString()}.ipynb`;
		const workingDirectory = this.platformService.storagePath();
		const notebookFullPath = path.join(workingDirectory, fileName);
		const outputFullPath = path.join(workingDirectory, `output-${fileName}`);
		const additionalEnvironmentVariables: NodeJS.ProcessEnv = env || {};
		// Set the azdata eula
		// Scenarios using the executeNotebook feature already have the EULA acceptted by the user before executing this.
		additionalEnvironmentVariables['ACCEPT_EULA'] = 'yes';
		try {
			await this.platformService.saveTextFile(content, notebookFullPath);
			await this.platformService.runCommand(`azdata notebook run --path "${notebookFullPath}" --output-path "${workingDirectory}" --timeout -1`,
				{
					additionalEnvironmentVariables: additionalEnvironmentVariables,
					workingDirectory: workingDirectory
				});
			return {
				succeeded: true
			};
		}
		catch (error) {
			const outputExists = await this.platformService.fileExists(outputFullPath);
			return {
				succeeded: false,
				outputNotebook: outputExists ? await this.platformService.readTextFile(outputFullPath) : undefined,
				errorMessage: getErrorMessage(error)
			};
		} finally {
			this.platformService.deleteFile(notebookFullPath);
			this.platformService.deleteFile(outputFullPath);
		}
	}

	async getNotebookFullPath(notebook: string | NotebookInfo): Promise<string> {
		const notebookPath = this.getNotebookPath(notebook);
		let notebookExists = await this.platformService.fileExists(notebookPath);
		if (notebookExists) {
			// this is for the scenarios when the provider is in a different extension, the full path will be passed in.
			return notebookPath;
		}

		// this is for the scenarios in this extension, the notebook paths are relative path.
		const absolutePath = path.join(this.extensionPath, notebookPath);
		notebookExists = await this.platformService.fileExists(absolutePath);
		if (notebookExists) {
			return absolutePath;
		} else {
			throw new Error(localize('resourceDeployment.notebookNotFound', "The notebook {0} does not exist", notebookPath));
		}
	}

	/**
	 * get the notebook path for current platform
	 * @param notebook the notebook path
	 */
	getNotebookPath(notebook: string | NotebookInfo): string {
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
