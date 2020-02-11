/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { azureResource } from '../../modelManagement/azure-resource';
import { ApiWrapper } from '../../common/apiWrapper';
import { AzureModelRegistryService } from '../../modelManagement/azureModelRegistryService';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { RegisteredModel } from '../../modelManagement/interfaces';
import { RegisteredModelService } from '../../modelManagement/registeredModelService';
import { RegisteredModelsDialog } from './registeredModelsDialog';
import { AzureResourceEventArgs, ListAzureModelsEventName, ListSubscriptionsEventName, ListModelsEventName, ListWorkspacesEventName, ListGroupsEventName, ListAccountsEventName } from './modelViewBase';
import { ViewBase } from '../viewBase';

export class ModelManagementController {

	/**
	 *
	 */
	constructor(
		private _apiWrapper: ApiWrapper,
		private _root: string,
		private _amlService: AzureModelRegistryService,
		private _registeredModelService: RegisteredModelService) {
	}

	public async manageRegisteredModels(): Promise<RegisteredModelsDialog> {
		let dialog = new RegisteredModelsDialog(this._apiWrapper, this._root);

		// Register events
		//
		dialog.on(ListAccountsEventName, async () => {
			await this.executeAction(dialog, ListAccountsEventName, this.getAzureAccounts, this._amlService);
		});
		dialog.on(ListSubscriptionsEventName, async (arg) => {
			let azureArgs = <AzureResourceEventArgs>arg;
			await this.executeAction(dialog, ListSubscriptionsEventName, this.getAzureSubscriptions, this._amlService, azureArgs.account);
		});
		dialog.on(ListWorkspacesEventName, async (arg) => {
			let azureArgs = <AzureResourceEventArgs>arg;
			await this.executeAction(dialog, ListWorkspacesEventName, this.getWorkspaces, this._amlService, azureArgs.account, azureArgs.subscription, azureArgs.group);
		});
		dialog.on(ListGroupsEventName, async (arg) => {
			let azureArgs = <AzureResourceEventArgs>arg;
			await this.executeAction(dialog, ListGroupsEventName, this.getAzureGroups, this._amlService, azureArgs.account, azureArgs.subscription);
		});
		dialog.on(ListAzureModelsEventName, async (arg) => {
			let azureArgs = <AzureResourceEventArgs>arg;
			await this.executeAction(dialog, ListAzureModelsEventName, this.getAzureModels, this._amlService, azureArgs.account, azureArgs.subscription, azureArgs.group, azureArgs.workspace);
		});

		dialog.on(ListModelsEventName, async () => {
			await this.executeAction(dialog, ListModelsEventName, this.getRegisteredModels, this._registeredModelService);
		});

		// Open dialog
		//
		dialog.showDialog();
		return dialog;
	}

	public async executeAction<T extends ViewBase>(dialog: T, eventName: string, func: (...args: any[]) => Promise<any>, ...args: any[]): Promise<void> {
		const callbackEvent = ViewBase.getCallbackEventName(eventName);
		try {
			let result = await func(...args);
			dialog.sendCallbackRequest(callbackEvent, { data: result });

		} catch (error) {
			dialog.sendCallbackRequest(callbackEvent, { error: error });
		}
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

	public async getAzureModels(
		service: AzureModelRegistryService,
		account: azdata.Account | undefined,
		subscription: azureResource.AzureResourceSubscription | undefined,
		resourceGroup: azureResource.AzureResource | undefined,
		workspace: Workspace | undefined): Promise<azureResource.AzureResource[]> {
		if (!account || !subscription || !resourceGroup || !workspace) {
			return [];
		}
		return await service.getModels(account, subscription, resourceGroup, workspace) || [];
	}
}
