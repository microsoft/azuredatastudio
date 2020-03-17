/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';

// New Resource Deployment
const RESOURCE_DEPLOYMENT_COMMAND_ID = 'resourceDeployment.new';
CommandsRegistry.registerCommand({
	id: RESOURCE_DEPLOYMENT_COMMAND_ID,
	handler: (accessor: ServicesAccessor, actionContext: any) => {
		const commandService = accessor.get(ICommandService);
		return commandService.executeCommand('azdata.resource.deploy');
	}
});
