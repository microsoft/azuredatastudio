/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ITree } from 'sql/base/parts/tree/browser/tree';
import { IObjectExplorerService, ServerTreeViewView } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import Severity from 'vs/base/common/severity';
import { ObjectExplorerActionsContext } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { UNSAVED_GROUP_ID } from 'sql/platform/connection/common/constants';
import { IServerGroupController } from 'sql/platform/serverGroup/common/serverGroupController';
import { ILogService } from 'vs/platform/log/common/log';
import { AsyncServerTree, ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { SqlIconId } from 'sql/base/common/codicons';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { ObjectExplorerServiceDialog } from 'sql/workbench/services/objectExplorer/browser/filterDialog/filterDialog';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export interface IServerView {
	showFilteredTree(filter: string): void;
	refreshTree(): void;
}

export class RefreshAction extends Action {

	public static ID = 'objectExplorer.refresh';
	public static LABEL = localize('connectionTree.refresh', "Refresh");

	constructor(
		id: string,
		label: string,
		private _tree: AsyncServerTree | ITree,
		private element: ServerTreeElement,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@ILogService private _logService: ILogService
	) {
		super(id, label);
	}
	public override async run(): Promise<void> {
		let treeNode: TreeNode | undefined = undefined;
		if (this.element instanceof ConnectionProfile) {
			let connection: ConnectionProfile = this.element;
			if (this._connectionManagementService.isConnected(undefined, connection)) {
				treeNode = this._objectExplorerService.getObjectExplorerNode(connection);
				if (treeNode === undefined) {
					await this._objectExplorerService.updateObjectExplorerNodes(connection.toIConnectionProfile());
					treeNode = this._objectExplorerService.getObjectExplorerNode(connection);
				}
			}
		} else if (this.element instanceof TreeNode) {
			treeNode = this.element;
		}

		if (treeNode) {
			try {
				if (this._tree instanceof AsyncServerTree) {
					// Code moved here as non async tree already does it in it's refresh function (required to show loading spinner)
					try {
						const session = treeNode.getSession();
						if (session) {
							await this._objectExplorerService.refreshTreeNode(session, treeNode);
						}
					} catch (error) {
						this.showError(error);
						return;
					}
					await this._tree.updateChildren(this.element);
				} else {
					await this._tree.refresh(this.element);
				}
			} catch (ex) {
				this._logService.error(ex);
				return;
			}
		}
	}

	private showError(errorMessage: string) {
		this._logService.error(errorMessage);
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}
}

export class EditConnectionAction extends Action {
	public static ID = 'registeredServers.editConnection';
	public static LABEL = localize('connectionTree.editConnection', "Edit Connection");

	constructor(
		id: string,
		label: string,
		private _connectionProfile: ConnectionProfile,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
		this.class = 'edit-server-action';
	}

	public override async run(): Promise<void> {
		if (this._connectionProfile) {
			await this._connectionManagementService.showEditConnectionDialog(this._connectionProfile);
		}
	}
}

export class DisconnectConnectionAction extends Action {
	public static ID = 'objectExplorer.disconnect';
	public static LABEL = localize('DisconnectAction', "Disconnect");

	constructor(
		id: string,
		label: string,
		private _connectionProfile: ConnectionProfile,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
	}

	override async run(actionContext: ObjectExplorerActionsContext): Promise<any> {
		if (!this._connectionProfile) {
			return true;
		}
		if (this._connectionManagementService.isProfileConnected(this._connectionProfile)) {
			let profileImpl = this._connectionProfile as ConnectionProfile;
			if (profileImpl) {
				profileImpl.isDisconnecting = true;
			}
			await this._connectionManagementService.disconnect(this._connectionProfile);
			if (profileImpl) {
				profileImpl.isDisconnecting = false;
			}
			return true;
		} else {
			return true;
		}
	}
}

/**
 * Actions to add a server to the group
 */
export class AddServerAction extends Action {
	public static ID = 'registeredServers.addConnection';
	public static LABEL = localize('connectionTree.addConnection', "New Connection");

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label, SqlIconId.addServerAction);
	}

	public override async run(element: ConnectionProfileGroup): Promise<void> {
		// Not sure how to fix this....
		let connection: Partial<IConnectionProfile> | undefined = element === undefined ? undefined : {
			connectionName: undefined,
			serverName: undefined,
			databaseName: undefined,
			userName: undefined,
			password: undefined,
			authenticationType: undefined,
			groupId: undefined,
			groupFullName: element.fullName,
			savePassword: undefined,
			getOptionsKey: undefined,
			matches: undefined,
			providerName: '',
			options: {},
			saveProfile: true,
			id: element.id!
		} as Partial<IConnectionProfile>;
		await this._connectionManagementService.showConnectionDialog(undefined, undefined, connection);
	}
}

/**
 * Action to open up the dialog to create a new server group
 */
export class AddServerGroupAction extends Action {
	public static ID = 'registeredServers.addServerGroup';
	public static LABEL = localize('connectionTree.addServerGroup', "New Server Group");

	constructor(
		id: string,
		label: string,
		@IServerGroupController private readonly serverGroupController: IServerGroupController
	) {
		super(id, label, SqlIconId.addServerGroupAction);
	}

	public override async run(): Promise<void> {
		return this.serverGroupController.showCreateGroupDialog();
	}
}

/**
 * Actions to edit a server group
 */
