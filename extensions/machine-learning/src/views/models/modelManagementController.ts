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
		private _deployedModelService: DeployedModelService,
		private _predictService: PredictService) {
		super(apiWrapper);
	}

	/**
	 * Opens the dialog for model import
	 * @param parent parent if the view is opened from another view
	 * @param controller controller
	 * @param apiWrapper apiWrapper
	 * @param root root folder path
	 */
	public async importModel(importTable: DatabaseTable | undefined, parent?: ModelViewBase, controller?: ModelManagementController, apiWrapper?: ApiWrapper, root?: string): Promise<ModelViewBase> {
		controller = controller || this;
		apiWrapper = apiWrapper || this._apiWrapper;
		root = root || this._root;
		let view = new ImportModelWizard(apiWrapper, root, parent);
		if (importTable) {
			view.importTable = importTable;
		} else {
			view.importTable = await controller._deployedModelService.getRecentImportTable();
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
	public async predictModel(): Promise<ModelViewBase | undefined> {

		const onnxSupported = await this._predictService.serverSupportOnnxModel();
		if (onnxSupported) {
			await this._deployedModelService.installDependencies();
			let view = new PredictWizard(this._apiWrapper, this._root);
			view.importTable = await this._deployedModelService.getRecentImportTable();

			this.registerEvents(view);

			view.on(LoadModelParametersEventName, async (args) => {
				const modelArtifact = await view.getModelFileName();
				await this.executeAction(view, LoadModelParametersEventName, args, this.loadModelParameters, this._deployedModelService,
					modelArtifact?.filePath);
			});

			// Open view
			//
			await view.open();
			await view.refresh();
			return view;
		} else {
			this._apiWrapper.showErrorMessage(constants.onnxNotSupportedError);
			return undefined;
		}
	}


	/**
	 * Register events in the main view
	 * @param view main view
	 */
	public registerEvents(view: ModelViewBase): void {

		// Register events
		//
		super.registerEvents(view);
		view.on(ListAccountsEventName, async (args) => {
			await this.executeAction(view, ListAccountsEventName, args, this.getAzureAccounts, this._amlService);
		});
		view.on(ListSubscriptionsEventName, async (args) => {
			let azureArgs = <AzureResourceEventArgs>args;
			await this.executeAction(view, ListSubscriptionsEventName, args, this.getAzureSubscriptions, this._amlService, azureArgs.account);
		});
		view.on(ListWorkspacesEventName, async (args) => {
			let azureArgs = <AzureResourceEventArgs>args;
			await this.executeAction(view, ListWorkspacesEventName, args, this.getWorkspaces, this._amlService, azureArgs.account, azureArgs.subscription, azureArgs.group);
		});
		view.on(ListGroupsEventName, async (args) => {
			let azureArgs = <AzureResourceEventArgs>args;
			await this.executeAction(view, ListGroupsEventName, args, this.getAzureGroups, this._amlService, azureArgs.account, azureArgs.subscription);
		});
		view.on(ListAzureModelsEventName, async (args) => {
			let azureArgs = <AzureResourceEventArgs>args;
			await this.executeAction(view, ListAzureModelsEventName, args, this.getAzureModels, this._amlService
				, azureArgs.account, azureArgs.subscription, azureArgs.group, azureArgs.workspace);
		});
		view.on(ListModelsEventName, async (args) => {
			const table = <DatabaseTable>args;
			await this.executeAction(view, ListModelsEventName, args, this.getRegisteredModels, this._deployedModelService, table);
		});
		view.on(RegisterLocalModelEventName, async (args) => {
			let models = <ModelViewData[]>args;
			await this.executeAction(view, RegisterLocalModelEventName, args, this.registerLocalModel, this._deployedModelService, models);
			view.refresh();
		});
		view.on(RegisterModelEventName, async (args) => {
			const importTable = <DatabaseTable>args;
			await this.executeAction(view, RegisterModelEventName, args, this.importModel, importTable, view, this, this._apiWrapper, this._root);
		});
		view.on(EditModelEventName, async (args) => {
			const model = <ImportedModel>args;
			await this.executeAction(view, EditModelEventName, args, this.editModel, model, view, this, this._apiWrapper, this._root);
		});
		view.on(UpdateModelEventName, async (args) => {
			const model = <ImportedModel>args;
			await this.executeAction(view, UpdateModelEventName, args, this.updateModel, this._deployedModelService, model);
		});
		view.on(DeleteModelEventName, async (args) => {
			const model = <ImportedModel>args;
			await this.executeAction(view, DeleteModelEventName, args, this.deleteModel, this._deployedModelService, model);
		});
		view.on(RegisterAzureModelEventName, async (args) => {
			let models = <ModelViewData[]>args;
			await this.executeAction(view, RegisterAzureModelEventName, args, this.registerAzureModel, this._amlService, this._deployedModelService,
				models);
		});
		view.on(DownloadAzureModelEventName, async (args) => {
			let registerArgs = <AzureModelResource>args;
			await this.executeAction(view, DownloadAzureModelEventName, args, this.downloadAzureModel, this._amlService,
				registerArgs.account, registerArgs.subscription, registerArgs.group, registerArgs.workspace, registerArgs.model);
		});
		view.on(ListDatabaseNamesEventName, async (args) => {
			await this.executeAction(view, ListDatabaseNamesEventName, args, this.getDatabaseList, this._predictService);
		});
		view.on(ListTableNamesEventName, async (args) => {
			let dbName = <string>args;
			await this.executeAction(view, ListTableNamesEventName, args, this.getTableList, this._predictService, dbName);
		});
		view.on(ListColumnNamesEventName, async (args) => {
			let tableColumnsArgs = <DatabaseTable>args;
			await this.executeAction(view, ListColumnNamesEventName, args, this.getTableColumnsList, this._predictService,
				tableColumnsArgs);
		});
		view.on(PredictModelEventName, async (args) => {
			let predictArgs = <PredictModelEventArgs>args;
			await this.executeAction(view, PredictModelEventName, args, this.generatePredictScript, this._predictService,
				predictArgs, predictArgs.model, predictArgs.filePath);
		});
		view.on(DownloadRegisteredModelEventName, async (args) => {
			let model = <ImportedModel>args;
			await this.executeAction(view, DownloadRegisteredModelEventName, args, this.downloadRegisteredModel, this._deployedModelService,
				model);
		});
		view.on(StoreImportTableEventName, async (args) => {
			let importTable = <DatabaseTable>args;
			await this.executeAction(view, StoreImportTableEventName, args, this.storeImportTable, this._deployedModelService,
				importTable);
		});
		view.on(VerifyImportTableEventName, async (args) => {
			let importTable = <DatabaseTable>args;
			await this.executeAction(view, VerifyImportTableEventName, args, this.verifyImportTable, this._deployedModelService,
				importTable);
		});
		view.on(SourceModelSelectedEventName, async (args) => {
			view.modelSourceType = <ModelSourceType>args;
			await view.refresh();
		});
		view.on(SignInToAzureEventName, async (args) => {
			await this.executeAction(view, SignInToAzureEventName, args, this.signInToAzure, this._amlService);
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
			view.importTable = await this._deployedModelService.getRecentImportTable();
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
