/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionGalleryService, IGalleryExtension } from 'vs/platform/extensionManagement/common/extensionManagement';
import { OpenExtensionAuthoringDocsAction } from 'sql/workbench/contrib/extensions/browser/extensionsActions';
import { localize } from 'vs/nls';
import { deepClone } from 'vs/base/common/objects';
import { CancellationToken } from 'vs/base/common/cancellation';
import { registerAction2 } from 'vs/platform/actions/common/actions';

// Global Actions


registerAction2(OpenExtensionAuthoringDocsAction);

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
		const [extension] = await extensionGalleryService.getExtensions([{ id: arg }], { source: 'getExtensionFromGallery' }, CancellationToken.None);
		if (extension) {
			return deepClone(extension);
		} else {
			throw new Error(localize('notFound', "Extension '{0}' not found.", arg));
		}
	}
});
