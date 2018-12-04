/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { ServiceClientCredentials } from 'ms-rest';

declare module 'sqlops' {
	export namespace azureResource {
		export interface IAzureResourceProvider extends sqlops.DataProvider {
			getTreeDataProvider(): IAzureResourceTreeDataProvider;
		}

		export interface IAzureResourceTreeDataProvider extends vscode.TreeDataProvider<IAzureResourceNode> {
		}

		export interface IAzureResourceNode {
			readonly account: sqlops.Account;
			readonly subscription: AzureResourceSubscription;
			readonly tenantId: string;
			readonly treeItem: vscode.TreeItem;
		}

		export interface AzureResourceSubscription {
			id: string;
			name: string;
		}
	}
}