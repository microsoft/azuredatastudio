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
	}

	export interface AzureSqlResource extends AzureResource {
		loginName: string;
	}

	export interface AzureResourceSubscription extends AzureResource {
		id: string;
		name: string;
	}

	export interface AzureResourceResourceGroup extends AzureResource {
		subscriptionId: string;
	}

	export interface AzureResourceDatabase extends AzureSqlResource {
		serverName: string;
		serverFullName: string;
	}

	export interface AzureResourceDatabaseServer extends AzureSqlResource {
		id?: string;
		fullName: string;
		defaultDatabaseName: string;
	}


}