export class EditServerGroupAction extends Action {
	public static ID = 'registeredServers.editServerGroup';
	public static LABEL = localize('connectionTree.editServerGroup', "Edit Server Group");

	constructor(
		id: string,
		label: string,
		private _group: ConnectionProfileGroup,
		@IServerGroupController private readonly serverGroupController: IServerGroupController
	) {
		super(id, label);
		this.class = 'edit-server-group-action';
	}

	public override run(): Promise<void> {
		return this.serverGroupController.showEditGroupDialog(this._group);
	}
}

/**
 * Action to toggle filtering the server connections tree to only show
 * active connections or not.
 */
export class ActiveConnectionsFilterAction extends Action {
	public static ID = 'registeredServers.recentConnections';
	public static SHOW_ACTIVE_CONNECTIONS_LABEL = localize('activeConnections', "Show Active Connections");
	public static SHOW_ALL_CONNECTIONS_LABEL = localize('showAllConnections', "Show All Connections");
	public static readonly ACTIVE = 'active';

	constructor(
		id: string,
		label: string,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService
	) {
		super(id, label, SqlIconId.activeConnectionsAction);
	}

	public override async run(): Promise<void> {
		const serverTreeView = this._objectExplorerService.getServerTreeView();
		if (serverTreeView.view !== ServerTreeViewView.active) {
			// show active connections in the tree
			serverTreeView.showFilteredTree(ServerTreeViewView.active);
		} else {
			// show full tree
			await serverTreeView.refreshTree();
		}
	}
}

/**
 * Actions to delete a server/group
 */
export class DeleteConnectionAction extends Action {
	public static ID = 'registeredServers.deleteConnection';
	public static DELETE_CONNECTION_LABEL = localize('deleteConnection', "Delete Connection");
	public static DELETE_CONNECTION_GROUP_LABEL = localize('deleteConnectionGroup', "Delete Group");

	constructor(
		id: string,
		label: string,
		private element: IConnectionProfile | ConnectionProfileGroup,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IDialogService private _dialogService: IDialogService
	) {
		super(id, label);
		this.class = 'delete-connection-action';
		if (element instanceof ConnectionProfileGroup && element.id === UNSAVED_GROUP_ID) {
			this.enabled = false;
		}

		if (element instanceof ConnectionProfile) {
			let parent: ConnectionProfileGroup | undefined = element.parent;
			if (parent && parent.id === UNSAVED_GROUP_ID) {
				this.enabled = false;
			}
		}
	}

	public override async run(): Promise<void> {

		const deleteConnectionConfirmationYes = localize('deleteConnectionConfirmationYes', "Yes");
		const deleteConnectionConfirmationNo = localize('deleteConnectionConfirmationNo', "No");

		if (this.element instanceof ConnectionProfile) {
			const name = this.element.connectionName || this.element.serverName;
			const modalResult = await this._dialogService.show(Severity.Warning, localize('deleteConnectionConfirmation', "Are you sure you want to delete connection '{0}'?", name),
				[deleteConnectionConfirmationYes, deleteConnectionConfirmationNo]);
			if (modalResult.choice === 0) {
				await this._connectionManagementService.deleteConnection(this.element);
			}
		} else if (this.element instanceof ConnectionProfileGroup) {
			const modalResult = await this._dialogService.show(Severity.Warning, localize('deleteConnectionGroupConfirmation', "Are you sure you want to delete connection group '{0}'?", this.element.name),
				[deleteConnectionConfirmationYes, deleteConnectionConfirmationNo]);
			if (modalResult.choice === 0) {
				await this._connectionManagementService.deleteConnectionGroup(this.element);
			}
		}
	}
}

export class FilterChildren extends Action {
	public static ID = 'objectExplorer.filterChildren';
	public static LABEL = localize('objectExplorer.filterChildren', "Filter");

	constructor(
		id: string,
		label: string,
		private _node: TreeNode,
		private _tree: AsyncServerTree | ITree,
		private _profile: ConnectionProfile | undefined,
		@IInstantiationService private _instantiationService: IInstantiationService) {
		super(id, label);
	}

	public override async run(): Promise<void> {
		const filterDialog = this._instantiationService.createInstance(ObjectExplorerServiceDialog, this._node, this._tree, this._profile);
		filterDialog.open();
	}
}

export class RemoveFilterAction extends Action {
	public static ID = 'objectExplorer.removeFilter';
	public static LABEL = localize('objectExplorer.removeFilter', "Remove Filter");

	constructor(
		id: string,
		label: string,
		private _node: TreeNode,
		private _tree: AsyncServerTree | ITree,
		private _profile: ConnectionProfile | undefined,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService
	) {
		super(id, label);
	}

	public override async run(): Promise<void> {
		let node = this._node;
		let nodeToRefresh: ServerTreeElement = this._node;
		if (this._profile) {
			node = this._objectExplorerService.getObjectExplorerNode(this._profile);
			nodeToRefresh = this._profile;
		}
		node.filters = [];
		if (this._tree instanceof AsyncServerTree) {
			await this._tree.rerender(nodeToRefresh);
			await this._tree.updateChildren(nodeToRefresh);
			await this._tree.expand(nodeToRefresh);
		} else {
			await this._tree.refresh(nodeToRefresh);
			await this._tree.expand(nodeToRefresh);
		}
	}
}
