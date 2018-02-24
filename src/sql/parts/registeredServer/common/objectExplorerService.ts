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
import * as sqlops from 'sqlops';
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

	createNewSession(providerId: string, connection: ConnectionProfile): Thenable<sqlops.ObjectExplorerSessionResponse>;

	closeSession(providerId: string, session: sqlops.ObjectExplorerSession): Thenable<sqlops.ObjectExplorerCloseSessionResponse>;

	expandNode(providerId: string, session: sqlops.ObjectExplorerSession, nodePath: string): Thenable<sqlops.ObjectExplorerExpandInfo>;

	refreshNode(providerId: string, session: sqlops.ObjectExplorerSession, nodePath: string): Thenable<sqlops.ObjectExplorerExpandInfo>;

	expandTreeNode(session: sqlops.ObjectExplorerSession, parentTree: TreeNode): Thenable<TreeNode[]>;

	refreshTreeNode(session: sqlops.ObjectExplorerSession, parentTree: TreeNode): Thenable<TreeNode[]>;

	onSessionCreated(handle: number, sessionResponse: sqlops.ObjectExplorerSession);

	onNodeExpanded(handle: number, sessionResponse: sqlops.ObjectExplorerExpandInfo);

	/**
	 * Register a ObjectExplorer provider
	 */
	registerProvider(providerId: string, provider: sqlops.ObjectExplorerProvider): void;

	getObjectExplorerNode(connection: IConnectionProfile): TreeNode;

	updateObjectExplorerNodes(connectionProfile: IConnectionProfile): Promise<void>;

	deleteObjectExplorerNode(connection: IConnectionProfile): void;

	onUpdateObjectExplorerNodes: Event<ObjectExplorerNodeEventArgs>;

	registerServerTreeView(view: ServerTreeView): void;

	getSelectedProfileAndDatabase(): { profile: ConnectionProfile, databaseName: string };

	isFocused(): boolean;

	onSelectionOrFocusChange: Event<void>;

	getServerTreeView(): ServerTreeView;

	getActiveConnections(): { connectionId: string, nodeInfo: sqlops.NodeInfo }[];

	getChildren(connectionId: string, nodePath: string): Thenable<sqlops.NodeInfo[]>;

	isExpanded(connectionId: string, nodePath: string): boolean;

	expandNodeForConnection(connectionId: string, nodePath: string): Thenable<void>;

	collapseNodeForConnection(connectionId: string, nodePath: string): Thenable<void>;

	selectNodeForConnection(connectionId: string, nodePath: string): Thenable<void>;

	findNodeInfo(connectionId: string, nodePath: string): Thenable<sqlops.NodeInfo>;
}

interface SessionStatus {
	nodes: { [nodePath: string]: NodeStatus };
	connection: ConnectionProfile;
	treeNodes: { [nodePath: string]: TreeNode };
}

interface NodeStatus {
	expandEmitter: Emitter<sqlops.ObjectExplorerExpandInfo>;
}

export interface ObjectExplorerNodeEventArgs {
	connection: IConnectionProfile;
	errorMessage: string;
}


export class ObjectExplorerService implements IObjectExplorerService {

	public _serviceBrand: any;

	private _disposables: IDisposable[] = [];

	private _providers: { [handle: string]: sqlops.ObjectExplorerProvider; } = Object.create(null);

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
	public onNodeExpanded(handle: number, expandResponse: sqlops.ObjectExplorerExpandInfo) {

		if (expandResponse.errorMessage) {
			error(expandResponse.errorMessage);
		}

		let nodeStatus = this._sessions[expandResponse.sessionId].nodes[expandResponse.nodePath];
		if (nodeStatus && nodeStatus.expandEmitter) {
			nodeStatus.expandEmitter.fire(expandResponse);
		} else {
			warn(`Cannot find node status for session: ${expandResponse.sessionId} and node path: ${expandResponse.nodePath}`);
		}
	}

