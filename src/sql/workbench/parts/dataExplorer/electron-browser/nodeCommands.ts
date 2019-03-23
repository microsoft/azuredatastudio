/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IOEShimService } from 'sql/parts/objectExplorer/common/objectExplorerViewTreeShim';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionType, IConnectableInput, IConnectionCompletionOptions, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { generateUri } from 'sql/platform/connection/common/utils';
import { ICustomViewDescriptor, TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IViewsRegistry, Extensions } from 'vs/workbench/common/views';
import { IProgressService2 } from 'vs/platform/progress/common/progress';
import { Registry } from 'vs/platform/registry/common/platform';

export const DISCONNECT_COMMAND_ID = 'dataExplorer.disconnect';
export const MANAGE_COMMAND_ID = 'dataExplorer.manage';
export const NEW_QUERY_COMMAND_ID = 'dataExplorer.newQuery';
export const REFRESH_COMMAND_ID = 'dataExplorer.refresh';

CommandsRegistry.registerCommand({
	id: DISCONNECT_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		if (args.$treeItem) {
			const oeService = accessor.get(IOEShimService);
			return oeService.disconnectNode(args.$treeViewId, args.$treeItem).then(() => {
				const { treeView } = (<ICustomViewDescriptor>Registry.as<IViewsRegistry>(Extensions.ViewsRegistry).getView(args.$treeViewId));
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
			const queryEditorService = accessor.get(IQueryEditorService);
			const connectionService = accessor.get(IConnectionManagementService);
			const capabilitiesService = accessor.get(ICapabilitiesService);
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

CommandsRegistry.registerCommand({
	id: MANAGE_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		if (args.$treeItem) {
			const connectionService = accessor.get(IConnectionManagementService);
			const capabilitiesService = accessor.get(ICapabilitiesService);
			let options = {
				showDashboard: true,
				saveTheConnection: false,
				params: undefined,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			};
			let profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
			let uri = generateUri(profile, 'dashboard');
			return connectionService.connect(new ConnectionProfile(capabilitiesService, args.$treeItem.payload), uri, options);
		}
		return Promise.resolve(true);
	}
});

CommandsRegistry.registerCommand({
	id: REFRESH_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const progressSerivce = accessor.get(IProgressService2);
		if (args.$treeItem) {
			const { treeView } = (<ICustomViewDescriptor>Registry.as<IViewsRegistry>(Extensions.ViewsRegistry).getView(args.$treeViewId));
			if (args.$treeContainerId) {
				return progressSerivce.withProgress({ location: args.$treeContainerId }, () => treeView.refresh([args.$treeItem]).then(() => true));
			} else {
				return treeView.refresh([args.$treeItem]).then(() => true);
			}

		}
		return Promise.resolve(true);
	}
});
