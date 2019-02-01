/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { Disposable } from 'vs/base/common/lifecycle';
import { ExtHostContext, MainThreadTreeViewsShape, ExtHostTreeViewsShape, MainContext, IExtHostContext } from '../node/extHost.protocol';
import { ITreeViewDataProvider, ITreeItem, IViewsService, ITreeViewer, ViewsRegistry, ICustomViewDescriptor, TreeItemCollapsibleState } from 'vs/workbench/common/views';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { distinct } from 'vs/base/common/arrays';
import { INotificationService } from 'vs/platform/notification/common/notification';

// {{SQL CARBON EDIT}}
import { IObjectExplorerService } from 'sql/parts/objectExplorer/common/objectExplorerService';
import * as sqlops from 'sqlops';
import { Emitter } from 'vs/base/common/event';
import { generateUuid } from 'vs/base/common/uuid';

@extHostNamedCustomer(MainContext.MainThreadTreeViews)
export class MainThreadTreeViews extends Disposable implements MainThreadTreeViewsShape {

	private _proxy: ExtHostTreeViewsShape;
	private _dataProviders: Map<string, TreeViewDataProvider> = new Map<string, TreeViewDataProvider>();

	constructor(
		extHostContext: IExtHostContext,
		@IViewsService private viewsService: IViewsService,
		@INotificationService private notificationService: INotificationService,
		// {{SQL CARBON EDIT}}
		@IObjectExplorerService private objectExplorerService: IObjectExplorerService
	) {
		super();
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostTreeViews);
	}

	$registerTreeViewDataProvider(treeViewId: string): void {
		const dataProvider = new TreeViewDataProvider(treeViewId, this._proxy, this.notificationService);
		this._dataProviders.set(treeViewId, dataProvider);
		// {{SQL CARBON EDIT}}
		if (this.checkForDataExplorer(treeViewId)) {
			return;
		}
		const viewer = this.getTreeViewer(treeViewId);
		if (viewer) {
			viewer.dataProvider = dataProvider;
			this.registerListeners(treeViewId, viewer);
			this._proxy.$setVisible(treeViewId, viewer.visible);
		} else {
			this.notificationService.error('No view is registered with id: ' + treeViewId);
		}
	}

	$reveal(treeViewId: string, item: ITreeItem, parentChain: ITreeItem[], options: { select: boolean, focus: boolean }): TPromise<void> {
		return this.viewsService.openView(treeViewId, options.focus)
			.then(() => {
				const viewer = this.getTreeViewer(treeViewId);
				return viewer ? viewer.reveal(item, parentChain, options) : null;
			});
	}

	$refresh(treeViewId: string, itemsToRefreshByHandle: { [treeItemHandle: string]: ITreeItem }): TPromise<void> {
		const viewer = this.getTreeViewer(treeViewId);
		const dataProvider = this._dataProviders.get(treeViewId);
		if (viewer && dataProvider) {
			const itemsToRefresh = dataProvider.getItemsToRefresh(itemsToRefreshByHandle);
			return viewer.refresh(itemsToRefresh.length ? itemsToRefresh : void 0);
		}
		return TPromise.as(null);
	}

	private registerListeners(treeViewId: string, treeViewer: ITreeViewer): void {
		this._register(treeViewer.onDidExpandItem(item => this._proxy.$setExpanded(treeViewId, item.handle, true)));
		this._register(treeViewer.onDidCollapseItem(item => this._proxy.$setExpanded(treeViewId, item.handle, false)));
		this._register(treeViewer.onDidChangeSelection(items => this._proxy.$setSelection(treeViewId, items.map(({ handle }) => handle))));
		this._register(treeViewer.onDidChangeVisibility(isVisible => this._proxy.$setVisible(treeViewId, isVisible)));
	}

	private getTreeViewer(treeViewId: string): ITreeViewer {
		const viewDescriptor: ICustomViewDescriptor = <ICustomViewDescriptor>ViewsRegistry.getView(treeViewId);
		return viewDescriptor ? viewDescriptor.treeViewer : null;
	}

	// {{SQL CARBON EDIT}}
	private checkForDataExplorer(treeViewId: string): boolean {
		const viewDescriptor: ICustomViewDescriptor = <ICustomViewDescriptor>ViewsRegistry.getView(treeViewId);
		if (viewDescriptor.container.id === 'workbench.view.dataExplorer') {
			const dataProvider = new OETreeViewDataProvider(treeViewId, this._proxy);
			this.objectExplorerService.registerProvider(treeViewId, dataProvider);
			dataProvider.registerOnExpandCompleted(e => this.objectExplorerService.onNodeExpanded(undefined, e));
		}
		return false;
	}

	dispose(): void {
		this._dataProviders.forEach((dataProvider, treeViewId) => {
			const treeViewer = this.getTreeViewer(treeViewId);
			if (treeViewer) {
				treeViewer.dataProvider = null;
			}
		});
		this._dataProviders.clear();
		super.dispose();
	}
}

// {{SQL CARBON EDIT}}
export type TreeItemHandle = string;

// {{SQL CARBON EDIT}}
export class TreeViewDataProvider implements ITreeViewDataProvider {

