/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IOEShimService } from 'sql/parts/objectExplorer/common/objectExplorerViewTreeShim';
import { ICustomViewDescriptor, TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ViewsRegistry } from 'vs/workbench/common/views';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IConnectionManagementService, IConnectableInput, IConnectionCompletionOptions, ConnectionType } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

export const DISCONNECT_COMMAND_ID = 'dataExplorerDisconnect';
export const MANAGE_COMMAND_ID = 'dataExplorerManage';
export const NEW_QUERY_COMMAND_ID = 'dataExplorerNewQuery';

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

CommandsRegistry.registerCommand({
	id: NEW_QUERY_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		if (args.$treeItem) {
			let queryEditorService = accessor.get(IQueryEditorService);
			let connectionService = accessor.get(IConnectionManagementService);
			let capabilitiesService = accessor.get(ICapabilitiesService);
			return queryEditorService.newSqlEditor().then((owner: IConnectableInput) => {
				// Connect our editor to the input connection
				let options: IConnectionCompletionOptions = {
					params: { connectionType: ConnectionType.editor, input: owner },
					saveTheConnection: false,
					showDashboard: false,
					showConnectionDialogOnError: true,
					showFirewallRuleOnError: true
				};
				return connectionService.connect(new ConnectionProfile(capabilitiesService, args.$treeItem.payload), owner.uri, options);
			});
		}
		return Promise.resolve(true);
	}
});
