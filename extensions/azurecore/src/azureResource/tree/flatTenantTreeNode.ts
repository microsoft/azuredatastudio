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
import { AzureSubscriptionError } from '../errors';
import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceItemType, AzureResourceServiceNames } from '../constants';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { IAzureResourceSubscriptionService, IAzureResourceSubscriptionFilterService } from '../interfaces';
import { AzureAccount, Tenant, azureResource } from 'azurecore';
import { AzureResourceService } from '../resourceService';
import { AzureResourceResourceTreeNode } from '../resourceTreeNode';
import { AzureResourceErrorMessageUtil } from '../utils';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';

export class FlatTenantTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		public readonly account: AzureAccount,
		public readonly tenant: Tenant,
		appContext: AppContext,
		treeChangeHandler: IAzureResourceTreeChangeHandler,
	) {
		super(appContext, treeChangeHandler, undefined);

		this._subscriptionService = this.appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
		this._subscriptionFilterService = this.appContext.getService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService);
		this._resourceService = this.appContext.getService<AzureResourceService>(AzureResourceServiceNames.resourceService);

		this._id = `account_${this.account.key.accountId}_tenant_${tenant.id}`;
		this.setCacheKey(`${this._id}.dataresources`);
		this._label = tenant.displayName;
		this._loader = new FlatTenantTreeNodeLoader(appContext, this._resourceService, this._subscriptionService, this._subscriptionFilterService, this.account, this.tenant, this);
		this._loader.onNewResourcesAvailable(() => {
			this.treeChangeHandler.notifyNodeChanged(this);
		});

		this._loader.onLoadingStatusChanged(async () => {
			await this.updateLabel();
			this.treeChangeHandler.notifyNodeChanged(this);
		});
	}

	public async updateLabel(): Promise<void> {
		const subscriptionInfo = await getSubscriptionInfo(this.account, this.tenant, this._subscriptionService, this._subscriptionFilterService);
		if (this._loader.isLoading) {
			this._label = localize('azure.resource.tree.tenantTreeNode.titleLoading', "{0} - Loading...", this.tenant.displayName);
		} else if (subscriptionInfo.total !== 0) {
			this._label = localize({
				key: 'azure.resource.tree.tenantTreeNode.title',
				comment: [
					'{0} is the display name of the azure tenant',
					'{1} is the number of selected subscriptions in this tenant',
					'{2} is the number of total subscriptions in this tenant'
				]
			}, "{0} ({1}/{2} subscriptions)", this.tenant.displayName, subscriptionInfo.selected, subscriptionInfo.total);
		} else {
			this._label = this.tenant.displayName;
		}
	}

	public async getChildren(): Promise<TreeNode[]> {
		if (this._isClearingCache) {
			this._loader.start().catch(err => console.error('Error loading Azure FlatTenantTreeNode ', err));
			this._isClearingCache = false;
			return [];
		} else {
			return this._loader.nodes;
		}
	}

	public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		const item = new vscode.TreeItem(this._label, vscode.TreeItemCollapsibleState.Collapsed);
		item.id = this._id;
		item.contextValue = AzureResourceItemType.tenant;
		item.iconPath = {
			dark: this.appContext.extensionContext.asAbsolutePath('resources/dark/type_hierarchy_inverse.svg'),
			light: this.appContext.extensionContext.asAbsolutePath('resources/light/type_hierarchy.svg')
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
			nodeType: AzureResourceItemType.tenant,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.tenant
		};
	}

	public get nodePathValue(): string {
		return this._id;
	}

	private _subscriptionService: IAzureResourceSubscriptionService;
	private _subscriptionFilterService: IAzureResourceSubscriptionFilterService;
	private _resourceService: AzureResourceService;
	private _loader: FlatTenantTreeNodeLoader;
	private _id: string;
	private _label: string;
}

