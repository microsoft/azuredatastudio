/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'azureResource' {
	import { TreeDataProvider } from 'vscode';
	import { DataProvider, TreeItem } from 'azdata';
	import { BlobItem } from '@azure/storage-blob';
	import { AzureAccount } from 'azurecore';

	export namespace azureResource {

		/**
		 * AzureCore core extension supports following resource types of Azure Resource Graph.
		 * To add more resources, please refer this guide: https://docs.microsoft.com/en-us/azure/governance/resource-graph/reference/supported-tables-resources
		 */
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
			azureArcService = 'microsoft.azuredata/datacontrollers',
			storageAccount = 'microsoft.storage/storageaccounts',
			azureMonitorLogs = 'microsoft.operationalinsights/workspaces'
		}

		export interface IAzureResourceProvider extends DataProvider {
			getTreeDataProvider(): IAzureResourceTreeDataProvider;
		}

		export interface IAzureResourceTreeDataProvider extends TreeDataProvider<IAzureResourceNode> {
			browseConnectionMode: boolean;
		}

		export interface IAzureResourceNode {
			readonly account: AzureAccount;
			readonly subscription: AzureResourceSubscription;
			readonly tenantId: string;
			readonly treeItem: TreeItem;
		}

		export interface IAzureSubscriptionInfo {
			id: string;
			name: string;
		}

		export interface AzureResource {
			name: string;
			id: string;
			subscription: IAzureSubscriptionInfo;
			resourceGroup?: string;
			tenant?: string;
		}

		export interface AzureResourceSubscription extends Omit<AzureResource, 'subscription'> {
		}

		export interface AzureSqlResource extends AzureResource {
			loginName: string;
		}

		export interface AzureGraphResource extends Omit<AzureResource, 'tenant' | 'subscription'> {
			tenantId: string;
			subscriptionId: string;
			type: string;
			location: string;
		}

		export interface AzureResourceResourceGroup extends AzureResource {
			location?: string;
			managedBy?: string;
			properties?: {
				provisioningState?: string
			};
			type?: string;
		}

		export interface AzureLocation {
			id: string,
			name: string,
			displayName: string,
			regionalDisplayName: string,
			metadata: {
				regionType: string,
				regionCategory: string,
				geographyGroup: string,
				longitude: number,
				latitude: number,
				physicalLocation: string,
				pairedRegion: {
					name: string,
					id: string,
				}[],
			},
		}

		export interface AzureSqlManagedInstance extends AzureGraphResource {
			sku: {
				capacity: number;
				family: string;
				name: string;
				tier: 'GeneralPurpose' | 'BusinessCritical';
			},
			properties: {
				provisioningState: string,
				storageAccountType: string,
				maintenanceConfigurationId: string,
				state: string,
				licenseType: string,
				zoneRedundant: false,
				fullyQualifiedDomainName: string,
				collation: string,
				administratorLogin: string,
				minimalTlsVersion: string,
				subnetId: string,
				publicDataEndpointEnabled: boolean,
				storageSizeInGB: number,
				timezoneId: string,
				proxyOverride: string,
				vCores: number,
				dnsZone: string,
			}

		}

		export interface ManagedDatabase {
			id: string,
			location: string,
			name: string,
			properties: {
				sourceDatabaseId: string,
				status: string
			},
			type: string
		}

		export interface AzureResourceDatabase extends AzureSqlResource {
			serverName: string;
			serverFullName: string;
		}

		export interface AzureResourceDatabaseServer extends AzureSqlResource {
			fullName: string;
			defaultDatabaseName: string;
		}
		export interface BlobContainer extends AzureResource { }

		export interface FileShare extends AzureResource { }

		export interface Blob extends BlobItem { }
	}
}
