/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITreeViewDataProvider, ITreeItem as vsITreeItem } from 'vs/workbench/common/views';
import { IConnectionProfile } from 'sqlops';

export interface ITreeComponentItem extends vsITreeItem {
	checked?: boolean;
	enabled?: boolean;
	onCheckedChanged?: (checked: boolean) => void;
	children?: ITreeComponentItem[];
}

export interface IModelViewTreeViewDataProvider extends ITreeViewDataProvider {
	refresh(itemsToRefreshByHandle: { [treeItemHandle: string]: ITreeComponentItem });
}

export interface ITreeItem extends vsITreeItem {
	providerHandle?: string;
	childProvider?: string;
	payload?: IConnectionProfile; // its possible we will want this to be more generic
}
