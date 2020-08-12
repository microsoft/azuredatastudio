/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as os from 'os';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as constants from '../common/constants';
import * as localizedConstants from '../common/localizedConstants';
import { JupyterServerInstallation } from './jupyterServerInstallation';
import { IServerInstance } from './common';
import * as utils from '../common/utils';
import { IPrompter, IQuestion, confirm } from '../prompts/question';

import { AppContext } from '../common/appContext';
import { LocalJupyterServerManager, ServerInstanceFactory } from './jupyterServerManager';
import { NotebookCompletionItemProvider } from '../intellisense/completionItemProvider';
import { JupyterNotebookProvider } from './jupyterNotebookProvider';
import { ConfigurePythonWizard } from '../dialog/configurePython/configurePythonWizard';
import CodeAdapter from '../prompts/adapter';
import { ManagePackagesDialog } from '../dialog/managePackages/managePackagesDialog';
import { IPackageManageProvider } from '../types';
import { LocalPipPackageManageProvider } from './localPipPackageManageProvider';
import { LocalCondaPackageManageProvider } from './localCondaPackageManageProvider';
import { ManagePackagesDialogModel, ManagePackageDialogOptions } from '../dialog/managePackages/managePackagesDialogModel';
import { PyPiClient } from './pypiClient';
import { ConfigurePythonDialog } from '../dialog/configurePython/configurePythonDialog';
import { IconPathHelper } from '../common/iconHelper';

let untitledCounter = 0;

export class JupyterController implements vscode.Disposable {
	private _jupyterInstallation: JupyterServerInstallation;
	private _notebookInstances: IServerInstance[] = [];
	private _serverInstanceFactory: ServerInstanceFactory = new ServerInstanceFactory();
	private _packageManageProviders = new Map<string, IPackageManageProvider>();

	private prompter: IPrompter;
	private _notebookProvider: JupyterNotebookProvider;

	constructor(private appContext: AppContext) {
		this.prompter = new CodeAdapter();
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this.appContext && this.appContext.extensionContext;
	}

	public get notebookProvider(): JupyterNotebookProvider {
		return this._notebookProvider;
	}

	public dispose(): void {
		this.deactivate();
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public async activate(): Promise<boolean> {
		this._jupyterInstallation = new JupyterServerInstallation(
			this.extensionContext.extensionPath,
			this.appContext.outputChannel);
		await this._jupyterInstallation.configurePackagePaths();
		IconPathHelper.setExtensionContext(this.extensionContext);

		// Add command/task handlers
		azdata.tasks.registerTask(constants.jupyterOpenNotebookTask, (profile: azdata.IConnectionProfile) => {
			return this.handleOpenNotebookTask(profile);
		});
		azdata.tasks.registerTask(constants.jupyterNewNotebookTask, (profile: azdata.IConnectionProfile) => {
			return this.saveProfileAndCreateNotebook(profile);
		});
		vscode.commands.registerCommand(constants.jupyterNewNotebookCommand, (explorerContext: azdata.ObjectExplorerContext) => {
			return this.saveProfileAndCreateNotebook(explorerContext ? explorerContext.connectionProfile : undefined);
		});
		vscode.commands.registerCommand(constants.jupyterAnalyzeCommand, (explorerContext: azdata.ObjectExplorerContext) => {
			return this.saveProfileAndAnalyzeNotebook(explorerContext);
		});

		vscode.commands.registerCommand(constants.jupyterReinstallDependenciesCommand, () => { return this.handleDependenciesReinstallation(); });
		vscode.commands.registerCommand(constants.jupyterManagePackages, async (args) => { return this.doManagePackages(args); });
		vscode.commands.registerCommand(constants.jupyterConfigurePython, () => { return this.doConfigurePython(this._jupyterInstallation); });

		let supportedFileFilter: vscode.DocumentFilter[] = [
			{ scheme: 'untitled', language: '*' }
		];
		this.registerNotebookProvider();
		this.extensionContext.subscriptions.push(vscode.languages.registerCompletionItemProvider(supportedFileFilter, new NotebookCompletionItemProvider(this._notebookProvider)));

		this.registerDefaultPackageManageProviders();
		return true;
	}

	private registerNotebookProvider(): void {
		this._notebookProvider = new JupyterNotebookProvider((documentUri: vscode.Uri) => new LocalJupyterServerManager({
			documentPath: documentUri.fsPath,
			jupyterInstallation: this._jupyterInstallation,
			extensionContext: this.extensionContext,
			factory: this._serverInstanceFactory
		}));
		azdata.nb.registerNotebookProvider(this._notebookProvider);
	}

	private saveProfileAndCreateNotebook(profile: azdata.IConnectionProfile): Promise<void> {
		return this.handleNewNotebookTask(undefined, profile);
	}

	private saveProfileAndAnalyzeNotebook(oeContext: azdata.ObjectExplorerContext): Promise<void> {
		return this.handleNewNotebookTask(oeContext, oeContext.connectionProfile);
	}

	public deactivate(): void {
		// Shutdown any open notebooks
		this._notebookInstances.forEach(async (instance) => { await instance.stop(); });
	}

	// EVENT HANDLERS //////////////////////////////////////////////////////
	public async getDefaultConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await azdata.connection.getCurrentConnection();
	}

