/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { azureResource } from '../../typings/azure-resource';
import { ApiWrapper } from '../../common/apiWrapper';
import { AzureModelRegistryService } from '../../modelManagement/azureModelRegistryService';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { ImportedModel, WorkspaceModel, ModelParameters } from '../../modelManagement/interfaces';
import { PredictParameters, DatabaseTable, TableColumn } from '../../prediction/interfaces';
import { DeployedModelService } from '../../modelManagement/deployedModelService';
import { ManageModelsDialog } from './manageModels/manageModelsDialog';
import {
	AzureResourceEventArgs, ListAzureModelsEventName, ListSubscriptionsEventName, ListModelsEventName, ListWorkspacesEventName,
	ListGroupsEventName, ListAccountsEventName, RegisterLocalModelEventName, RegisterAzureModelEventName,
	ModelViewBase, SourceModelSelectedEventName, RegisterModelEventName, DownloadAzureModelEventName,
	ListDatabaseNamesEventName, ListTableNamesEventName, ListColumnNamesEventName, PredictModelEventName, PredictModelEventArgs, DownloadRegisteredModelEventName, LoadModelParametersEventName, ModelSourceType, ModelViewData, StoreImportTableEventName, VerifyImportTableEventName, EditModelEventName, UpdateModelEventName, DeleteModelEventName, SignInToAzureEventName
} from './modelViewBase';
import { ControllerBase } from '../controllerBase';
import { ImportModelWizard } from './manageModels/importModelWizard';
import * as fs from 'fs';
import * as constants from '../../common/constants';
import { PredictWizard } from './prediction/predictWizard';
import { AzureModelResource } from '../interfaces';
import { PredictService } from '../../prediction/predictService';
import { EditModelDialog } from './manageModels/editModelDialog';

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
	public async registerModel(importTable: DatabaseTable | undefined, parent?: ModelViewBase, controller?: ModelManagementController, apiWrapper?: ApiWrapper, root?: string): Promise<ModelViewBase> {
		controller = controller || this;
		apiWrapper = apiWrapper || this._apiWrapper;
		root = root || this._root;
		let view = new ImportModelWizard(apiWrapper, root, parent);
		if (importTable) {
			view.importTable = importTable;
		} else {
			view.importTable = await controller._registeredModelService.getRecentImportTable();
		}

		controller.registerEvents(view);

		// Open view
		//
		await view.open();
		await view.refresh();
		return view;
	}

	/**
	 * Opens the dialog to edit model
	 */
	public async editModel(model: ImportedModel, parent?: ModelViewBase, controller?: ModelManagementController, apiWrapper?: ApiWrapper, root?: string): Promise<ModelViewBase> {
		controller = controller || this;
		apiWrapper = apiWrapper || this._apiWrapper;
		root = root || this._root;
		let view = new EditModelDialog(apiWrapper, root, parent, model);

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
		view.importTable = await this._registeredModelService.getRecentImportTable();

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
		view.on(ListModelsEventName, async (args) => {
			const table = <DatabaseTable>args;
			await this.executeAction(view, ListModelsEventName, this.getRegisteredModels, this._registeredModelService, table);
		});
		view.on(RegisterLocalModelEventName, async (arg) => {
			let models = <ModelViewData[]>arg;
			await this.executeAction(view, RegisterLocalModelEventName, this.registerLocalModel, this._registeredModelService, models);
			view.refresh();
		});
		view.on(RegisterModelEventName, async (args) => {
			const importTable = <DatabaseTable>args;
			await this.executeAction(view, RegisterModelEventName, this.registerModel, importTable, view, this, this._apiWrapper, this._root);
		});
		view.on(EditModelEventName, async (args) => {
			const model = <ImportedModel>args;
			await this.executeAction(view, EditModelEventName, this.editModel, model, view, this, this._apiWrapper, this._root);
		});
		view.on(UpdateModelEventName, async (args) => {
			const model = <ImportedModel>args;
			await this.executeAction(view, UpdateModelEventName, this.updateModel, this._registeredModelService, model);
		});
		view.on(DeleteModelEventName, async (args) => {
			const model = <ImportedModel>args;
			await this.executeAction(view, DeleteModelEventName, this.deleteModel, this._registeredModelService, model);
		});
		view.on(RegisterAzureModelEventName, async (arg) => {
			let models = <ModelViewData[]>arg;
			await this.executeAction(view, RegisterAzureModelEventName, this.registerAzureModel, this._amlService, this._registeredModelService,
				models);
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
			let model = <ImportedModel>arg;
			await this.executeAction(view, DownloadRegisteredModelEventName, this.downloadRegisteredModel, this._registeredModelService,
				model);
		});
		view.on(StoreImportTableEventName, async (arg) => {
			let importTable = <DatabaseTable>arg;
			await this.executeAction(view, StoreImportTableEventName, this.storeImportTable, this._registeredModelService,
				importTable);
		});
		view.on(VerifyImportTableEventName, async (arg) => {
			let importTable = <DatabaseTable>arg;
			await this.executeAction(view, VerifyImportTableEventName, this.verifyImportTable, this._registeredModelService,
				importTable);
		});
		view.on(SourceModelSelectedEventName, async (arg) => {
			view.modelSourceType = <ModelSourceType>arg;
			await view.refresh();
		});
		view.on(SignInToAzureEventName, async () => {
			await this.executeAction(view, SignInToAzureEventName, this.signInToAzure, this._amlService);
			await view.refresh();
		});
	}

	/**
	 * Opens the dialog for model management
	 */
	public async manageRegisteredModels(importTable?: DatabaseTable): Promise<ModelViewBase> {
		let view = new ManageModelsDialog(this._apiWrapper, this._root);

		if (importTable) {
			view.importTable = importTable;
		} else {
			view.importTable = await this._registeredModelService.getRecentImportTable();
		}

		// Register events
		//
		this.registerEvents(view);

		// Open view
		//
		view.open();
		return view;
	}

	private async signInToAzure(service: AzureModelRegistryService): Promise<void> {
		return await service.signInToAzure();
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

	private async getRegisteredModels(registeredModelService: DeployedModelService, table: DatabaseTable): Promise<ImportedModel[]> {
		return registeredModelService.getDeployedModels(table);
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

	private async registerLocalModel(service: DeployedModelService, models: ModelViewData[] | undefined): Promise<void> {
		if (models) {
			await Promise.all(models.map(async (model) => {
				if (model && model.targetImportTable) {
					const localModel = <string>model.modelData;
					if (localModel) {
						await service.deployLocalModel(localModel, model.modelDetails, model.targetImportTable);
					}
				} else {
					throw Error(constants.invalidModelToRegisterError);
				}
			}));
		} else {
			throw Error(constants.invalidModelToRegisterError);
		}
	}

	private async updateModel(service: DeployedModelService, model: ImportedModel | undefined): Promise<void> {
		if (model) {
			await service.updateModel(model);
		} else {
			throw Error(constants.invalidModelToRegisterError);
		}
	}

	private async deleteModel(service: DeployedModelService, model: ImportedModel | undefined): Promise<void> {
		if (model) {
			await service.deleteModel(model);
		} else {
			throw Error(constants.invalidModelToRegisterError);
		}
	}

	private async registerAzureModel(
		azureService: AzureModelRegistryService,
		service: DeployedModelService,
		models: ModelViewData[] | undefined): Promise<void> {
		if (!models) {
			throw Error(constants.invalidAzureResourceError);
		}

		await Promise.all(models.map(async (model) => {
			if (model && model.targetImportTable) {
				const azureModel = <AzureModelResource>model.modelData;
				if (azureModel && azureModel.account && azureModel.subscription && azureModel.group && azureModel.workspace && azureModel.model) {
					let filePath: string | undefined;
					try {
						const filePath = await azureService.downloadModel(azureModel.account, azureModel.subscription, azureModel.group,
							azureModel.workspace, azureModel.model);
						if (filePath) {
							await service.deployLocalModel(filePath, model.modelDetails, model.targetImportTable);
						} else {
							throw Error(constants.invalidModelToRegisterError);
						}
					} finally {
						if (filePath) {
							await fs.promises.unlink(filePath);
						}
					}
				}
			} else {
				throw Error(constants.invalidModelToRegisterError);
			}
		}));
	}

	private async getDatabaseList(predictService: PredictService): Promise<string[]> {
		return await predictService.getDatabaseList();
	}

	private async getTableList(predictService: PredictService, databaseName: string): Promise<DatabaseTable[]> {
		return await predictService.getTableList(databaseName);
	}

	private async getTableColumnsList(predictService: PredictService, databaseTable: DatabaseTable): Promise<TableColumn[]> {
		return await predictService.getTableColumnsList(databaseTable);
	}

	private async generatePredictScript(
		predictService: PredictService,
		predictParams: PredictParameters,
		registeredModel: ImportedModel | undefined,
		filePath: string | undefined
	): Promise<string> {
		if (!predictParams) {
			throw Error(constants.invalidModelToPredictError);
		}
		const result = await predictService.generatePredictScript(predictParams, registeredModel, filePath);
		return result;
	}

	private async storeImportTable(registeredModelService: DeployedModelService, table: DatabaseTable | undefined): Promise<void> {
		if (table) {
			await registeredModelService.storeRecentImportTable(table);
		} else {
			throw Error(constants.invalidImportTableError(undefined, undefined));
		}
	}

	private async verifyImportTable(registeredModelService: DeployedModelService, table: DatabaseTable | undefined): Promise<boolean> {
		if (table) {
			return await registeredModelService.verifyConfigTable(table);
		} else {
			throw Error(constants.invalidImportTableError(undefined, undefined));
		}
	}

	private async downloadRegisteredModel(
		registeredModelService: DeployedModelService,
		model: ImportedModel | undefined): Promise<string> {
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
