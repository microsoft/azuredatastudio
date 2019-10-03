/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { ServerTreeView } from 'sql/workbench/parts/objectExplorer/browser/serverTreeView';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import * as TaskUtilities from 'sql/workbench/browser/taskUtilities';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TreeNode } from 'sql/workbench/parts/objectExplorer/common/treeNode';
import Severity from 'vs/base/common/severity';
import { ObjectExplorerActionsContext } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerActions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { UNSAVED_GROUP_ID } from 'sql/platform/connection/common/constants';
import { IServerGroupController } from 'sql/platform/serverGroup/common/serverGroupController';

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
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) {
		super(id, label);
		this._tree = tree;
	}
	public run(): Promise<boolean> {
		let treeNode: TreeNode;
		if (this.element instanceof ConnectionProfile) {
			let connection: ConnectionProfile = this.element;
			if (this._connectionManagementService.isConnected(undefined, connection)) {
				treeNode = this._objectExplorerService.getObjectExplorerNode(connection);
				if (treeNode === undefined) {
					this._objectExplorerService.updateObjectExplorerNodes(connection.toIConnectionProfile()).then(() => {
						treeNode = this._objectExplorerService.getObjectExplorerNode(connection);
					});
				}
			}
		} else if (this.element instanceof TreeNode) {
			treeNode = this.element;
		}

		if (treeNode) {
			return this._tree.collapse(this.element).then(() => {
				return this._objectExplorerService.refreshTreeNode(treeNode.getSession(), treeNode).then(() => {

					return this._tree.refresh(this.element).then(() => {
						return this._tree.expand(this.element);
					}, refreshError => {
						return Promise.resolve(true);
					});
				}, error => {
					this.showError(error);
					return Promise.resolve(true);
				});
			}, collapseError => {
				return Promise.resolve(true);
			});
		}
		return Promise.resolve(true);
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
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
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) {
		super(id, label);
	}

	run(actionContext: ObjectExplorerActionsContext): Promise<any> {
		return new Promise<boolean>((resolve, reject) => {
			if (!this._connectionProfile) {
				resolve(true);
			}
			if (this._connectionManagementService.isProfileConnected(this._connectionProfile)) {
				let profileImpl = this._connectionProfile as ConnectionProfile;
				if (profileImpl) {
					profileImpl.isDisconnecting = true;
				}
				this._connectionManagementService.disconnect(this._connectionProfile).then((value) => {
					if (profileImpl) {
						profileImpl.isDisconnecting = false;
					}
					resolve(true);
				}
				).catch(disconnectError => {
					reject(disconnectError);
				});
			} else {
				resolve(true);
			}
		});
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

	public run(element: ConnectionProfileGroup): Promise<boolean> {
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
		this._connectionManagementService.showConnectionDialog(undefined, undefined, connection);
		return Promise.resolve(true);
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

	public run(): Promise<boolean> {
		this.serverGroupController.showCreateGroupDialog();
		return Promise.resolve(true);
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
		private view: ServerTreeView
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
		private view: ServerTreeView,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
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
