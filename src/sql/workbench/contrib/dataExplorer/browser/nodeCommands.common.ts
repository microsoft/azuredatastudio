/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IOEShimService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerViewTreeShim';
import { ICustomViewDescriptor, TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IViewsRegistry, Extensions } from 'vs/workbench/common/views';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { Registry } from 'vs/platform/registry/common/platform';

export const DISCONNECT_COMMAND_ID = 'dataExplorer.disconnect';
export const REFRESH_COMMAND_ID = 'dataExplorer.refresh';

// Disconnect
CommandsRegistry.registerCommand({
	id: DISCONNECT_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		if (args.$treeItem) {
			const oeService = accessor.get(IOEShimService);
			return oeService.disconnectNode(args.$treeViewId, args.$treeItem).then(() => {
				const { treeView } = (<ICustomViewDescriptor>Registry.as<IViewsRegistry>(Extensions.ViewsRegistry).getView(args.$treeViewId));
				// we need to collapse it then refresh it so that the tree doesn't try and use it's cache next time the user expands the node
				treeView.collapse(args.$treeItem);
				treeView.refresh([args.$treeItem]).then(() => true);
			});
		}
		return Promise.resolve(true);
	}
});

// Refresh
CommandsRegistry.registerCommand({
	id: REFRESH_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const progressService = accessor.get(IProgressService);
		if (args.$treeItem) {
			const { treeView } = (<ICustomViewDescriptor>Registry.as<IViewsRegistry>(Extensions.ViewsRegistry).getView(args.$treeViewId));
			if (args.$treeContainerId) {
				return progressService.withProgress({ location: args.$treeContainerId }, () => treeView.refresh([args.$treeItem]).then(() => true));
			} else {
				return treeView.refresh([args.$treeItem]).then(() => true);
			}

		}
		return Promise.resolve(true);
	}
});
