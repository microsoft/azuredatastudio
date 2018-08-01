/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ExtHostModelViewTreeViewsShape, SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { Event, Emitter } from 'vs/base/common/event';
import { TPromise } from 'vs/base/common/winjs.base';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { IModelViewTreeViewDataProvider, ITreeComponentItem } from 'sql/workbench/common/views';
import { distinct } from 'vs/base/common/arrays';
import { INotificationService } from 'vs/platform/notification/common/notification';

export type TreeItemHandle = string;

export class TreeViewDataProvider implements IModelViewTreeViewDataProvider {

	private readonly _onDidChange: Emitter<ITreeComponentItem[] | undefined | null> = new Emitter<ITreeComponentItem[] | undefined | null>();
	readonly onDidChange: Event<ITreeComponentItem[] | undefined | null> = this._onDidChange.event;

	private readonly _onDispose: Emitter<void> = new Emitter<void>();
	readonly onDispose: Event<void> = this._onDispose.event;

	private itemsMap: Map<TreeItemHandle, ITreeComponentItem> = new Map<TreeItemHandle, ITreeComponentItem>();
	private _proxy: ExtHostModelViewTreeViewsShape;

	constructor(private treeViewId: string,
		context: IExtHostContext,
		private notificationService?: INotificationService
	) {
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostModelViewTreeViews);
	}

	onNodeCheckedChanged(treeViewId: string, treeItemHandle?: string, checked?: boolean) {
		this._proxy.$onNodeCheckedChanged(treeViewId, treeItemHandle, checked);
	}

	getChildren(treeItem?: ITreeComponentItem): TPromise<ITreeComponentItem[]> {
		if (treeItem && treeItem.children) {
			return TPromise.as(treeItem.children);
		}
		return this._proxy.$getChildren(this.treeViewId, treeItem ? treeItem.handle : void 0)
			.then(children => {
				return this.postGetChildren(children);
			}, err => {
				if (this.notificationService) {
					this.notificationService.error(err);
				}
				return [];
			});
	}

	refresh(itemsToRefreshByHandle: { [treeItemHandle: string]: ITreeComponentItem }) {
		const itemsToRefresh: ITreeComponentItem[] = [];
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
		if (itemsToRefresh.length) {
			this._onDidChange.fire(itemsToRefresh);
		} else {
			this._onDidChange.fire();
		}
	}

	private postGetChildren(elements: ITreeComponentItem[]): ITreeComponentItem[] {
		const result = [];
		if (elements) {
			for (const element of elements) {
				element.onCheckedChanged = (checked: boolean) => {
					this.onNodeCheckedChanged(this.treeViewId, element.handle, checked);
				};
				this.itemsMap.set(element.handle, element);
				result.push(element);
			}
		}
		return result;
	}

	private updateTreeItem(current: ITreeComponentItem, treeItem: ITreeComponentItem): void {
		treeItem.children = treeItem.children ? treeItem.children : null;
		if (current) {
			const properties = distinct([...Object.keys(current), ...Object.keys(treeItem)]);
			for (const property of properties) {
				current[property] = treeItem[property];
			}
		}
	}

	dispose(): void {
		this._onDispose.fire();
	}
}
