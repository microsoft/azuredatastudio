/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { NodeType } from 'sql/parts/registeredServer/common/nodeType';
import { TreeNode } from 'sql/parts/registeredServer/common/treeNode';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import Event, { Emitter } from 'vs/base/common/event';
import * as data from 'data';
import * as nls from 'vs/nls';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { warn, error } from 'sql/base/common/log';
import { ServerTreeView } from 'sql/parts/registeredServer/viewlet/serverTreeView';

export const SERVICE_ID = 'ObjectExplorerService';

export const IObjectExplorerService = createDecorator<IObjectExplorerService>(SERVICE_ID);

export interface IObjectExplorerService {
	_serviceBrand: any;

	createNewSession(providerId: string, connection: ConnectionProfile): Thenable<data.ObjectExplorerSessionResponse>;

	closeSession(providerId: string, session: data.ObjectExplorerSession): Thenable<data.ObjectExplorerCloseSessionResponse>;

	expandNode(providerId: string, session: data.ObjectExplorerSession, nodePath: string): Thenable<data.ObjectExplorerExpandInfo>;

	refreshNode(providerId: string, session: data.ObjectExplorerSession, nodePath: string): Thenable<data.ObjectExplorerExpandInfo>;

	expandTreeNode(session: data.ObjectExplorerSession, parentTree: TreeNode): Thenable<TreeNode[]>;

	refreshTreeNode(session: data.ObjectExplorerSession, parentTree: TreeNode): Thenable<TreeNode[]>;

	onSessionCreated(handle: number, sessionResponse: data.ObjectExplorerSession);

	onNodeExpanded(handle: number, sessionResponse: data.ObjectExplorerExpandInfo);

	/**
	 * Register a ObjectExplorer provider
	 */
	registerProvider(providerId: string, provider: data.ObjectExplorerProvider): void;

	getObjectExplorerNode(connection: IConnectionProfile): TreeNode;

	updateObjectExplorerNodes(connectionProfile: IConnectionProfile): Promise<void>;

	deleteObjectExplorerNode(connection: IConnectionProfile): void;

	onUpdateObjectExplorerNodes: Event<ObjectExplorerNodeEventArgs>;

	registerServerTreeView(view: ServerTreeView): void;

	getSelectedProfileAndDatabase(): { profile: ConnectionProfile, databaseName: string };

	isFocused(): boolean;

	onSelectionOrFocusChange: Event<void>;

	getServerTreeView(): ServerTreeView;
}

interface SessionStatus {
	nodes: { [nodePath: string]: NodeStatus };
	connection: ConnectionProfile;

}

interface NodeStatus {
	expandHandler: (result: data.ObjectExplorerExpandInfo) => void;
}

export interface ObjectExplorerNodeEventArgs {
	connection: IConnectionProfile;
	errorMessage: string;
}


export class ObjectExplorerService implements IObjectExplorerService {

	public _serviceBrand: any;

	private _disposables: IDisposable[] = [];

	private _providers: { [handle: string]: data.ObjectExplorerProvider; } = Object.create(null);

	private _activeObjectExplorerNodes: { [id: string]: TreeNode };
	private _sessions: { [sessionId: string]: SessionStatus };

	private _onUpdateObjectExplorerNodes: Emitter<ObjectExplorerNodeEventArgs>;

	private _serverTreeView: ServerTreeView;

