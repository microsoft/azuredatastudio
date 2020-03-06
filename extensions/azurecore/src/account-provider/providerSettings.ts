/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { ProviderSettings } from './interfaces';

const localize = nls.loadMessageBundle();

const publicAzureSettings: ProviderSettings = {
	configKey: 'enablePublicCloud',
	metadata: {
		displayName: localize('publicCloudDisplayName', "Azure"),
		id: 'azurePublicCloud',
		settings: {
			host: 'https://login.microsoftonline.com/',
			clientId: 'a69788c6-1d43-44ed-9ca3-b83e194da255',
			signInResourceId: 'https://management.core.windows.net/',
			graphResource: {
				id: 'https://graph.windows.net/',
				endpoint: 'https://graph.windows.net'
			},
			armResource: {
				id: 'https://management.core.windows.net/',
				endpoint: 'https://management.azure.com'
			},
			sqlResource: {
				id: 'https://database.windows.net/',
				endpoint: 'https://database.windows.net'
			},
			ossRdbmsResource: {
				id: 'https://ossrdbms-aad.database.windows.net',
				endpoint: 'https://ossrdbms-aad.database.windows.net'
			},
			azureKeyVaultResource: {
				id: 'https://vault.azure.net',
				endpoint: 'https://vault.azure.net'
			},
			redirectUri: 'http://localhost/redirect'
		}
	}
};


const usGovAzureSettings: ProviderSettings = {
	configKey: 'enableUsGovCloud',
	metadata: {
		displayName: localize('usGovCloudDisplayName', "Azure (US Government)"),
		id: 'usGovAzureCloud',
		settings: {
			host: 'https://login.microsoftonline.us',
			clientId: 'TBD',
			signInResourceId: 'https://management.core.usgovcloudapi.net/',
			graphResource: {
				id: 'https://graph.usgovcloudapi.net/',
				endpoint: 'https://graph.usgovcloudapi.net'
			},
			armResource: {
				id: 'https://management.core.usgovcloudapi.net/',
				endpoint: 'https://management.usgovcloudapi.net'
			},
			azureKeyVaultResource: {
				id: 'https://vault.usgovcloudapi.net',
				endpoint: 'https://vault.usgovcloudapi.net'
			},
			redirectUri: 'http://localhost/redirect'
		}
	}
};


const germanyAzureSettings: ProviderSettings = {
	configKey: 'enableGermanyCloud',
	metadata: {
		displayName: localize('germanyCloud', "Azure (Germany)"),
		id: 'germanyAzureCloud',
		settings: {
			host: 'https://login.microsoftazure.de/',
			clientId: 'TBD',
			signInResourceId: 'https://management.core.cloudapi.de/',
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
			redirectUri: 'http://localhost/redirect'
		}
	}
};

const chinaAzureSettings: ProviderSettings = {
	configKey: 'enableChinaCloud',
	metadata: {
		displayName: localize('chinaCloudDisplayName', "Azure (China)"),
		id: 'chinaAzureCloud',
		settings: {
			host: 'https://login.chinacloudapi.cn/',
			clientId: 'TBD',
			signInResourceId: 'https://management.core.chinacloudapi.cn/',
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
			redirectUri: 'http://localhost/redirect'
		}
	}
};
const allSettings = [publicAzureSettings, usGovAzureSettings, germanyAzureSettings, chinaAzureSettings];
export default allSettings;
