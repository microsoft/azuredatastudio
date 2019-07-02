/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IOEShimService } from 'sql/workbench/parts/objectExplorer/common/objectExplorerViewTreeShim';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';

export const PROFILER_COMMAND_ID = 'dataExplorer.profiler';
export const GENERATE_SCRIPTS_COMMAND_ID = 'dataExplorer.generateScripts';
export const PROPERTIES_COMMAND_ID = 'dataExplorer.properties';

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