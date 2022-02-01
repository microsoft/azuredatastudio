/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { ExtHostContext, MainThreadTreeViewsShape, ExtHostTreeViewsShape, MainContext, IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { ITreeViewDataProvider, ITreeItem, IViewsService, ITreeView, IViewsRegistry, ITreeViewDescriptor, IRevealOptions, Extensions, ResolvableTreeItem, ITreeViewDragAndDropController, ITreeDataTransfer } from 'vs/workbench/common/views';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { distinct } from 'vs/base/common/arrays';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { isUndefinedOrNull, isNumber } from 'vs/base/common/types';
import { Registry } from 'vs/platform/registry/common/platform';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { ILogService } from 'vs/platform/log/common/log';
import { IConnectionTreeService } from 'sql/workbench/services/connection/common/connectionTreeService'; // {{SQL CARBON EDIT}} Add our tree service
import { TreeDataTransferConverter } from 'vs/workbench/api/common/shared/treeDataTransfer';

@extHostNamedCustomer(MainContext.MainThreadTreeViews)
export class MainThreadTreeViews extends Disposable implements MainThreadTreeViewsShape {

	private readonly _proxy: ExtHostTreeViewsShape;
	private readonly _dataProviders: Map<string, TreeViewDataProvider> = new Map<string, TreeViewDataProvider>();

	constructor(
		extHostContext: IExtHostContext,
		@IViewsService private readonly viewsService: IViewsService,
		@INotificationService private readonly notificationService: INotificationService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@ILogService private readonly logService: ILogService,
		@IConnectionTreeService private readonly connectionTreeService: IConnectionTreeService
	) {
		super();
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostTreeViews);
	}

	async $registerTreeViewDataProvider(treeViewId: string, options: { showCollapseAll: boolean, canSelectMany: boolean, canDragAndDrop: boolean }): Promise<void> {
		this.logService.trace('MainThreadTreeViews#$registerTreeViewDataProvider', treeViewId, options);

		this.extensionService.whenInstalledExtensionsRegistered().then(() => {
			const dataProvider = new TreeViewDataProvider(treeViewId, this._proxy, this.notificationService);
			this._dataProviders.set(treeViewId, dataProvider);
			const dndController = options.canDragAndDrop ? new TreeViewDragAndDropController(treeViewId, this._proxy) : undefined;
			const viewer = this.getTreeView(treeViewId);
			if (viewer) {
				// Order is important here. The internal tree isn't created until the dataProvider is set.
				// Set all other properties first!
				viewer.showCollapseAllAction = !!options.showCollapseAll;
				viewer.canSelectMany = !!options.canSelectMany;
				viewer.dragAndDropController = dndController;
				viewer.dataProvider = dataProvider;
				this.registerListeners(treeViewId, viewer);
				this._proxy.$setVisible(treeViewId, viewer.visible);
				// {{SQL CARBON EDIT}}
			} else if (treeViewId.includes('connectionDialog')) {
				this.connectionTreeService.registerTreeProvider(treeViewId, dataProvider);
			} else {
				this.notificationService.error('No view is registered with id: ' + treeViewId);
			}
		});
	}

	$reveal(treeViewId: string, itemInfo: { item: ITreeItem, parentChain: ITreeItem[] } | undefined, options: IRevealOptions): Promise<void> {
		this.logService.trace('MainThreadTreeViews#$reveal', treeViewId, itemInfo?.item, itemInfo?.parentChain, options);

		return this.viewsService.openView(treeViewId, options.focus)
			.then(() => {
				const viewer = this.getTreeView(treeViewId);
				if (viewer && itemInfo) {
					return this.reveal(viewer, this._dataProviders.get(treeViewId)!, itemInfo.item, itemInfo.parentChain, options);
				}
				return undefined;
			});
	}

	$refresh(treeViewId: string, itemsToRefreshByHandle: { [treeItemHandle: string]: ITreeItem }): Promise<void> {
		this.logService.trace('MainThreadTreeViews#$refresh', treeViewId, itemsToRefreshByHandle);

		const viewer = this.getTreeView(treeViewId);
		const dataProvider = this._dataProviders.get(treeViewId);
		if (viewer && dataProvider) {
			const itemsToRefresh = dataProvider.getItemsToRefresh(itemsToRefreshByHandle);
			return viewer.refresh(itemsToRefresh.length ? itemsToRefresh : undefined);
			// {{SQL CARBON EDIT}}
		} else if (treeViewId.includes('connectionDialog')) {
			const itemsToRefresh = dataProvider.getItemsToRefresh(itemsToRefreshByHandle);
			return this.connectionTreeService.view?.refresh(itemsToRefresh.length ? itemsToRefresh : undefined);
		}
		return Promise.resolve();
	}

	$setMessage(treeViewId: string, message: string): void {
		this.logService.trace('MainThreadTreeViews#$setMessage', treeViewId, message);

		const viewer = this.getTreeView(treeViewId);
		if (viewer) {
			viewer.message = message;
		}
	}

	$setTitle(treeViewId: string, title: string, description: string | undefined): void {
		this.logService.trace('MainThreadTreeViews#$setTitle', treeViewId, title, description);

		const viewer = this.getTreeView(treeViewId);
		if (viewer) {
			viewer.title = title;
			viewer.description = description;
		}
	}

	private async reveal(treeView: ITreeView, dataProvider: TreeViewDataProvider, itemIn: ITreeItem, parentChain: ITreeItem[], options: IRevealOptions): Promise<void> {
		options = options ? options : { select: false, focus: false };
		const select = isUndefinedOrNull(options.select) ? false : options.select;
		const focus = isUndefinedOrNull(options.focus) ? false : options.focus;
		let expand = Math.min(isNumber(options.expand) ? options.expand : options.expand === true ? 1 : 0, 3);

		if (dataProvider.isEmpty()) {
			// Refresh if empty
			await treeView.refresh();
		}
		for (const parent of parentChain) {
			const parentItem = dataProvider.getItem(parent.handle);
			if (parentItem) {
				await treeView.expand(parentItem);
			}
		}
		const item = dataProvider.getItem(itemIn.handle);
		if (item) {
			await treeView.reveal(item);
			if (select) {
				treeView.setSelection([item]);
			}
			if (focus) {
				treeView.setFocus(item);
			}
			let itemsToExpand = [item];
			for (; itemsToExpand.length > 0 && expand > 0; expand--) {
				await treeView.expand(itemsToExpand);
				itemsToExpand = itemsToExpand.reduce((result, itemValue) => {
					const item = dataProvider.getItem(itemValue.handle);
					if (item && item.children && item.children.length) {
						result.push(...item.children);
					}
					return result;
				}, [] as ITreeItem[]);
			}
		}
	}

	private registerListeners(treeViewId: string, treeView: ITreeView): void {
		this._register(treeView.onDidExpandItem(item => this._proxy.$setExpanded(treeViewId, item.handle, true)));
		this._register(treeView.onDidCollapseItem(item => this._proxy.$setExpanded(treeViewId, item.handle, false)));
		this._register(treeView.onDidChangeSelection(items => this._proxy.$setSelection(treeViewId, items.map(({ handle }) => handle))));
		this._register(treeView.onDidChangeVisibility(isVisible => this._proxy.$setVisible(treeViewId, isVisible)));
	}

	private getTreeView(treeViewId: string): ITreeView | null {
		const viewDescriptor: ITreeViewDescriptor = <ITreeViewDescriptor>Registry.as<IViewsRegistry>(Extensions.ViewsRegistry).getView(treeViewId);
		return viewDescriptor ? viewDescriptor.treeView : null;
	}

	override dispose(): void {
		this._dataProviders.forEach((dataProvider, treeViewId) => {
			const treeView = this.getTreeView(treeViewId);
			if (treeView) {
				treeView.dataProvider = undefined;
			}
		});
		this._dataProviders.clear();
		super.dispose();
	}
}