	private _onSelectionOrFocusChange: Emitter<void>;

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService
	) {
		this._onUpdateObjectExplorerNodes = new Emitter<ObjectExplorerNodeEventArgs>();
		this._activeObjectExplorerNodes = {};
		this._sessions = {};
		this._providers = {};
		this._onSelectionOrFocusChange = new Emitter<void>();
	}

	public get onUpdateObjectExplorerNodes(): Event<ObjectExplorerNodeEventArgs> {
		return this._onUpdateObjectExplorerNodes.event;
	}

	/**
	 * Event fired when the selection or focus of Object Explorer changes
	 */
	public get onSelectionOrFocusChange(): Event<void> {
		return this._onSelectionOrFocusChange.event;
	}

	public updateObjectExplorerNodes(connection: IConnectionProfile): Promise<void> {
		return this._connectionManagementService.addSavedPassword(connection).then(withPassword => {
			let connectionProfile = ConnectionProfile.convertToConnectionProfile(
				this._connectionManagementService.getCapabilities(connection.providerName), withPassword);
			return this.updateNewObjectExplorerNode(connectionProfile);
		});
	}

	public deleteObjectExplorerNode(connection: IConnectionProfile): void {
		let self = this;
		var connectionUri = connection.id;
		var nodeTree = this._activeObjectExplorerNodes[connectionUri];
		if (nodeTree) {
			self.closeSession(connection.providerName, nodeTree.getSession()).then(() => {
				delete self._activeObjectExplorerNodes[connectionUri];
				delete self._sessions[nodeTree.getSession().sessionId];
			});
		}
	}

	/**
	 * Gets called when expanded node response is ready
	 */
	public onNodeExpanded(handle: number, expandResponse: data.ObjectExplorerExpandInfo) {

		if (expandResponse.errorMessage) {
			error(expandResponse.errorMessage);
		}

		let nodeStatus = this._sessions[expandResponse.sessionId].nodes[expandResponse.nodePath];
		if (nodeStatus && nodeStatus.expandHandler) {
			nodeStatus.expandHandler(expandResponse);
		} else {
			warn(`Cannot find node status for session: ${expandResponse.sessionId} and node path: ${expandResponse.nodePath}`);
		}
	}

	/**
	 * Gets called when session is created
	 */
	public onSessionCreated(handle: number, session: data.ObjectExplorerSession) {
		let connection: ConnectionProfile = undefined;
		let errorMessage: string = undefined;
		if (this._sessions[session.sessionId]) {
			connection = this._sessions[session.sessionId].connection;

			if (session && session.success && session.rootNode) {
				let server = this.toTreeNode(session.rootNode, null);
				server.connection = connection;
				server.session = session;
				this._activeObjectExplorerNodes[connection.id] = server;
			} else {
				errorMessage = session && session.errorMessage ? session.errorMessage :
					nls.localize('OeSessionFailedError', 'Failed to create Object Explorer session');
				error(errorMessage);
			}

		} else {
			warn(`cannot find session ${session.sessionId}`);
		}

		this.sendUpdateNodeEvent(connection, errorMessage);
	}

	private sendUpdateNodeEvent(connection: ConnectionProfile, errorMessage: string = undefined) {
		let eventArgs: ObjectExplorerNodeEventArgs = {
			connection: <IConnectionProfile>connection,
			errorMessage: errorMessage
		};
		this._onUpdateObjectExplorerNodes.fire(eventArgs);
	}

	private updateNewObjectExplorerNode(connection: ConnectionProfile): Promise<void> {
		let self = this;
		return new Promise<void>((resolve, reject) => {
			if (self._activeObjectExplorerNodes[connection.id]) {
				this.sendUpdateNodeEvent(connection);
				resolve();
			} else {
				// Create session will send the event or reject the promise
				this.createNewSession(connection.providerName, connection).then(response => {
					resolve();
				}, error => {
					this.sendUpdateNodeEvent(connection, error);
					reject(error);
				});
			}
		});
	}

	public getObjectExplorerNode(connection: IConnectionProfile): TreeNode {
		return this._activeObjectExplorerNodes[connection.id];
	}

	public createNewSession(providerId: string, connection: ConnectionProfile): Thenable<data.ObjectExplorerSessionResponse> {
		let self = this;
		return new Promise<data.ObjectExplorerSessionResponse>((resolve, reject) => {
			let provider = this._providers[providerId];
			if (provider) {
				provider.createNewSession(connection.toConnectionInfo()).then(result => {
					self._sessions[result.sessionId] = {
						connection: connection,
						nodes: {}
					};
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(`Provider doesn't exist. id: ${providerId}`);
			}
		});
	}

	public expandNode(providerId: string, session: data.ObjectExplorerSession, nodePath: string): Thenable<data.ObjectExplorerExpandInfo> {
		return new Promise<data.ObjectExplorerExpandInfo>((resolve, reject) => {
			let provider = this._providers[providerId];
			if (provider) {
				TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.ObjectExplorerExpand, { refresh: 0, provider: providerId });
				this.expandOrRefreshNode(provider, session, nodePath).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(`Provider doesn't exist. id: ${providerId}`);
			}
		});
	}
	private callExpandOrRefreshFromProvider(provider: data.ObjectExplorerProvider, nodeInfo: data.ExpandNodeInfo, refresh: boolean = false) {
		if (refresh) {
			return provider.refreshNode(nodeInfo);
		} else {
			return provider.expandNode(nodeInfo);
		}
	}

	private expandOrRefreshNode(
		provider: data.ObjectExplorerProvider,
		session: data.ObjectExplorerSession,
		nodePath: string,
		refresh: boolean = false): Thenable<data.ObjectExplorerExpandInfo> {
		let self = this;
		return new Promise<data.ObjectExplorerExpandInfo>((resolve, reject) => {
			if (session.sessionId in self._sessions && self._sessions[session.sessionId]) {
				self._sessions[session.sessionId].nodes[nodePath] = {
					expandHandler: ((expandResult) => {
						if (expandResult && !expandResult.errorMessage) {
							resolve(expandResult);
						}
						else {
							reject(expandResult ? expandResult.errorMessage : undefined);
						}
						delete self._sessions[session.sessionId].nodes[nodePath];
					})
				};
				self.callExpandOrRefreshFromProvider(provider, {
					sessionId: session ? session.sessionId : undefined,
					nodePath: nodePath
				}, refresh).then(result => {
				}, error => {
					reject(error);
				});
			} else {
				reject(`session cannot find to expand node. id: ${session.sessionId} nodePath: ${nodePath}`);
			}
		});
	}

	public refreshNode(providerId: string, session: data.ObjectExplorerSession, nodePath: string): Thenable<data.ObjectExplorerExpandInfo> {
		let provider = this._providers[providerId];
		if (provider) {
			TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.ObjectExplorerExpand, { refresh: 1, provider: providerId });
			return this.expandOrRefreshNode(provider, session, nodePath, true);
		}
		return Promise.resolve(undefined);
	}

	public closeSession(providerId: string, session: data.ObjectExplorerSession): Thenable<data.ObjectExplorerCloseSessionResponse> {
		let provider = this._providers[providerId];
		if (provider) {
			return provider.closeSession({
				sessionId: session ? session.sessionId : undefined
			});
		}

		return Promise.resolve(undefined);
	}

	/**
	 * Register a ObjectExplorer provider
	 */
	public registerProvider(providerId: string, provider: data.ObjectExplorerProvider): void {
		this._providers[providerId] = provider;
	}

	public dispose(): void {
		this._disposables = dispose(this._disposables);
	}

	public expandTreeNode(session: data.ObjectExplorerSession, parentTree: TreeNode): Thenable<TreeNode[]> {
		return this.expandOrRefreshTreeNode(session, parentTree);
	}

	public refreshTreeNode(session: data.ObjectExplorerSession, parentTree: TreeNode): Thenable<TreeNode[]> {
		return this.expandOrRefreshTreeNode(session, parentTree, true);
	}

	private callExpandOrRefreshFromService(providerId: string, session: data.ObjectExplorerSession, nodePath: string, refresh: boolean = false): Thenable<data.ObjectExplorerExpandInfo> {
		if (refresh) {
			return this.refreshNode(providerId, session, nodePath);
		} else {
			return this.expandNode(providerId, session, nodePath);
		}
	}

	private expandOrRefreshTreeNode(
		session: data.ObjectExplorerSession,
		parentTree: TreeNode,
		refresh: boolean = false): Thenable<TreeNode[]> {
		return new Promise<TreeNode[]>((resolve, reject) => {
			this.callExpandOrRefreshFromService(parentTree.getConnectionProfile().providerName, session, parentTree.nodePath, refresh).then(expandResult => {
				let children: TreeNode[] = [];
				if (expandResult && expandResult.nodes) {
					children = expandResult.nodes.map(node => {
						return this.toTreeNode(node, parentTree);
					});
					parentTree.children = children.filter(c => c !== undefined);
					resolve(children);
				} else {
					reject(expandResult && expandResult.errorMessage ? expandResult.errorMessage : 'Failed to expand node');
				}
			}, error => {
				reject(error);
			});
		});
	}

	private toTreeNode(nodeInfo: data.NodeInfo, parent: TreeNode): TreeNode {
		// Show the status for database nodes with a status field
		let isLeaf: boolean = nodeInfo.isLeaf;
		if (nodeInfo.nodeType === NodeType.Database) {
			if (nodeInfo.nodeStatus) {
				nodeInfo.label = nodeInfo.label + ' (' + nodeInfo.nodeStatus + ')';
			}
			if (isLeaf) {
				// set to common status so we can have a single 'Unavailable' db icon
				nodeInfo.nodeStatus = 'Unavailable';
			} else {
				nodeInfo.nodeStatus = undefined;
			}
		}

		return new TreeNode(nodeInfo.nodeType, nodeInfo.label, isLeaf, nodeInfo.nodePath,
			nodeInfo.nodeSubType, nodeInfo.nodeStatus, parent, nodeInfo.metadata);
	}

	public registerServerTreeView(view: ServerTreeView): void {
		if (this._serverTreeView) {
			throw new Error('The object explorer server tree view is already registered');
		}
		this._serverTreeView = view;
		this._serverTreeView.onSelectionOrFocusChange(() => this._onSelectionOrFocusChange.fire());
	}

	/**
	 * Returns the connection profile corresponding to the current Object Explorer selection,
	 * or undefined if there are multiple selections or no such connection
	 */
	public getSelectedProfileAndDatabase(): { profile: ConnectionProfile, databaseName: string } {
		if (!this._serverTreeView) {
			return undefined;
		}
		let selection = this._serverTreeView.getSelection();
		if (selection.length === 1) {
			let selectedNode = selection[0];
			if (selectedNode instanceof ConnectionProfile) {
				return { profile: selectedNode, databaseName: undefined };
			} else if (selectedNode instanceof TreeNode) {
				let profile = selectedNode.getConnectionProfile();
				let database = selectedNode.getDatabaseName();
				// If the database is unavailable, use the server connection
				if (selectedNode.nodeTypeId === 'Database' && selectedNode.isAlwaysLeaf) {
					database = undefined;
				}
				return { profile: profile, databaseName: database };
			}
		}
		return undefined;
	}

	/**
	 * Returns a boolean indicating whether the Object Explorer tree has focus
	*/
	public isFocused(): boolean {
		return this._serverTreeView.isFocused();
	}

	public getServerTreeView() {
		return this._serverTreeView;
	}
}