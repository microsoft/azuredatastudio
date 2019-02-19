/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { localize } from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { ExecuteCommandAction } from 'vs/platform/actions/common/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';

import * as sqlops from 'sqlops';
import { IConnectionManagementService, IConnectionCompletionOptions } from 'sql/platform/connection/common/connectionManagement';
import { TreeNode } from 'sql/parts/objectExplorer/common/treeNode';
import {
	ScriptSelectAction, EditDataAction, ScriptCreateAction,
	ScriptExecuteAction, ScriptDeleteAction, ScriptAlterAction
} from 'sql/workbench/common/actions';
import { NodeType } from 'sql/parts/objectExplorer/common/nodeType';
import { TreeUpdateUtils } from 'sql/parts/objectExplorer/viewlet/treeUpdateUtils';
import { TreeSelectionHandler } from 'sql/parts/objectExplorer/viewlet/treeSelectionHandler';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import * as Constants from 'sql/platform/connection/common/constants';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';


export class ObjectExplorerActionsContext implements sqlops.ObjectExplorerContext {
	public connectionProfile: sqlops.IConnectionProfile;
	public nodeInfo: sqlops.NodeInfo;
	public isConnectionNode: boolean = false;
}

async function getTreeNode(context: ObjectExplorerActionsContext, objectExplorerService: IObjectExplorerService): TPromise<TreeNode> {
	if (context.isConnectionNode) {
		return Promise.resolve(undefined);
	}
	return await objectExplorerService.getTreeNode(context.connectionProfile.id, context.nodeInfo.nodePath);
}


export class OEAction extends ExecuteCommandAction {
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ICommandService commandService: ICommandService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
		super(id, label, commandService);
	}

	public async run(actionContext: any): Promise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);


		let profile: IConnectionProfile;
		if (actionContext instanceof ObjectExplorerActionsContext) {
			if (actionContext.isConnectionNode) {
				profile = new ConnectionProfile(this._capabilitiesService, actionContext.connectionProfile);
			} else {
				// Get the "correct" version from the tree
				let treeNode = await getTreeNode(actionContext, this._objectExplorerService);
				profile = TreeUpdateUtils.getConnectionProfile(treeNode);
			}
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);

		return super.run(profile).then(() => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return true;
		});
	}
}

export class ManageConnectionAction extends Action {
	public static ID = 'objectExplorer.manage';
	public static LABEL = localize('ManageAction', 'Manage');

	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string,
		label: string,
		private _tree: ITree,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService protected _capabilitiesService: ICapabilitiesService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService
	) {
		super(id, label);
	}

	run(actionContext: ObjectExplorerActionsContext): TPromise<any> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		this._treeSelectionHandler.onTreeActionStateChange(true);
		let self = this;
		let promise = new TPromise<boolean>((resolve, reject) => {
			self.doManage(actionContext).then((success) => {
				self.done();
				resolve(success);
			}, error => {
				self.done();
				reject(error);
			});
		});
		return promise;
	}

	private async doManage(actionContext: ObjectExplorerActionsContext): TPromise<boolean> {
		let treeNode: TreeNode = undefined;
		let connectionProfile: IConnectionProfile = undefined;
		if (actionContext instanceof ObjectExplorerActionsContext) {
			// Must use a real connection profile for this action due to lookup
			connectionProfile = ConnectionProfile.fromIConnectionProfile(this._capabilitiesService, actionContext.connectionProfile);
			if (!actionContext.isConnectionNode) {
				treeNode = await getTreeNode(actionContext, this._objectExplorerService);
				if (TreeUpdateUtils.isDatabaseNode(treeNode)) {
					connectionProfile = TreeUpdateUtils.getConnectionProfile(treeNode);
				}
			}
		}

		if (!connectionProfile) {
			// This should never happen. There should be always a valid connection if the manage action is called for
			// an OE node or a database node
			return true;
		}

		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showConnectionDialogOnError: true,
			showDashboard: true,
			showFirewallRuleOnError: true
		};

		// If it's a database node just open a database connection and open dashboard,
		// the node is already from an open OE session we don't need to create new session
		if (TreeUpdateUtils.isAvailableDatabaseNode(treeNode)) {
			return this._connectionManagementService.showDashboard(connectionProfile);
		} else {
			return TreeUpdateUtils.connectAndCreateOeSession(connectionProfile, options, this._connectionManagementService, this._objectExplorerService, this._tree);
		}
	}

	private done() {
		this._treeSelectionHandler.onTreeActionStateChange(false);
	}

	dispose(): void {
		super.dispose();
	}
}

export class OEScriptSelectAction extends ScriptSelectAction {
	public static ID = 'objectExplorer.' + ScriptSelectAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(id, label, _queryEditorService, _connectionManagementService, _scriptingService);
	}

	public async run(actionContext: any): Promise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = await getTreeNode(actionContext, this._objectExplorerService);
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(this._objectExplorerTreeNode);
		var ownerUri = this._connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = this._connectionManagementService.getFormattedUri(ownerUri, connectionProfile);
		var metadata = this._objectExplorerTreeNode.metadata;

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}

export class OEEditDataAction extends EditDataAction {
	public static ID = 'objectExplorer.' + EditDataAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(id, label, _queryEditorService, _connectionManagementService, _scriptingService);
	}

	public async run(actionContext: any): Promise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = await getTreeNode(actionContext, this._objectExplorerService);
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
		var metadata = (<TreeNode>this._objectExplorerTreeNode).metadata;

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return true;
		});
	}
}

export class OEScriptCreateAction extends ScriptCreateAction {
	public static ID = 'objectExplorer.' + ScriptCreateAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label, _queryEditorService, _connectionManagementService, _scriptingService, _errorMessageService);
	}

	public async run(actionContext: any): Promise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = await getTreeNode(actionContext, this._objectExplorerService);
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
		var metadata = (<TreeNode>this._objectExplorerTreeNode).metadata;
		var ownerUri = this._connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = this._connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}

export class OEScriptExecuteAction extends ScriptExecuteAction {
	public static ID = 'objectExplorer.' + ScriptExecuteAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label, _queryEditorService, _connectionManagementService, _scriptingService, _errorMessageService);
	}

	public async run(actionContext: any): Promise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = await getTreeNode(actionContext, this._objectExplorerService);
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
		var metadata = (<TreeNode>this._objectExplorerTreeNode).metadata;
		var ownerUri = this._connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = this._connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}

export class OEScriptAlterAction extends ScriptAlterAction {
	public static ID = 'objectExplorer.' + ScriptAlterAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label, _queryEditorService, _connectionManagementService, _scriptingService, _errorMessageService);
	}

	public async run(actionContext: any): Promise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = await getTreeNode(actionContext, this._objectExplorerService);
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
		var metadata = (<TreeNode>this._objectExplorerTreeNode).metadata;
		var ownerUri = this._connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = this._connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}

export class OEScriptDeleteAction extends ScriptDeleteAction {
	public static ID = 'objectExplorer.' + ScriptDeleteAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label, _queryEditorService, _connectionManagementService, _scriptingService, _errorMessageService);
	}

	public async run(actionContext: any): Promise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = await getTreeNode(actionContext, this._objectExplorerService);
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
		var metadata = (<TreeNode>this._objectExplorerTreeNode).metadata;
		var ownerUri = this._connectionManagementService.getConnectionUri(connectionProfile);
		ownerUri = this._connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}

export class ObjectExplorerActionUtilities {

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
}

