/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VIEWLET_ID } from 'sql/workbench/contrib/dataExplorer/browser/dataExplorerViewlet';
import { localize } from 'vs/nls';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { ContextKeyEqualsExpr } from 'vs/platform/contextkey/common/contextkey';
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

MenuRegistry.appendMenuItem(MenuId.ViewContainerTitle, {
	group: 'deployment',
	order: 4,
	command: {
		id: 'azdata.resource.deploy',
		title: localize('deployment.title', "New Deployment...")
	},
	when: ContextKeyEqualsExpr.create('viewContainer', VIEWLET_ID)
});
