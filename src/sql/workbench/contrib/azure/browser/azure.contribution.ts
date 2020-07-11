/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';
import { ConnectionContextKey } from 'sql/workbench/services/connection/common/connectionContextKey';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { ObjectExplorerActionsContext } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';

const openInAzureDECommandId: string = 'azure.openInAzureCoreDE';
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'z-azurecore',
	order: 1,
	command: {
		id: openInAzureDECommandId,
		title: localize('azure.openInAzurePortal.title', "Open in Azure Portal")
	},
	when: MssqlNodeContext.CanOpenInAzurePortal
});

CommandsRegistry.registerCommand({
	id: openInAzureDECommandId,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		return commandService.executeCommand('azure.resource.openInAzurePortal', args.$treeItem.payload);
	}
});

const openInAzureOECommandId: string = 'azure.openInAzureCoreOE';
MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'z-azurecore',
	order: 1,
	command: {
		id: openInAzureOECommandId,
		title: localize('azure.openInAzurePortal.title', "Open in Azure Portal")
	},
	when: ConnectionContextKey.CanOpenInAzurePortal
});

CommandsRegistry.registerCommand({
	id: openInAzureOECommandId,
	handler: (accessor, args: ObjectExplorerActionsContext) => {
		const commandService = accessor.get(ICommandService);
		return commandService.executeCommand('azure.resource.openInAzurePortal', args.connectionProfile);
	}
});
