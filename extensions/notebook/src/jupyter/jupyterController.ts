/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as os from 'os';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as constants from '../common/constants';
import * as localizedConstants from '../common/localizedConstants';
import JupyterServerInstallation from './jupyterServerInstallation';
import { IServerInstance } from './common';
import * as utils from '../common/utils';
import { IPrompter, QuestionTypes, IQuestion } from '../prompts/question';

import { AppContext } from '../common/appContext';
import { ApiWrapper } from '../common/apiWrapper';
import { LocalJupyterServerManager } from './jupyterServerManager';
import { NotebookCompletionItemProvider } from '../intellisense/completionItemProvider';
import { JupyterNotebookProvider } from './jupyterNotebookProvider';
import { ConfigurePythonDialog } from '../dialog/configurePythonDialog';
import CodeAdapter from '../prompts/adapter';

let untitledCounter = 0;

export class JupyterController implements vscode.Disposable {
	private _jupyterInstallation: Promise<JupyterServerInstallation>;
	private _notebookInstances: IServerInstance[] = [];

	private outputChannel: vscode.OutputChannel;
	private prompter: IPrompter;

	constructor(private appContext: AppContext) {
		this.prompter = new CodeAdapter();
		this.outputChannel = this.appContext.apiWrapper.createOutputChannel(constants.extensionOutputChannel);
	}

	private get apiWrapper(): ApiWrapper {
		return this.appContext.apiWrapper;
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this.appContext && this.appContext.extensionContext;
	}

