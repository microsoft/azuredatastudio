/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { WelcomePageContribution, WelcomePageAction, WelcomeInputSerializer } from 'sql/workbench/contrib/welcome/page/browser/welcomePage'; // {{SQL CARBON EDIT}} use our welcome page
import {
	WelcomeInputSerializer as WelcomeInputSerializer2,
	WelcomePageContribution as WelcomePageContribution2, WelcomePageAction as WelcomePageAction2
} from 'vs/workbench/contrib/welcome/page/browser/welcomePage'; // {{SQL CARBON EDIT}} use our welcome page
import { IWorkbenchActionRegistry, Extensions as ActionExtensions, CATEGORIES } from 'vs/workbench/common/actions';
import { SyncActionDescriptor, MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { IEditorInputFactoryRegistry, EditorExtensions } from 'vs/workbench/common/editor';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { workbenchConfigurationNodeBase } from 'vs/workbench/common/configuration';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration'; // {{SQL CARBON EDIT}} - use our welcome page

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
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePage' }, "Open the legacy Welcome page."),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.readme' }, "Open the README when opening a folder that contains one, fallback to 'welcomePage' otherwise. Note: This is only observed as a global ccnfiguration, it will be ignored if set in a workspace or folder configuration."),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.newUntitledFile' }, "Open a new untitled file (only applies when opening an empty window)."),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePageInEmptyWorkbench' }, "Open the legacy Welcome page when opening an empty workbench."),
					// localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.gettingStarted' }, "Open the new Welcome Page with content to aid in getting started with VS Code and extensions."), // {{SQL CARBON EDIT}} We don't use the VS Code gettingStarted experience
					// localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.gettingStartedInEmptyWorkbench' }, "When opening an empty workbench, open the new Welcome Page with content to aid in getting started with VS Code and extensions.") // {{SQL CARBON EDIT}} We don't use the VS Code gettingStarted experience
				],
				'default': 'welcomePageWithTour', // {{SQL CARBON EDIT}} Remove gettingStarted page
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

			Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories).registerEditorInputSerializer(WelcomeInputSerializer.ID, WelcomeInputSerializer);

		} else {
			Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
				.registerWorkbenchContribution(WelcomePageContribution2, LifecyclePhase.Restored);

			Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions)
				.registerWorkbenchAction(SyncActionDescriptor.create(WelcomePageAction2, WelcomePageAction2.ID, WelcomePageAction2.LABEL), 'Help: Welcome', CATEGORIES.Help.value);

			Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories).registerEditorInputSerializer(WelcomeInputSerializer2.ID, WelcomeInputSerializer2);
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(WelcomeContributions, LifecyclePhase.Starting);
// {{SQL CARBON EDIT}} - end preview startup customization

MenuRegistry.appendMenuItem(MenuId.MenubarHelpMenu, {
	group: '1_welcome',
	command: {
		id: 'workbench.action.showWelcomePage',
		title: localize({ key: 'miWelcome', comment: ['&& denotes a mnemonic'] }, "&&Welcome")
	},
	order: 1
});
