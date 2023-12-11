/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as constants from '../common/constants';
import { JupyterServerInstallation } from './jupyterServerInstallation';
import * as utils from '../common/utils';
import { IPrompter, IQuestion, QuestionTypes } from '../prompts/question';

import { AppContext } from '../common/appContext';
import { LocalJupyterServerManager, ServerInstanceFactory } from './jupyterServerManager';
import { NotebookCompletionItemProvider } from '../intellisense/completionItemProvider';
import { ConfigurePythonWizard } from '../dialog/configurePython/configurePythonWizard';
import CodeAdapter from '../prompts/adapter';
import { ManagePackagesDialog } from '../dialog/managePackages/managePackagesDialog';
import { IPackageManageProvider } from '../types';
import { LocalPipPackageManageProvider } from './localPipPackageManageProvider';
import { LocalCondaPackageManageProvider } from './localCondaPackageManageProvider';
import { ManagePackagesDialogModel, ManagePackageDialogOptions } from '../dialog/managePackages/managePackagesDialogModel';
import { PyPiClient } from './pypiClient';
import { JupyterExecuteProvider } from './jupyterExecuteProvider';

export class JupyterController {
	private _jupyterInstallation: JupyterServerInstallation;
	private _serverInstanceFactory: ServerInstanceFactory = new ServerInstanceFactory();
	private _packageManageProviders = new Map<string, IPackageManageProvider>();

	private prompter: IPrompter;
	private _executeProvider: JupyterExecuteProvider;

	constructor(private appContext: AppContext) {
		this.prompter = new CodeAdapter();
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this.appContext && this.appContext.extensionContext;
	}

	public get executeProvider(): JupyterExecuteProvider {
		return this._executeProvider;
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public async activate(): Promise<boolean> {
		this._jupyterInstallation = new JupyterServerInstallation(
			this.extensionContext.extensionPath,
			this.appContext.outputChannel);
		await this._jupyterInstallation.configurePackagePaths();

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

		vscode.commands.registerCommand(constants.jupyterReinstallDependenciesCommand, () => { return this.handleDependenciesReinstallation(); });
		vscode.commands.registerCommand(constants.jupyterManagePackages, async (args) => { return this.doManagePackages(args); });
		vscode.commands.registerCommand(constants.jupyterConfigurePython, () => { return this.doConfigurePython(this._jupyterInstallation); });

		let supportedFileFilter: vscode.DocumentFilter[] = [
			{ scheme: 'untitled', language: '*' }
		];

		this._executeProvider = new JupyterExecuteProvider((documentUri: vscode.Uri) => new LocalJupyterServerManager({
			documentPath: documentUri.fsPath,
			jupyterInstallation: this._jupyterInstallation,
			extensionContext: this.extensionContext,
			factory: this._serverInstanceFactory
		}));
		azdata.nb.registerExecuteProvider(this._executeProvider);

		this.extensionContext.subscriptions.push(vscode.languages.registerCompletionItemProvider(supportedFileFilter, new NotebookCompletionItemProvider(this._executeProvider), '.'));

		this.registerDefaultPackageManageProviders();
		return true;
	}

	private saveProfileAndCreateNotebook(profile: azdata.IConnectionProfile): Promise<void> {
		return this.handleNewNotebookTask(profile);
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
				void vscode.window.showErrorMessage(localize('unsupportedFileType', "Only .ipynb Notebooks are supported"));
			} else {
				await azdata.nb.showNotebookDocument(fileUri, {
					connectionProfile: profile,
					providerId: constants.jupyterNotebookProviderId,
					preview: false
				});
			}
		}
	}

	private async handleNewNotebookTask(profile?: azdata.IConnectionProfile): Promise<void> {
		await azdata.nb.showNotebookDocument(vscode.Uri.from({ scheme: 'untitled' }), {
			connectionProfile: profile,
			providerId: constants.jupyterNotebookProviderId,
			preview: false,
			defaultKernel: {
				name: 'python3',
				display_name: 'Python 3',
				language: 'python'
			}
		});
	}

	private async handleDependenciesReinstallation(): Promise<void> {
		try {
			let doReinstall = await this.confirmReinstall();
			if (doReinstall) {
				await this._jupyterInstallation.startInstallProcess(true);
			}
		} catch (err) {
			void vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	//Confirmation message dialog
	private async confirmReinstall(): Promise<boolean> {
		return await this.prompter.promptSingle<boolean>(<IQuestion>{
			type: QuestionTypes.confirm,
			message: localize('confirmReinstall', "Are you sure you want to reinstall?"),
			default: true
		});
	}

	public async doManagePackages(options?: ManagePackageDialogOptions | vscode.Uri): Promise<void> {
		// Handle the edge case where python is installed and then deleted manually from the user settings.
		if (!JupyterServerInstallation.isPythonInstalled()) {
			await vscode.window.showErrorMessage(localize('pythonNotSetup', "Python is not currently configured for notebooks. The 'Configure Python for Notebooks' command must be run before being able to manage notebook packages."));
		} else {
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
				await vscode.window.showErrorMessage(message);
			}
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
		let pythonWizard = new ConfigurePythonWizard(jupyterInstaller);
		pythonWizard.start().catch((err: any) => {
			void vscode.window.showErrorMessage(utils.getErrorMessage(err));
		});
		pythonWizard.setupComplete.catch((err: any) => {
			void vscode.window.showErrorMessage(utils.getErrorMessage(err));
		});
	}

	public get jupyterInstallation() {
		return this._jupyterInstallation;
	}
}
