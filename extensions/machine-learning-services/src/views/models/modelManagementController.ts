/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { azureResource } from '../../typings/azure-resource';
import { ApiWrapper } from '../../common/apiWrapper';
import { AzureModelRegistryService } from '../../modelManagement/azureModelRegistryService';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { RegisteredModel, WorkspaceModel, RegisteredModelDetails, ModelParameters } from '../../modelManagement/interfaces';
import { PredictParameters, DatabaseTable, TableColumn } from '../../prediction/interfaces';
import { DeployedModelService } from '../../modelManagement/deployedModelService';
import { RegisteredModelsDialog } from './registerModels/registeredModelsDialog';
import {
	AzureResourceEventArgs, ListAzureModelsEventName, ListSubscriptionsEventName, ListModelsEventName, ListWorkspacesEventName,
	ListGroupsEventName, ListAccountsEventName, RegisterLocalModelEventName, RegisterLocalModelEventArgs, RegisterAzureModelEventName,
	RegisterAzureModelEventArgs, ModelViewBase, SourceModelSelectedEventName, RegisterModelEventName, DownloadAzureModelEventName,
	ListDatabaseNamesEventName, ListTableNamesEventName, ListColumnNamesEventName, PredictModelEventName, PredictModelEventArgs, DownloadRegisteredModelEventName, LoadModelParametersEventName
} from './modelViewBase';
import { ControllerBase } from '../controllerBase';
import { RegisterModelWizard } from './registerModels/registerModelWizard';
import * as fs from 'fs';
import * as constants from '../../common/constants';
import { PredictWizard } from './prediction/predictWizard';
import { AzureModelResource } from '../interfaces';
import { PredictService } from '../../prediction/predictService';

/**
 * Model management UI controller
 */
export class ModelManagementController extends ControllerBase {

	/**
	 * Creates new instance
	 */
	constructor(
		apiWrapper: ApiWrapper,
		private _root: string,
		private _amlService: AzureModelRegistryService,
		private _registeredModelService: DeployedModelService,
		private _predictService: PredictService) {
		super(apiWrapper);
	}

	/**
	 * Opens the dialog for model registration
	 * @param parent parent if the view is opened from another view
	 * @param controller controller
	 * @param apiWrapper apiWrapper
	 * @param root root folder path
	 */
	public async registerModel(parent?: ModelViewBase, controller?: ModelManagementController, apiWrapper?: ApiWrapper, root?: string): Promise<ModelViewBase> {
		controller = controller || this;
		apiWrapper = apiWrapper || this._apiWrapper;
		root = root || this._root;
		let view = new RegisterModelWizard(apiWrapper, root, parent);

		controller.registerEvents(view);

		// Open view
		//
		await view.open();
		await view.refresh();
		return view;
	}

	/**
	 * Opens the wizard for prediction
	 */
	public async predictModel(): Promise<ModelViewBase> {

		let view = new PredictWizard(this._apiWrapper, this._root);

		this.registerEvents(view);
		view.on(LoadModelParametersEventName, async () => {
			const modelArtifact = await view.getModelFileName();
			await this.executeAction(view, LoadModelParametersEventName, this.loadModelParameters, this._registeredModelService,
				modelArtifact?.filePath);
		});

		// Open view
		//
		await view.open();
		await view.refresh();
		return view;
	}