// {{SQL CARBON EDIT}}
export type TreeItemHandle = string;

class TreeViewDragAndDropController implements ITreeViewDragAndDropController {

	constructor(private readonly treeViewId: string,
		private readonly _proxy: ExtHostTreeViewsShape) { }

	async onDrop(dataTransfer: ITreeDataTransfer, targetTreeItem: ITreeItem): Promise<void> {
		return this._proxy.$onDrop(this.treeViewId, await TreeDataTransferConverter.toTreeDataTransferDTO(dataTransfer), targetTreeItem.handle);
	}
}

// {{SQL CARBON EDIT}}
export class TreeViewDataProvider implements ITreeViewDataProvider {

	protected readonly itemsMap: Map<TreeItemHandle, ITreeItem> = new Map<TreeItemHandle, ITreeItem>(); // {{SQL CARBON EDIT}} For use by Component Tree View
	protected hasResolve: Promise<boolean>; // {{SQL CARBON EDIT}} For use by Component Tree View

	// {{SQL CARBON EDIT}}
	constructor(protected readonly treeViewId: string,
		protected readonly _proxy: ExtHostTreeViewsShape,
		private readonly notificationService: INotificationService
	) {
		this.hasResolve = this._proxy.$hasResolve(this.treeViewId);
	}

	getChildren(treeItem?: ITreeItem): Promise<ITreeItem[] | undefined> {
		return this._proxy.$getChildren(this.treeViewId, treeItem ? treeItem.handle : undefined)
			.then(
				children => this.postGetChildren(children),
				err => {
					this.notificationService.error(err);
					return [];
				});
	}

