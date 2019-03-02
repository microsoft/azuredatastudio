/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IOEShimService } from 'sql/parts/objectExplorer/common/objectExplorerViewTreeShim';
import { ICustomViewDescriptor, TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ViewsRegistry } from 'vs/workbench/common/views';

export const DISCONNECT_COMMAND_ID = 'disconnect';

CommandsRegistry.registerCommand({
	id: DISCONNECT_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		if (args.$treeItem) {
			const oeService = accessor.get(IOEShimService);
			return oeService.disconnectNode(args.$treeViewId, args.$treeItem).then(() => {
				const { treeView } = (<ICustomViewDescriptor>ViewsRegistry.getView(args.$treeViewId));
				// we need to collapse it then refresh it so that the tree doesn't try and use it's cache next time the user expands the node
				return treeView.collapse(args.$treeItem).then(() => treeView.refresh([args.$treeItem]).then(() => true));
			});
		}
		return Promise.resolve(true);
	}
});
