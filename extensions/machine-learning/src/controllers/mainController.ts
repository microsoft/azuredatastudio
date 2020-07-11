/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import * as nbExtensionApis from '../typings/notebookServices';
import { PackageManager } from '../packageManagement/packageManager';
import * as constants from '../common/constants';
import { ApiWrapper } from '../common/apiWrapper';
import { QueryRunner } from '../common/queryRunner';
import { ProcessService } from '../common/processService';
import { Config } from '../configurations/config';
import { PackageManagementService } from '../packageManagement/packageManagementService';
import { HttpClient } from '../common/httpClient';
import { ModelManagementController } from '../views/models/modelManagementController';
import { DeployedModelService } from '../modelManagement/deployedModelService';
import { AzureModelRegistryService } from '../modelManagement/azureModelRegistryService';
import { ModelPythonClient } from '../modelManagement/modelPythonClient';
import { PredictService } from '../prediction/predictService';
import { DashboardWidget } from '../views/widgets/dashboardWidget';
import { ModelConfigRecent } from '../modelManagement/modelConfigRecent';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	private _outputChannel: vscode.OutputChannel;
	private _rootPath = this._context.extensionPath;
	private _config: Config;

	public constructor(
		private _context: vscode.ExtensionContext,
		private _apiWrapper: ApiWrapper,
		private _queryRunner: QueryRunner,
		private _processService: ProcessService,
		private _packageManager?: PackageManager,
		private _packageManagementService?: PackageManagementService,
		private _httpClient?: HttpClient
	) {
		this._outputChannel = this._apiWrapper.createOutputChannel(constants.extensionOutputChannel);
		this._rootPath = this._context.extensionPath;
		this._config = new Config(this._rootPath, this._apiWrapper);
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
	}

	/**
	 * Activates the extension
	 */
	public async activate(): Promise<boolean> {
		await this.initialize();
		return Promise.resolve(true);
	}

	/**
	 * Returns an instance of Server Installation from notebook extension
	 */
	private async getNotebookExtensionApis(): Promise<nbExtensionApis.IExtensionApi> {
		let nbExtension = this._apiWrapper.getExtension(constants.notebookExtensionName);
		if (nbExtension) {
			await nbExtension.activate();
			return (nbExtension.exports as nbExtensionApis.IExtensionApi);
		} else {
			throw new Error(constants.notebookExtensionNotLoaded);
		}
	}

	private async initialize(): Promise<void> {

		this._outputChannel.show(true);
		let nbApis = await this.getNotebookExtensionApis();
		await this._config.load();

		let packageManager = this.getPackageManager(nbApis);
		this._apiWrapper.registerCommand(constants.mlManagePackagesCommand, (async () => {
			await packageManager.managePackages();
		}));

		// External Languages
		//
		let modelImporter = new ModelPythonClient(this._outputChannel, this._apiWrapper, this._processService, this._config, packageManager);
		let modelRecentService = new ModelConfigRecent(this._context.globalState);

		// Model Management
		//
		let registeredModelService = new DeployedModelService(this._apiWrapper, this._config, this._queryRunner, modelImporter, modelRecentService);
		let azureModelsService = new AzureModelRegistryService(this._apiWrapper, this._config, this.httpClient, this._outputChannel);
		let predictService = new PredictService(this._apiWrapper, this._queryRunner);
		let modelManagementController = new ModelManagementController(this._apiWrapper, this._rootPath,
			azureModelsService, registeredModelService, predictService);

		let dashboardWidget = new DashboardWidget(this._apiWrapper, this._rootPath, predictService);
		dashboardWidget.register();

		this._apiWrapper.registerCommand(constants.mlManageModelsCommand, (async () => {
			await modelManagementController.manageRegisteredModels();
		}));
		this._apiWrapper.registerCommand(constants.mlImportModelCommand, (async () => {
			await modelManagementController.importModel(undefined);
		}));
		this._apiWrapper.registerCommand(constants.mlsPredictModelCommand, (async () => {
			await modelManagementController.predictModel();
		}));
		this._apiWrapper.registerCommand(constants.mlsDependenciesCommand, (async () => {
			await packageManager.installDependencies();
		}));
		this._apiWrapper.registerCommand(constants.mlsEnableExternalScriptCommand, (async () => {
			await packageManager.enableExternalScript();
		}));
		this._apiWrapper.registerTaskHandler(constants.mlManagePackagesCommand, async () => {
			await packageManager.managePackages();
		});
	}

	/**
	 * Returns the package manager instance
	 */
	public getPackageManager(nbApis: nbExtensionApis.IExtensionApi): PackageManager {
		if (!this._packageManager) {
			this._packageManager = new PackageManager(this._outputChannel, this._rootPath, this._apiWrapper, this.packageManagementService, this._processService, this._config, this.httpClient);
			this._packageManager.init();
			this._packageManager.packageManageProviders.forEach(provider => {
				nbApis.registerPackageManager(provider.providerId, provider);
			});
		}
		return this._packageManager;
	}

	/**
	 * Returns the server config manager instance
	 */
	public get packageManagementService(): PackageManagementService {
		if (!this._packageManagementService) {
			this._packageManagementService = new PackageManagementService(this._apiWrapper, this._queryRunner);
		}
		return this._packageManagementService;
	}

	/**
	 * Returns the server config manager instance
	 */
	public get httpClient(): HttpClient {
		if (!this._httpClient) {
			this._httpClient = new HttpClient();
		}
		return this._httpClient;
	}

	/**
	 * Config instance
	 */
	public get config(): Config {
		return this._config;
	}

	/**
	 * Disposes the extension
	 */
	public dispose(): void {
		this.deactivate();
	}
}
