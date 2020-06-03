/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import * as path from 'path';
import { isString } from 'util';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { NotebookPathInfo } from '../interfaces';
import { getDateTimeString, getErrorMessage } from '../utils';
import { IPlatformService } from './platformService';
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
	launchNotebook(notebook: string | NotebookPathInfo): Promise<azdata.nb.NotebookEditor>;
	launchNotebookWithEdits(notebook: string | NotebookPathInfo, cellStatements: string[], insertionPosition?: number): Promise<void>;
	launchNotebookWithContent(title: string, content: string): Promise<azdata.nb.NotebookEditor>;
	getNotebook(notebook: string | NotebookPathInfo): Promise<Notebook>;
	getNotebookPath(notebook: string | NotebookPathInfo): string;
	executeNotebook(notebook: any, env?: NodeJS.ProcessEnv): Promise<NotebookExecutionResult>;
	backgroundExecuteNotebook(taskName: string | undefined, notebookInfo: string | NotebookPathInfo | Notebook, tempNotebookPrefix: string, platformService: IPlatformService, env?: NodeJS.ProcessEnv): void;
}

export class NotebookService implements INotebookService {

	constructor(private platformService: IPlatformService, private extensionPath: string) { }

	/**
	 * Launch notebook with file path
	 * @param notebook the path of the notebook
	 */
	async launchNotebook(notebook: string | NotebookPathInfo): Promise<azdata.nb.NotebookEditor> {
		const notebookPath = await this.getNotebookFullPath(notebook);
		return await this.showNotebookAsUntitled(notebookPath);
	}

	/**
	 * Inserts cell code given by {@param cellStatements} in an existing notebook given by {@param notebook} file path at the location
	 * {@param insertionPosition} and then launches the edited notebook.
	 *
	 * @param notebook - the path to notebook that needs to be launched
	 * @param cellStatements - array of statements to be inserted in a cell
	 * @param insertionPosition - the position at which cells are inserted. Default is a new cell at the beginning of the notebook.
	 */
	async launchNotebookWithEdits(notebook: string, cellStatements: string[], insertionPosition: number = 0): Promise<void> {
		const openedNotebook = await this.launchNotebook(notebook);
		await openedNotebook.edit((editBuilder: azdata.nb.NotebookEditorEdit) => {
			editBuilder.insertCell({
				cell_type: 'code',
				source: cellStatements
			}, insertionPosition);
		});
	}

	/**
	 * Launch notebook with file path
	 * @param title the title of the notebook
	 * @param content the notebook content
	 */
	async launchNotebookWithContent(title: string, content: string): Promise<azdata.nb.NotebookEditor> {
		const uri: vscode.Uri = vscode.Uri.parse(`untitled:${this.findNextUntitledEditorName(title)}`);
		return await azdata.nb.showNotebookDocument(uri, {
			connectionProfile: undefined,
			preview: false,
			initialContent: content,
			initialDirtyState: false
		});
	}


	async getNotebook(notebook: string | NotebookPathInfo): Promise<Notebook> {
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
		// Scenarios using the executeNotebook feature already have the EULA accepted by the user before executing this.
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

	backgroundExecuteNotebook(taskName: string = 'Executing notebook', notebookInfo: string | NotebookPathInfo | Notebook, tempNotebookPrefix: string, platformService: IPlatformService, env?: NodeJS.ProcessEnv): void {
		azdata.tasks.startBackgroundOperation({
			displayName: taskName,
			description: taskName,
			isCancelable: false,
			operation: async op => {
				op.updateStatus(azdata.TaskStatus.InProgress);
				const notebook = (typeof notebookInfo === 'object' && 'cells' in notebookInfo)
					? <Notebook>notebookInfo
					: await this.getNotebook(notebookInfo);
				const result = await this.executeNotebook(notebook, env);
				if (result.succeeded) {
					op.updateStatus(azdata.TaskStatus.Succeeded);
				} else {
					op.updateStatus(azdata.TaskStatus.Failed, result.errorMessage);
					if (result.outputNotebook) {
						const viewErrorDetail = localize('resourceDeployment.ViewErrorDetail', "View error detail");
						const taskFailedMessage = localize('resourceDeployment.BackgroundExecutionFailed', "The task \"{0}\" has failed.", taskName);
						const selectedOption = await vscode.window.showErrorMessage(taskFailedMessage, viewErrorDetail);
						platformService.logToOutputChannel(taskFailedMessage);
						if (selectedOption === viewErrorDetail) {
							try {
								await this.launchNotebookWithContent(`${tempNotebookPrefix}-${getDateTimeString()}`, result.outputNotebook);
							} catch (error) {
								const launchNotebookError = localize('resourceDeployment.FailedToOpenNotebook', "An error occurred launching the output notebook. {1}{2}.", EOL, getErrorMessage(error));
								platformService.logToOutputChannel(launchNotebookError);
								vscode.window.showErrorMessage(launchNotebookError);
							}
						}
					} else {
						const errorMessage = localize('resourceDeployment.TaskFailedWithNoOutputNotebook', "The task \"{0}\" failed and no output Notebook was generated.", taskName);
						platformService.logToOutputChannel(errorMessage);
						vscode.window.showErrorMessage(errorMessage);
					}
				}
			}
		});
	}

	async getNotebookFullPath(notebook: string | NotebookPathInfo): Promise<string> {
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
	getNotebookPath(notebook: string | NotebookPathInfo): string {
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

	async showNotebookAsUntitled(notebookPath: string): Promise<azdata.nb.NotebookEditor> {
		let targetFileName: string = this.findNextUntitledEditorName(notebookPath);
		const untitledFileName: vscode.Uri = vscode.Uri.parse(`untitled:${targetFileName}`);
		const document = await vscode.workspace.openTextDocument(notebookPath);
		let initialContent = document.getText();
		return await azdata.nb.showNotebookDocument(untitledFileName, {
			connectionProfile: undefined,
			preview: false,
			initialContent: initialContent,
			initialDirtyState: false
		});
	}
}
