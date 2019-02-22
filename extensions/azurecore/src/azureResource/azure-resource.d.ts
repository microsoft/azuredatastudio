/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider } from 'vscode';
import { DataProvider, Account } from 'sqlops';
import { TreeItem } from 'sqlops';

export namespace azureResource {
	export interface IAzureResourceProvider extends DataProvider {
		getTreeDataProvider(): IAzureResourceTreeDataProvider;
	}

	export interface IAzureResourceTreeDataProvider extends TreeDataProvider<IAzureResourceNode> {
	}

	export interface IAzureResourceNode {
		readonly account: Account;
		readonly subscription: AzureResourceSubscription;
		readonly tenantId: string;
		readonly treeItem: TreeItem;
	}

	export interface AzureResourceSubscription {
		id: string;
		name: string;
	}
}