	private async handleOpenNotebookTask(profile: azdata.IConnectionProfile): Promise<void> {
		let notebookFileTypeName = localize('notebookFileType', "Notebooks");
		let filter: { [key: string]: Array<string> } = {};
		filter[notebookFileTypeName] = ['ipynb'];
		let uris = await vscode.window.showOpenDialog({
			filters: filter,
			canSelectFiles: true,
			canSelectMany: false
		});
		if (uris && uris.length > 0) {
			let fileUri = uris[0];
			// Verify this is a .ipynb file since this isn't actually filtered on Mac/Linux
			if (path.extname(fileUri.fsPath) !== '.ipynb') {
				// in the future might want additional supported types
				vscode.window.showErrorMessage(localize('unsupportedFileType', "Only .ipynb Notebooks are supported"));
			} else {
				await azdata.nb.showNotebookDocument(fileUri, {
					connectionProfile: profile,
					providerId: constants.jupyterNotebookProviderId,
					preview: false
				});
			}
		}
	}

	private async handleNewNotebookTask(oeContext?: azdata.ObjectExplorerContext, profile?: azdata.IConnectionProfile): Promise<void> {
		// Ensure we get a unique ID for the notebook. For now we're using a different prefix to the built-in untitled files
		// to handle this. We should look into improving this in the future
		let untitledUri = vscode.Uri.parse(`untitled:Notebook-${untitledCounter++}`);
		let editor = await azdata.nb.showNotebookDocument(untitledUri, {
			connectionProfile: profile,
			providerId: constants.jupyterNotebookProviderId,
			preview: false,
			defaultKernel: {
				name: 'pysparkkernel',
				display_name: 'PySpark',
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
		try {
			let doReinstall = await this.confirmReinstall();
			if (doReinstall) {
				await this._jupyterInstallation.startInstallProcess(true);
			}
		} catch (err) {
			vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	//Confirmation message dialog
	private async confirmReinstall(): Promise<boolean> {
		return await this.prompter.promptSingle<boolean>(<IQuestion>{
			type: confirm,
			message: localize('confirmReinstall', "Are you sure you want to reinstall?"),
			default: true
		});
	}

	public async doManagePackages(options?: ManagePackageDialogOptions | vscode.Uri): Promise<void> {
		try {
			if (!options || options instanceof vscode.Uri) {
				options = {
					defaultLocation: constants.localhostName,
					defaultProviderId: LocalPipPackageManageProvider.ProviderId
				};
			}
			let model = new ManagePackagesDialogModel(this._jupyterInstallation, this._packageManageProviders, options);

			await model.init();
			let packagesDialog = new ManagePackagesDialog(model, this.extensionContext);
			packagesDialog.showDialog();
		} catch (error) {
			let message = utils.getErrorMessage(error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Register a package provider
	 * @param providerId Provider Id
	 * @param packageManageProvider Provider instance
	 */
	public registerPackageManager(providerId: string, packageManageProvider: IPackageManageProvider): void {
		if (packageManageProvider) {
			if (!this._packageManageProviders.has(providerId)) {
				this._packageManageProviders.set(providerId, packageManageProvider);
			} else {
				throw Error(`Package manager provider is already registered. provider id: ${providerId}`);
			}
		}
	}

	/**
	 * Returns the list of registered providers
	 */
	public get packageManageProviders(): Map<string, IPackageManageProvider> {
		return this._packageManageProviders;
	}

	private registerDefaultPackageManageProviders(): void {
		this.registerPackageManager(LocalPipPackageManageProvider.ProviderId, new LocalPipPackageManageProvider(this._jupyterInstallation, new PyPiClient()));
		this.registerPackageManager(LocalCondaPackageManageProvider.ProviderId, new LocalCondaPackageManageProvider(this._jupyterInstallation));
	}

	public doConfigurePython(jupyterInstaller: JupyterServerInstallation): void {
		if (jupyterInstaller.previewFeaturesEnabled) {
			let pythonWizard = new ConfigurePythonWizard(jupyterInstaller);
			pythonWizard.start().catch((err: any) => {
				vscode.window.showErrorMessage(utils.getErrorMessage(err));
			});
			pythonWizard.setupComplete.catch((err: any) => {
				vscode.window.showErrorMessage(utils.getErrorMessage(err));
			});
		} else {
			let pythonDialog = new ConfigurePythonDialog(jupyterInstaller);
			pythonDialog.showDialog().catch((err: any) => {
				vscode.window.showErrorMessage(utils.getErrorMessage(err));
			});
		}
	}

	public get jupyterInstallation() {
		return this._jupyterInstallation;
	}
}
