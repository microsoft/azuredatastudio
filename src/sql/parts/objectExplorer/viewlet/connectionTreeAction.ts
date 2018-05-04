/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { IConnectionManagementService, IErrorMessageService } from 'sql/parts/connection/common/connectionManagement';
import { IQueryEditorService } from 'sql/parts/query/common/queryEditorService';
import { ServerTreeView } from 'sql/parts/objectExplorer/viewlet/serverTreeView';
import { ConnectionViewlet } from 'sql/parts/objectExplorer/viewlet/connectionViewlet';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { ConnectionProfileGroup } from 'sql/parts/connection/common/connectionProfileGroup';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import * as Constants from 'sql/parts/connection/common/constants';
import { IObjectExplorerService } from 'sql/parts/objectExplorer/common/objectExplorerService';
import { TreeNode } from 'sql/parts/objectExplorer/common/treeNode';
import Severity from 'vs/base/common/severity';
import { ObjectExplorerActionsContext, ObjectExplorerActionUtilities } from 'sql/parts/objectExplorer/viewlet/objectExplorerActions';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';

export class RefreshAction extends Action {

	public static ID = 'objectExplorer.refresh';
	public static LABEL = localize('connectionTree.refresh', 'Refresh');
	private _tree: ITree;

	constructor(
		id: string,
		label: string,
		tree: ITree,
		private element: ConnectionProfile | TreeNode,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) {
		super(id, label);
		this._tree = tree;
	}
	public run(): TPromise<boolean> {
		var treeNode: TreeNode;
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
			this._tree.collapse(this.element).then(() => {
				this._objectExplorerService.refreshTreeNode(treeNode.getSession(), treeNode).then(() => {

					this._tree.refresh(this.element).then(() => {
						this._tree.expand(this.element);
					}, refreshError => {
						return TPromise.as(true);
					});
				}, error => {
					this.showError(error);
					return TPromise.as(true);
				});
			}, collapseError => {
				return TPromise.as(true);
			});
		}
		return TPromise.as(true);
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}
}

export class DisconnectConnectionAction extends Action {
	public static ID = 'objectExplorer.disconnect';
	public static LABEL = localize('DisconnectAction', 'Disconnect');

	private _disposables: IDisposable[] = [];
	private _connectionProfile: ConnectionProfile;

