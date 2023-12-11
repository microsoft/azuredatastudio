/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azurecore';
import * as Constants from '../constants';

export const where = `where `;
/**
 * Lists all SQL Databases and Synapse SQL Databases
 */
export const sqlDatabaseQuery = `type == "${azureResource.AzureResourceType.sqlDatabase}" or type == "${azureResource.AzureResourceType.sqlSynapseSqlDatabase}"`;

/**
 * Lists all Synapse Workspaces with information such as SQL connection endpoints.
 */
export const synapseWorkspacesQuery = `type == "${azureResource.AzureResourceType.sqlSynapseWorkspace}"`;

/**
 * Lists all Synapse Dedicated SQL Pools
 */
export const synapseSqlPoolsQuery = `type == "${azureResource.AzureResourceType.sqlSynapseSqlPool}"`;

/**
 * Lists all Sql Servers excluding Synapse Pool Servers
 * (they have different properties and need to be handled separately)
 */
export const sqlServerQuery = `type == "${azureResource.AzureResourceType.sqlServer}" and kind != "${Constants.analyticsKind}"`;

/**
 * Lists all Azure Arc SQL Managed Instances
 */
export const sqlInstanceArcQuery = `type == "${azureResource.AzureResourceType.azureArcSqlManagedInstance}"`;

/**
 * Lists all Azure SQL Managed Instances
 */
export const sqlInstanceQuery = `type == "${azureResource.AzureResourceType.sqlManagedInstance}"`;

/**
 * Lists all resource containers and resource groups
 */
export const resourceGroupQuery = `ResourceContainers | where type=="${azureResource.AzureResourceType.resourceGroup}"`;

/**
 * Lists all postgreSQL servers
 */
export const postgresServerQuery = `type == "${azureResource.AzureResourceType.postgresServer}" or type == "${azureResource.AzureResourceType.postgresServerv2}" or type == "${azureResource.AzureResourceType.postgresSingleServer}"`;

/**
 * Lists all postgreSQL flexible servers
 */
export const postgresFlexibleServerQuery = `type == "${azureResource.AzureResourceType.postgresFlexibleServer}"`;

/**
 * Lists all Azure Arc PostgreSQL servers
 */
export const postgresArcServerQuery = `type == "${azureResource.AzureResourceType.azureArcPostgresServer}"`;

/**
 * Lists all MySQL Flexible servers
 */
export const mysqlFlexibleServerQuery = `type == "${azureResource.AzureResourceType.mysqlFlexibleServer}"`;

/**
 * Lists all Kusto Clusters
 */
export const kustoClusterQuery = `type == "${azureResource.AzureResourceType.kustoClusters}"`;

/**
 * Lists all Cosmos DB for MongoDB accounts
 */
export const cosmosMongoDbQuery = `(type == "${azureResource.AzureResourceType.cosmosDbAccount}" and kind == "${Constants.mongoDbKind}") or type == "${azureResource.AzureResourceType.cosmosDbMongoCluster}"`;

/**
 * Lists all Cosmos DB for MongoDB accounts
 */
export const cosmosPostgresDbQuery = `type == "${azureResource.AzureResourceType.postgresServerGroup}" or type == "${azureResource.AzureResourceType.postgresServerGroupv2}"`;

/**
 * Lists all Cosmos DB for NoSQL accounts
 */
export const cosmosNoSqlQuery = `type == "${azureResource.AzureResourceType.cosmosDbAccount}" and kind == "${Constants.cosmosDbNoSqlKind}"`;

/**
 * Lists all Log Analytics workspaces
 */
export const logAnalyticsQuery = `type == "${azureResource.AzureResourceType.logAnalytics}"`;
