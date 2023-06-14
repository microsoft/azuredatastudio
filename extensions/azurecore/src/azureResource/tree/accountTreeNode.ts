/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AppContext } from '../../appContext';
import { TreeNode } from '../treeNode';
import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceItemType, AzureResourceServiceNames } from '../constants';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { AzureAccount, Tenant } from 'azurecore';
import { AzureResourceTenantTreeNode } from './tenantTreeNode';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { IAzureResourceTenantFilterService } from '../interfaces';

export class AzureResourceAccountTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		public readonly account: AzureAccount,
		appContext: AppContext,
		treeChangeHandler: IAzureResourceTreeChangeHandler
	) {
		super(appContext, treeChangeHandler, undefined);
		this._tenantFilterService = this.appContext.getService<IAzureResourceTenantFilterService>(AzureResourceServiceNames.tenantFilterService);

		if (this.account.properties.tenants.length === 1) {
			this._singleTenantTreeNode = new AzureResourceTenantTreeNode(this.account, this.account.properties.tenants[0], this, this.appContext, this.treeChangeHandler);
		}
		this._id = `account_${this.account.key.accountId}`;
		this.setCacheKey(`${this._id}.tenants`);
		this._label = this.generateLabel();
	}

	public async getChildren(): Promise<TreeNode[]> {
		let tenants = this.account.properties.tenants;
		this._totalTenantsCount = tenants.length;

		const selectedTenants = await this._tenantFilterService.getSelectedTenants(this.account);
		const selectedTenantIds = (selectedTenants || <Tenant[]>[]).map((Tenant) => Tenant.id);

		if (selectedTenantIds.length > 0) {
			tenants = tenants.filter((tenant) => selectedTenantIds.indexOf(tenant.id) !== -1);
			this._selectedTenantsCount = selectedTenantIds.length;
		} else {
			// ALL Tenants are listed by default
			this._selectedTenantsCount = this._totalTenantsCount;
		}

		this.refreshLabel();

		if (this.totalTenantsCount === 1) {
			return await this._singleTenantTreeNode?.getChildren() ?? [];
		} else if (tenants.length === 0) {
			return [AzureResourceMessageTreeNode.create(AzureResourceAccountTreeNode.noTenantsLabel, this)];
		} else {
			let subTreeNodes = await Promise.all(tenants.map(async (tenant) => {
				return new AzureResourceTenantTreeNode(this.account, tenant, this, this.appContext, this.treeChangeHandler);
			}));
			return subTreeNodes.sort((a, b) => a.tenant.displayName.localeCompare(b.tenant.displayName));
		}
	}

	public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		const item = new vscode.TreeItem(this._label, vscode.TreeItemCollapsibleState.Collapsed);
		item.id = this._id;
		item.contextValue = this.account.properties.tenants.length > 1 ?
			AzureResourceItemType.multipleTenantAccount : AzureResourceItemType.singleTenantAccount;
		item.iconPath = this.appContext.extensionContext.asAbsolutePath('resources/users.svg');
		return item;
	}

	public getNodeInfo(): azdata.NodeInfo {
		return {
			label: this._label,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			parentNodePath: this.parent?.generateNodePath() ?? '',
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.account,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.account
		};
	}

	public get nodePathValue(): string {
		return this._id;
	}

	public get totalTenantsCount(): number {
		return this._totalTenantsCount;
	}

	public get selectedTenantCount(): number {
		return this._selectedTenantsCount;
	}

	protected refreshLabel(): void {
		const newLabel = this.generateLabel();
		if (this._label !== newLabel) {
			this._label = newLabel;
			this.treeChangeHandler.notifyNodeChanged(this);
		}
	}

	private generateLabel(): string {
		let label = this.account.displayInfo.displayName;

		if (this._totalTenantsCount === 1 && this._singleTenantTreeNode) {
			label += ` (${this._singleTenantTreeNode.selectedSubscriptionCount} / ${this._singleTenantTreeNode.totalSubscriptionCount} subscriptions)`;
		} else if (this._totalTenantsCount > 0) {
			label += ` (${this._selectedTenantsCount} / ${this._totalTenantsCount} tenants)`;
		}

		return label;
	}

	private _tenantFilterService: IAzureResourceTenantFilterService;

	private _id: string;
	private _label: string;
	private _totalTenantsCount = 0;
	private _selectedTenantsCount = 0;
	private _singleTenantTreeNode: AzureResourceTenantTreeNode | undefined;

	private static readonly noTenantsLabel = localize('azure.resource.tree.accountTreeNode.noTenantsLabel', "No Tenants found.");

}
