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
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import Severity from 'vs/base/common/severity';
import { ObjectExplorerActionsContext } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { UNSAVED_GROUP_ID } from 'sql/platform/connection/common/constants';
import { IServerGroupController } from 'sql/platform/serverGroup/common/serverGroupController';
import { ILogService } from 'vs/platform/log/common/log';

export interface IServerView {
	showFilteredTree(filter: string): void;
	refreshTree(): void;
}

export class RefreshAction extends Action {

	public static ID = 'objectExplorer.refresh';
	public static LABEL = localize('connectionTree.refresh', "Refresh");
	private _tree: ITree;

	constructor(
		id: string,
		label: string,
		tree: ITree,
		private element: IConnectionProfile | TreeNode,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@ILogService private _logService: ILogService
	) {
		super(id, label);
		this._tree = tree;
	}
	public async run(): Promise<boolean> {
		let treeNode: TreeNode;
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
				try {
					await this._objectExplorerService.refreshTreeNode(treeNode.getSession(), treeNode);
				} catch (error) {
					this.showError(error);
					return true;
				}
				await this._tree.refresh(this.element);
			} catch (ex) {
				this._logService.error(ex);
				return true;
			}
		}
		return true;
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

	public async run(): Promise<boolean> {
		if (!this._connectionProfile) {
			return false;
		}

		await this._connectionManagementService.showEditConnectionDialog(this._connectionProfile);
		return true;
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

	async run(actionContext: ObjectExplorerActionsContext): Promise<any> {
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
		super(id, label);
		this.class = 'add-server-action';
	}

	public async run(element: ConnectionProfileGroup): Promise<boolean> {
		let connection: IConnectionProfile = element === undefined ? undefined : {
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
			id: element.id
		};
		await this._connectionManagementService.showConnectionDialog(undefined, undefined, connection);
		return true;
	}
}

/**
 * Actions to add a server to the group
 */
export class AddServerGroupAction extends Action {
	public static ID = 'registeredServers.addServerGroup';
	public static LABEL = localize('connectionTree.addServerGroup', "New Server Group");

	constructor(
		id: string,
		label: string,
		@IServerGroupController private readonly serverGroupController: IServerGroupController
	) {
		super(id, label);
		this.class = 'add-server-group-action';
	}

	public async run(): Promise<boolean> {
		await this.serverGroupController.showCreateGroupDialog();
		return true;
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

	public run(): Promise<boolean> {
		this.serverGroupController.showEditGroupDialog(this._group);
		return Promise.resolve(true);
	}
}

/**
 * Display active connections in the tree
 */
export class ActiveConnectionsFilterAction extends Action {
	public static ID = 'registeredServers.recentConnections';
	public static LABEL = localize('activeConnections', "Show Active Connections");
	private static enabledClass = 'active-connections-action';
	private static disabledClass = 'icon server-page';
	private static showAllConnectionsLabel = localize('showAllConnections', "Show All Connections");
	private _isSet: boolean;
	public static readonly ACTIVE = 'active';
	public get isSet(): boolean {
		return this._isSet;
	}
	public set isSet(value: boolean) {
		this._isSet = value;
		this.class = (!this._isSet) ?
			ActiveConnectionsFilterAction.enabledClass : ActiveConnectionsFilterAction.disabledClass;
	}

	constructor(
		id: string,
		label: string,
		private view: IServerView
	) {
		super(id, label);
		this.class = ActiveConnectionsFilterAction.enabledClass;
	}

	public run(): Promise<boolean> {
		if (!this.view) {
			// return without doing anything
			return Promise.resolve(true);
		}
		if (this.class === ActiveConnectionsFilterAction.enabledClass) {
			// show active connections in the tree
			this.view.showFilteredTree(ActiveConnectionsFilterAction.ACTIVE);
			this.isSet = true;
			this.label = ActiveConnectionsFilterAction.showAllConnectionsLabel;
		} else {
			// show full tree
			this.view.refreshTree();
			this.isSet = false;
			this.label = ActiveConnectionsFilterAction.LABEL;
		}
		return Promise.resolve(true);
	}
}

/**
 * Display recent connections in the tree
 */
export class RecentConnectionsFilterAction extends Action {
	public static ID = 'registeredServers.recentConnections';
	public static LABEL = localize('recentConnections', "Recent Connections");
	private static enabledClass = 'recent-connections-action';
	private static disabledClass = 'recent-connections-action-set';
	private _isSet: boolean;
	public get isSet(): boolean {
		return this._isSet;
	}
	public set isSet(value: boolean) {
		this._isSet = value;
		this.class = (!this._isSet) ?
			RecentConnectionsFilterAction.enabledClass : RecentConnectionsFilterAction.disabledClass;
	}
	constructor(
		id: string,
		label: string,
		private view: IServerView
	) {
		super(id, label);
		this.class = RecentConnectionsFilterAction.enabledClass;
		this._isSet = false;
	}

	public run(): Promise<boolean> {
		if (!this.view) {
			// return without doing anything
			return Promise.resolve(true);
		}
		if (this.class === RecentConnectionsFilterAction.enabledClass) {
			// show recent connections in the tree
			this.view.showFilteredTree('recent');
			this.isSet = true;
		} else {
			// show full tree
			this.view.refreshTree();
			this.isSet = false;
		}
		return Promise.resolve(true);
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
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
		this.class = 'delete-connection-action';
		if (element instanceof ConnectionProfileGroup && element.id === UNSAVED_GROUP_ID) {
			this.enabled = false;
		}

		if (element instanceof ConnectionProfile) {
			let parent: ConnectionProfileGroup = element.parent;
			if (parent && parent.id === UNSAVED_GROUP_ID) {
				this.enabled = false;
			}
		}
	}

	public run(): Promise<boolean> {
		if (this.element instanceof ConnectionProfile) {
			this._connectionManagementService.deleteConnection(this.element);
		} else if (this.element instanceof ConnectionProfileGroup) {
			this._connectionManagementService.deleteConnectionGroup(this.element);
		}
		return Promise.resolve(true);
	}
}
