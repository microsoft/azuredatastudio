/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const standardWidth: string = '480px';

// Deploy Azure SQL VM wizard constants
export const WizardTitle = localize('deployAzureSQLVM.NewSQLVMTitle', "Deploy Azure SQL VM");
export const WizardDoneButtonLabel = localize('deployAzureSQLVM.ScriptToNotebook', "Script to Notebook");
export const MissingRequiredInformationErrorMessage = localize('deployAzureSQLVM.MissingRequiredInfoError', "Please fill out the required fields marked with red asterisks.");

// Azure settings page constants
export const AzureSettingsPageTitle = localize('deployAzureSQLVM.AzureSettingsPageTitle', "Azure settings");
export const AzureAccountDropdownLabel = localize('deployAzureSQLVM.AzureAccountDropdownLabel', "Azure Account");
export const AzureAccountSubscriptionDropdownLabel = localize('deployAzureSQLVM.AzureSubscriptionDropdownLabel', "Subscription");
export const AzureAccountResourceGroupDropdownLabel = localize('deployAzureSQLVM.ResourceGroup', "Resource Group");
export const AzureAccountRegionDropdownLabel = localize('deployAzureSQLVM.AzureRegionDropdownLabel', "Region");

// VM settings page constants
export const VmSettingsPageTitle = localize('deployeAzureSQLVM.VmSettingsPageTitle', "Virtual machine settings");
export const VmNameTextBoxLabel = localize('deployAzureSQLVM.VmNameTextBoxLabel', "Virtual machine name");
export const VmAdminUsernameTextBoxLabel = localize('deployAzureSQLVM.VmAdminUsernameTextBoxLabel', "Administrator account username");
export const VmAdminPasswordTextBoxLabel = localize('deployAzureSQLVM.VmAdminPasswordTextBoxLabel', "Administrator account password");
export const VmAdminConfirmPasswordTextBoxLabel = localize('deployAzureSQLVM.VmAdminConfirmPasswordTextBoxLabel', "Confirm password");
export const VmImageDropdownLabel = localize('deployAzureSQLVM.VmImageDropdownLabel', "Image");
export const VmSkuDropdownLabel = localize('deployAzureSQLVM.VmSkuDropdownLabel', "Image SKU");
export const VmVersionDropdownLabel = localize('deployAzureSQLVM.VmImageVersionDropdownLabel', "Image Version");
export const VmSizeDropdownLabel = localize('deployAzureSQLVM.VmSizeDropdownLabel', "Size");
export const VmSizeLearnMoreLabel = localize('deployeAzureSQLVM.VmSizeLearnMoreLabel', "Click here to learn more about pricing and supported VM sizes");

// Network settings page constants
export const NetworkSettingsPageTitle = localize('deployAzureSQLVM.NetworkSettingsPageTitle', "Networking");
export const NetworkSettingsPageDescription = localize('deployAzureSQLVM.NetworkSettingsPageDescription', "Configure network settings");
export const NetworkSettingsNewVirtualNetwork = localize('deployAzureSQLVM.NetworkSettingsNewVirtualNetwork', "New virtual network");
export const VirtualNetworkDropdownLabel = localize('deployAzureSQLVM.VirtualNetworkDropdownLabel', "Virtual Network");
export const NetworkSettingsNewSubnet = localize('deployAzureSQLVM.NetworkSettingsNewSubnet', "New subnet");
export const SubnetDropdownLabel = localize('deployAzureSQLVM.SubnetDropdownLabel', "Subnet");
export const PublicIPDropdownLabel = localize('deployAzureSQLVM.PublicIPDropdownLabel', "Public IP");
export const NetworkSettingsNewPublicIp = localize('deployAzureSQLVM.NetworkSettingsUseExistingPublicIp', "New public ip");
export const RDPAllowCheckboxLabel = localize('deployAzureSQLVM.VmRDPAllowCheckboxLabel', "Enable Remote Desktop (RDP) inbound port (3389)");

// SQL Server settings page constants
export const SqlServerSettingsPageTitle = localize('deployAzureSQLVM.SqlServerSettingsPageTitle', "SQL Servers settings");
export const SqlConnectivityTypeDropdownLabel = localize('deployAzureSQLVM.SqlConnectivityTypeDropdownLabel', "SQL connectivity");
export const SqlPortLabel = localize('deployAzureSQLVM.SqlPortLabel', "Port");
export const SqlEnableSQLAuthenticationLabel = localize('deployAzureSQLVM.SqlEnableSQLAuthenticationLabel', "Enable SQL authentication");
export const SqlAuthenticationUsernameLabel = localize('deployAzureSQLVM.SqlAuthenticationUsernameLabel', "Username");
export const SqlAuthenticationPasswordLabel = localize('deployAzureSQLVM.SqlAuthenticationPasswordLabel', "Password");
export const SqlAuthenticationConfirmPasswordLabel = localize('deployAzureSQLVM.SqlAuthenticationConfirmPasswordLabel', "Confirm password");
