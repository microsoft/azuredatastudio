/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions as WorkbenchActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { ExtensionsLabel } from 'vs/platform/extensionManagement/common/extensionManagement';
import { OpenExtensionAuthoringDocsAction } from 'sql/workbench/contrib/extensions/browser/extensionsActions';

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
