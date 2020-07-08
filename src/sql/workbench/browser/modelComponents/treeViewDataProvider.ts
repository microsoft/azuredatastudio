/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// eslint-disable-next-line code-import-patterns
import { ExtHostModelViewTreeViewsShape, SqlExtHostContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
// eslint-disable-next-line code-import-patterns
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { IModelViewTreeViewDataProvider, ITreeComponentItem } from 'sql/workbench/common/views';
import { INotificationService } from 'vs/platform/notification/common/notification';
// eslint-disable-next-line code-import-patterns
import * as vsTreeView from 'vs/workbench/api/browser/mainThreadTreeViews';
import { ResolvableTreeItem } from 'vs/workbench/common/views';
import { deepClone } from 'vs/base/common/objects';

export class ResolvableTreeComponentItem extends ResolvableTreeItem implements ITreeComponentItem {

	checked?: boolean;
	enabled?: boolean;
	onCheckedChanged?: (checked: boolean) => void;
	children?: ITreeComponentItem[];

	constructor(treeItem: ITreeComponentItem, resolve?: (() => Promise<ITreeComponentItem | undefined>)) {
		super(treeItem, resolve);
		this.checked = treeItem.checked;
		this.enabled = treeItem.enabled;
		this.onCheckedChanged = treeItem.onCheckedChanged;
		this.children = deepClone(treeItem.children);
	}
}

export class TreeViewDataProvider extends vsTreeView.TreeViewDataProvider implements IModelViewTreeViewDataProvider {
	constructor(handle: number, treeViewId: string,
		context: IExtHostContext,
		notificationService?: INotificationService
	) {
		super(`${handle}-${treeViewId}`, context.getProxy(SqlExtHostContext.ExtHostModelViewTreeViews), notificationService);
	}

	onNodeCheckedChanged(treeItemHandle?: string, checked?: boolean) {
		(<ExtHostModelViewTreeViewsShape>this._proxy).$onNodeCheckedChanged(this.treeViewId, treeItemHandle, checked);
	}

	onNodeSelected(items: ITreeComponentItem[]) {
		if (items) {
			(<ExtHostModelViewTreeViewsShape>this._proxy).$onNodeSelected(this.treeViewId, items.map(i => i.handle));
		}
	}

	refresh(itemsToRefreshByHandle: { [treeItemHandle: string]: ITreeComponentItem }) {
	}

	/**
	 * Returns the set of mapped ResolvableTreeComponentItems
	 * @override
	 * @param elements The elements to map
	 */
	protected async postGetChildren(elements: ITreeComponentItem[]): Promise<ResolvableTreeComponentItem[]> {
		const result: ResolvableTreeComponentItem[] = [];
		const hasResolve = await this.hasResolve;
		if (elements) {
			for (const element of elements) {
				const resolvable = new ResolvableTreeComponentItem(element, hasResolve ? () => {
					return this._proxy.$resolve(this.treeViewId, element.handle);
				} : undefined);
				this.itemsMap.set(element.handle, resolvable);
				result.push(resolvable);
			}
		}
		return result;
	}
}
