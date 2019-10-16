/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { IConnectionManagementService, IConnectionCompletionOptions } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { generateUri } from 'sql/platform/connection/common/utils';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { TreeSelectionHandler } from 'sql/workbench/parts/objectExplorer/browser/treeSelectionHandler';
import { ObjectExplorerActionsContext, getTreeNode } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerActions';
import { TreeNode } from 'sql/workbench/parts/objectExplorer/common/treeNode';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { TreeUpdateUtils } from 'sql/workbench/parts/objectExplorer/browser/treeUpdateUtils';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IViewsService } from 'vs/workbench/common/views';
import { ConnectionViewletPanel } from 'sql/workbench/parts/dataExplorer/browser/connectionViewletPanel';

export const DE_MANAGE_COMMAND_ID = 'dataExplorer.manage';

// Manage
CommandsRegistry.registerCommand({
	id: DE_MANAGE_COMMAND_ID,
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

export const OE_MANAGE_COMMAND_ID = 'objectExplorer.manage';

// Manage
CommandsRegistry.registerCommand({
	id: OE_MANAGE_COMMAND_ID,
	handler: (accessor, args: ObjectExplorerActionsContext) => {
		return accessor.get(IInstantiationService).createInstance(OEManageConnectionAction, OEManageConnectionAction.ID, OEManageConnectionAction.LABEL).run(args);
	}
});

export class OEManageConnectionAction extends Action {
	public static ID = 'objectExplorer.manage';
	public static LABEL = localize('ManageAction', "Manage");

	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService protected readonly _connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService protected readonly _capabilitiesService: ICapabilitiesService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IObjectExplorerService private readonly _objectExplorerService: IObjectExplorerService,
		@IViewsService private readonly _viewsService: IViewsService
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
			const view = await this._viewsService.openView(ConnectionViewletPanel.ID) as ConnectionViewletPanel;
			return TreeUpdateUtils.connectAndCreateOeSession(connectionProfile, options, this._connectionManagementService, this._objectExplorerService, view.serversTree);
		}
	}

	private done() {
		this._treeSelectionHandler.onTreeActionStateChange(false);
	}

	dispose(): void {
		super.dispose();
	}
}
