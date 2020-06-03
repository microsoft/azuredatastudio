/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import * as azdata from 'azdata';
import { IOEShimService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerViewTreeShim';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';

export const DATA_TIER_WIZARD_COMMAND_ID = 'dataExplorer.dataTierWizard';
export const PROFILER_COMMAND_ID = 'dataExplorer.profiler';
export const IMPORT_COMMAND_ID = 'dataExplorer.flatFileImport';
export const SCHEMA_COMPARE_COMMAND_ID = 'dataExplorer.schemaCompare';
export const GENERATE_SCRIPTS_COMMAND_ID = 'dataExplorer.generateScripts';
export const PROPERTIES_COMMAND_ID = 'dataExplorer.properties';
export const IMPORT_DATABASE_COMMAND_ID = 'dataExplorer.importDatabase';


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

// Import Database
CommandsRegistry.registerCommand({
	id: IMPORT_DATABASE_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		let connectedContext: azdata.ConnectedContext = { connectionProfile: args.$treeItem.payload };
		return commandService.executeCommand('sqlDatabaseProjects.importDatabase', connectedContext);
	}
});