	// {{SQL CARBON EDIT}}
	protected itemsMap: Map<TreeItemHandle, ITreeItem> = new Map<TreeItemHandle, ITreeItem>();

	// {{SQL CARBON EDIT}}
	constructor(protected treeViewId: string,
		protected _proxy: ExtHostTreeViewsShape,
		protected notificationService: INotificationService
	) {
	}

	getChildren(treeItem?: ITreeItem): TPromise<ITreeItem[]> {
		if (treeItem && treeItem.children) {
			return TPromise.as(treeItem.children);
		}
		return this._proxy.$getChildren(this.treeViewId, treeItem ? treeItem.handle : void 0)
			.then(children => {
				return this.postGetChildren(children);
			}, err => {
				this.notificationService.error(err);
				return [];
			});
	}

	getItemsToRefresh(itemsToRefreshByHandle: { [treeItemHandle: string]: ITreeItem }): ITreeItem[] {
		const itemsToRefresh: ITreeItem[] = [];
		if (itemsToRefreshByHandle) {
			for (const treeItemHandle of Object.keys(itemsToRefreshByHandle)) {
				const currentTreeItem = this.itemsMap.get(treeItemHandle);
				if (currentTreeItem) { // Refresh only if the item exists
					const treeItem = itemsToRefreshByHandle[treeItemHandle];
					// Update the current item with refreshed item
					this.updateTreeItem(currentTreeItem, treeItem);
					if (treeItemHandle === treeItem.handle) {
						itemsToRefresh.push(currentTreeItem);
					} else {
						// Update maps when handle is changed and refresh parent
						this.itemsMap.delete(treeItemHandle);
						this.itemsMap.set(currentTreeItem.handle, currentTreeItem);
						const parent = treeItem.parentHandle ? this.itemsMap.get(treeItem.parentHandle) : null;
						if (parent) {
							itemsToRefresh.push(parent);
						}
					}
				}
			}
		}
		return itemsToRefresh;
	}

	private postGetChildren(elements: ITreeItem[]): ITreeItem[] {
		const result = [];
		if (elements) {
			for (const element of elements) {
				this.itemsMap.set(element.handle, element);
				result.push(element);
			}
		}
		return result;
	}

	private updateTreeItem(current: ITreeItem, treeItem: ITreeItem): void {
		treeItem.children = treeItem.children ? treeItem.children : null;
		if (current) {
			const properties = distinct([...Object.keys(current), ...Object.keys(treeItem)]);
			for (const property of properties) {
				current[property] = treeItem[property];
			}
		}
	}
}

// {{SQL CARBON EDIT}}
export class OETreeViewDataProvider implements sqlops.ObjectExplorerProvider {

	protected itemsMap: Map<TreeItemHandle, ITreeItem> = new Map<TreeItemHandle, ITreeItem>();
	private onExpandComplete = new Emitter<sqlops.ObjectExplorerExpandInfo>();
	private onSessionCreated = new Emitter<sqlops.ObjectExplorerSession>();

	private sessionId: string;

	handle: number;
	readonly providerId = this.treeViewId;

	constructor(protected treeViewId: string,
		protected _proxy: ExtHostTreeViewsShape
	) {
	}

	public createNewSession(connInfo: sqlops.ConnectionInfo): Thenable<sqlops.ObjectExplorerSessionResponse> {
		// no op
		this.sessionId = generateUuid();
		return TPromise.as({ sessionId: this.sessionId });
	}

	public expandNode(nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
		this._proxy.$getChildren(this.treeViewId, nodeInfo.nodePath).then(e => {
			this.onExpandComplete.fire({
				errorMessage: undefined,
				nodePath: nodeInfo.nodePath,
				nodes: e.map(e => {
					return <sqlops.NodeInfo>{
						nodePath: e.handle,
						label: e.label,
						iconType: e.icon,
						isLeaf: e.collapsibleState === TreeItemCollapsibleState.None,
						provider: e.providerHandle,
						payload: e.payload
					};
				}),
				sessionId: this.sessionId
			});
		});
		return TPromise.as(true);
	}

	public refreshNode(nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
		// no op
		return TPromise.as(true);
	}

	public closeSession(closeSessionInfo: sqlops.ObjectExplorerCloseSessionInfo): Thenable<sqlops.ObjectExplorerCloseSessionResponse> {
		// no op
		return TPromise.as({ sessionId: undefined, success: true });
	}

	public findNodes(findNodesInfo: sqlops.FindNodesInfo): Thenable<sqlops.ObjectExplorerFindNodesResponse> {
		// no op
		return TPromise.as({ nodes: [] });
	}

	public registerOnSessionCreated(handler: (response: sqlops.ObjectExplorerSession) => any): void {
		// no op
		return;
	}

	public registerOnSessionDisconnected?(handler: (response: sqlops.ObjectExplorerSession) => any): void {
		// no op
		return;
	}

	public registerOnExpandCompleted(handler: (response: sqlops.ObjectExplorerExpandInfo) => any): void {
		this.onExpandComplete.event(handler);
		return;
	}
}
