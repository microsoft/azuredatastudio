/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IOEShimService } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerViewTreeShim';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { BaseActionContext } from 'sql/workbench/browser/actions';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ScriptCreateAction, ScriptDeleteAction, ScriptSelectAction, ScriptExecuteAction, ScriptAlterAction, EditDataAction } from 'sql/workbench/electron-browser/scriptingActions';
import { ObjectExplorerActionsContext, getTreeNode } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TreeSelectionHandler } from 'sql/workbench/parts/objectExplorer/browser/treeSelectionHandler';
import { TreeUpdateUtils } from 'sql/workbench/parts/objectExplorer/browser/treeUpdateUtils';
import Severity from 'vs/base/common/severity';
import { TreeNode } from 'sql/workbench/parts/objectExplorer/common/treeNode';
import { VIEWLET_ID } from 'sql/workbench/parts/dataExplorer/browser/dataExplorerViewlet';

//#region -- Data Explorer
export const SCRIPT_AS_CREATE_COMMAND_ID = 'dataExplorer.scriptAsCreate';
export const SCRIPT_AS_DELETE_COMMAND_ID = 'dataExplorer.scriptAsDelete';
export const SCRIPT_AS_SELECT_COMMAND_ID = 'dataExplorer.scriptAsSelect';
export const SCRIPT_AS_EXECUTE_COMMAND_ID = 'dataExplorer.scriptAsExecute';
export const SCRIPT_AS_ALTER_COMMAND_ID = 'dataExplorer.scriptAsAlter';
export const EDIT_DATA_COMMAND_ID = 'dataExplorer.scriptAsEdit';

// Script as Create
CommandsRegistry.registerCommand({
	id: SCRIPT_AS_CREATE_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const errorMessageService = accessor.get(IErrorMessageService);
		const progressService = accessor.get(IProgressService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const scriptCreateAction = new ScriptCreateAction(ScriptCreateAction.ID, ScriptCreateAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService, errorMessageService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => scriptCreateAction.run(baseContext));
	}
});

// Script as Delete
CommandsRegistry.registerCommand({
	id: SCRIPT_AS_DELETE_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const errorMessageService = accessor.get(IErrorMessageService);
		const progressService = accessor.get(IProgressService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const scriptDeleteAction = new ScriptDeleteAction(ScriptDeleteAction.ID, ScriptDeleteAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService, errorMessageService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => scriptDeleteAction.run(baseContext));
	}
});

// Script as Select
CommandsRegistry.registerCommand({
	id: SCRIPT_AS_SELECT_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const progressService = accessor.get(IProgressService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const scriptSelectAction = new ScriptSelectAction(ScriptSelectAction.ID, ScriptSelectAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => scriptSelectAction.run(baseContext));
	}
});

// Script as Execute
CommandsRegistry.registerCommand({
	id: SCRIPT_AS_EXECUTE_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const progressService = accessor.get(IProgressService);
		const errorMessageService = accessor.get(IErrorMessageService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const scriptExecuteAction = new ScriptExecuteAction(ScriptExecuteAction.ID, ScriptExecuteAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService, errorMessageService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => scriptExecuteAction.run(baseContext));
	}
});

// Script as Alter
CommandsRegistry.registerCommand({
	id: SCRIPT_AS_ALTER_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const progressService = accessor.get(IProgressService);
		const errorMessageService = accessor.get(IErrorMessageService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const scriptAlterAction = new ScriptAlterAction(ScriptAlterAction.ID, ScriptAlterAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService, errorMessageService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => scriptAlterAction.run(baseContext));
	}
});

// Edit Data
CommandsRegistry.registerCommand({
	id: EDIT_DATA_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const progressService = accessor.get(IProgressService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const editDataAction = new EditDataAction(EditDataAction.ID, EditDataAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => editDataAction.run(baseContext));
	}
});
//#endregion

//#region -- Object Explorer

export const OE_SCRIPT_AS_CREATE_COMMAND_ID = 'objectExplorer.scriptAsCreate';
export const OE_SCRIPT_AS_DELETE_COMMAND_ID = 'objectExplorer.scriptAsDelete';
export const OE_SCRIPT_AS_SELECT_COMMAND_ID = 'objectExplorer.scriptAsSelect';
export const OE_SCRIPT_AS_EXECUTE_COMMAND_ID = 'objectExplorer.scriptAsExecute';
export const OE_SCRIPT_AS_ALTER_COMMAND_ID = 'objectExplorer.scriptAsAlter';
export const OE_EDIT_DATA_COMMAND_ID = 'objectExplorer.scriptAsEdit';
export const OE_REFRESH_COMMAND_ID = 'objectExplorer.refreshNode';

