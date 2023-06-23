/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { ProviderSettings } from './interfaces';
import { AzureResource } from 'azdata';
import * as Constants from '../constants';
import { displayReloadAds } from '../extension';

const localize = nls.loadMessageBundle();

export const PROVIDER_CONFIG_KEY = 'provider.clouds';

export type ProviderSettingsJson = {
	name: string,
	settings: {
		configKey: string,
		metadata: {
			displayName: string,
			id: string,
			endpoints: {
				host: string,
				microsoftResource: string,
				graphResource: string,
				msGraphResource: string,
				armResource: string,
				sqlResource: string,
				azureKeyVaultResource: string,
				azureLogAnalyticsResource: string,
				azureStorageResource: {
					endpoint: string,
					endpointSuffix: string
				}
				azureKustoResource: string,
				powerBiResource: string,
				scopes: string,
				portalEndpoint: string
			}
		}
	}
}

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
	kusto = 'kusto',
	powerbi = 'powerbi'
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
				endpoint: 'https://graph.windows.net/',
				azureResourceId: AzureResource.Graph
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
			graphResource: {
				id: SettingIds.graph,
				endpoint: 'https://graph.windows.net/',
				azureResourceId: AzureResource.Graph
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

let providerSettingsJson: ProviderSettingsJson[] | undefined = vscode.workspace.getConfiguration(Constants.AzureSection).get(Constants.ProviderSettingsJson);
vscode.workspace.onDidChangeConfiguration(async (changeEvent) => {
	const impactProvider = changeEvent.affectsConfiguration(Constants.ProviderSettingsJsonSection);
	if (impactProvider === true) {
		await displayReloadAds(Constants.ProviderSettingsJsonSection);
	}
});
if (providerSettingsJson && providerSettingsJson[0].name !== '') {
	try {
		if (providerSettingsJson) {
			for (let cloudProvider of providerSettingsJson) {
				// build provider setting
				let newSettings = buildProviderSettings(cloudProvider);
				allSettings.push(newSettings)
			}
			void vscode.window.showInformationMessage(localize('providerSettings.success', 'Successfully loaded custom endpoints file'));
		}
	} catch (error) {
		console.log(error);
		void vscode.window.showErrorMessage(localize('providerSettings.error', 'could not load custom endpoints file'));
		throw Error(error.message);
	}
}

export function buildProviderSettings(cloudProvider: ProviderSettingsJson): ProviderSettings {
	// build provider setting
	let newSettings = {
		configKey: 'enable' + cloudProvider.settings.metadata.id,
		metadata: {
			displayName: cloudProvider.settings.metadata.displayName,
			id: cloudProvider.settings.metadata.id,
			settings: {
				host: cloudProvider.settings.metadata.endpoints.host,
				clientId: 'a69788c6-1d43-44ed-9ca3-b83e194da255',
				microsoftResource: {
					id: SettingIds.marm,
					endpoint: cloudProvider.settings.metadata.endpoints.microsoftResource,
					azureResourceId: AzureResource.MicrosoftResourceManagement
				},
				graphResource: {
					id: SettingIds.graph,
					endpoint: cloudProvider.settings.metadata.endpoints.graphResource,
					azureResourceId: AzureResource.Graph
				},
				msGraphResource: {
					id: SettingIds.msgraph,
					endpoint: cloudProvider.settings.metadata.endpoints.msGraphResource,
					azureResourceId: AzureResource.MsGraph
				},
				armResource: {
					id: SettingIds.arm,
					endpoint: cloudProvider.settings.metadata.endpoints.armResource,
					azureResourceId: AzureResource.ResourceManagement
				},
				sqlResource: {
					id: SettingIds.sql,
					endpoint: cloudProvider.settings.metadata.endpoints.sqlResource,
					azureResourceId: AzureResource.Sql
				},
				azureKeyVaultResource: {
					id: SettingIds.vault,
					endpoint: cloudProvider.settings.metadata.endpoints.azureKeyVaultResource,
					azureResourceId: AzureResource.AzureKeyVault
				},
				azureLogAnalyticsResource: {
					id: SettingIds.ala,
					endpoint: cloudProvider.settings.metadata.endpoints.azureLogAnalyticsResource,
					azureResourceId: AzureResource.AzureLogAnalytics,
				},
				azureStorageResource: {
					id: SettingIds.storage,
					endpoint: cloudProvider.settings.metadata.endpoints.azureStorageResource.endpoint,
					endpointSuffix: cloudProvider.settings.metadata.endpoints.azureStorageResource.endpointSuffix,
					azureResourceId: AzureResource.AzureStorage
				},
				azureKustoResource: {
					id: SettingIds.kusto,
					endpoint: cloudProvider.settings.metadata.endpoints.azureKustoResource,
					azureResourceId: AzureResource.AzureKusto,
				},
				powerBiResource: {
					id: SettingIds.powerbi,
					endpoint: cloudProvider.settings.metadata.endpoints.powerBiResource,
					azureResourceId: AzureResource.PowerBi
				},
				redirectUri: 'http://localhost',
				scopes: [
					'openid', 'email', 'profile', 'offline_access',
					cloudProvider.settings.metadata.endpoints.scopes
				],
				portalEndpoint: cloudProvider.settings.metadata.endpoints.portalEndpoint
			}
		}
	};
	return newSettings;
}

export default allSettings;
