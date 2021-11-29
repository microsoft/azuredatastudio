/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { KeyMod, KeyCode, KeyChord } from 'vs/base/common/keyCodes';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions as WorkbenchActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { ExtensionsLabel, IExtensionGalleryService, IGalleryExtension } from 'vs/platform/extensionManagement/common/extensionManagement';
import { OpenExtensionAuthoringDocsAction, HideExtensionMenu, HideSettings, HidePanel } from 'sql/workbench/contrib/extensions/browser/extensionsActions';
import { localize } from 'vs/nls';
import { deepClone } from 'vs/base/common/objects';
import { IWorkbenchContribution, Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import product from 'vs/platform/product/common/product';

// Global Actions
const actionRegistry = Registry.as<IWorkbenchActionRegistry>(WorkbenchActionExtensions.WorkbenchActions);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.from(OpenExtensionAuthoringDocsAction), 'Extensions: Author an Extension...', ExtensionsLabel);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		HideExtensionMenu,
		HideExtensionMenu.ID,
		HideExtensionMenu.LABEL,
		{ primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_V) }
	),
	HideExtensionMenu.LABEL
);
actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		HideSettings,
		HideSettings.ID,
		HideSettings.LABEL,
		{ primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_V) }
	),
	HideSettings.LABEL
);
actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		HidePanel,
		HidePanel.ID,
		HidePanel.LABEL,
		{ primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_V) }
	),
	HidePanel.LABEL
);
// Register Commands
CommandsRegistry.registerCommand('azdata.extension.open', (accessor: ServicesAccessor, extension: { id: string }) => {
	if (extension && extension.id) {
		const commandService = accessor.get(ICommandService);
		return commandService.executeCommand('extension.open', extension.id);
	} else {
		throw new Error('Extension id is not provided');
	}
});

CommandsRegistry.registerCommand({
	id: 'workbench.extensions.getExtensionFromGallery',
	description: {
		description: localize('workbench.extensions.getExtensionFromGallery.description', "Gets extension information from the gallery"),
		args: [
			{
				name: localize('workbench.extensions.getExtensionFromGallery.arg.name', "Extension id"),
				schema: {
					'type': ['string']
				}
			}
		]
	},
	handler: async (accessor, arg: string): Promise<IGalleryExtension> => {
		const extensionGalleryService = accessor.get(IExtensionGalleryService);
		const extension = await extensionGalleryService.getCompatibleExtension({ id: arg });
		if (extension) {
			return deepClone(extension);
		} else {
			throw new Error(localize('notFound', "Extension '{0}' not found.", arg));
		}
	}
});
export class ADSWebLite implements IWorkbenchContribution {
	constructor(
		@ICommandService private commandService: ICommandService,
	) {
		this.registerEditorOverride();
	}

	private async registerEditorOverride(): Promise<void> {
		if (product.quality === 'tsgops-image') {
			await this.commandService.executeCommand('workbench.extensions.action.hideSettings');
			await this.commandService.executeCommand('workbench.extensions.action.hidePanel');
			await this.commandService.executeCommand('workbench.extensions.action.hideExtensionsMenu');
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(ADSWebLite, LifecyclePhase.Restored);
