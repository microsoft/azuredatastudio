/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { Event } from 'vs/base/common/event';
import { ITreeViewDataProvider, ITreeItem } from 'vs/workbench/common/views';

export interface ITreeComponentItem extends ITreeItem {
	checked?: boolean;
	onCheckedChanged?: (checked: boolean) => void;
	children?: ITreeComponentItem[];
}

export interface IModelViewTreeViewDataProvider extends ITreeViewDataProvider {
	refresh(itemsToRefreshByHandle: { [treeItemHandle: string]: ITreeComponentItem });
}

export interface IModelViewTreeViewDataProvider {
	onDidChange: Event<ITreeComponentItem[] | undefined | null>;

	onDispose: Event<void>;

	getChildren(element?: ITreeComponentItem): TPromise<ITreeComponentItem[]>;
}