/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const standardWidth: string = '480px';

// Deploy Azure SQL DB wizard constants
export const WizardTitle = localize('deployAzureSQLDB.NewSQLDBTitle', "Deploy Azure SQL DB");
export const WizardDoneButtonLabel = localize('deployAzureSQLDB.ScriptToNotebook', "Script to Notebook");
export const MissingRequiredInformationErrorMessage = localize('deployCluster.MissingRequiredInfoError', "Please fill out the required fields marked with red asterisks.");

// Azure settings page constants
export const AzureSettingsPageTitle = localize('deployAzureSQLDB.AzureSettingsPageTitle', "Azure settings");
export const AzureSettingsPageDescription = localize('deployAzureSQLDB.AzureSettingsPageDescription', "");
export const AzureAccountDropdownLabel = localize('deployAzureSQLDB.AzureAccountDropdownLabel', "Azure Account");
export const AzureAccountSubscriptionDropdownLabel = localize('deployAzureSQLDB.AzureSubscriptionDropdownLabel', "Subscription");
export const AzureAccountDatabaseServersDropdownLabel = localize('deployAzureSQLDB.AzureDatabaseServersDropdownLabel', "Server");
export const AzureAccountResourceGroupDropdownLabel = localize('deployAzureSQLDB.ResourceGroup', "Resource Group");
export const AzureAccountRegionDropdownLabel = localize('deployAzureSQLDB.AzureRegionDropdownLabel', "Region");

// VM settings page constants
export const VmSettingsPageTitle = localize('deployeAzureSQLVM.VmSettingsPageTitle', "Virtual machine settings");
export const VmSettingsPageDescription = localize('deployAzureSQLVM.VmSettingsPageDescription', "");
export const VmNameTextBoxLabel = localize('deployAzureSQLVM.VmNameTextBoxLabel', "Virtual machine name");
export const VmAdminUsernameTextBoxLabel = localize('deployAzureSQLVM.VmAdminUsernameTextBoxLabel', "Administrator account username");
export const VmAdminPasswordTextBoxLabel = localize('deployAzureSQLVM.VmAdminPasswordTextBoxLabel', "Administrator account password");
export const VmAdminConfirmPasswordTextBoxLabel = localize('deployAzureSQLVM.VmAdminConfirmPasswordTextBoxLabel', "Confirm password");
export const VmImageDropdownLabel = localize('deployAzureSQLVM.VmImageDropdownLabel', "Image");
export const VmSkuDropdownLabel = localize('deployAzureSQLVM.VmSkuDropdownLabel', "Image SKU");
export const VmVersionDropdownLabel = localize('deployAzureSQLVM.VmImageVersionDropdownLabel', "Image Version");
export const VmSizeDropdownLabel = localize('deployAzureSQLVM.VmSizeDropdownLabel', "Size");

// Network settings page constants
export const NetworkSettingsPageTitle = localize('deployAzureSQLVM.NetworkSettingsPageTitle', "Networking");
export const NetworkSettingsPageDescription = localize('deployAzureSQLVM.NetworkSettingsPageDescription', "Configure network settings");
export const NetworkSettingsNewVirtualNetwork = localize('deployAzureSQLVM.NetworkSettingsNewVirtualNetwork', 'New virtual network');
export const VirtualNetworkDropdownLabel = localize('deployAzureSQLVM.VirtualNetworkDropdownLabel', "Virtual Network");
export const NetworkSettingsNewSubnet = localize('deployAzureSQLVM.NetworkSettingsNewSubnet', "New subnet");
export const SubnetDropdownLabel = localize('deployAzureSQLVM.SubnetDropdownLabel', "Subnet");
export const PublicIPDropdownLabel = localize('deployAzureSQLVM.PublicIPDropdownLabel', "Public IP");
export const NetworkSettingsNewPublicIp = localize('deployAzureSQLVM.NetworkSettingsUseExistingPublicIp', 'New public ip');
export const RDPAllowCheckboxLabel = localize('deployAzureSQLVM.VmRDPAllowCheckboxLabel', "Enable RDP(3389) inbound Port");

// SQL Server settings page constants
export const SqlServerSettingsPageTitle = localize('deployAzureSQLVM', "SQL Servers settings");
