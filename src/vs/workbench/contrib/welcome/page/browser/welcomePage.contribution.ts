/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { WelcomePageContribution, WelcomePageAction, WelcomeInputSerializer } from 'sql/workbench/contrib/welcome/page/browser/welcomePage'; // {{SQL CARBON EDIT}} use our welcome page
import { IWorkbenchActionRegistry, Extensions as ActionExtensions, CATEGORIES } from 'vs/workbench/common/actions'; // {{SQL CARBON EDIT}}
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions'; // {{SQL CARBON EDIT}}
import { WelcomePageContribution as WelcomePageContributionVs } from 'vs/workbench/contrib/welcome/page/browser/welcomePage'; // {{SQL CARBON EDIT}} use our welcome page
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration'; // {{SQL CARBON EDIT}} - use our welcome page
import { workbenchConfigurationNodeBase } from 'vs/workbench/common/configuration';
import { EditorExtensions, IEditorFactoryRegistry } from 'vs/workbench/common/editor';

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerConfiguration({
		...workbenchConfigurationNodeBase,
		'properties': {
			'workbench.startupEditor': {
				'scope': ConfigurationScope.RESOURCE,
				'type': 'string',
				'enum': ['none', 'welcomePageWithTour', 'welcomePage', 'readme', 'newUntitledFile', 'welcomePageInEmptyWorkbench'], // {{SQL CARBON EDIT}} Add our own welcomePageWithTour
				'enumDescriptions': [
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.none' }, "Start without an editor."),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePageWithTour' }, "Open the welcome page with Getting Started Tour (default)"), // {{SQL CARBON EDIT}} Add our own welcomePageWithTour
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePage' }, "Open the Welcome page, with content to aid in getting started with VS Code and extensions."),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.readme' }, "Open the README when opening a folder that contains one, fallback to 'welcomePage' otherwise. Note: This is only observed as a global configuration, it will be ignored if set in a workspace or folder configuration."),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.newUntitledFile' }, "Open a new untitled file (only applies when opening an empty window)."),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePageInEmptyWorkbench' }, "Open the Welcome page when opening an empty workbench."),
				],
				'default': 'welcomePage',
				'description': localize('workbench.startupEditor', "Controls which editor is shown at startup, if none are restored from the previous session.")
			},
		}
	});

// {{SQL CARBON EDIT}} - determine whether to show preview or stable welcome page
class WelcomeContributions {
	constructor(
		@IConfigurationService configurationService: IConfigurationService,
	) {
		const previewFeaturesEnabled: boolean = configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (previewFeaturesEnabled) {


			Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
				.registerWorkbenchContribution(WelcomePageContribution, LifecyclePhase.Restored);

			Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions)
				.registerWorkbenchAction(SyncActionDescriptor.create(WelcomePageAction, WelcomePageAction.ID, WelcomePageAction.LABEL), 'Help: Welcome', CATEGORIES.Help.value);

			Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(WelcomeInputSerializer.ID, WelcomeInputSerializer);

		} else {
			Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
				.registerWorkbenchContribution(WelcomePageContributionVs, LifecyclePhase.Restored);
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(WelcomeContributions, LifecyclePhase.Starting);
// {{SQL CARBON EDIT}} - end preview startup customization
