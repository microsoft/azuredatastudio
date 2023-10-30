/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem } from 'vscode';
import { DataProvider, Account } from 'azdata';

export namespace cmsResource {
	export interface ICmsResourceProvider extends DataProvider {
		getTreeDataProvider(): ICmsResourceTreeDataProvider;
	}

	export interface ICmsResourceTreeDataProvider extends TreeDataProvider<ICmsResourceNode> {
	}

	export interface ICmsResourceNode {
		readonly treeItem: TreeItem;
	}
}