	/**
	 * Register events in the main view
	 * @param view main view
	 */
	public registerEvents(view: ModelViewBase): void {

		// Register events
		//
		super.registerEvents(view);
		view.on(ListAccountsEventName, async () => {
			await this.executeAction(view, ListAccountsEventName, this.getAzureAccounts, this._amlService);
		});
		view.on(ListSubscriptionsEventName, async (arg) => {
			let azureArgs = <AzureResourceEventArgs>arg;
			await this.executeAction(view, ListSubscriptionsEventName, this.getAzureSubscriptions, this._amlService, azureArgs.account);
		});
		view.on(ListWorkspacesEventName, async (arg) => {
			let azureArgs = <AzureResourceEventArgs>arg;
			await this.executeAction(view, ListWorkspacesEventName, this.getWorkspaces, this._amlService, azureArgs.account, azureArgs.subscription, azureArgs.group);
		});
		view.on(ListGroupsEventName, async (arg) => {
			let azureArgs = <AzureResourceEventArgs>arg;
			await this.executeAction(view, ListGroupsEventName, this.getAzureGroups, this._amlService, azureArgs.account, azureArgs.subscription);
		});
		view.on(ListAzureModelsEventName, async (arg) => {
			let azureArgs = <AzureResourceEventArgs>arg;
			await this.executeAction(view, ListAzureModelsEventName, this.getAzureModels, this._amlService
				, azureArgs.account, azureArgs.subscription, azureArgs.group, azureArgs.workspace);
		});

		view.on(ListModelsEventName, async () => {
			await this.executeAction(view, ListModelsEventName, this.getRegisteredModels, this._registeredModelService);
		});
		view.on(RegisterLocalModelEventName, async (arg) => {
			let registerArgs = <RegisterLocalModelEventArgs>arg;
			await this.executeAction(view, RegisterLocalModelEventName, this.registerLocalModel, this._registeredModelService, registerArgs.filePath, registerArgs.details);
			view.refresh();
		});
		view.on(RegisterModelEventName, async () => {
			await this.executeAction(view, RegisterModelEventName, this.registerModel, view, this, this._apiWrapper, this._root);
		});
		view.on(RegisterAzureModelEventName, async (arg) => {
			let registerArgs = <RegisterAzureModelEventArgs>arg;
			await this.executeAction(view, RegisterAzureModelEventName, this.registerAzureModel, this._amlService, this._registeredModelService,
				registerArgs.account, registerArgs.subscription, registerArgs.group, registerArgs.workspace, registerArgs.model, registerArgs.details);
		});
		view.on(DownloadAzureModelEventName, async (arg) => {
			let registerArgs = <AzureModelResource>arg;
			await this.executeAction(view, DownloadAzureModelEventName, this.downloadAzureModel, this._amlService,
				registerArgs.account, registerArgs.subscription, registerArgs.group, registerArgs.workspace, registerArgs.model);
		});
		view.on(ListDatabaseNamesEventName, async () => {
			await this.executeAction(view, ListDatabaseNamesEventName, this.getDatabaseList, this._predictService);
		});
		view.on(ListTableNamesEventName, async (arg) => {
			let dbName = <string>arg;
			await this.executeAction(view, ListTableNamesEventName, this.getTableList, this._predictService, dbName);
		});
		view.on(ListColumnNamesEventName, async (arg) => {
			let tableColumnsArgs = <DatabaseTable>arg;
			await this.executeAction(view, ListColumnNamesEventName, this.getTableColumnsList, this._predictService,
				tableColumnsArgs);
		});
		view.on(PredictModelEventName, async (arg) => {
			let predictArgs = <PredictModelEventArgs>arg;
			await this.executeAction(view, PredictModelEventName, this.generatePredictScript, this._predictService,
				predictArgs, predictArgs.model, predictArgs.filePath);
		});
		view.on(DownloadRegisteredModelEventName, async (arg) => {
			let model = <RegisteredModel>arg;
			await this.executeAction(view, DownloadRegisteredModelEventName, this.downloadRegisteredModel, this._registeredModelService,
				model);
		});
		view.on(SourceModelSelectedEventName, () => {
			view.refresh();
		});
	}

	/**
	 * Opens the dialog for model management
	 */
	public async manageRegisteredModels(): Promise<ModelViewBase> {
		let view = new RegisteredModelsDialog(this._apiWrapper, this._root);

		// Register events
		//
		this.registerEvents(view);

		// Open view
		//
		view.open();
		return view;
	}

	private async getAzureAccounts(service: AzureModelRegistryService): Promise<azdata.Account[]> {
		return await service.getAccounts();
	}

	private async getAzureSubscriptions(service: AzureModelRegistryService, account: azdata.Account | undefined): Promise<azureResource.AzureResourceSubscription[] | undefined> {
		return await service.getSubscriptions(account);
	}

	private async getAzureGroups(service: AzureModelRegistryService, account: azdata.Account | undefined, subscription: azureResource.AzureResourceSubscription | undefined): Promise<azureResource.AzureResource[] | undefined> {
		return await service.getGroups(account, subscription);
	}

