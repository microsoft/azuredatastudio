/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { ProviderSettings, SettingIds } from './interfaces';
import { AzureResource } from 'azdata';
import { updateCustomCloudProviderSettings } from '../utils';

const localize = nls.loadMessageBundle();

const publicAzureSettings: ProviderSettings = {
	configKey: 'enablePublicCloud',
	metadata: {
		displayName: localize('publicCloudDisplayName', "Azure"),
		id: 'azure_publicCloud',
		settings: {
			host: 'https://login.microsoftonline.com/',
			clientId: 'a69788c6-1d43-44ed-9ca3-b83e194da255',
			microsoftResource: {
				id: SettingIds.marm,
				endpoint: 'https://management.core.windows.net/',
				azureResourceId: AzureResource.MicrosoftResourceManagement
			},
			msGraphResource: {
				id: SettingIds.msgraph,
				endpoint: 'https://graph.microsoft.com/',
				azureResourceId: AzureResource.MsGraph
			},
			armResource: {
				id: SettingIds.arm,
				endpoint: 'https://management.azure.com/',
				azureResourceId: AzureResource.ResourceManagement
			},
			sqlResource: {
				id: SettingIds.sql,
				endpoint: 'https://database.windows.net/',
				azureResourceId: AzureResource.Sql
			},
			ossRdbmsResource: {
				id: SettingIds.ossrdbms,
				endpoint: 'https://ossrdbms-aad.database.windows.net/',
				azureResourceId: AzureResource.OssRdbms
			},
			azureKeyVaultResource: {
				id: SettingIds.vault,
				endpoint: 'https://vault.azure.net/',
				azureResourceId: AzureResource.AzureKeyVault
			},
			azureDevOpsResource: {
				id: SettingIds.ado,
				endpoint: '499b84ac-1321-427f-aa17-267ca6975798/',
				azureResourceId: AzureResource.AzureDevOps,
			},
			azureLogAnalyticsResource: {
				id: SettingIds.ala,
				endpoint: 'https://api.loganalytics.io/',
				azureResourceId: AzureResource.AzureLogAnalytics,
			},
			azureStorageResource: {
				id: SettingIds.storage,
				endpoint: '',
				endpointSuffix: '.core.windows.net/',
				azureResourceId: AzureResource.AzureStorage
			},
			azureKustoResource: {
				id: SettingIds.kusto,
				endpoint: 'https://kusto.kusto.windows.net/',
				azureResourceId: AzureResource.AzureKusto,
			},
			powerBiResource: {
				id: SettingIds.powerbi,
				endpoint: 'https://analysis.windows.net/powerbi/api/',
				azureResourceId: AzureResource.PowerBi
			},
			redirectUri: 'http://localhost',
			scopes: [
				'openid', 'email', 'profile', 'offline_access',
				'https://management.azure.com/user_impersonation',
			],
			portalEndpoint: 'https://portal.azure.com'
		}
	}
};


