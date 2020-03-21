/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';

CommandsRegistry.registerCommand('azdata.extension.open', (accessor: ServicesAccessor, extension: { id: string }) => {
	if (extension && extension.id) {
		const commandService = accessor.get(ICommandService);
		return commandService.executeCommand('extension.open', extension.id);
	} else {
		throw new Error('Extension id is not provided');
	}
});
