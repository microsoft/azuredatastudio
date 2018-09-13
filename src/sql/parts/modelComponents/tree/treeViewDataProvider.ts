/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ExtHostModelViewTreeViewsShape, SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { IModelViewTreeViewDataProvider, ITreeComponentItem } from 'sql/workbench/common/views';
import { INotificationService } from 'vs/platform/notification/common/notification';
import * as vsTreeView from 'vs/workbench/api/electron-browser/mainThreadTreeViews';
import { TPromise } from 'vs/base/common/winjs.base';

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
}
