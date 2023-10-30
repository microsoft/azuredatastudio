/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureAccount, Tenant, azureResource } from 'azurecore';

export interface GraphData {
	subscriptionId: string,
	subscriptionName?: string,
	tenantId: string;
	id: string;
	name: string;
	location: string;
	type: string;
	resourceGroup: string;
}

export interface AzureMonitorGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
		uri: string;
		customerId: string
	};
}

export interface SqlInstanceArcGraphData extends GraphData {
	properties: {
		admin: string;
		hybridDataManager: string;
	};
}

export interface PostgresArcServerGraphData extends GraphData {
	properties: {
		admin: string;
	};
}

export interface DatabaseGraphData extends GraphData {
	kind: string;
}

export interface SynapseGraphData extends GraphData {
	kind: string;
}

export interface DbServerGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
		connectionString: string;
	};
}

export interface KustoGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
		uri: string;
	};
}

export interface SqlInstanceGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
	};
}

/**
 * Properties combined from all providers to create a universal interface that can be translated to any resource provider.
 */
export interface UniversalGraphData extends GraphData {
	kind?: string,
	properties?: {
		/**
		 * SQL connectivity endpoint and other endpoints are found here, instead of fullyQualifiedDomainName.
		 */
		connectivityEndpoints?: { sql: string };
		/**
		 * managedResourceGroupName is the resource group used by any SQL pools inside the workspace
		 * which is different from the resource group of the workspace itself.
		 */
		managedResourceGroupName?: string;
		/**
		 * administratorLogin is called sqlAdministratorLogin for Synapse.
		 */
		sqlAdministratorLogin?: string;

		admin?: string;

		hybridDataManager?: string;

		fullyQualifiedDomainName?: string;

		administratorLogin?: string;

		uri?: string;

		customerId?: string
	}
}

/**
 * Properties returned by the Synapse query are different from the server ones and have to be treated differently.
 */
export interface SynapseWorkspaceGraphData extends GraphData {
	properties: {
		/**
		 * SQL connectivity endpoint and other endpoints are found here, instead of fullyQualifiedDomainName.
		 */
		connectivityEndpoints: { sql: string };
		/**
		 * managedResourceGroupName is the resource group used by any SQL pools inside the workspace
		 * which is different from the resource group of the workspace itself.
		 */
		managedResourceGroupName: string;
		/**
		 * administratorLogin is called sqlAdministratorLogin here.
		 */
		sqlAdministratorLogin: string;
	};
}

export interface IAzureResourceSubscriptionService {
	/**
	 * Gets subscriptions for the given account. Any errors that occur while fetching the subscriptions for each tenant
	 * will be displayed to the user, but this function will only throw an error if it's unable to fetch any subscriptions.
	 * @param account The account to get the subscriptions for
	 * @param tenantIds The list of tenant IDs to get subscriptions for - if undefined then subscriptions for all tenants will be retrieved
	 * @returns The list of all subscriptions on this account that were able to be retrieved
	 */
	getSubscriptions(account: AzureAccount, tenantIds?: string[] | undefined): Promise<azureResource.AzureResourceSubscription[]>;
}

export interface IAzureResourceTenantFilterService {
	getSelectedTenants(account: AzureAccount): Promise<Tenant[]>;
	saveSelectedTenants(account: AzureAccount, selectedTenants: Tenant[]): Promise<void>;
}

export interface IAzureResourceSubscriptionFilterService {
	getSelectedSubscriptions(account: AzureAccount, tenant: Tenant): Promise<azureResource.AzureResourceSubscription[]>;
	saveSelectedSubscriptions(account: AzureAccount, tenant: Tenant, selectedSubscriptions: azureResource.AzureResourceSubscription[]): Promise<void>;
}

export interface IAzureTerminalService {
	getOrCreateCloudConsole(account: AzureAccount, tenant: Tenant): Promise<void>;
}

export interface IAzureResourceCacheService {
	generateKey(id: string): string;

	get<T>(key: string): T | undefined;

	update<T>(key: string, value: T): Promise<void>;
}

export interface IAzureResourceDbService<S extends GraphData, T extends GraphData> extends azureResource.IAzureResourceService {
	convertDatabaseResource(resource: T, server?: S): azureResource.AzureResource | undefined;
}

export interface IAzureResourceServerService<T extends GraphData> extends azureResource.IAzureResourceService {
	convertServerResource(resource: T): azureResource.AzureResource | undefined;
}
