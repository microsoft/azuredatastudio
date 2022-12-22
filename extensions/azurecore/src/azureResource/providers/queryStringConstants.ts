/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azurecore';

/**
 * Lists all SQL Databases and Synapse SQL Databases
 */
export const sqlDatabaseQuery = `where type == "${azureResource.AzureResourceType.sqlDatabase}" or type == "${azureResource.AzureResourceType.sqlSynapseSqlDatabase}"`;

/**
 * Lists all Synapse Workspaces with information such as SQL connection endpoints.
 */
export const synapseWorkspacesQuery = `where type == "${azureResource.AzureResourceType.sqlSynapseWorkspace}"`;

/**
 * Lists all Synapse Dedicated SQL Pools
 */
export const synapseSqlPoolsQuery = `where type == "${azureResource.AzureResourceType.sqlSynapseSqlPool}"`;

/**
 * Lists all Sql Servers excluding Synapse Pool Servers
 * (they have different properties and need to be handled separately)
 */
export const sqlServerQuery = `where type == "${azureResource.AzureResourceType.sqlServer}" and kind != "v12.0,analytics"`;

/**
 * Lists all Azure Arc SQL Managed Instances
 */
export const sqlInstanceArcQuery = `where type == "${azureResource.AzureResourceType.azureArcSqlManagedInstance}"`;

/**
 * Lists all Azure SQL Managed Instances
 */
export const sqlInstanceQuery = `where type == "${azureResource.AzureResourceType.sqlManagedInstance}"`;

/**
 * Lists all resource containers and resource groups
 */
export const resourceGroupQuery = `ResourceContainers | where type=="${azureResource.AzureResourceType.resourceGroup}"`;

/**
 * Lists all postgreSQL servers
 */
export const postgresServerQuery = `where type == "${azureResource.AzureResourceType.postgresServer}"`;

/**
 * Lists all Azure Arc PostgreSQL servers
 */
export const postgresArcServerQuery = `where type == "${azureResource.AzureResourceType.azureArcPostgresServer}"`;

/**
 * Lists all MySQL Flexible servers
 */
export const mysqlFlexibleServerQuery = `where type == "${azureResource.AzureResourceType.mysqlFlexibleServer}"`;

/**
 * Lists all Kusto Clusters
 */
export const kustoClusterQuery = `where type == "${azureResource.AzureResourceType.kustoClusters}"`;

/**
 * Lists all Cosmos DB for MongoDB accounts
 */
export const cosmosMongoDbQuery = `where type == "${azureResource.AzureResourceType.cosmosDbAccount}" and kind == "MongoDB"`;

/**
 * Lists all Log Analytics workspaces
 */
export const logAnalyticsQuery = `where type == "${azureResource.AzureResourceType.logAnalytics}"`;
