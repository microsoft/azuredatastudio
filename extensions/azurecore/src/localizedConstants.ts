/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const extensionName = localize('azurecore.extensionName', "Azure Accounts");

export const requiresReload = localize('azurecore.requiresReload', "Modifying this setting requires reloading the window for all changes to take effect.");
export const reload = localize('azurecore.reload', "Reload");

export const australiaCentral = localize('azurecore.australiacentral', "Australia Central");
export const australiaCentral2 = localize('azurecore.australiacentral2', "Australia Central 2");
export const australiaEast = localize('azurecore.australiaeast', "Australia East");
export const australiaSouthEast = localize('azurecore.australiasoutheast', "Australia Southeast");
export const brazilSouth = localize('azurecore.brazilsouth', "Brazil South");
export const brazilSouthEast = localize('azurecore.brazilsoutheast', "Brazil Southeast");
export const canadaCentral = localize('azurecore.canadacentral', "Canada Central");
export const canadaEast = localize('azurecore.canadaeast', "Canada East");
export const centralIndia = localize('azurecore.centralindia', "Central India");
export const centralUS = localize('azurecore.centralus', "Central US");
export const centralUSEUAP = localize('azurecore.centraluseuap', "Central US EUAP");
export const eastAsia = localize('azurecore.eastasia', "East Asia");
export const eastUS = localize('azurecore.eastus', "East US");
export const eastUS2 = localize('azurecore.eastus2', "East US 2");
export const eastUS2EUAP = localize('azurecore.eastus2euap', "East US 2 EUAP");
export const franceCentral = localize('azurecore.francecentral', "France Central");
export const franceSouth = localize('azurecore.francesouth', "France South");
export const germanyNorth = localize('azurecore.germanynorth', "Germany North");
export const germanyWestCentral = localize('azurecore.germanywestcentral', "Germany West Central");
export const japanEast = localize('azurecore.japaneast', "Japan East");
export const japanWest = localize('azurecore.japanwest', "Japan West");
export const koreaCentral = localize('azurecore.koreacentral', "Korea Central");
export const koreaSouth = localize('azurecore.koreasouth', "Korea South");
export const northCentralUS = localize('azurecore.northcentralus', "North Central US");
export const northEurope = localize('azurecore.northeurope', "North Europe");
export const norwayEast = localize('azurecore.norwayeast', "Norway East");
export const norwayWest = localize('azurecore.norwaywest', "Norway West");
export const southAfricaNorth = localize('azurecore.southafricanorth', "South Africa North");
export const southAfricaWest = localize('azurecore.southafricawest', "South Africa West");
export const southCentralUS = localize('azurecore.southcentralus', "South Central US");
export const southEastAsia = localize('azurecore.southeastasia', "Southeast Asia");
export const southIndia = localize('azurecore.southindia', "South India");
export const switzerlandNorth = localize('azurecore.switzerlandnorth', "Switzerland North");
export const switzerlandWest = localize('azurecore.switzerlandwest', "Switzerland West");
export const uaeCentral = localize('azurecore.uaecentral', "UAE Central");
export const uaeNorth = localize('azurecore.uaenorth', "UAE North");
export const ukSouth = localize('azurecore.uksouth', "UK South");
export const ukWest = localize('azurecore.ukwest', "UK West");
export const westCentralUS = localize('azurecore.westcentralus', "West Central US");
export const westEurope = localize('azurecore.westeurope', "West Europe");
export const westIndia = localize('azurecore.westindia', "West India");
export const westUS = localize('azurecore.westus', "West US");
export const westUS2 = localize('azurecore.westus2', "West US 2");

export const name = localize('azurecore.name', "Name");
export const resourceType = localize('azurecore.resourceType', "Resource type");
export const resourceGroup = localize('azurecore.resourceGroup', "Resource group");
export const location = localize('azurecore.location', "Location");
export const subscription = localize('azurecore.subscription', "Subscription");
export const typeIcon = localize('azurecore.typeIcon', "Type Icon");

// Azure Resource Types
export const sqlServer = localize('azurecore.sqlServer', "SQL server");
export const sqlDatabase = localize('azurecore.sqlDatabase', "SQL database");
export const postgresServer = localize('azurecore.postgresServer', "Azure Database for PostgreSQL server");
export const sqlManagedInstance = localize('azurecore.sqlManagedInstance', "SQL managed instance");
export const azureArcsqlManagedInstance = localize('azurecore.azureArcsqlManagedInstance', "SQL managed instance - Azure Arc");
export const azureArcService = localize('azurecore.azureArcService', "Data Service - Azure Arc");
export const sqlServerArc = localize('azurecore.sqlServerArc', "SQL Server - Azure Arc");
export const azureArcPostgresServer = localize('azurecore.azureArcPostgres', "Azure Arc enabled PostgreSQL Hyperscale");

export const unableToOpenAzureLink = localize('azure.unableToOpenAzureLink', "Unable to open link, missing required values");
export const azureResourcesGridTitle = localize('azure.azureResourcesGridTitle', "Azure Resources (Preview)");

// Azure Request Errors
export const invalidAzureAccount = localize('azurecore.invalidAzureAccount', "Invalid account");
export const invalidTenant = localize('azurecore.invalidTenant', "Invalid tenant for subscription");
export function unableToFetchTokenError(tenant: string): string {
	return localize('azurecore.unableToFetchToken', "Unable to get token for tenant {0}", tenant);
}
