/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ServerTreeView } from 'sql/workbench/parts/objectExplorer/browser/serverTreeView';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ObjectExplorerActionsContext } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerActions';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

export class DisconnectConnectionAction extends Action {
	public static ID = 'objectExplorer.disconnect';
	public static LABEL = localize('DisconnectAction', "Disconnect");

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService private readonly capabilitiesService: ICapabilitiesService
	) {
		super(id, label);
	}

	run(actionContext: ObjectExplorerActionsContext): Promise<any> {
		return new Promise<boolean>((resolve, reject) => {
			if (!actionContext.connectionProfile) {
				resolve(true);
			}
			const profile = new ConnectionProfile(this.capabilitiesService, actionContext.connectionProfile);
			if (this._connectionManagementService.isProfileConnected(profile)) {
				profile.isDisconnecting = true;
				this._connectionManagementService.disconnect(actionContext.connectionProfile).then((value) => {
					profile.isDisconnecting = false;
					resolve(true);
				}).catch(disconnectError => {
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
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
		this.class = 'add-server-group-action';
	}

	public run(): Promise<boolean> {
		this._connectionManagementService.showCreateServerGroupDialog();
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
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
		this.class = 'edit-server-group-action';
	}

	public run(group: ConnectionProfileGroup): Promise<boolean> {
		this._connectionManagementService.showEditServerGroupDialog(group);
		return Promise.resolve(true);
	}
}

/**
 * Actions to delete a server/group
 */
export class DeleteConnectionGroupAction extends Action {
	public static ID = 'registeredServers.deleteConnectionGroup';
	public static LABEL = localize('deleteConnectionGroup', "Delete Group");

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
	}

	public run(group: ConnectionProfileGroup): Promise<boolean> {
		this._connectionManagementService.deleteConnectionGroup(group);
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
	public static LABEL = localize('deleteConnection', "Delete Connection");

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService private readonly capabilitiesService: ICapabilitiesService
	) {
		super(id, label);
	}

	public run(context: ObjectExplorerActionsContext): Promise<boolean> {
		const profile = new ConnectionProfile(this.capabilitiesService, context.connectionProfile);
		this._connectionManagementService.deleteConnection(profile);
		return Promise.resolve(true);
	}
}
