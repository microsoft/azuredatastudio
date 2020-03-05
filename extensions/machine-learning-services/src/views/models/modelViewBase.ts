/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { azureResource } from '../../typings/azure-resource';
import { ApiWrapper } from '../../common/apiWrapper';
import { ViewBase } from '../viewBase';
import { RegisteredModel, WorkspaceModel } from '../../modelManagement/interfaces';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { AzureWorkspaceResource, AzureModelResource } from '../interfaces';

export interface AzureResourceEventArgs extends AzureWorkspaceResource {
}

export interface RegisterModelEventArgs extends AzureWorkspaceResource {
	details?: RegisteredModel
}

export interface RegisterAzureModelEventArgs extends AzureModelResource, RegisterModelEventArgs {
	model?: WorkspaceModel;
}

export interface RegisterLocalModelEventArgs extends RegisterModelEventArgs {
	filePath?: string;
}

// Event names
//
export const ListModelsEventName = 'listModels';
export const ListAzureModelsEventName = 'listAzureModels';
export const ListAccountsEventName = 'listAccounts';
export const ListSubscriptionsEventName = 'listSubscriptions';
export const ListGroupsEventName = 'listGroups';
export const ListWorkspacesEventName = 'listWorkspaces';
export const RegisterLocalModelEventName = 'registerLocalModel';
export const RegisterAzureModelEventName = 'registerAzureLocalModel';
export const RegisterModelEventName = 'registerModel';
export const SourceModelSelectedEventName = 'sourceModelSelected';

/**
 * Base class for all model management views
 */
export abstract class ModelViewBase extends ViewBase {

	constructor(apiWrapper: ApiWrapper, root?: string, parent?: ModelViewBase) {
		super(apiWrapper, root, parent);
	}

	protected getEventNames(): string[] {
		return super.getEventNames().concat([ListModelsEventName,
			ListAzureModelsEventName,
			ListAccountsEventName,
			ListSubscriptionsEventName,
			ListGroupsEventName,
			ListWorkspacesEventName,
			RegisterLocalModelEventName,
			RegisterAzureModelEventName,
			RegisterModelEventName,
			SourceModelSelectedEventName]);
	}

	/**
	 * Parent view
	 */
	public get parent(): ModelViewBase | undefined {
		return this._parent ? <ModelViewBase>this._parent : undefined;
	}

	/**
	 * list azure models
	 */
	public async listAzureModels(workspaceResource: AzureWorkspaceResource): Promise<WorkspaceModel[]> {
		const args: AzureResourceEventArgs = workspaceResource;
		return await this.sendDataRequest(ListAzureModelsEventName, args);
	}

	/**
	 * list registered models
	 */
	public async listModels(): Promise<RegisteredModel[]> {
		return await this.sendDataRequest(ListModelsEventName);
	}

	/**
	 * lists azure accounts
	 */
	public async listAzureAccounts(): Promise<azdata.Account[]> {
		return await this.sendDataRequest(ListAccountsEventName);
	}

	/**
	 * lists azure subscriptions
	 * @param account azure account
	 */
	public async listAzureSubscriptions(account: azdata.Account | undefined): Promise<azureResource.AzureResourceSubscription[]> {
		const args: AzureResourceEventArgs = {
			account: account
		};
		return await this.sendDataRequest(ListSubscriptionsEventName, args);
	}

	/**
	 * registers local model
	 * @param localFilePath local file path
	 */
	public async registerLocalModel(localFilePath: string | undefined, details: RegisteredModel | undefined): Promise<void> {
		const args: RegisterLocalModelEventArgs = {
			filePath: localFilePath,
			details: details
		};
		return await this.sendDataRequest(RegisterLocalModelEventName, args);
	}

	/**
	 * registers azure model
	 * @param args azure resource
	 */
	public async registerAzureModel(resource: AzureModelResource | undefined, details: RegisteredModel | undefined): Promise<void> {
		const args: RegisterAzureModelEventArgs = Object.assign({}, resource, {
			details: details
		});
		return await this.sendDataRequest(RegisterAzureModelEventName, args);
	}

	/**
	 * list resource groups
	 * @param account azure account
	 * @param subscription azure subscription
	 */
	public async listAzureGroups(account: azdata.Account | undefined, subscription: azureResource.AzureResourceSubscription | undefined): Promise<azureResource.AzureResource[]> {
		const args: AzureResourceEventArgs = {
			account: account,
			subscription: subscription
		};
		return await this.sendDataRequest(ListGroupsEventName, args);
	}

	/**
	 * lists azure workspaces
	 * @param account azure account
	 * @param subscription azure subscription
	 * @param group azure resource group
	 */
	public async listWorkspaces(account: azdata.Account | undefined, subscription: azureResource.AzureResourceSubscription | undefined, group: azureResource.AzureResource | undefined): Promise<Workspace[]> {
		const args: AzureResourceEventArgs = {
			account: account,
			subscription: subscription,
			group: group
		};
		return await this.sendDataRequest(ListWorkspacesEventName, args);
	}
}
