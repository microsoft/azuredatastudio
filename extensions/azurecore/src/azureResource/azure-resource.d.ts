/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider } from 'vscode';
import { DataProvider, Account, TreeItem } from 'azdata';

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

	export interface AzureResource {
		name: string;
		id: string;
		tenant?: string;
	}

	export interface AzureResourceSubscription extends AzureResource {
	}

	export interface AzureSqlResource extends AzureResource {
		loginName: string;
	}

	export interface AzureResourceResourceGroup extends AzureResource {
	}

	export interface AzureResourceDatabase extends AzureSqlResource {
		serverName: string;
		serverFullName: string;
	}

	export interface AzureResourceDatabaseServer extends AzureSqlResource {
		fullName: string;
		defaultDatabaseName: string;
	}


}
