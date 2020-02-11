/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import { azureResource } from '../../modelManagement/azure-resource';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';

const componentWidth = 200;
export class AzureResourceFilterComponent extends ModelViewBase {

	private _flex: azdata.FlexContainer;
	private _accounts: azdata.DropDownComponent;
	private _subscriptions: azdata.DropDownComponent;
	private _groups: azdata.DropDownComponent;
	private _workspaces: azdata.DropDownComponent;
	private _azureAccounts: azdata.Account[] = [];
	private _azureSubscriptions: azureResource.AzureResourceSubscription[] = [];
	private _azureGroups: azureResource.AzureResource[] = [];
	private _azureWorkspaces: Workspace[] = [];
	private _onWorkspacesSelected: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onWorkspacesSelected: vscode.Event<void> = this._onWorkspacesSelected.event;

	/**
	 *
	 */
	constructor(apiWrapper: ApiWrapper, private _modelBuilder: azdata.ModelBuilder, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
		this._accounts = this._modelBuilder.dropDown().withProperties({
			width: componentWidth
		}).component();
		this._subscriptions = this._modelBuilder.dropDown().withProperties({
			width: componentWidth
		}).component();
		this._groups = this._modelBuilder.dropDown().withProperties({
			width: componentWidth
		}).component();
		this._workspaces = this._modelBuilder.dropDown().withProperties({
			width: componentWidth
		}).component();

		this._accounts.onValueChanged(async () => {
			await this.onAccountSelected();
		});

		this._subscriptions.onValueChanged(async () => {
			await this.onSubscriptionSelected();
		});
		this._groups.onValueChanged(async () => {
			await this.onGroupSelected();
		});
		this._workspaces.onValueChanged(async () => {
			await this.onWorkspaceSelected();
		});

		this._flex = this._modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				justifyContent: 'space-between'
				//width: parent.componentMaxLength
			})
			.withItems([
				this._accounts,
				this._subscriptions,
				this._groups,
				this._workspaces
			]).component();
	}

	public get component(): azdata.Component {
		return this._flex;
	}

	private async onAccountSelected(): Promise<void> {
		this._azureSubscriptions = await this.listAzureSubscriptions(this.account);
		let values = this._azureSubscriptions.map(s => { return { displayName: s.name, name: s.id }; });
		this._subscriptions.values = values;
		this._subscriptions.value = values[0];
		await this.onSubscriptionSelected();
	}

	private async onSubscriptionSelected(): Promise<void> {
		this._azureGroups = await this.listAzureGroups(this.account, this.subscription);
		let values = this._azureGroups.map(s => { return { displayName: s.name, name: s.id }; });
		this._groups.values = values;
		this._groups.value = values[0];
		await this.onGroupSelected();
	}

	private async onGroupSelected(): Promise<void> {
		this._azureWorkspaces = await this.listWorkspaces(this.account, this.subscription, this.group);
		let values = this._azureWorkspaces.map(s => { return { displayName: s.name || '', name: s.id || '' }; });
		this._workspaces.values = values;
		this._workspaces.value = values[0];
		await this.onWorkspaceSelected();
	}

	private onWorkspaceSelected(): void {
		this._onWorkspacesSelected.fire();
	}

	public get workspace(): Workspace | undefined {
		return this._azureWorkspaces.find(a => a.id === (<azdata.CategoryValue>this._workspaces.value).name);
	}

	public get account(): azdata.Account | undefined {
		return this._azureAccounts.find(a => a.key.accountId === (<azdata.CategoryValue>this._accounts.value).name);
	}

	public get group(): azureResource.AzureResource | undefined {
		return this._azureGroups.find(a => a.id === (<azdata.CategoryValue>this._groups.value).name);
	}

	public get subscription(): azureResource.AzureResourceSubscription | undefined {
		return this._azureSubscriptions.find(a => a.id === (<azdata.CategoryValue>this._subscriptions.value).name);
	}

	public async loadData(): Promise<void> {
		this._azureAccounts = await this.listAzureAccounts();
		let values = this._azureAccounts.map(a => { return { displayName: a.displayInfo.displayName, name: a.key.accountId }; });
		this._accounts.values = values;
		this._accounts.value = values[0];
		this.onAccountSelected();
	}

	public async reset(): Promise<void> {
		await this.loadData();
	}
}
