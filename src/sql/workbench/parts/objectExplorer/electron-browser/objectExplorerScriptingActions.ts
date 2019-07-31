/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ScriptSelectAction, EditDataAction, ScriptCreateAction, ScriptExecuteAction, ScriptAlterAction, ScriptDeleteAction } from 'sql/workbench/electron-browser/scriptingActions';
import { TreeSelectionHandler } from 'sql/workbench/parts/objectExplorer/browser/treeSelectionHandler';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ObjectExplorerActionsContext, getTreeNode } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerActions';
import { TreeUpdateUtils } from 'sql/workbench/parts/objectExplorer/browser/treeUpdateUtils';
import { TreeNode } from 'sql/workbench/parts/objectExplorer/common/treeNode';
import { Action } from 'vs/base/common/actions';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';

export const SCRIPT_AS_CREATE_COMMAND_ID = 'objectExplorer.scriptAsCreate';
export const SCRIPT_AS_DELETE_COMMAND_ID = 'objectExplorer.scriptAsDelete';
export const SCRIPT_AS_SELECT_COMMAND_ID = 'objectExplorer.scriptAsSelect';
export const SCRIPT_AS_EXECUTE_COMMAND_ID = 'objectExplorer.scriptAsExecute';
export const SCRIPT_AS_ALTER_COMMAND_ID = 'objectExplorer.scriptAsAlter';
export const EDIT_DATA_COMMAND_ID = 'objectExplorer.scriptAsAlter';

// Script as Create
CommandsRegistry.registerCommand({
	id: SCRIPT_AS_SELECT_COMMAND_ID,
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

CommandsRegistry.registerCommand({
	id: EDIT_DATA_COMMAND_ID,
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

CommandsRegistry.registerCommand({
	id: SCRIPT_AS_CREATE_COMMAND_ID,
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

CommandsRegistry.registerCommand({
	id: SCRIPT_AS_EXECUTE_COMMAND_ID,
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

export class OEScriptAlterAction extends Action {
	public static ID = 'objectExplorer.' + ScriptAlterAction.ID;

	constructor(
		id: string, label: string,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private readonly objectExplorerService: IObjectExplorerService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super(id, label);
	}

	public async run(actionContext: ObjectExplorerActionsContext): Promise<boolean> {
		const selectionHandler = this.instantiationService.createInstance(TreeSelectionHandler);
		const node = await getTreeNode(actionContext, this.objectExplorerService);
		selectionHandler.onTreeActionStateChange(true);
		let connectionProfile = TreeUpdateUtils.getConnectionProfile(node);
		let metadata = node.metadata;
		let ownerUri = this.connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = this.connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return this.instantiationService.createInstance(ScriptAlterAction, this.id, this.label).run({ profile: connectionProfile, object: metadata }).then((result) => {
			selectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}

export class OEScriptDeleteAction extends Action {
	public static ID = 'objectExplorer.' + ScriptDeleteAction.ID;

	constructor(
		id: string, label: string,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private readonly objectExplorerService: IObjectExplorerService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public async run(actionContext: ObjectExplorerActionsContext): Promise<boolean> {
		const selectionHandler = this.instantiationService.createInstance(TreeSelectionHandler);
		//set objectExplorerTreeNode for context menu clicks
		const node = await getTreeNode(actionContext, this.objectExplorerService);
		selectionHandler.onTreeActionStateChange(true);
		const connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>node);
		const metadata = node.metadata;
		let ownerUri = this.connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = this.connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return this.instantiationService.createInstance(ScriptDeleteAction, this.id, this.label).run({ profile: connectionProfile, object: metadata }).then((result) => {
			selectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}
/*
class ObjectExplorerActionUtilities {

	public static readonly objectExplorerElementClass = 'object-element-group';
	public static readonly connectionElementClass = 'connection-tile';

	public static getScriptMap(treeNode: TreeNode): Map<NodeType, any[]> {
		let scriptMap = new Map<NodeType, any[]>();

		let isMssqlProvider: boolean = true;
		if (treeNode) {
			let connectionProfile = treeNode.getConnectionProfile();
			if (connectionProfile) {
				isMssqlProvider = connectionProfile.providerName === Constants.mssqlProviderName;
			}
		}

		let basicScripting = [OEScriptCreateAction, OEScriptDeleteAction];
		let storedProcedureScripting = isMssqlProvider ? [OEScriptCreateAction, OEScriptAlterAction, OEScriptDeleteAction, OEScriptExecuteAction] :
			basicScripting;

		let viewScripting = isMssqlProvider ? [OEScriptSelectAction, OEScriptCreateAction, OEScriptAlterAction, OEScriptDeleteAction] :
			[OEScriptSelectAction, OEScriptCreateAction, OEScriptDeleteAction];

		let functionScripting = isMssqlProvider ? [OEScriptCreateAction, OEScriptAlterAction, OEScriptDeleteAction] :
			basicScripting;
		scriptMap.set(NodeType.AggregateFunction, functionScripting);
		scriptMap.set(NodeType.PartitionFunction, functionScripting);
		scriptMap.set(NodeType.ScalarValuedFunction, functionScripting);
		scriptMap.set(NodeType.Schema, basicScripting);
		scriptMap.set(NodeType.StoredProcedure, storedProcedureScripting);
		scriptMap.set(NodeType.Table, [OEScriptSelectAction, OEEditDataAction, OEScriptCreateAction, OEScriptDeleteAction]);
		scriptMap.set(NodeType.TableValuedFunction, functionScripting);
		scriptMap.set(NodeType.User, basicScripting);
		scriptMap.set(NodeType.UserDefinedTableType, basicScripting);
		scriptMap.set(NodeType.View, viewScripting);
		return scriptMap;
	}
}*/