async function getSubscriptionInfo(account: AzureAccount, tenant: Tenant, subscriptionService: IAzureResourceSubscriptionService, subscriptionFilterService: IAzureResourceSubscriptionFilterService): Promise<{
	subscriptions: azureResource.AzureResourceSubscription[],
	total: number,
	selected: number
}> {
	let subscriptions = await subscriptionService.getSubscriptions(account, [tenant.id]);
	const total = subscriptions.length;
	let selected = total;

	const selectedSubscriptions = await subscriptionFilterService.getSelectedSubscriptions(account, tenant);
	const selectedSubscriptionIds = (selectedSubscriptions || <azureResource.AzureResourceSubscription[]>[]).map((subscription) => subscription.id);
	if (selectedSubscriptionIds.length > 0) {
		subscriptions = subscriptions.filter((subscription) => selectedSubscriptionIds.indexOf(subscription.id) !== -1);
		selected = selectedSubscriptionIds.length;
	}
	return {
		subscriptions,
		total,
		selected
	};
}
class FlatTenantTreeNodeLoader {

	private _isLoading: boolean = false;
	private _nodes: TreeNode[] = [];
	private readonly _onNewResourcesAvailable = new vscode.EventEmitter<void>();
	public readonly onNewResourcesAvailable = this._onNewResourcesAvailable.event;
	private readonly _onLoadingStatusChanged = new vscode.EventEmitter<void>();
	public readonly onLoadingStatusChanged = this._onLoadingStatusChanged.event;

	constructor(private readonly appContext: AppContext,
		private readonly _resourceService: AzureResourceService,
		private readonly _subscriptionService: IAzureResourceSubscriptionService,
		private readonly _subscriptionFilterService: IAzureResourceSubscriptionFilterService,
		private readonly _account: AzureAccount,
		private readonly _tenant: Tenant,
		private readonly _tenantNode: TreeNode) {
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
		let newNodesAvailable = false;

		// Throttle the refresh events to at most once per 500ms
		const refreshHandle = setInterval(() => {
			if (newNodesAvailable) {
				this._onNewResourcesAvailable.fire();
				newNodesAvailable = false;
			}
			if (!this.isLoading) {
				clearInterval(refreshHandle);
			}
		}, 500);
		try {
			let subscriptions: azureResource.AzureResourceSubscription[] = (await getSubscriptionInfo(this._account, this._tenant, this._subscriptionService, this._subscriptionFilterService)).subscriptions;
			const resources = await this._resourceService.getAllChildren(this._account, subscriptions, true);
			if (resources?.length > 0) {
				this._nodes.push(...resources.map(dr => new AzureResourceResourceTreeNode(dr, this._tenantNode, this.appContext)));
				this._nodes = this.nodes.sort((a, b) => {
					return a.getNodeInfo().label.localeCompare(b.getNodeInfo().label);
				});
				newNodesAvailable = true;
			}
			// Create "No Resources Found" message node if no resources found under azure account.
			if (this._nodes.length === 0) {
				this._nodes.push(AzureResourceMessageTreeNode.create(localize('azure.resource.flatTenantTreeNode.noResourcesLabel', "No Resources found."), this._tenantNode));
			}
		} catch (error) {
			if (error instanceof AzureSubscriptionError) {
				void vscode.commands.executeCommand('azure.resource.signin');
			}
			// http status code 429 means "too many requests"
			// use a custom error message for azure resource graph api throttling error to make it more actionable for users.
			const errorMessage = error?.statusCode === 429 ? localize('azure.resource.throttleerror', "Requests from this tenant have been throttled. To retry, please select a smaller number of subscriptions.") : AzureResourceErrorMessageUtil.getErrorMessage(error);
			void vscode.window.showErrorMessage(localize('azure.resource.tree.loadresourceerror', "An error occurred while loading Azure resources: {0}", errorMessage));
		}

		this._isLoading = false;
		this._onLoadingStatusChanged.fire();
	}
}
