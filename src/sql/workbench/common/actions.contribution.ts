/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Actions from './actions';

import * as nls from 'vs/nls';

import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { ShowCurrentReleaseNotesAction } from 'sql/workbench/update/releaseNotes';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';

new Actions.BackupAction().registerTask();
new Actions.RestoreAction().registerTask();
new Actions.NewQueryAction().registerTask();
new Actions.ConfigureDashboardAction().registerTask();

// add product update and release notes contributions
Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions)
	.registerWorkbenchAction(new SyncActionDescriptor(ShowCurrentReleaseNotesAction, ShowCurrentReleaseNotesAction.ID, ShowCurrentReleaseNotesAction.LABEL), 'Show Getting Started');

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
			'default': true,
			'description': nls.localize('showConnectDialogOnStartup', "Show connect dialog on startup")
		}
	}
});
