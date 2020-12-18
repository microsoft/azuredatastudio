/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { ProviderSettings } from './interfaces';
import { AzureResource } from 'azdata';

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
				id: 'marm',
				endpoint: 'https://management.core.windows.net/',
				azureResourceId: AzureResource.MicrosoftResourceManagement
			},
			graphResource: {
				id: 'graph',
				endpoint: 'https://graph.microsoft.com',
				azureResourceId: AzureResource.Graph
			},
			armResource: {
				id: 'arm',
				endpoint: 'https://management.azure.com',
				azureResourceId: AzureResource.ResourceManagement
			},
			sqlResource: {
				id: 'sql',
				endpoint: 'https://database.windows.net/',
				azureResourceId: AzureResource.Sql
			},
			ossRdbmsResource: {
				id: 'ossrdbms',
				endpoint: 'https://ossrdbms-aad.database.windows.net',
				azureResourceId: AzureResource.OssRdbms
			},
			azureKeyVaultResource: {
				id: 'vault',
				endpoint: 'https://vault.azure.net',
				azureResourceId: AzureResource.AzureKeyVault
			},
			azureDevOpsResource: {
				id: 'ado',
				endpoint: '499b84ac-1321-427f-aa17-267ca6975798',
				azureResourceId: AzureResource.AzureDevOps,
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
				id: 'marm',
				endpoint: 'https://management.core.usgovcloudapi.net/',
				azureResourceId: AzureResource.MicrosoftResourceManagement
			},
			graphResource: {
				id: 'graph',
				endpoint: 'https://graph.windows.net',
				azureResourceId: AzureResource.Graph
			},
			armResource: {
				id: 'arm',
				endpoint: 'https://management.usgovcloudapi.net',
				azureResourceId: AzureResource.ResourceManagement
			},
			sqlResource: {
				id: 'sql',
				endpoint: 'https://database.usgovcloudapi.net/',
				azureResourceId: AzureResource.Sql
			},
			ossRdbmsResource: {
				id: 'ossrdbms',
				endpoint: 'https://ossrdbms-aad.database.usgovcloudapi.net',
				azureResourceId: AzureResource.OssRdbms
			},
			azureKeyVaultResource: {
				id: 'vault',
				endpoint: 'https://vault.usgovcloudapi.net',
				azureResourceId: AzureResource.AzureKeyVault
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
				id: 'marm',
				endpoint: 'https://management.azure.eaglex.ic.gov/',
				azureResourceId: AzureResource.MicrosoftResourceManagement
			},
			graphResource: {
				id: 'graph',
				endpoint: 'https://graph.eaglex.ic.gov',
				azureResourceId: AzureResource.Graph
			},
			armResource: {
				id: 'arm',
				endpoint: 'https://management.core.eaglex.ic.gov/',
				azureResourceId: AzureResource.ResourceManagement
			},
			sqlResource: {
				id: 'sql',
				endpoint: 'https://database.cloudapi.eaglex.ic.gov/',
				azureResourceId: AzureResource.Sql
			},
			ossRdbmsResource: {
				id: 'ossrdbms',
				endpoint: 'https://ossrdbms-aad.database.cloudapi.eaglex.ic.gov',
				azureResourceId: AzureResource.OssRdbms
			},
			azureKeyVaultResource: {
				id: 'vault',
				endpoint: 'https://vault.cloudapi.eaglex.ic.gov',
				azureResourceId: AzureResource.AzureKeyVault
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
				id: 'https://graph.cloudapi.de/',
				endpoint: 'https://graph.cloudapi.de'
			},
			armResource: {
				id: 'https://management.core.cloudapi.de/',
				endpoint: 'https://management.microsoftazure.de'
			},
			azureKeyVaultResource: {
				id: 'https://vault.microsoftazure.de',
				endpoint: 'https://vault.microsoftazure.de'
			},
			redirectUri: 'https://vscode-redirect.azurewebsites.net/'
		}
	}
};

const chinaAzureSettings: ProviderSettings = {
	configKey: 'enableChinaCloud',
	metadata: {
		displayName: localize('chinaCloudDisplayName', "Azure (China)"),
		id: 'azure_chinaCloud',
		settings: {
			host: 'https://login.chinacloudapi.cn/',
			clientId: 'a69788c6-1d43-44ed-9ca3-b83e194da255',
			graphResource: {
				id: 'https://graph.chinacloudapi.cn/',
				endpoint: 'https://graph.chinacloudapi.cn'
			},
			armResource: {
				id: 'https://management.core.chinacloudapi.cn/',
				endpoint: 'https://managemement.chinacloudapi.net'
			},
			azureKeyVaultResource: {
				id: 'https://vault.azure.cn',
				endpoint: 'https://vault.azure.cn'
			},
			redirectUri: 'https://vscode-redirect.azurewebsites.net/'

		}
	}
};
const allSettings = [publicAzureSettings, usGovAzureSettings, usNatAzureSettings, germanyAzureSettings, chinaAzureSettings];
export default allSettings;
