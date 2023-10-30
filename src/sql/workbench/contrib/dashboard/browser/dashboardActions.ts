/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IConnectionManagementService, IConnectionCompletionOptions } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { generateUri } from 'sql/platform/connection/common/utils';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { TreeSelectionHandler } from 'sql/workbench/services/objectExplorer/browser/treeSelectionHandler';
import { ObjectExplorerActionsContext, getTreeNode } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IViewsService } from 'vs/workbench/common/views';
import { ConnectionViewletPanel } from 'sql/workbench/contrib/dataExplorer/browser/connectionViewletPanel';
import * as TaskUtilities from 'sql/workbench/browser/taskUtilities';
import { ILogService } from 'vs/platform/log/common/log';

export const DE_MANAGE_COMMAND_ID = 'dataExplorer.manage';

// Manage
CommandsRegistry.registerCommand({
	id: DE_MANAGE_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		if (args.$treeItem) {
			const connectionService = accessor.get(IConnectionManagementService);
			const capabilitiesService = accessor.get(ICapabilitiesService);
			const providerName = args.$treeItem?.payload?.providerName;
			if (providerName && capabilitiesService.providers[providerName] === undefined) {
				await connectionService.handleUnsupportedProvider(providerName);
			} else {
				let options = {
					showDashboard: true,
					saveTheConnection: false,
					showConnectionDialogOnError: true,
					showFirewallRuleOnError: true
				};
				let payload = await connectionService.fixProfile(args.$treeItem.payload);
				let profile = new ConnectionProfile(capabilitiesService, payload);
				let uri = generateUri(profile, 'dashboard');
				return connectionService.connect(new ConnectionProfile(capabilitiesService, args.$treeItem.payload), uri, options);
			}
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
		@IEditorService private readonly _editorService: IEditorService,
		@ICapabilitiesService protected readonly _capabilitiesService: ICapabilitiesService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IObjectExplorerService private readonly _objectExplorerService: IObjectExplorerService,
		@IViewsService private readonly _viewsService: IViewsService,
		@ILogService private readonly _logService: ILogService
	) {
		super(id, label);
	}

	override async run(actionContext: ObjectExplorerActionsContext): Promise<void> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		this._treeSelectionHandler.onTreeActionStateChange(true);
		try {
			await this.doManage(actionContext);
		} finally {
			this.done();
		}
	}

	private async doManage(actionContext: ObjectExplorerActionsContext): Promise<boolean> {
		let treeNode: TreeNode = undefined;
		let connectionProfile: ConnectionProfile | undefined;

		if (actionContext instanceof ObjectExplorerActionsContext) {
			// Must use a real connection profile for this action due to lookup
			let updatedIConnProfile = await this._connectionManagementService.fixProfile(actionContext.connectionProfile);
			connectionProfile = ConnectionProfile.fromIConnectionProfile(this._capabilitiesService, updatedIConnProfile);
			if (!actionContext.isConnectionNode) {
				treeNode = await getTreeNode(actionContext, this._objectExplorerService);
				if (TreeUpdateUtils.isDatabaseNode(treeNode)) {
					connectionProfile = TreeUpdateUtils.getConnectionProfile(treeNode);
				}
			}
		}
		else if (!actionContext) {
			const globalProfile = TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._editorService, this._logService);
			connectionProfile = globalProfile ? ConnectionProfile.fromIConnectionProfile(this._capabilitiesService, globalProfile) : undefined;
		}

		if (!connectionProfile) {
			// No valid connection (e.g. This was triggered without an active context to get the connection from) so just return early
			this._logService.info('dashboardActions.doManage: No connection found to connect.');
			return true;
		}

		if (!this._capabilitiesService.getCapabilities(connectionProfile.providerName)) {
			this._connectionManagementService.handleUnsupportedProvider(connectionProfile.providerName);
			return true;
		}

		let options: IConnectionCompletionOptions = {
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

	override dispose(): void {
		super.dispose();
	}
}