// Script as Select
CommandsRegistry.registerCommand({
	id: OE_SCRIPT_AS_SELECT_COMMAND_ID,
	handler: async (accessor, args: ObjectExplorerActionsContext) => {
		const instantiationService = accessor.get(IInstantiationService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const objectExplorerService = accessor.get(IObjectExplorerService);
		const selectionHandler = instantiationService.createInstance(TreeSelectionHandler);
		const node = await getTreeNode(args, objectExplorerService);
		selectionHandler.onTreeActionStateChange(true);
		let connectionProfile = TreeUpdateUtils.getConnectionProfile(node);
		let ownerUri = connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = connectionManagementService.getFormattedUri(ownerUri, connectionProfile);
		let metadata = node.metadata;

		return instantiationService.createInstance(ScriptSelectAction, ScriptSelectAction.ID, ScriptSelectAction.LABEL).run({ profile: connectionProfile, object: metadata }).then((result) => {
			selectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
});

// Edit Data
CommandsRegistry.registerCommand({
	id: OE_EDIT_DATA_COMMAND_ID,
	handler: async (accessor, args: ObjectExplorerActionsContext) => {
		const instantiationService = accessor.get(IInstantiationService);
		const objectExplorerService = accessor.get(IObjectExplorerService);
		const selectionHandler = instantiationService.createInstance(TreeSelectionHandler);
		const node = await getTreeNode(args, objectExplorerService);
		selectionHandler.onTreeActionStateChange(true);
		let connectionProfile = TreeUpdateUtils.getConnectionProfile(node);
		let metadata = node.metadata;

		return instantiationService.createInstance(EditDataAction, EditDataAction.ID, EditDataAction.LABEL).run({ profile: connectionProfile, object: metadata }).then((result) => {
			selectionHandler.onTreeActionStateChange(false);
			return true;
		});
	}
});

// Script as Create
CommandsRegistry.registerCommand({
	id: OE_SCRIPT_AS_CREATE_COMMAND_ID,
	handler: async (accessor, args: ObjectExplorerActionsContext) => {
		const instantiationService = accessor.get(IInstantiationService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const objectExplorerService = accessor.get(IObjectExplorerService);
		const selectionHandler = instantiationService.createInstance(TreeSelectionHandler);
		const node = await getTreeNode(args, objectExplorerService);
		selectionHandler.onTreeActionStateChange(true);
		let connectionProfile = TreeUpdateUtils.getConnectionProfile(node);
		let metadata = node.metadata;
		let ownerUri = connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return instantiationService.createInstance(ScriptCreateAction, ScriptCreateAction.ID, ScriptCreateAction.LABEL).run({ profile: connectionProfile, object: metadata }).then((result) => {
			selectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
});

// Script as Execute
CommandsRegistry.registerCommand({
	id: OE_SCRIPT_AS_EXECUTE_COMMAND_ID,
	handler: async (accessor, args: ObjectExplorerActionsContext) => {
		const instantiationService = accessor.get(IInstantiationService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const objectExplorerService = accessor.get(IObjectExplorerService);
		const selectionHandler = instantiationService.createInstance(TreeSelectionHandler);
		const node = await getTreeNode(args, objectExplorerService);
		selectionHandler.onTreeActionStateChange(true);
		let connectionProfile = TreeUpdateUtils.getConnectionProfile(node);
		let metadata = node.metadata;
		let ownerUri = connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return instantiationService.createInstance(ScriptExecuteAction, ScriptExecuteAction.ID, ScriptExecuteAction.LABEL).run({ profile: connectionProfile, object: metadata }).then((result) => {
			selectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
});

// Script as Alter
CommandsRegistry.registerCommand({
	id: OE_SCRIPT_AS_ALTER_COMMAND_ID,
	handler: async (accessor, args: ObjectExplorerActionsContext) => {
		const instantiationService = accessor.get(IInstantiationService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const objectExplorerService = accessor.get(IObjectExplorerService);
		const selectionHandler = instantiationService.createInstance(TreeSelectionHandler);
		const node = await getTreeNode(args, objectExplorerService);
		selectionHandler.onTreeActionStateChange(true);
		let connectionProfile = TreeUpdateUtils.getConnectionProfile(node);
		let metadata = node.metadata;
		let ownerUri = connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return instantiationService.createInstance(ScriptAlterAction, ScriptAlterAction.ID, ScriptAlterAction.LABEL).run({ profile: connectionProfile, object: metadata }).then((result) => {
			selectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
});


// Script as Delete
CommandsRegistry.registerCommand({
	id: OE_SCRIPT_AS_DELETE_COMMAND_ID,
	handler: async (accessor, args: ObjectExplorerActionsContext) => {
		const instantiationService = accessor.get(IInstantiationService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const objectExplorerService = accessor.get(IObjectExplorerService);
		const selectionHandler = instantiationService.createInstance(TreeSelectionHandler);
		//set objectExplorerTreeNode for context menu clicks
		const node = await getTreeNode(args, objectExplorerService);
		selectionHandler.onTreeActionStateChange(true);
		const connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>node);
		const metadata = node.metadata;
		let ownerUri = connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return instantiationService.createInstance(ScriptDeleteAction, ScriptDeleteAction.ID, ScriptDeleteAction.LABEL).run({ profile: connectionProfile, object: metadata }).then((result) => {
			selectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
});

// Refresh Action for Scriptable objects
CommandsRegistry.registerCommand({
	id: OE_REFRESH_COMMAND_ID,
	handler: async (accessor, args: ObjectExplorerActionsContext) => {
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const objectExplorerService = accessor.get(IObjectExplorerService);
		const errorMessageService = accessor.get(IErrorMessageService);
		const connection = new ConnectionProfile(capabilitiesService, args.connectionProfile);
		let treeNode: TreeNode;
		if (connectionManagementService.isConnected(undefined, connection)) {
			treeNode = await getTreeNode(args, objectExplorerService);
			if (treeNode === undefined) {
				objectExplorerService.updateObjectExplorerNodes(connection.toIConnectionProfile()).then(() => {
					treeNode = objectExplorerService.getObjectExplorerNode(connection);
				});
			}
		}
		const tree = objectExplorerService.getServerTreeView().tree;
		if (treeNode) {
			return tree.collapse(treeNode).then(() => {
				return objectExplorerService.refreshTreeNode(treeNode.getSession(), treeNode).then(() => {
					return tree.refresh(treeNode).then(() => {
						return tree.expand(treeNode);
					}, refreshError => {
						return Promise.resolve(true);
					});
				}, error => {
					errorMessageService.showDialog(Severity.Error, '', error);
					return Promise.resolve(true);
				});
			}, collapseError => {
				return Promise.resolve(true);
			});
		}
		return Promise.resolve(true);
	}
});
//#endregion