	public dispose(): void {
		this.deactivate();
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public async activate(): Promise<boolean> {
		// Prompt for install if the python installation path is not defined
		let jupyterInstaller = new JupyterServerInstallation(
			this.extensionContext.extensionPath,
			this.outputChannel,
			this.apiWrapper);
		if (JupyterServerInstallation.isPythonInstalled(this.apiWrapper)) {
			this._jupyterInstallation = Promise.resolve(jupyterInstaller);
		} else {
			this._jupyterInstallation = new Promise(resolve => {
				jupyterInstaller.onInstallComplete(err => {
					if (!err) {
						resolve(jupyterInstaller);
					}
				});
			});
		}

		let notebookProvider = undefined;

		notebookProvider = this.registerNotebookProvider();
		sqlops.nb.onDidOpenNotebookDocument(notebook => {
			if (!JupyterServerInstallation.isPythonInstalled(this.apiWrapper)) {
				this.doConfigurePython(jupyterInstaller);
			}
		});
		// Add command/task handlers
		this.apiWrapper.registerTaskHandler(constants.jupyterOpenNotebookTask, (profile: sqlops.IConnectionProfile) => {
			return this.handleOpenNotebookTask(profile);
		});
		this.apiWrapper.registerTaskHandler(constants.jupyterNewNotebookTask, (profile: sqlops.IConnectionProfile) => {
			return this.saveProfileAndCreateNotebook(profile);
		});
		this.apiWrapper.registerCommand(constants.jupyterNewNotebookCommand, (explorerContext: sqlops.ObjectExplorerContext) => {
			return this.saveProfileAndCreateNotebook(explorerContext ? explorerContext.connectionProfile : undefined);
		});
		this.apiWrapper.registerCommand(constants.jupyterAnalyzeCommand, (explorerContext: sqlops.ObjectExplorerContext) => {
			return this.saveProfileAndAnalyzeNotebook(explorerContext);
		});

		this.apiWrapper.registerCommand(constants.jupyterReinstallDependenciesCommand, () => { return this.handleDependenciesReinstallation(); });
		this.apiWrapper.registerCommand(constants.jupyterInstallPackages, () => { return this.doManagePackages(); });
		this.apiWrapper.registerCommand(constants.jupyterConfigurePython, () => { return this.doConfigurePython(jupyterInstaller); });

		let supportedFileFilter: vscode.DocumentFilter[] = [
			{ scheme: 'untitled', language: '*' }
		];
		this.extensionContext.subscriptions.push(this.apiWrapper.registerCompletionItemProvider(supportedFileFilter, new NotebookCompletionItemProvider(notebookProvider)));

		return true;
	}

	private registerNotebookProvider(): JupyterNotebookProvider {
		let notebookProvider = new JupyterNotebookProvider((documentUri: vscode.Uri) => new LocalJupyterServerManager({
			documentPath: documentUri.fsPath,
			jupyterInstallation: this._jupyterInstallation,
			extensionContext: this.extensionContext,
			apiWrapper: this.apiWrapper
		}));
		sqlops.nb.registerNotebookProvider(notebookProvider);
		return notebookProvider;
	}

	private saveProfileAndCreateNotebook(profile: sqlops.IConnectionProfile): Promise<void> {
		return this.handleNewNotebookTask(undefined, profile);
	}

	private saveProfileAndAnalyzeNotebook(oeContext: sqlops.ObjectExplorerContext): Promise<void> {
		return this.handleNewNotebookTask(oeContext, oeContext.connectionProfile);
	}

	public deactivate(): void {
		// Shutdown any open notebooks
		this._notebookInstances.forEach(instance => { instance.stop(); });
	}

	// EVENT HANDLERS //////////////////////////////////////////////////////
	public async getDefaultConnection(): Promise<sqlops.ConnectionInfo> {
		return await this.apiWrapper.getCurrentConnection();
	}

	private async handleOpenNotebookTask(profile: sqlops.IConnectionProfile): Promise<void> {
		let notebookFileTypeName = localize('notebookFileType', 'Notebooks');
		let filter = {};
		filter[notebookFileTypeName] = 'ipynb';
		let uris = await this.apiWrapper.showOpenDialog({
			filters: filter,
			canSelectFiles: true,
			canSelectMany: false
		});
		if (uris && uris.length > 0) {
			let fileUri = uris[0];
			// Verify this is a .ipynb file since this isn't actually filtered on Mac/Linux
			if (path.extname(fileUri.fsPath) !== '.ipynb') {
				// in the future might want additional supported types
				this.apiWrapper.showErrorMessage(localize('unsupportedFileType', 'Only .ipynb Notebooks are supported'));
			} else {
				await sqlops.nb.showNotebookDocument(fileUri, {
					connectionId: profile.id,
					providerId: constants.jupyterNotebookProviderId,
					preview: false
				});
			}
		}
	}

	private async handleNewNotebookTask(oeContext?: sqlops.ObjectExplorerContext, profile?: sqlops.IConnectionProfile): Promise<void> {
		// Ensure we get a unique ID for the notebook. For now we're using a different prefix to the built-in untitled files
		// to handle this. We should look into improving this in the future
		let untitledUri = vscode.Uri.parse(`untitled:Notebook-${untitledCounter++}`);
		let editor = await sqlops.nb.showNotebookDocument(untitledUri, {
			connectionId: profile.id,
			providerId: constants.jupyterNotebookProviderId,
			preview: false,
			defaultKernel: {
				name: 'pyspark3kernel',
				display_name: 'PySpark3',
				language: 'python'
			}
		});
		if (oeContext && oeContext.nodeInfo && oeContext.nodeInfo.nodePath) {
			// Get the file path after '/HDFS'
			let hdfsPath: string = oeContext.nodeInfo.nodePath.substring(oeContext.nodeInfo.nodePath.indexOf('/HDFS') + '/HDFS'.length);
			if (hdfsPath.length > 0) {
				let analyzeCommand = '#' + localizedConstants.msgSampleCodeDataFrame + os.EOL + 'df = (spark.read.option(\"inferSchema\", \"true\")'
					+ os.EOL + '.option(\"header\", \"true\")' + os.EOL + '.csv(\'{0}\'))' + os.EOL + 'df.show(10)';
				// TODO re-enable insert into document once APIs are finalized.
				// editor.document.cells[0].source = [analyzeCommand.replace('{0}', hdfsPath)];
				editor.edit(editBuilder => {
					editBuilder.replace(0, {
						cell_type: 'code',
						source: analyzeCommand.replace('{0}', hdfsPath)
					});
				});

			}
		}
	}

	private async handleDependenciesReinstallation(): Promise<void> {
		if (await this.confirmReinstall()) {
			this._jupyterInstallation = JupyterServerInstallation.getInstallation(
				this.extensionContext.extensionPath,
				this.outputChannel,
				this.apiWrapper,
				undefined,
				true);
		}
	}

	//Confirmation message dialog
	private async confirmReinstall(): Promise<boolean> {
		return await this.prompter.promptSingle<boolean>(<IQuestion>{
			type: QuestionTypes.confirm,
			message: localize('confirmReinstall', 'Are you sure you want to reinstall?'),
			default: true
		});
	}

	public doManagePackages(): void {
		try {
			let terminal = this.apiWrapper.createTerminalWithOptions({ cwd: this.getPythonBinDir() });
			terminal.show(true);
			let shellType = this.apiWrapper.getConfiguration().get('terminal.integrated.shell.windows');
			terminal.sendText(this.getTextToSendToTerminal(shellType), true);
		} catch (error) {
			let message = utils.getErrorMessage(error);
			this.apiWrapper.showErrorMessage(message);
		}
	}

	public async doConfigurePython(jupyterInstaller: JupyterServerInstallation): Promise<void> {
		try {
			let pythonDialog = new ConfigurePythonDialog(this.appContext, this.outputChannel, jupyterInstaller);
			await pythonDialog.showDialog();
		} catch (error) {
			let message = utils.getErrorMessage(error);
			this.apiWrapper.showErrorMessage(message);
		}
	}

	public getTextToSendToTerminal(shellType: any): string {
		if (utils.getOSPlatform() === utils.Platform.Windows && typeof shellType === 'string') {
			if (shellType.endsWith('powershell.exe')) {
				return localizedConstants.msgManagePackagesPowershell;
			} else if (shellType.endsWith('cmd.exe')) {
				return localizedConstants.msgManagePackagesCmd;
			} else {
				return localizedConstants.msgManagePackagesBash;
			}
		} else {
			return localizedConstants.msgManagePackagesBash;
		}
	}

	private getPythonBinDir(): string {
		return JupyterServerInstallation.getPythonBinPath(this.apiWrapper);
	}

	public get jupyterInstallation() {
		return this._jupyterInstallation;
	}
}