	getItemsToRefresh(itemsToRefreshByHandle: { [treeItemHandle: string]: ITreeItem }): ITreeItem[] {
		const itemsToRefresh: ITreeItem[] = [];
		if (itemsToRefreshByHandle) {
			for (const treeItemHandle of Object.keys(itemsToRefreshByHandle)) {
				const currentTreeItem = this.getItem(treeItemHandle);
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

	getItem(treeItemHandle: string): ITreeItem | undefined {
		return this.itemsMap.get(treeItemHandle);
	}

	isEmpty(): boolean {
		return this.itemsMap.size === 0;
	}

	protected async postGetChildren(elements: ITreeItem[] | undefined): Promise<ITreeItem[] | undefined> { // {{SQL CARBON EDIT}} For use by Component Tree View
		if (elements === undefined) {
			return undefined;
		}
		const result: ITreeItem[] = []; // {{SQL CARBON EDIT}} We don't always return ResolvableTreeItems
		const hasResolve = await this.hasResolve;
		if (elements) {
			for (const element of elements) {
				// {{SQL CARBON EDIT}} We rely on custom properties on the tree items in a number of places so creating a new item here was
				// {{SQL CARBON EDIT}} clearing those. Revert to old behavior if the provider doesn't support a resolve (our normal case)
				if (hasResolve) {
					const resolvable = new ResolvableTreeItem(element, hasResolve ? (token) => {
						return this._proxy.$resolve(this.treeViewId, element.handle, token);
					} : undefined);
					this.itemsMap.set(element.handle, resolvable);
					result.push(resolvable);
				} else {
					this.itemsMap.set(element.handle, element);
					result.push(element);
				}
			}
		}
		return result;
	}

	private updateTreeItem(current: ITreeItem, treeItem: ITreeItem): void {
		treeItem.children = treeItem.children ? treeItem.children : undefined;
		if (current) {
			const properties = distinct([...Object.keys(current instanceof ResolvableTreeItem ? current.asTreeItem() : current),
			...Object.keys(treeItem)]);
			for (const property of properties) {
				(<any>current)[property] = (<any>treeItem)[property];
			}
			if (current instanceof ResolvableTreeItem) {
				current.resetResolve();
			}
		}
	}
}
