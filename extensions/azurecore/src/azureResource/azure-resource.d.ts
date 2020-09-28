/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'azureResource' {
	import { TreeDataProvider } from 'vscode';
	import { DataProvider, Account, TreeItem } from 'azdata';
	export namespace azureResource {

		export const enum AzureResourceType {
			resourceGroup = 'microsoft.resources/subscriptions/resourcegroups',
			sqlServer = 'microsoft.sql/servers',
			sqlDatabase = 'microsoft.sql/servers/databases',
			sqlManagedInstance = 'microsoft.sql/managedinstances',
			azureArcSqlManagedInstance = 'microsoft.azuredata/sqlmanagedinstances',
			virtualMachines = 'microsoft.compute/virtualmachines',
			kustoClusters = 'microsoft.kusto/clusters',
			azureArcPostgresServer = 'microsoft.azuredata/postgresinstances',
			postgresServer = 'microsoft.dbforpostgresql/servers',
			azureArcService = 'microsoft.azuredata/datacontrollers'
		}

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
			subscriptionId: string;
			tenant?: string;
		}

		export interface AzureResourceSubscription extends Omit<AzureResource, 'subscriptionId'> {
		}

		export interface AzureSqlResource extends AzureResource {
			loginName: string;
		}

		export interface AzureGraphResource extends Omit<AzureResource, 'tenant'> {
			tenantId: string;
			type: string;
			location: string;
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
}
