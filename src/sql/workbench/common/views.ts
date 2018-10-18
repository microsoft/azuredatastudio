/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITreeViewDataProvider, ITreeItem } from 'vs/workbench/common/views';

export interface ITreeComponentItem extends ITreeItem {
	checked?: boolean;
	enabled?: boolean;
	onCheckedChanged?: (checked: boolean) => void;
	children?: ITreeComponentItem[];
}

export interface IModelViewTreeViewDataProvider extends ITreeViewDataProvider {
	refresh(itemsToRefreshByHandle: { [treeItemHandle: string]: ITreeComponentItem });
}
