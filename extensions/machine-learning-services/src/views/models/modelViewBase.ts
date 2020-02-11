/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { azureResource } from '../../modelManagement/azure-resource';
import { ApiWrapper } from '../../common/apiWrapper';
import { ViewBase } from '../viewBase';
import { RegisteredModel, WorkspaceModel } from '../../modelManagement/interfaces';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';

export interface AzureResourceEventArgs {
	account?: azdata.Account,
	subscription?: azureResource.AzureResourceSubscription,
	group?: azureResource.AzureResource,
	workspace?: Workspace
}

export const ListModelsEventName = 'listModels';
export const ListAzureModelsEventName = 'listAzureModels';
export const ListAccountsEventName = 'listAccounts';
export const ListSubscriptionsEventName = 'listSubscriptions';
export const ListGroupsEventName = 'listGroups';
export const ListWorkspacesEventName = 'listWorkspaces';

export abstract class ModelViewBase extends ViewBase {

	constructor(apiWrapper: ApiWrapper, root?: string, parent?: ModelViewBase) {
		super(apiWrapper, root, parent);
	}

	protected registerEvents() {
		super.registerEvents();
	}

	protected getEventNames(): string[] {
		return [ListModelsEventName, ListAzureModelsEventName, ListAccountsEventName, ListSubscriptionsEventName, ListGroupsEventName, ListWorkspacesEventName];
	}

	public get parent(): ModelViewBase | undefined {
		return this._parent ? <ModelViewBase>this._parent : undefined;
	}

	public async listAzureModels(
		account: azdata.Account | undefined,
		subscription: azureResource.AzureResourceSubscription | undefined,
		group: azureResource.AzureResource | undefined,
		workspace: Workspace | undefined): Promise<WorkspaceModel[]> {
		const args: AzureResourceEventArgs = {
			account: account,
			subscription: subscription,
			group: group,
			workspace: workspace
		};
		return await this.sendDataRequest(ListAzureModelsEventName, args);
	}

	public async listModels(): Promise<RegisteredModel[]> {
		return await this.sendDataRequest(ListModelsEventName);
	}

	public async listAzureAccounts(): Promise<azdata.Account[]> {
		return await this.sendDataRequest(ListAccountsEventName);
	}

	public async listAzureSubscriptions(account: azdata.Account | undefined): Promise<azureResource.AzureResourceSubscription[]> {
		const args: AzureResourceEventArgs = {
			account: account
		};
		return await this.sendDataRequest(ListSubscriptionsEventName, args);
	}

	public async listAzureGroups(account: azdata.Account | undefined, subscription: azureResource.AzureResourceSubscription | undefined): Promise<azureResource.AzureResource[]> {
		const args: AzureResourceEventArgs = {
			account: account,
			subscription: subscription
		};
		return await this.sendDataRequest(ListGroupsEventName, args);
	}

	public async listWorkspaces(account: azdata.Account | undefined, subscription: azureResource.AzureResourceSubscription | undefined, group: azureResource.AzureResource | undefined): Promise<Workspace[]> {
		const args: AzureResourceEventArgs = {
			account: account,
			subscription: subscription,
			group: group
		};
		return await this.sendDataRequest(ListWorkspacesEventName, args);
	}
}
