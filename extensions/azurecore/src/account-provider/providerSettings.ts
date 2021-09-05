/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { ProviderSettings } from './interfaces';
import { AzureResource } from 'azdata';

const localize = nls.loadMessageBundle();

const enum SettingIds {
	marm = 'marm',
	graph = 'graph',
	msgraph = 'msgraph',
	arm = 'arm',
	sql = 'sql',
	ossrdbms = 'ossrdbms',
	vault = 'vault',
	ado = 'ado',
	ala = 'ala',
	storage = 'storage',
	kusto = 'kusto'
}

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
			graphResource: {
				id: SettingIds.graph,
				endpoint: 'https://graph.windows.net',
				azureResourceId: AzureResource.Graph
			},
			msGraphResource: {
				id: SettingIds.msgraph,
				endpoint: 'https://graph.microsoft.com/',
				azureResourceId: AzureResource.MsGraph
			},
			armResource: {
				id: SettingIds.arm,
				endpoint: 'https://management.azure.com',
				azureResourceId: AzureResource.ResourceManagement
			},
			sqlResource: {
				id: SettingIds.sql,
				endpoint: 'https://database.windows.net/',
				azureResourceId: AzureResource.Sql
			},
			ossRdbmsResource: {
				id: SettingIds.ossrdbms,
				endpoint: 'https://ossrdbms-aad.database.windows.net',
				azureResourceId: AzureResource.OssRdbms
			},
			azureKeyVaultResource: {
				id: SettingIds.vault,
				endpoint: 'https://vault.azure.net',
				azureResourceId: AzureResource.AzureKeyVault
			},
			azureDevOpsResource: {
				id: SettingIds.ado,
				endpoint: '499b84ac-1321-427f-aa17-267ca6975798',
				azureResourceId: AzureResource.AzureDevOps,
			},
			azureLogAnalyticsResource: {
				id: SettingIds.ala,
				endpoint: 'https://api.loganalytics.io',
				azureResourceId: AzureResource.AzureLogAnalytics,
			},
			azureStorageResource: {
				id: SettingIds.storage,
				endpoint: '',
				endpointSuffix: '.core.windows.net',
				azureResourceId: AzureResource.AzureStorage
			},
			azureKustoResource: {
				id: SettingIds.kusto,
				endpoint: 'https://api.kusto.io',
				azureResourceId: AzureResource.AzureKusto,
			},
			redirectUri: 'https://vscode-redirect.azurewebsites.net/',
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
			graphResource: {
				id: SettingIds.graph,
				endpoint: 'https://graph.windows.net',
				azureResourceId: AzureResource.Graph
			},
			armResource: {
				id: SettingIds.arm,
				endpoint: 'https://management.usgovcloudapi.net',
				azureResourceId: AzureResource.ResourceManagement
			},
			sqlResource: {
				id: SettingIds.sql,
				endpoint: 'https://database.usgovcloudapi.net/',
				azureResourceId: AzureResource.Sql
			},
			ossRdbmsResource: {
				id: SettingIds.ossrdbms,
				endpoint: 'https://ossrdbms-aad.database.usgovcloudapi.net',
				azureResourceId: AzureResource.OssRdbms
			},
			azureKeyVaultResource: {
				id: SettingIds.vault,
				endpoint: 'https://vault.usgovcloudapi.net',
				azureResourceId: AzureResource.AzureKeyVault
			},
			azureLogAnalyticsResource: {
				id: SettingIds.ala,
				endpoint: 'https://api.loganalytics.us',
				azureResourceId: AzureResource.AzureLogAnalytics,
			},
			azureStorageResource: {
				id: SettingIds.storage,
				endpoint: '',
				endpointSuffix: '.core.usgovcloudapi.net',
				azureResourceId: AzureResource.AzureStorage
			},
			redirectUri: 'https://vscode-redirect.azurewebsites.net/',
			scopes: [
				'openid', 'email', 'profile', 'offline_access',
				'https://management.usgovcloudapi.net/user_impersonation'
			],
			portalEndpoint: 'https://portal.azure.us'
		}
	}
};