	private async getWorkspaces(service: AzureModelRegistryService, account: azdata.Account | undefined, subscription: azureResource.AzureResourceSubscription | undefined, group: azureResource.AzureResource | undefined): Promise<Workspace[] | undefined> {
		if (!account || !subscription) {
			return [];
		}
		return await service.getWorkspaces(account, subscription, group);
	}

	private async getRegisteredModels(registeredModelService: DeployedModelService): Promise<RegisteredModel[]> {
		return registeredModelService.getDeployedModels();
	}

	private async getAzureModels(
		service: AzureModelRegistryService,
		account: azdata.Account | undefined,
		subscription: azureResource.AzureResourceSubscription | undefined,
		resourceGroup: azureResource.AzureResource | undefined,
		workspace: Workspace | undefined): Promise<WorkspaceModel[]> {
		if (!account || !subscription || !resourceGroup || !workspace) {
			return [];
		}
		return await service.getModels(account, subscription, resourceGroup, workspace) || [];
	}

	private async registerLocalModel(service: DeployedModelService, filePath: string, details: RegisteredModelDetails | undefined): Promise<void> {
		if (filePath) {
			await service.deployLocalModel(filePath, details);
		} else {
			throw Error(constants.invalidModelToRegisterError);

		}
	}

	private async registerAzureModel(
		azureService: AzureModelRegistryService,
		service: DeployedModelService,
		account: azdata.Account | undefined,
		subscription: azureResource.AzureResourceSubscription | undefined,
		resourceGroup: azureResource.AzureResource | undefined,
		workspace: Workspace | undefined,
		model: WorkspaceModel | undefined,
		details: RegisteredModelDetails | undefined): Promise<void> {
		if (!account || !subscription || !resourceGroup || !workspace || !model || !details) {
			throw Error(constants.invalidAzureResourceError);
		}
		const filePath = await azureService.downloadModel(account, subscription, resourceGroup, workspace, model);
		if (filePath) {

			await service.deployLocalModel(filePath, details);
			await fs.promises.unlink(filePath);
		} else {
			throw Error(constants.invalidModelToRegisterError);
		}
	}

	public async getDatabaseList(predictService: PredictService): Promise<string[]> {
		return await predictService.getDatabaseList();
	}

	public async getTableList(predictService: PredictService, databaseName: string): Promise<DatabaseTable[]> {
		return await predictService.getTableList(databaseName);
	}

	public async getTableColumnsList(predictService: PredictService, databaseTable: DatabaseTable): Promise<TableColumn[]> {
		return await predictService.getTableColumnsList(databaseTable);
	}

	private async generatePredictScript(
		predictService: PredictService,
		predictParams: PredictParameters,
		registeredModel: RegisteredModel | undefined,
		filePath: string | undefined
	): Promise<string> {
		if (!predictParams) {
			throw Error(constants.invalidModelToPredictError);
		}
		const result = await predictService.generatePredictScript(predictParams, registeredModel, filePath);
		return result;
	}

	private async downloadRegisteredModel(
		registeredModelService: DeployedModelService,
		model: RegisteredModel | undefined): Promise<string> {
		if (!model) {
			throw Error(constants.invalidModelToPredictError);
		}
		return await registeredModelService.downloadModel(model);
	}

	private async loadModelParameters(
		registeredModelService: DeployedModelService,
		model: string | undefined): Promise<ModelParameters | undefined> {
		if (!model) {
			return undefined;
		}
		return await registeredModelService.loadModelParameters(model);
	}

	private async downloadAzureModel(
		azureService: AzureModelRegistryService,
		account: azdata.Account | undefined,
		subscription: azureResource.AzureResourceSubscription | undefined,
		resourceGroup: azureResource.AzureResource | undefined,
		workspace: Workspace | undefined,
		model: WorkspaceModel | undefined): Promise<string> {
		if (!account || !subscription || !resourceGroup || !workspace || !model) {
			throw Error(constants.invalidAzureResourceError);
		}
		const filePath = await azureService.downloadModel(account, subscription, resourceGroup, workspace, model);
		if (filePath) {
			return filePath;
		} else {
			throw Error(constants.invalidModelToRegisterError);
		}
	}
}