	private _container: HTMLElement;

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) {
		super(id, label);
		const self = this;
		this._disposables.push(this._connectionManagementService.onConnect(() => {
			self.setLabel();
		})
		);
		this._disposables.push(this._connectionManagementService.onDisconnect((disconnectParams) => {
			if (this._connectionProfile) {
				this._connectionProfile.isDisconnecting = false;
			}
			self.setLabel();
			self._connectionManagementService.closeDashboard(disconnectParams.connectionUri);
		})
		);
		if (this._objectExplorerService && this._objectExplorerService.onUpdateObjectExplorerNodes) {
			this._disposables.push(this._objectExplorerService.onUpdateObjectExplorerNodes((args) => {
				self.removeSpinning(args.connection);
				if (args.errorMessage !== undefined) {
					self.showError(args.errorMessage);
				}
			})
			);
		}
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}

	private setLabel(): void {
		if (!this._connectionProfile) {
			this.label = 'Connect';
			return;
		}
		this.label = this._connectionManagementService.isProfileConnected(this._connectionProfile) ? 'Disconnect' : 'Connect';
	}

	private removeSpinning(connection: IConnectionProfile): void {
		if (this._connectionProfile) {
			if (connection.id === this._connectionProfile.id && this._container) {
				ObjectExplorerActionUtilities.hideLoadingIcon(this._container, ObjectExplorerActionUtilities.connectionElementClass);
			}
		}
	}

	run(actionContext: ObjectExplorerActionsContext): TPromise<any> {
		return new TPromise<boolean>((resolve, reject) => {
			if (actionContext instanceof ObjectExplorerActionsContext) {
				//set objectExplorerTreeNode for context menu clicks
				this._connectionProfile = actionContext.connectionProfile;
				this._container = actionContext.container;
				resolve(true);
			}

			if (!this._connectionProfile) {
				resolve(true);
			}
			if (this._connectionManagementService.isProfileConnected(this._connectionProfile)) {
				this._connectionProfile.isDisconnecting = true;
				this._connectionManagementService.disconnect(this._connectionProfile).then((value) => {
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

	dispose(): void {
		super.dispose();
		this._disposables = dispose(this._disposables);
	}
}


/**
 * Actions to add a server to the group
 */
export class AddServerAction extends Action {
	public static ID = 'registeredServers.addConnection';
	public static LABEL = localize('connectionTree.addConnection', 'New Connection');

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
		this.class = 'add-server-action';
	}

	public run(element: ConnectionProfileGroup): TPromise<boolean> {
		let connection: IConnectionProfile = element === undefined ? undefined : {
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
		this._connectionManagementService.showConnectionDialog(undefined, connection);
		return TPromise.as(true);
	}
}

/**
 * Actions to add a server to the group
 */
export class AddServerGroupAction extends Action {
	public static ID = 'registeredServers.addServerGroup';
	public static LABEL = localize('connectionTree.addServerGroup', 'New Server Group');

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
		this.class = 'add-server-group-action';
	}

	public run(): TPromise<boolean> {
		this._connectionManagementService.showCreateServerGroupDialog();
		return TPromise.as(true);
	}
}

/**
 * Actions to edit a server group
 */
export class EditServerGroupAction extends Action {
	public static ID = 'registeredServers.editServerGroup';
	public static LABEL = localize('connectionTree.editServerGroup', 'Edit Server Group');

	constructor(
		id: string,
		label: string,
		private _group: ConnectionProfileGroup,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
		this.class = 'edit-server-group-action';
	}

	public run(): TPromise<boolean> {
		this._connectionManagementService.showEditServerGroupDialog(this._group);
		return TPromise.as(true);
	}
}

/**
 * Display active connections in the tree
 */
export class ActiveConnectionsFilterAction extends Action {
	public static ID = 'registeredServers.recentConnections';
	public static LABEL = localize('activeConnections', 'Show Active Connections');
	private static enabledClass = 'active-connections-action';
	private static disabledClass = 'icon server-page';
	private static clearAllLabel = localize('clearAll', 'Clear All');
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
		private view: ServerTreeView,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
		this.class = ActiveConnectionsFilterAction.enabledClass;
	}

	public run(): TPromise<boolean> {
		if (!this.view) {
			// return without doing anything
			return TPromise.as(true);
		}
		if (this.class === ActiveConnectionsFilterAction.enabledClass) {
			// show active connections in the tree
			this.view.showFilteredTree(ActiveConnectionsFilterAction.ACTIVE);
			this.isSet = true;
			this.label = ActiveConnectionsFilterAction.clearAllLabel;
		} else {
			// show full tree
			this.view.refreshTree();
			this.isSet = false;
			this.label = ActiveConnectionsFilterAction.LABEL;
		}
		return TPromise.as(true);
	}
}

/**
 * Display recent connections in the tree
 */
export class RecentConnectionsFilterAction extends Action {
	public static ID = 'registeredServers.recentConnections';
	public static LABEL = localize('recentConnections', 'Recent Connections');
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

	public run(): TPromise<boolean> {
		if (!this.view) {
			// return without doing anything
			return TPromise.as(true);
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
		return TPromise.as(true);
	}
}

export class NewQueryAction extends Action {
	public static ID = 'registeredServers.newQuery';
	public static LABEL = localize('registeredServers.newQuery', 'New Query');
	private _connectionProfile: ConnectionProfile;
	get connectionProfile(): ConnectionProfile {
		return this._connectionProfile;
	}
	set connectionProfile(profile: ConnectionProfile) {
		this._connectionProfile = profile;
	}

	constructor(
		id: string,
		label: string,
		@IQueryEditorService private queryEditorService: IQueryEditorService,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService protected _objectExplorerService: IObjectExplorerService,
		@IWorkbenchEditorService protected _workbenchEditorService: IWorkbenchEditorService
	) {
		super(id, label);
		this.class = 'extension-action update';
	}

	public run(actionContext: ObjectExplorerActionsContext): TPromise<boolean> {
		if (actionContext instanceof ObjectExplorerActionsContext) {
			this._connectionProfile = actionContext.connectionProfile;
		}

		TaskUtilities.newQuery(this._connectionProfile, this.connectionManagementService, this.queryEditorService, this._objectExplorerService, this._workbenchEditorService);
		return TPromise.as(true);
	}
}

/**
 * Actions to delete a server/group
 */
export class DeleteConnectionAction extends Action {
	public static ID = 'registeredServers.deleteConnection';
	public static DELETE_CONNECTION_LABEL = localize('deleteConnection', 'Delete Connection');
	public static DELETE_CONNECTION_GROUP_LABEL = localize('deleteConnectionGroup', 'Delete Group');

	constructor(
		id: string,
		label: string,
		private element: ConnectionProfile | ConnectionProfileGroup,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
		this.class = 'delete-connection-action';
		if (element instanceof ConnectionProfileGroup && element.id === Constants.unsavedGroupId) {
			this.enabled = false;
		}

		if (element instanceof ConnectionProfile) {
			element = <ConnectionProfile>element;
			let parent: ConnectionProfileGroup = element.parent;
			if (parent && parent.id === Constants.unsavedGroupId) {
				this.enabled = false;
			}
		}
	}

	public run(): TPromise<boolean> {
		if (this.element instanceof ConnectionProfile) {
			this._connectionManagementService.deleteConnection(this.element);
		} else if (this.element instanceof ConnectionProfileGroup) {
			this._connectionManagementService.deleteConnectionGroup(this.element);
		}
		return TPromise.as(true);
	}
}

/**
 * Action to clear search results
 */
export class ClearSearchAction extends Action {
	public static ID = 'registeredServers.clearSearch';
	public static LABEL = localize('clearSearch', 'Clear Search');

	constructor(
		id: string,
		label: string,
		private _viewlet: ConnectionViewlet,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
		this.class = 'icon close';
		this.enabled = false;
	}

	public run(): TPromise<boolean> {
		this._viewlet.clearSearch();
		return TPromise.as(true);
	}
}