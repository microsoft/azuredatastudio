/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { WelcomePageContribution, WelcomePageAction, WelcomeInputSerializer } from 'sql/workbench/contrib/welcome/page/browser/welcomePage';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions, CATEGORIES } from 'vs/workbench/common/actions';
import { MenuId, MenuRegistry, SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { workbenchConfigurationNodeBase } from 'vs/workbench/common/configuration';
import { EditorExtensions, IEditorFactoryRegistry } from 'vs/workbench/common/editor';

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerConfiguration({
		...workbenchConfigurationNodeBase,
		'properties': {
			'workbench.startupEditor': {
				'scope': ConfigurationScope.RESOURCE,
				'type': 'string',
				'enum': ['none', 'welcomePageWithTour', 'welcomePage', 'readme', 'newUntitledFile', 'welcomePageInEmptyWorkbench'],
				'enumDescriptions': [
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.none' }, "Start without an editor."),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePageWithTour' }, "Open the welcome page with Getting Started Tour (default)"),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePage' }, "Open the Welcome page, with content to aid in getting started with Azure Data Studio and extensions."),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.readme' }, "Open the README when opening a folder that contains one, fallback to 'welcomePage' otherwise. Note: This is only observed as a global configuration, it will be ignored if set in a workspace or folder configuration."),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.newUntitledFile' }, "Open a new untitled file (only applies when opening an empty window)."),
					localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePageInEmptyWorkbench' }, "Open the Welcome page when opening an empty workbench."),
				],
				'default': 'welcomePage',
				'description': localize('workbench.startupEditor', "Controls which editor is shown at startup, if none are restored from the previous session.")
			},
		}
	});

class WelcomeContributions {
	constructor() {
		Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
			.registerWorkbenchContribution(WelcomePageContribution, LifecyclePhase.Restored);

		Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions)
			.registerWorkbenchAction(SyncActionDescriptor.create(WelcomePageAction, WelcomePageAction.ID, WelcomePageAction.LABEL), 'Help: Welcome', CATEGORIES.Help.value);

		Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(WelcomeInputSerializer.ID, WelcomeInputSerializer);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(WelcomeContributions, LifecyclePhase.Starting);

MenuRegistry.appendMenuItem(MenuId.MenubarHelpMenu, {
	group: '1_welcome',
	command: {
		id: 'workbench.action.showWelcomePage',
		title: localize({ key: 'miWelcome', comment: ['&& denotes a mnemonic'] }, "&&Welcome")
	},
	order: 1
});