	/**
	 * Gets called when session is created
	 */
	public onSessionCreated(handle: number, session: sqlops.ObjectExplorerSession) {
		let connection: ConnectionProfile = undefined;
		let errorMessage: string = undefined;
		if (this._sessions[session.sessionId]) {
			connection = this._sessions[session.sessionId].connection;

			if (session && session.success && session.rootNode) {
				let server = this.toTreeNode(session.rootNode, null);
				server.connection = connection;
				server.session = session;
				this._activeObjectExplorerNodes[connection.id] = server;
				this._sessions[session.sessionId].treeNodes[server.nodePath] = server;
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

	public createNewSession(providerId: string, connection: ConnectionProfile): Thenable<sqlops.ObjectExplorerSessionResponse> {
		let self = this;
		return new Promise<sqlops.ObjectExplorerSessionResponse>((resolve, reject) => {
			let provider = this._providers[providerId];
			if (provider) {
				provider.createNewSession(connection.toConnectionInfo()).then(result => {
					self._sessions[result.sessionId] = {
						connection: connection,
						nodes: {},
						treeNodes: {}
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

	public expandNode(providerId: string, session: sqlops.ObjectExplorerSession, nodePath: string): Thenable<sqlops.ObjectExplorerExpandInfo> {
		return new Promise<sqlops.ObjectExplorerExpandInfo>((resolve, reject) => {
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
	private callExpandOrRefreshFromProvider(provider: sqlops.ObjectExplorerProvider, nodeInfo: sqlops.ExpandNodeInfo, refresh: boolean = false) {
		if (refresh) {
			return provider.refreshNode(nodeInfo);
		} else {
			return provider.expandNode(nodeInfo);
		}
	}

	private expandOrRefreshNode(
		provider: sqlops.ObjectExplorerProvider,
		session: sqlops.ObjectExplorerSession,
		nodePath: string,
		refresh: boolean = false): Thenable<sqlops.ObjectExplorerExpandInfo> {
		let self = this;
		return new Promise<sqlops.ObjectExplorerExpandInfo>((resolve, reject) => {
			if (session.sessionId in self._sessions && self._sessions[session.sessionId]) {
				let newRequest = false;
				if (!self._sessions[session.sessionId].nodes[nodePath]) {
					self._sessions[session.sessionId].nodes[nodePath] = {
						expandEmitter: new Emitter<sqlops.ObjectExplorerExpandInfo>()
					};
					newRequest = true;
				}
				self._sessions[session.sessionId].nodes[nodePath].expandEmitter.event(((expandResult) => {
					if (expandResult && !expandResult.errorMessage) {
						resolve(expandResult);
					}
					else {
						reject(expandResult ? expandResult.errorMessage : undefined);
					}
					if (newRequest) {
						delete self._sessions[session.sessionId].nodes[nodePath];
					}
				}));
				if (newRequest) {
					self.callExpandOrRefreshFromProvider(provider, {
						sessionId: session ? session.sessionId : undefined,
						nodePath: nodePath
					}, refresh).then(result => {
					}, error => {
						reject(error);
					});
				}
			} else {
				reject(`session cannot find to expand node. id: ${session.sessionId} nodePath: ${nodePath}`);
			}
		});
	}

	public refreshNode(providerId: string, session: sqlops.ObjectExplorerSession, nodePath: string): Thenable<sqlops.ObjectExplorerExpandInfo> {
		let provider = this._providers[providerId];
		if (provider) {
			TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.ObjectExplorerExpand, { refresh: 1, provider: providerId });
			return this.expandOrRefreshNode(provider, session, nodePath, true);
		}
		return Promise.resolve(undefined);
	}

	public closeSession(providerId: string, session: sqlops.ObjectExplorerSession): Thenable<sqlops.ObjectExplorerCloseSessionResponse> {
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
	public registerProvider(providerId: string, provider: sqlops.ObjectExplorerProvider): void {
		this._providers[providerId] = provider;
	}

	public dispose(): void {
		this._disposables = dispose(this._disposables);
	}

	public expandTreeNode(session: sqlops.ObjectExplorerSession, parentTree: TreeNode): Thenable<TreeNode[]> {
		return this.expandOrRefreshTreeNode(session, parentTree);
	}

	public refreshTreeNode(session: sqlops.ObjectExplorerSession, parentTree: TreeNode): Thenable<TreeNode[]> {
		return this.expandOrRefreshTreeNode(session, parentTree, true);
	}

	private callExpandOrRefreshFromService(providerId: string, session: sqlops.ObjectExplorerSession, nodePath: string, refresh: boolean = false): Thenable<sqlops.ObjectExplorerExpandInfo> {
		if (refresh) {
			return this.refreshNode(providerId, session, nodePath);
		} else {
			return this.expandNode(providerId, session, nodePath);
		}
	}

	private expandOrRefreshTreeNode(
		session: sqlops.ObjectExplorerSession,
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

	private toTreeNode(nodeInfo: sqlops.NodeInfo, parent: TreeNode): TreeNode {
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

	public getActiveConnections(): { connectionId: string, nodeInfo: sqlops.NodeInfo }[] {
		let connections: [string, TreeNode][] = Object.entries(this._activeObjectExplorerNodes);
		return connections.map(([connectionId, treeNode]) => {
			this._sessions[treeNode.session.sessionId].treeNodes[treeNode.nodePath] = treeNode;
			return {
				connectionId: connectionId,
				nodeInfo: treeNode.toNodeInfo()
			};
		});
	}

	public expandNodeForConnection(connectionId: string, nodePath: string, stopAtParent: boolean = false): Thenable<void> {
		let rootNode = this._activeObjectExplorerNodes[connectionId];
		if (!rootNode) {
			return Promise.reject('The given connection is not active in Object Explorer');
		}
		let node = this.findTreeNode(connectionId, nodePath);
		if (!node) {
			// The node is not in the tree yet, so expand its parent nodes to make it visible
			return this.findNodeInfo(connectionId, nodePath).then(nodeInfo => {
				if (!nodeInfo) {
					return Promise.reject('There is no object at the given node path');
				}
				return new Promise((resolve, reject) => {
					// Recursively expand the tree to get to the given node
					let expandFunction = ((treeNode: TreeNode) => {
						if ((stopAtParent || treeNode.isAlwaysLeaf) && treeNode.nodePath === nodePath) {
							resolve();
							return;
						} else if (treeNode.isAlwaysLeaf) {
							reject('Could not find tree node for expand due to leaf node on path');
							return;
						}
						this._serverTreeView.expand(treeNode === rootNode ? rootNode.connection : treeNode).then(() => {
							if (treeNode.nodePath === nodePath) {
								resolve();
								return;
							}
							let children = treeNode.children.filter(child => nodePath.startsWith(child.nodePath));
							if (children.length === 0) {
								reject('Could not find matching tree node for expand');
								return;
							}
							let nextNode = children.reduce((currentMax, newNode) => currentMax.nodePath.length < newNode.nodePath.length ? newNode : currentMax);
							expandFunction(nextNode);
						}, err => reject(err));
					});
					expandFunction(rootNode);
				});
			});
		}
		// Otherwise the node is already in the tree, so expand and reveal it
		let expandNode: any = node;
		if (node === rootNode) {
			expandNode = node.connection;
		}
		if (stopAtParent) {
			return this._serverTreeView.reveal(expandNode);
		}
		return this.expandNode(rootNode.connection.providerName, rootNode.session, nodePath).then(() => {
			return this._serverTreeView.expand(expandNode).then(() => this._serverTreeView.reveal(expandNode));
		});
	}

	public collapseNodeForConnection(connectionId: string, nodePath: string): Thenable<void> {
		let treeNode = this.findTreeNode(connectionId, nodePath);
		if (!treeNode) {
			// No visible matching tree node. If there is no object matching the node path at all, reject the promise.
			// Otherwise resolve it since the node is already collapsed
			return this.findNodeInfo(connectionId, nodePath).then(nodeInfo => {
				if (!nodeInfo) {
					throw new Error('Could not find matching tree node for collapse');
				}
				return Promise.resolve();
			});
		}
		let rootNode = this._activeObjectExplorerNodes[connectionId];
		let collapseNode: any = treeNode;
		if (treeNode === rootNode) {
			collapseNode = treeNode.connection;
		}
		return this._serverTreeView.collapse(collapseNode);
	}

	public selectNodeForConnection(connectionId: string, nodePath: string): Thenable<void> {
		return this.expandNodeForConnection(connectionId, nodePath, true).then(() => {
			let node = this.findTreeNode(connectionId, nodePath);
			let rootNode = this._activeObjectExplorerNodes[connectionId];
			let selectNode: TreeNode | ConnectionProfile = node;
			if (node === rootNode) {
				selectNode = node.connection;
			}
			this._serverTreeView.select(selectNode);
		});
	}

	public getChildren(connectionId: string, nodePath: string): Thenable<sqlops.NodeInfo[]> {
		return this.findNodeInfo(connectionId, nodePath).then(parentNode => {
			if (!parentNode) {
				throw new Error('There is no object at the given node path');
			}
			let rootNode = this._activeObjectExplorerNodes[connectionId];
			if (parentNode.isLeaf) {
				return Promise.resolve([]);
			}
			return this.expandNode(rootNode.connection.providerName, rootNode.session, nodePath).then(expandInfo => {
				return expandInfo.nodes;
			});
		});
	}

	public isExpanded(connectionId: string, nodePath: string): boolean {
		let treeNode = this.findTreeNode(connectionId, nodePath, true);
		if (!treeNode) {
			return false;
		}
		let rootNode = this._activeObjectExplorerNodes[connectionId];
		let expandNode: TreeNode | ConnectionProfile = treeNode;
		if (treeNode === rootNode) {
			expandNode = treeNode.connection;
		}
		return this._serverTreeView.isExpanded(expandNode);
	}

	private findTreeNode(connectionId: string, nodePath: string, onlyExpandedParents: boolean = false): TreeNode {
		let parentNode = this._activeObjectExplorerNodes[connectionId];
		if (!parentNode) {
			return undefined;
		}
		if (!nodePath) {
			return parentNode;
		}
		let currentNode = parentNode;
		while (currentNode.nodePath !== nodePath) {
			if (onlyExpandedParents && !this._serverTreeView.isExpanded(currentNode === parentNode ? parentNode.connection : currentNode)) {
				return undefined;
			}
			let nextNode = undefined;
			if (currentNode.children) {
				let children = currentNode.children.filter(child => nodePath.startsWith(child.nodePath));
				nextNode = children.reduce((currentMax, candidate) => currentMax.nodePath.length < candidate.nodePath.length ? candidate : currentMax);
			}
			if (!nextNode) {
				return undefined;
			}
			currentNode = nextNode;
		}
		return currentNode;
	}

	public findNodeInfo(connectionId: string, nodePath: string): Thenable<sqlops.NodeInfo> {
		let rootNode = this._activeObjectExplorerNodes[connectionId];
		if (!rootNode) {
			return Promise.resolve(undefined);
		}
		return new Promise((resolve, reject) => {
			let findNodeFunction = (currentNodePath: string) => {
				this.expandNode(rootNode.connection.providerName, rootNode.session, currentNodePath).then(expandInfo => {
					let candidates: sqlops.NodeInfo[] = [];
					expandInfo.nodes.forEach(node => {
						if (node.nodePath === nodePath) {
							resolve(node);
							return;
						} else if (nodePath.startsWith(node.nodePath) && !node.isLeaf) {
							candidates.push(node);
						}
					});
					if (candidates.length === 0) {
						resolve(undefined);
					} else {
						let nextNode = candidates.reduce((currentMax, candidate) => currentMax.nodePath.length < candidate.nodePath.length ? candidate : currentMax);
						findNodeFunction(nextNode.nodePath);
					}
				}, err => reject(err));
			};
			if (rootNode.nodePath === nodePath) {
				resolve(rootNode.toNodeInfo());
			}
			findNodeFunction(rootNode.nodePath);
		});
	}
}