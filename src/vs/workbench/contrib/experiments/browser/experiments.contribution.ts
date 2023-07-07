/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IExperimentService, ExperimentService } from 'vs/workbench/contrib/experiments/common/experimentService';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { ExperimentalPrompts } from 'vs/workbench/contrib/experiments/browser/experimentalPrompt';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { workbenchConfigurationNodeBase } from 'vs/workbench/common/configuration';

registerSingleton(IExperimentService, ExperimentService, InstantiationType.Delayed);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ExperimentalPrompts, LifecyclePhase.Eventually);

const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

// Configuration
registry.registerConfiguration({
	...workbenchConfigurationNodeBase,
	'properties': {
		'workbench.enableExperiments': {
			'type': 'boolean',
			'description': localize('workbench.enableExperiments', "Fetches experiments to run from a Microsoft online service."),
			'default': true,
			'scope': ConfigurationScope.APPLICATION,
			'restricted': true,
			'tags': ['usesOnlineServices']
		}
	}
});
