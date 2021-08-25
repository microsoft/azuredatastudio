/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { WelcomePageContribution, WelcomePageAction, WelcomeInputSerializer } from 'sql/workbench/contrib/welcome/page/browser/welcomePage'; // {{SQL CARBON EDIT}} use our welcome page
import {
	WelcomeInputSerializer as WelcomeInputSerializer2, DEFAULT_STARTUP_EDITOR_CONFIG,
	WelcomePageContribution as WelcomePageContribution2, WelcomePageAction as WelcomePageAction2
} from 'vs/workbench/contrib/welcome/page/browser/welcomePage'; // {{SQL CARBON EDIT}} use our welcome page
import { IWorkbenchActionRegistry, Extensions as ActionExtensions, CATEGORIES } from 'vs/workbench/common/actions';
import { SyncActionDescriptor, MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { IEditorInputFactoryRegistry, EditorExtensions } from 'vs/workbench/common/editor';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration'; // {{SQL CARBON EDIT}} - use our welcome page

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerConfiguration(DEFAULT_STARTUP_EDITOR_CONFIG);

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
