/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Registry } from 'vs/platform/registry/common/platform';
import { GettingStarted } from './gettingStarted';
import { TelemetryOptOut } from './telemetryOptOut';
import { UpgradeToAzureDataStudio } from './updateToAzureDataStudio';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
// {{SQL CARBON EDIT}} - Add preview feature switch
import { EnablePreviewFeatures } from 'sql/workbench/electron-browser/enablePreviewFeatures';
import * as nls from 'vs/nls';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';

// {{SQL CARBON EDIT}}
// Registry
// 	.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
// 	.registerWorkbenchContribution(GettingStarted, LifecyclePhase.Running);

Registry
	.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(GettingStarted, LifecyclePhase.Running);

Registry
	.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(TelemetryOptOut, LifecyclePhase.Eventually);

// {{SQL CARBON EDIT}} - Add preview feature switch
Registry
	.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(EnablePreviewFeatures, LifecyclePhase.Eventually);

Registry
	.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(UpgradeToAzureDataStudio, LifecyclePhase.Eventually);


const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'upgradeToAzureDataStudio',
	'order': 25,
	'title': nls.localize('updateToAzureDataStudio', "Upgrade"),
	'type': 'object',
	'properties': {
		'upgrade.disablePrompt': {
			'type': 'boolean',
			'default': false,
			'scope': ConfigurationScope.APPLICATION,
			'description': nls.localize('updateToAzureDataStudio.disablePrompt', "Disables the Upgrade to Azure Data Studio prompt"),
			'tags': ['upgrade']
		},
	}
});

