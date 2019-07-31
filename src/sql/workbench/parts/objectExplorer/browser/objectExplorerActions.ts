/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { ExecuteCommandAction } from 'vs/platform/actions/common/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';

import * as azdata from 'azdata';
import { IConnectionManagementService, IConnectionCompletionOptions } from 'sql/platform/connection/common/connectionManagement';
import { TreeNode } from 'sql/workbench/parts/objectExplorer/common/treeNode';
import { TreeUpdateUtils } from 'sql/workbench/parts/objectExplorer/browser/treeUpdateUtils';
import { TreeSelectionHandler } from 'sql/workbench/parts/objectExplorer/browser/treeSelectionHandler';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';

export class ObjectExplorerActionsContext implements azdata.ObjectExplorerContext {
	public connectionProfile: azdata.IConnectionProfile;
	public nodeInfo: azdata.NodeInfo;
	public isConnectionNode: boolean = false;
}

export async function getTreeNode(context: ObjectExplorerActionsContext, objectExplorerService: IObjectExplorerService): Promise<TreeNode> {
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
	public static LABEL = localize('ManageAction', "Manage");

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

	run(actionContext: ObjectExplorerActionsContext): Promise<any> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		this._treeSelectionHandler.onTreeActionStateChange(true);
		let self = this;
		let promise = new Promise<boolean>((resolve, reject) => {
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

	private async doManage(actionContext: ObjectExplorerActionsContext): Promise<boolean> {
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
