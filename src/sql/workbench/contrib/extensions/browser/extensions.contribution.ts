/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions as WorkbenchActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { ExtensionsLabel, IExtensionGalleryService, IGalleryExtension, TargetPlatform } from 'vs/platform/extensionManagement/common/extensionManagement';
import { OpenExtensionAuthoringDocsAction } from 'sql/workbench/contrib/extensions/browser/extensionsActions';
import { localize } from 'vs/nls';
import { deepClone } from 'vs/base/common/objects';

// Global Actions
const actionRegistry = Registry.as<IWorkbenchActionRegistry>(WorkbenchActionExtensions.WorkbenchActions);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.from(OpenExtensionAuthoringDocsAction), 'Extensions: Author an Extension...', ExtensionsLabel);

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
		const extension = await extensionGalleryService.getCompatibleExtension({ id: arg }, TargetPlatform.UNIVERSAL);
		if (extension) {
			return deepClone(extension);
		} else {
			throw new Error(localize('notFound', "Extension '{0}' not found.", arg));
		}
	}
});
