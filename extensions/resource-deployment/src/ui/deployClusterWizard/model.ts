/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
export const DeploymentProfile_VariableName = 'AZDATA_NB_VAR_DEPLOYMENT_PROFILE';
export const ClusterName_VariableName = 'AZDATA_NB_VAR_CLUSTER_NAME';
export const AdminUserName_VariableName = 'AZDATA_NB_VAR_ADMIN_USERNAME';
export const AdminPassword_VariableName = 'AZDATA_NB_VAR_ADMIN_PASSWORD';
export const AuthenticationMode_VariableName = 'AZDATA_NB_VAR_AUTHENTICATION_MODE';
export const DistinguishedName_VariableName = 'AZDATA_NB_VAR_AD_DN';
export const AdminPrincipals_VariableName = 'AZDATA_NB_VAR_AD_ADMIN_PRINCIPALS';
export const UserPrincipals_VariableName = 'AZDATA_NB_VAR_AD_USER_PRINCIPALS';
export const UpstreamIPAddresses_VariableName = 'AZDATA_NB_VAR_AD_UPSTREAM_IPADDRESSES';
export const DnsName_VariableName = 'AZDATA_NB_VAR_AD_DNS_NAME';
export const Realm_VariableName = 'AZDATA_NB_VAR_AD_REALM';
export const AppOwnerPrincipals_VariableName = 'AZDATA_NB_VAR_AD_APP_OWNER_PRINCIPALS';
export const AppReaderPrincipals_VariableName = 'AZDATA_NB_VAR_AD_APP_READER_PRINCIPALS';
export const SubscriptionId_VariableName = 'AZDATA_NB_VAR_BDC_AZURE_SUBSCRIPTION';
export const ResourceGroup_VariableName = 'AZDATA_NB_VAR_BDC_RESOURCEGROUP_NAME';
export const Region_VariableName = 'AZDATA_NB_VAR_BDC_AZURE_REGION';
export const AksName_VariableName = 'AZDATA_NB_VAR_BDC_AKS_NAME';
export const VMSize_VariableName = 'AZDATA_NB_VAR_BDC_AZURE_VM_SIZE';
export const VMCount_VariableName = 'AZDATA_NB_VAR_BDC_VM_COUNT';
export const KubeConfigPath_VariableName = 'AZDATA_NB_VAR_BDC_CONFIG_PATH';
export const ClusterContext_VariableName = 'AZDATA_NB_VAR_BDC_CLUSTER_CONTEXT';

export type WizardModel = { [s: string]: string | undefined };
