/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { azureResource } from '../../typings/azure-resource';
import { ApiWrapper } from '../../common/apiWrapper';
import { AzureModelRegistryService } from '../../modelManagement/azureModelRegistryService';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { RegisteredModel, WorkspaceModel } from '../../modelManagement/interfaces';
import { RegisteredModelService } from '../../modelManagement/registeredModelService';
import { RegisteredModelsDialog } from './registeredModelsDialog';
import { AzureResourceEventArgs, ListAzureModelsEventName, ListSubscriptionsEventName, ListModelsEventName, ListWorkspacesEventName, ListGroupsEventName, ListAccountsEventName, RegisterLocalModelEventName, RegisterLocalModelEventArgs, RegisterAzureModelEventName, RegisterAzureModelEventArgs, ModelViewBase, SourceModelSelectedEventName, RegisterModelEventName } from './modelViewBase';
import { ControllerBase } from '../controllerBase';
import { RegisterModelWizard } from './registerModelWizard';
import * as fs from 'fs';
import * as constants from '../../common/constants';

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
		private _registeredModelService: RegisteredModelService) {
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
		view.open();
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

	private async getRegisteredModels(registeredModelService: RegisteredModelService): Promise<RegisteredModel[]> {
		return registeredModelService.getRegisteredModels();
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

	private async registerLocalModel(service: RegisteredModelService, filePath: string, details: RegisteredModel | undefined): Promise<void> {
		if (filePath) {
			await service.registerLocalModel(filePath, details);
		} else {
			throw Error(constants.invalidModelToRegisterError);

		}
	}

	private async registerAzureModel(
		azureService: AzureModelRegistryService,
		service: RegisteredModelService,
		account: azdata.Account | undefined,
		subscription: azureResource.AzureResourceSubscription | undefined,
		resourceGroup: azureResource.AzureResource | undefined,
		workspace: Workspace | undefined,
		model: WorkspaceModel | undefined,
		details: RegisteredModel | undefined): Promise<void> {
		if (!account || !subscription || !resourceGroup || !workspace || !model || !details) {
			throw Error(constants.invalidAzureResourceError);
		}
		const filePath = await azureService.downloadModel(account, subscription, resourceGroup, workspace, model);
		if (filePath) {

			await service.registerLocalModel(filePath, details);
			await fs.promises.unlink(filePath);
		} else {
			throw Error(constants.invalidModelToRegisterError);
		}
	}
}