const usNatAzureSettings: ProviderSettings = {
	configKey: 'enableUsNatCloud',
	metadata: {
		displayName: localize('usNatCloudDisplayName', "Azure (US National)"),
		id: 'azure_usNatCloud',
		settings: {
			host: 'https://login.microsoftonline.eaglex.ic.gov/',
			clientId: 'a69788c6-1d43-44ed-9ca3-b83e194da255',
			microsoftResource: {
				id: SettingIds.marm,
				endpoint: 'https://management.azure.eaglex.ic.gov/',
				azureResourceId: AzureResource.MicrosoftResourceManagement
			},
			graphResource: {
				id: SettingIds.graph,
				endpoint: 'https://graph.eaglex.ic.gov',
				azureResourceId: AzureResource.Graph
			},
			armResource: {
				id: SettingIds.arm,
				endpoint: 'https://management.core.eaglex.ic.gov/',
				azureResourceId: AzureResource.ResourceManagement
			},
			sqlResource: {
				id: SettingIds.sql,
				endpoint: 'https://database.cloudapi.eaglex.ic.gov/',
				azureResourceId: AzureResource.Sql
			},
			ossRdbmsResource: {
				id: SettingIds.ossrdbms,
				endpoint: 'https://ossrdbms-aad.database.cloudapi.eaglex.ic.gov',
				azureResourceId: AzureResource.OssRdbms
			},
			azureKeyVaultResource: {
				id: SettingIds.vault,
				endpoint: 'https://vault.cloudapi.eaglex.ic.gov',
				azureResourceId: AzureResource.AzureKeyVault
			},
			azureLogAnalyticsResource: {
				id: SettingIds.ala,
				endpoint: 'https://api.loganalytics.azure.eaglex.ic.gov',
				azureResourceId: AzureResource.AzureLogAnalytics,
			},
			azureStorageResource: {
				id: SettingIds.storage,
				endpoint: '',
				endpointSuffix: '.core.eaglex.ic.gov',
				azureResourceId: AzureResource.AzureStorage
			},
			redirectUri: 'https://vscode-redirect.azurewebsites.net/',
			scopes: [
				'openid', 'email', 'profile', 'offline_access',
				'https://management.core.eaglex.ic.gov/user_impersonation'
			],
			portalEndpoint: 'https://portal.azure.eaglex.ic.gov/'
		}
	}
};


const germanyAzureSettings: ProviderSettings = {
	configKey: 'enableGermanyCloud',
	metadata: {
		displayName: localize('germanyCloud', "Azure (Germany)"),
		id: 'azure_germanyCloud',
		settings: {
			host: 'https://login.microsoftazure.de/',
			clientId: 'a69788c6-1d43-44ed-9ca3-b83e194da255',
			graphResource: {
				id: SettingIds.graph,
				endpoint: 'https://graph.cloudapi.de',
				azureResourceId: AzureResource.Graph
			},
			msGraphResource: {
				id: SettingIds.msgraph,
				endpoint: 'https://graph.microsoft.de',
				azureResourceId: AzureResource.MsGraph
			},
			armResource: {
				id: SettingIds.arm,
				endpoint: 'https://management.microsoftazure.de',
				azureResourceId: AzureResource.ResourceManagement
			},
			azureKeyVaultResource: {
				id: SettingIds.vault,
				endpoint: 'https://vault.microsoftazure.de',
				azureResourceId: AzureResource.AzureKeyVault
			},
			azureStorageResource: {
				id: SettingIds.storage,
				endpoint: '',
				endpointSuffix: '.core.cloudapi.de',
				azureResourceId: AzureResource.AzureStorage
			},
			redirectUri: 'https://vscode-redirect.azurewebsites.net/',
			scopes: [
				'openid', 'email', 'profile', 'offline_access',
				'https://management.microsoftazure.de/user_impersonation'
			],
			portalEndpoint: 'https://portal.microsoftazure.de/'
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
			graphResource: {
				id: SettingIds.graph,
				endpoint: 'https://graph.chinacloudapi.cn',
				azureResourceId: AzureResource.Graph
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
			redirectUri: 'https://vscode-redirect.azurewebsites.net/',
			scopes: [
				'openid', 'email', 'profile', 'offline_access',
				'https://management.chinacloudapi.cn/user_impersonation'
			],
			portalEndpoint: 'https://portal.azure.cn/'
		}
	}
};
const allSettings = [publicAzureSettings, usGovAzureSettings, usNatAzureSettings, germanyAzureSettings, chinaAzureSettings];
export default allSettings;
