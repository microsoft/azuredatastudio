/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import { azureResource } from '../../typings/azure-resource';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import * as constants from '../../common/constants';
import { AzureWorkspaceResource, IDataComponent } from '../interfaces';

/**
 * View to render filters to pick an azure resource
 */
const componentWidth = 300;
export class AzureResourceFilterComponent extends ModelViewBase implements IDataComponent<AzureWorkspaceResource> {

	private _form: azdata.FormContainer;
	private _accounts: azdata.DropDownComponent;
	private _subscriptions: azdata.DropDownComponent;
	private _groups: azdata.DropDownComponent;
	private _workspaces: azdata.DropDownComponent;
	private _azureAccounts: azdata.Account[] = [];
	private _azureSubscriptions: azureResource.AzureResourceSubscription[] = [];
	private _azureGroups: azureResource.AzureResource[] = [];
	private _azureWorkspaces: Workspace[] = [];
	private _onWorkspacesSelectedChanged: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onWorkspacesSelectedChanged: vscode.Event<void> = this._onWorkspacesSelectedChanged.event;

	/**
	 * Creates a new view
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
			await this.onWorkspaceSelectedChanged();
		});

		this._form = this._modelBuilder.formContainer().withFormItems([{
			title: constants.azureAccount,
			component: this._accounts
		}, {
			title: constants.azureSubscription,
			component: this._subscriptions
		}, {
			title: constants.azureGroup,
			component: this._groups
		}, {
			title: constants.azureModelWorkspace,
			component: this._workspaces
		}]).component();
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._accounts && this._subscriptions && this._groups && this._workspaces) {
			formBuilder.addFormItems([{
				title: constants.azureAccount,
				component: this._accounts
			}, {
				title: constants.azureSubscription,
				component: this._subscriptions
			}, {
				title: constants.azureGroup,
				component: this._groups
			}, {
				title: constants.azureModelWorkspace,
				component: this._workspaces
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._accounts && this._subscriptions && this._groups && this._workspaces) {
			formBuilder.removeFormItem({
				title: constants.azureAccount,
				component: this._accounts
			});
			formBuilder.removeFormItem({
				title: constants.azureSubscription,
				component: this._subscriptions
			});
			formBuilder.removeFormItem({
				title: constants.azureGroup,
				component: this._groups
			});
			formBuilder.removeFormItem({
				title: constants.azureModelWorkspace,
				component: this._workspaces
			});
		}
	}

	/**
	 * Returns the created component
	 */
	public get component(): azdata.Component {
		return this._form;
	}

	/**
	 * Returns selected data
	 */
	public get data(): AzureWorkspaceResource | undefined {
		return {
			account: this.account,
			subscription: this.subscription,
			group: this.group,
			workspace: this.workspace
		};
	}

	/**
	 * loads data in the components
	 */
	public async loadData(): Promise<void> {
		this._azureAccounts = await this.listAzureAccounts();
		if (this._azureAccounts && this._azureAccounts.length > 0) {
			let values = this._azureAccounts.map(a => { return { displayName: a.displayInfo.displayName, name: a.key.accountId }; });
			this._accounts.values = values;
			this._accounts.value = values[0];
		} else {
			this._accounts.values = [];
			this._accounts.value = undefined;
		}
		await this.onAccountSelected();
	}

	/**
	 * refreshes the view
	 */
	public async refresh(): Promise<void> {
		await this.loadData();
	}

	private async onAccountSelected(): Promise<void> {
		this._azureSubscriptions = await this.listAzureSubscriptions(this.account);
		if (this._azureSubscriptions && this._azureSubscriptions.length > 0) {
			let values = this._azureSubscriptions.map(s => { return { displayName: s.name, name: s.id }; });
			this._subscriptions.values = values;
			this._subscriptions.value = values[0];
		} else {
			this._subscriptions.values = [];
			this._subscriptions.value = undefined;
		}
		await this.onSubscriptionSelected();
	}

	private async onSubscriptionSelected(): Promise<void> {
		this._azureGroups = await this.listAzureGroups(this.account, this.subscription);
		if (this._azureGroups && this._azureGroups.length > 0) {
			let values = this._azureGroups.map(s => { return { displayName: s.name, name: s.id }; });
			this._groups.values = values;
			this._groups.value = values[0];
		} else {
			this._groups.values = [];
			this._groups.value = undefined;
		}
		await this.onGroupSelected();
	}

	private async onGroupSelected(): Promise<void> {
		this._azureWorkspaces = await this.listWorkspaces(this.account, this.subscription, this.group);
		if (this._azureWorkspaces && this._azureWorkspaces.length > 0) {
			let values = this._azureWorkspaces.map(s => { return { displayName: s.name || '', name: s.id || '' }; });
			this._workspaces.values = values;
			this._workspaces.value = values[0];
		} else {
			this._workspaces.values = [];
			this._workspaces.value = undefined;
		}
		this.onWorkspaceSelectedChanged();
	}

	private onWorkspaceSelectedChanged(): void {
		this._onWorkspacesSelectedChanged.fire();
	}

	private get workspace(): Workspace | undefined {
		return this._azureWorkspaces && this._workspaces.value ? this._azureWorkspaces.find(a => a.id === (<azdata.CategoryValue>this._workspaces.value).name) : undefined;
	}

	private get account(): azdata.Account | undefined {
		return this._azureAccounts && this._accounts.value ? this._azureAccounts.find(a => a.key.accountId === (<azdata.CategoryValue>this._accounts.value).name) : undefined;
	}

	private get group(): azureResource.AzureResource | undefined {
		return this._azureGroups && this._groups.value ? this._azureGroups.find(a => a.id === (<azdata.CategoryValue>this._groups.value).name) : undefined;
	}

	private get subscription(): azureResource.AzureResourceSubscription | undefined {
		return this._azureSubscriptions && this._subscriptions.value ? this._azureSubscriptions.find(a => a.id === (<azdata.CategoryValue>this._subscriptions.value).name) : undefined;
	}
}
