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
import { IAzureResourceTenantFilterService } from '../interfaces';
import { AzureAccount, Tenant } from 'azurecore';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { FlatTenantTreeNode } from './flatTenantTreeNode';

export class FlatAccountTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		public readonly account: AzureAccount,
		appContext: AppContext,
		treeChangeHandler: IAzureResourceTreeChangeHandler
	) {
		super(appContext, treeChangeHandler, undefined);

		this._tenantFilterService = this.appContext.getService<IAzureResourceTenantFilterService>(AzureResourceServiceNames.tenantFilterService);

		this._id = `account_${this.account.key.accountId}`;
		this.setCacheKey(`${this._id}.dataresources`);
		this._label = account.displayInfo.displayName;
		this._loader = new FlatAccountTreeNodeLoader(appContext, this.account, this, this.treeChangeHandler);
		this._loader.onNewResourcesAvailable(() => {
			this.treeChangeHandler.notifyNodeChanged(this);
		});

		this._loader.onLoadingStatusChanged(async () => {
			await this.updateLabel();
			this.treeChangeHandler.notifyNodeChanged(this);
		});
	}

	public async updateLabel(): Promise<void> {
		const tenantInfo = await getTenantInfo(this.account, this._tenantFilterService);
		if (this._loader.isLoading) {
			this._label = localize('azure.resource.tree.accountTreeNode.titleLoading', "{0} - Loading...", this.account.displayInfo.displayName);
		} else if (tenantInfo.total !== 0) {
			this._label = localize({
				key: 'azure.resource.tree.accountTreeNode.title',
				comment: [
					'{0} is the display name of the azure account',
					'{1} is the number of selected tenants in this account',
					'{2} is the number of total tenants in this account'
				]
			}, "{0} ({1}/{2} tenants)", this.account.displayInfo.displayName, tenantInfo.selected, tenantInfo.total);
		} else {
			this._label = this.account.displayInfo.displayName;
		}
	}

	public async getChildren(): Promise<TreeNode[]> {
		if (this._isClearingCache) {
			this._loader.start().catch(err => console.error('Error loading Azure FlatAccountTreeNodes ', err));
			this._isClearingCache = false;
			return [];
		} else {
			return this._loader.nodes;
		}
	}

	public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		const item = new vscode.TreeItem(this._label, vscode.TreeItemCollapsibleState.Collapsed);
		item.id = this._id;
		item.contextValue = AzureResourceItemType.account;
		item.iconPath = {
			dark: this.appContext.extensionContext.asAbsolutePath('resources/dark/account_inverse.svg'),
			light: this.appContext.extensionContext.asAbsolutePath('resources/light/account.svg')
		};
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

	private _tenantFilterService: IAzureResourceTenantFilterService;
	private _loader: FlatAccountTreeNodeLoader;
	private _id: string;
	private _label: string;
}

async function getTenantInfo(account: AzureAccount, tenantFilterService: IAzureResourceTenantFilterService,): Promise<{
	tenants: Tenant[],
	total: number,
	selected: number
}> {
	let tenants = account.properties.tenants;
	const total = tenants.length;
	let selected = total;

	const selectedTenants = await tenantFilterService.getSelectedTenants(account);
	const selectedTenantIds = (selectedTenants || <Tenant[]>[]).map((tenant) => tenant.id);
	if (selectedTenantIds.length > 0) {
		tenants = tenants.filter((tenant) => selectedTenantIds.indexOf(tenant.id) !== -1);
		selected = selectedTenantIds.length;
	}
	return {
		tenants,
		total,
		selected
	};
}
class FlatAccountTreeNodeLoader {

	private _isLoading: boolean = false;
	private _nodes: TreeNode[] = [];
	private readonly _onNewResourcesAvailable = new vscode.EventEmitter<void>();
	public readonly onNewResourcesAvailable = this._onNewResourcesAvailable.event;
	private readonly _onLoadingStatusChanged = new vscode.EventEmitter<void>();
	public readonly onLoadingStatusChanged = this._onLoadingStatusChanged.event;

	constructor(private readonly appContext: AppContext,
		private readonly _account: AzureAccount,
		private readonly _tenantNode: TreeNode,
		private readonly treeChangeHandler: IAzureResourceTreeChangeHandler) {
	}

	public get isLoading(): boolean {
		return this._isLoading;
	}

	public get nodes(): TreeNode[] {
		return this._nodes;
	}

	public async start(): Promise<void> {
		if (this._isLoading) {
			return;
		}
		this._isLoading = true;
		this._nodes = [];
		this._onLoadingStatusChanged.fire();

		let tenants = this._account.properties.tenants;

		if (tenants?.length > 0) {
			this._nodes.push(...tenants.map(tenant => new FlatTenantTreeNode(this._account, tenant, this.appContext, this.treeChangeHandler)));
			this._nodes = this.nodes.sort((a, b) => {
				return a.getNodeInfo().label.localeCompare(b.getNodeInfo().label);
			});
		}

		// Create "No Resources Found" message node if no resources found under azure account.
		if (this._nodes.length === 0) {
			this._nodes.push(AzureResourceMessageTreeNode.create(localize('azure.resource.flatAccountTreeNode.noTenantsLabel', "No Tenants found."), this._tenantNode))
		}

		this._isLoading = false;
		this._onLoadingStatusChanged.fire();
	}
}
