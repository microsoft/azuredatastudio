/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IOEShimService } from 'sql/workbench/parts/objectExplorer/common/objectExplorerViewTreeShim';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionType, IConnectableInput, IConnectionCompletionOptions, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { generateUri } from 'sql/platform/connection/common/utils';
import { ICustomViewDescriptor, TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { IViewsRegistry, Extensions } from 'vs/workbench/common/views';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { Registry } from 'vs/platform/registry/common/platform';
import { BackupAction, RestoreAction } from 'sql/workbench/common/actions';
import { NewNotebookAction } from 'sql/workbench/parts/notebook/browser/notebookActions';

export const DISCONNECT_COMMAND_ID = 'dataExplorer.disconnect';
export const MANAGE_COMMAND_ID = 'dataExplorer.manage';
export const NEW_QUERY_COMMAND_ID = 'dataExplorer.newQuery';
export const REFRESH_COMMAND_ID = 'dataExplorer.refresh';
export const NEW_NOTEBOOK_COMMAND_ID = 'dataExplorer.newNotebook';
export const DATA_TIER_WIZARD_COMMAND_ID = 'dataExplorer.dataTierWizard';
export const PROFILER_COMMAND_ID = 'dataExplorer.profiler';
export const IMPORT_COMMAND_ID = 'dataExplorer.flatFileImport';
export const SCHEMA_COMPARE_COMMAND_ID = 'dataExplorer.schemaCompare';
export const BACKUP_COMMAND_ID = 'dataExplorer.backup';
export const RESTORE_COMMAND_ID = 'dataExplorer.restore';
export const GENERATE_SCRIPTS_COMMAND_ID = 'dataExplorer.generateScripts';
export const PROPERTIES_COMMAND_ID = 'dataExplorer.properties';

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

// New Query
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

// Manage
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

// New Notebook
CommandsRegistry.registerCommand({
	id: NEW_NOTEBOOK_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const commandService = accessor.get(ICommandService);
		let profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const connectedContext: azdata.ConnectedContext = { connectionProfile: profile };
		return commandService.executeCommand(NewNotebookAction.ID, connectedContext);
	}
});

// Data Tier Wizard
CommandsRegistry.registerCommand({
	id: DATA_TIER_WIZARD_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		const connectedContext: azdata.ConnectedContext = { connectionProfile: args.$treeItem.payload };
		return commandService.executeCommand('dacFx.start', connectedContext);
	}
});


// Flat File Import
CommandsRegistry.registerCommand({
	id: IMPORT_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		let connectedContext: azdata.ConnectedContext = { connectionProfile: args.$treeItem.payload };
		return commandService.executeCommand('flatFileImport.start', connectedContext);
	}
});

// Schema Compare
CommandsRegistry.registerCommand({
	id: SCHEMA_COMPARE_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		let connectedContext: azdata.ConnectedContext = { connectionProfile: args.$treeItem.payload };
		return commandService.executeCommand('schemaCompare.start', connectedContext);
	}
});

// Backup
CommandsRegistry.registerCommand({
	id: BACKUP_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		let connectedContext: azdata.ConnectedContext = { connectionProfile: args.$treeItem.payload };
		return commandService.executeCommand(BackupAction.ID, connectedContext);
	}
});

// Restore
CommandsRegistry.registerCommand({
	id: RESTORE_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		let connectedContext: azdata.ConnectedContext = { connectionProfile: args.$treeItem.payload };
		return commandService.executeCommand(RestoreAction.ID, connectedContext);
	}
});

// Profiler
CommandsRegistry.registerCommand({
	id: PROFILER_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		const oeShimService = accessor.get(IOEShimService);
		const objectExplorerContext: azdata.ObjectExplorerContext = {
			connectionProfile: args.$treeItem.payload,
			isConnectionNode: true,
			nodeInfo: oeShimService.getNodeInfoForTreeItem(args.$treeItem)
		};
		return commandService.executeCommand('profiler.newProfiler', objectExplorerContext);
	}
});

// Generate Scripts
CommandsRegistry.registerCommand({
	id: GENERATE_SCRIPTS_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		const oeShimService = accessor.get(IOEShimService);
		const objectExplorerContext: azdata.ObjectExplorerContext = {
			connectionProfile: args.$treeItem.payload,
			isConnectionNode: true,
			nodeInfo: oeShimService.getNodeInfoForTreeItem(args.$treeItem)
		};
		return commandService.executeCommand('adminToolExtWin.launchSsmsMinGswDialog', objectExplorerContext);
	}
});

// Properties
CommandsRegistry.registerCommand({
	id: PROPERTIES_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const oeShimService = accessor.get(IOEShimService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		await connectionManagementService.connectIfNotConnected(profile);
		const objectExplorerContext: azdata.ObjectExplorerContext = {
			connectionProfile: args.$treeItem.payload,
			isConnectionNode: true,
			nodeInfo: oeShimService.getNodeInfoForTreeItem(args.$treeItem)
		};
		return commandService.executeCommand('adminToolExtWin.launchSsmsMinPropertiesDialog', objectExplorerContext);
	}
});