const usGovAzureSettings: ProviderSettings = {
	configKey: 'enableUsGovCloud',
	metadata: {
		displayName: localize('usGovCloudDisplayName', "Azure (US Government)"),
		id: 'azure_usGovtCloud',
		settings: {
			host: 'https://login.microsoftonline.us/',
			clientId: 'a69788c6-1d43-44ed-9ca3-b83e194da255',
			microsoftResource: {
				id: SettingIds.marm,
				endpoint: 'https://management.core.usgovcloudapi.net/',
				azureResourceId: AzureResource.MicrosoftResourceManagement
			},
			msGraphResource: {
				id: SettingIds.msgraph,
				endpoint: 'https://graph.microsoft.us/',
				azureResourceId: AzureResource.MsGraph
			},
			armResource: {
				id: SettingIds.arm,
				endpoint: 'https://management.usgovcloudapi.net/',
				azureResourceId: AzureResource.ResourceManagement
			},
			sqlResource: {
				id: SettingIds.sql,
				endpoint: 'https://database.usgovcloudapi.net/',
				azureResourceId: AzureResource.Sql
			},
			ossRdbmsResource: {
				id: SettingIds.ossrdbms,
				endpoint: 'https://ossrdbms-aad.database.usgovcloudapi.net/',
				azureResourceId: AzureResource.OssRdbms
			},
			azureKeyVaultResource: {
				id: SettingIds.vault,
				endpoint: 'https://vault.usgovcloudapi.net/',
				azureResourceId: AzureResource.AzureKeyVault
			},
			azureLogAnalyticsResource: {
				id: SettingIds.ala,
				endpoint: 'https://api.loganalytics.us/',
				azureResourceId: AzureResource.AzureLogAnalytics,
			},
			azureStorageResource: {
				id: SettingIds.storage,
				endpoint: '',
				endpointSuffix: '.core.usgovcloudapi.net/',
				azureResourceId: AzureResource.AzureStorage
			},
			azureKustoResource: {
				id: SettingIds.kusto,
				endpoint: 'https://kusto.kusto.usgovcloudapi.net',
				azureResourceId: AzureResource.AzureKusto,
			},
			powerBiResource: {
				id: SettingIds.powerbi,
				endpoint: 'https://analysis.windows.net/powerbi/api/',
				azureResourceId: AzureResource.PowerBi
			},
			redirectUri: 'http://localhost',
			scopes: [
				'openid', 'email', 'profile', 'offline_access',
				'https://management.usgovcloudapi.net/user_impersonation'
			],
			portalEndpoint: 'https://portal.azure.us'
		}
	}
};

const chinaAzureSettings: ProviderSettings = {
	configKey: 'enableChinaCloud',
	metadata: {
		displayName: localize('chinaCloudDisplayName', "Azure (China)"),
		id: 'azure_chinaCloud',
		settings: {
			host: 'https://login.partner.microsoftonline.cn/',
			clientId: 'a69788c6-1d43-44ed-9ca3-b83e194da255',
			microsoftResource: {
				id: SettingIds.marm,
				endpoint: 'https://management.core.chinacloudapi.cn/',
				azureResourceId: AzureResource.MicrosoftResourceManagement
			},
			msGraphResource: {
				id: SettingIds.msgraph,
				endpoint: 'https://microsoftgraph.chinacloudapi.cn',
				azureResourceId: AzureResource.MsGraph
			},
			armResource: {
				id: SettingIds.arm,
				endpoint: 'https://management.chinacloudapi.cn',
				azureResourceId: AzureResource.ResourceManagement
			},
			sqlResource: {
				id: SettingIds.sql,
				endpoint: 'https://database.chinacloudapi.cn/',
				azureResourceId: AzureResource.Sql
			},
			azureKeyVaultResource: {
				id: SettingIds.vault,
				endpoint: 'https://vault.azure.cn',
				azureResourceId: AzureResource.AzureKeyVault
			},
			azureLogAnalyticsResource: {
				id: SettingIds.ala,
				endpoint: 'https://api.loganalytics.azure.cn',
				azureResourceId: AzureResource.AzureLogAnalytics,
			},
			azureStorageResource: {
				id: SettingIds.storage,
				endpoint: '',
				endpointSuffix: '.core.chinacloudapi.cn',
				azureResourceId: AzureResource.AzureStorage
			},
			azureKustoResource: {
				id: SettingIds.kusto,
				endpoint: 'https://kusto.kusto.chinacloudapi.cn',
				azureResourceId: AzureResource.AzureKusto,
			},
			powerBiResource: {
				id: SettingIds.powerbi,
				endpoint: 'https://analysis.windows.net/powerbi/api',
				azureResourceId: AzureResource.PowerBi
			},
			redirectUri: 'http://localhost',
			scopes: [
				'openid', 'email', 'profile', 'offline_access',
				'https://management.chinacloudapi.cn/user_impersonation'
			],
			portalEndpoint: 'https://portal.azure.cn/'
		}
	}
};

let allSettings = [publicAzureSettings, usGovAzureSettings, chinaAzureSettings];
allSettings = updateCustomCloudProviderSettings(allSettings);
export default allSettings;
