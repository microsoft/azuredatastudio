/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Actions from './actions';

import * as nls from 'vs/nls';

import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';

new Actions.ConfigureDashboardAction().registerTask();
new Actions.ClearSavedAccountsAction().registerTask();

Registry.as<IConfigurationRegistry>(ConfigExtensions.Configuration).registerConfiguration({
	'id': 'previewFeatures',
	'title': nls.localize('previewFeatures.configTitle', "Preview Features"),
	'type': 'object',
	'properties': {
		'workbench.enablePreviewFeatures': {
			'type': 'boolean',
			'default': undefined,
			'description': nls.localize('previewFeatures.configEnable', "Enable unreleased preview features")
		}
	}
});

Registry.as<IConfigurationRegistry>(ConfigExtensions.Configuration).registerConfiguration({
	'id': 'showConnectDialogOnStartup',
	'title': nls.localize('showConnectDialogOnStartup', "Show connect dialog on startup"),
	'type': 'object',
	'properties': {
		'workbench.showConnectDialogOnStartup': {
			'type': 'boolean',
			'default': false,
			'description': nls.localize('showConnectDialogOnStartup', "Show connect dialog on startup")
		}
	}
});

Registry.as<IConfigurationRegistry>(ConfigExtensions.Configuration).registerConfiguration({
	'id': 'enableObsoleteApiUsageNotification',
	'title': nls.localize('enableObsoleteApiUsageNotificationTitle', "Obsolete API Notification"),
	'type': 'object',
	'properties': {
		'workbench.enableObsoleteApiUsageNotification': {
			'type': 'boolean',
			'default': true,
			'description': nls.localize('enableObsoleteApiUsageNotification', "Enable/disable obsolete API usage notification")
		}
	}
});
