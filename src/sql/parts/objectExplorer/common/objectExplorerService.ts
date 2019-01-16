/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { NodeType } from 'sql/parts/objectExplorer/common/nodeType';
import { TreeNode, TreeItemCollapsibleState } from 'sql/parts/objectExplorer/common/treeNode';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { Event, Emitter } from 'vs/base/common/event';
import * as sqlops from 'sqlops';
import * as nls from 'vs/nls';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { warn, error } from 'sql/base/common/log';
import { ServerTreeView } from 'sql/parts/objectExplorer/viewlet/serverTreeView';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import * as Utils from 'sql/parts/connection/common/utils';

export const SERVICE_ID = 'ObjectExplorerService';

export const IObjectExplorerService = createDecorator<IObjectExplorerService>(SERVICE_ID);

export interface IObjectExplorerService {
	_serviceBrand: any;

	createNewSession(providerId: string, connection: ConnectionProfile): Thenable<sqlops.ObjectExplorerSessionResponse>;

	closeSession(providerId: string, session: sqlops.ObjectExplorerSession): Thenable<sqlops.ObjectExplorerCloseSessionResponse>;

	expandNode(providerId: string, session: sqlops.ObjectExplorerSession, nodePath: string): Thenable<sqlops.ObjectExplorerExpandInfo>;

	refreshNode(providerId: string, session: sqlops.ObjectExplorerSession, nodePath: string): Thenable<sqlops.ObjectExplorerExpandInfo>;

	resolveTreeNodeChildren(session: sqlops.ObjectExplorerSession, parentTree: TreeNode): Thenable<TreeNode[]>;

	refreshTreeNode(session: sqlops.ObjectExplorerSession, parentTree: TreeNode): Thenable<TreeNode[]>;

	onSessionCreated(handle: number, sessionResponse: sqlops.ObjectExplorerSession);

	onSessionDisconnected(handle: number, sessionResponse: sqlops.ObjectExplorerSession);

	onNodeExpanded(handle: number, sessionResponse: sqlops.ObjectExplorerExpandInfo);

	/**
	 * Register a ObjectExplorer provider
	 */
	registerProvider(providerId: string, provider: sqlops.ObjectExplorerProvider): void;

	registerExpander(expander: sqlops.ObjectExplorerNodeExpander): void;

	getObjectExplorerNode(connection: IConnectionProfile): TreeNode;

	updateObjectExplorerNodes(connectionProfile: IConnectionProfile): Promise<void>;

	deleteObjectExplorerNode(connection: IConnectionProfile): Thenable<void>;

	onUpdateObjectExplorerNodes: Event<ObjectExplorerNodeEventArgs>;

	registerServerTreeView(view: ServerTreeView): void;

	getSelectedProfileAndDatabase(): { profile: ConnectionProfile, databaseName: string };

	isFocused(): boolean;

	onSelectionOrFocusChange: Event<void>;

	getServerTreeView(): ServerTreeView;

	findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames?: string[]): Thenable<sqlops.NodeInfo[]>;

	getActiveConnectionNodes(): TreeNode[];

	getTreeNode(connectionId: string, nodePath: string): Thenable<TreeNode>;

	refreshNodeInView(connectionId: string, nodePath: string): Thenable<TreeNode>;
}

interface SessionStatus {
	nodes: { [nodePath: string]: NodeStatus };
	connection: ConnectionProfile;
}

interface NodeStatus {
	expandEmitter: Emitter<sqlops.ObjectExplorerExpandInfo>;
}

export interface ObjectExplorerNodeEventArgs {
	connection: IConnectionProfile;
	errorMessage: string;
}

export interface NodeInfoWithConnection {
	connectionId: string;
	nodeInfo: sqlops.NodeInfo;
}

export interface TopLevelExpander {
	providerId: string;
	supportedProviderId: string;
	groupingId: number;
	path: string[];
	expanderObject: sqlops.ObjectExplorerNodeExpander | sqlops.ObjectExplorerProvider;
}

export class ObjectExplorerService implements IObjectExplorerService {

	public _serviceBrand: any;

	private _disposables: IDisposable[] = [];

	private _providers: { [handle: string]: sqlops.ObjectExplorerProvider; } = Object.create(null);

	private _expanders: { [handle: string]: sqlops.ObjectExplorerNodeExpander[]; } = Object.create(null);

	private _topLevelChildrenPath: TopLevelExpander[] = Object.create(null);

	private _activeObjectExplorerNodes: { [id: string]: TreeNode };

	private _sessions: { [sessionId: string]: SessionStatus };

	private _onUpdateObjectExplorerNodes: Emitter<ObjectExplorerNodeEventArgs>;

	private _serverTreeView: ServerTreeView;

	private _onSelectionOrFocusChange: Emitter<void>;

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
		this._onUpdateObjectExplorerNodes = new Emitter<ObjectExplorerNodeEventArgs>();
		this._activeObjectExplorerNodes = {};
		this._sessions = {};
		this._providers = {};
		this._expanders = {};
		this._topLevelChildrenPath = [];

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
			let connectionProfile = ConnectionProfile.fromIConnectionProfile(this._capabilitiesService, withPassword);
			return this.updateNewObjectExplorerNode(connectionProfile);
		});
	}

	public deleteObjectExplorerNode(connection: IConnectionProfile): Thenable<void> {
		let self = this;
		var connectionUri = connection.id;
		var nodeTree = this._activeObjectExplorerNodes[connectionUri];
		if (nodeTree) {
			return self.closeSession(connection.providerName, nodeTree.getSession()).then(() => {
				delete self._activeObjectExplorerNodes[connectionUri];
				delete self._sessions[nodeTree.getSession().sessionId];
			});
		}
		return Promise.resolve();
	}

	/**
	 * Gets called when expanded node response is ready
	 */
	public onNodeExpanded(handle: number, expandResponse: sqlops.ObjectExplorerExpandInfo) {

		if (expandResponse.errorMessage) {
			error(expandResponse.errorMessage);
		}

		let sessionStatus = this._sessions[expandResponse.sessionId];
		let foundSession = false;
		if (sessionStatus) {
			let nodeStatus = this._sessions[expandResponse.sessionId].nodes[expandResponse.nodePath];
			foundSession = !!nodeStatus;
			if (foundSession && nodeStatus.expandEmitter) {
				nodeStatus.expandEmitter.fire(expandResponse);
			}
		}
		if (!foundSession) {
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

	/**
	 * Gets called when session is disconnected
	 */
	public onSessionDisconnected(handle: number, session: sqlops.ObjectExplorerSession) {
		if (this._sessions[session.sessionId]) {
			let connection: ConnectionProfile = this._sessions[session.sessionId].connection;
			if (connection && this._connectionManagementService.isProfileConnected(connection)) {
				let uri: string = Utils.generateUri(connection);
				if (this._serverTreeView.isObjectExplorerConnectionUri(uri)) {
					this._serverTreeView.deleteObjectExplorerNodeAndRefreshTree(connection).then(() => {
						this.sendUpdateNodeEvent(connection, session.errorMessage);
						connection.isDisconnecting = true;
						this._connectionManagementService.disconnect(connection).then((value) => {
							connection.isDisconnecting = false;
						});
					});
				}
			}
		} else {
			warn(`Cannot find session ${session.sessionId}`);
		}
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

	public async createNewSession(providerId: string, connection: ConnectionProfile): Promise<sqlops.ObjectExplorerSessionResponse> {
		let self = this;
		return new Promise<sqlops.ObjectExplorerSessionResponse>((resolve, reject) => {
			let provider = this._providers[providerId];
			if (provider) {
				provider.createNewSession(connection.toConnectionInfo()).then(result => {
					self._sessions[result.sessionId] = {
						connection: connection,
						nodes: {},
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

	public expandNodeFromProvider(provider: sqlops.ObjectExplorerProvider | sqlops.ObjectExplorerNodeExpander, session: sqlops.ObjectExplorerSession, nodePath: string): Thenable<sqlops.ObjectExplorerExpandInfo> {
		return new Promise<sqlops.ObjectExplorerExpandInfo>((resolve, reject) => {
			this.expandOrRefreshNode(provider, session, nodePath).then(result => {
				resolve(result);
			}, error => {
				reject(error);
			});
		});
	}

	public expandNode(providerId: string, session: sqlops.ObjectExplorerSession, nodePath: string): Thenable<sqlops.ObjectExplorerExpandInfo> {
		return new Promise<sqlops.ObjectExplorerExpandInfo>((resolve, reject) => {
			let provider = this._providers[providerId];
			if (provider) {
				TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.ObjectExplorerExpand, { refresh: 0, provider: providerId });
				let serverInfo = this._connectionManagementService.getActiveConnectionServerInfo(this._sessions[session.sessionId].connection.id);
				if (serverInfo && !serverInfo.options.isBigDataCluster) {
					this.expandOrRefreshNode(provider, session, nodePath).then(result => {
						resolve(result);
					}, error => {
						reject(error);
					});
				} else {
					if (this._topLevelChildrenPath.length === 0 ) {
						this.expandOrRefreshNode(provider, session, nodePath).then(result => {
							if (result) {
								let pathes: string[] = [];
								result.nodes.forEach(node => pathes.push(node.nodePath));
								this._topLevelChildrenPath.push({ providerId: provider.providerId, supportedProviderId: provider.providerId, groupingId: 0,path: pathes, expanderObject: provider });

								let expanders = this._expanders[providerId].sort(expander=> expander.groupingId);
								if (expanders) {
									for (let expander of expanders) {
										this.expandOrRefreshNode(expander, session, nodePath).then(result2 => {
											if (result2) {
												let pathes: string[] = [];
												result2.nodes.forEach(node => pathes.push(node.nodePath));
												this._topLevelChildrenPath.push({ providerId: expander.providerId, supportedProviderId: expander.supportedProviderId, groupingId: expander.groupingId,path: pathes, expanderObject: expander });
												result.nodes = result.nodes.concat(result2.nodes);
												resolve(result);
											}
										}, error => {
											reject(error);
										});
									}
								}
							}
						}, error => {
							reject(error);
						});
					} else {
						if (this._topLevelChildrenPath) {
							for (let topLevelExpander of this._topLevelChildrenPath) {
								if (topLevelExpander.supportedProviderId === providerId
									&& topLevelExpander.path.some(p => nodePath.indexOf(p) >= 0)
									&& topLevelExpander.expanderObject) {
									this.expandOrRefreshNode(topLevelExpander.expanderObject, session, nodePath).then(result => {
										resolve(result);
									}, error => {
										reject(error);
									});
								}
							}
						}
					}
				}
			} else {
				reject(`Provider doesn't exist. id: ${providerId}`);
			}
		});
	}

	private callExpandOrRefreshFromProvider(provider: sqlops.ObjectExplorerProvider | sqlops.ObjectExplorerNodeExpander, nodeInfo: sqlops.ExpandNodeInfo, refresh: boolean = false) {
		if (refresh) {
			return provider.refreshNode(nodeInfo);
		} else {
			return provider.expandNode(nodeInfo);
		}
	}

	private expandOrRefreshNode(
		provider: sqlops.ObjectExplorerProvider | sqlops.ObjectExplorerNodeExpander,
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
						sessionId: session.sessionId,
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
		// Complete any requests that are still open for the session
		let sessionStatus = this._sessions[session.sessionId];
		if (sessionStatus && sessionStatus.nodes) {
			Object.entries(sessionStatus.nodes).forEach(([nodePath, nodeStatus]: [string, NodeStatus]) => {
				if (nodeStatus.expandEmitter) {
					nodeStatus.expandEmitter.fire({
						sessionId: session.sessionId,
						nodes: [],
						nodePath: nodePath,
						errorMessage: undefined
					});
				}
			});
		}

		let provider = this._providers[providerId];
		if (provider) {
			this._topLevelChildrenPath = [];
			provider.closeSession({
				sessionId: session ? session.sessionId : undefined
			}).then(() => {
				let expanders = this._expanders[providerId];
				for (let expander of expanders) {
					expander.closeSession({
						sessionId: session ? session.sessionId : undefined
					});
				}
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

	public registerExpander(expander: sqlops.ObjectExplorerNodeExpander): void {
		let expanders = this._expanders[expander.supportedProviderId] || [];
		expanders.push(expander);
		this._expanders[expander.supportedProviderId] = expanders;
	}

	public dispose(): void {
		this._disposables = dispose(this._disposables);
	}

	public resolveTreeNodeChildren(session: sqlops.ObjectExplorerSession, parentTree: TreeNode): Thenable<TreeNode[]> {
		// Always refresh the node if it has an error, otherwise expand it normally
		let needsRefresh = !!parentTree.errorStateMessage;
		return this.expandOrRefreshTreeNode(session, parentTree, needsRefresh);
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
			nodeInfo.nodeSubType, nodeInfo.nodeStatus, parent, nodeInfo.metadata, nodeInfo.iconType, {
				getChildren: treeNode => this.getChildren(treeNode),
				isExpanded: treeNode => this.isExpanded(treeNode),
				setNodeExpandedState: (treeNode, expandedState) => this.setNodeExpandedState(treeNode, expandedState),
				setNodeSelected: (treeNode, selected, clearOtherSelections: boolean = undefined) => this.setNodeSelected(treeNode, selected, clearOtherSelections)
			});
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

	public findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames?: string[]): Thenable<sqlops.NodeInfo[]> {
		let rootNode = this._activeObjectExplorerNodes[connectionId];
		if (!rootNode) {
			return Promise.resolve([]);
		}
		let sessionId = rootNode.session.sessionId;
		return this._providers[this._sessions[sessionId].connection.providerName].findNodes({
			type: type,
			name: name,
			schema: schema,
			database: database,
			parentObjectNames: parentObjectNames,
			sessionId: sessionId
		}).then(response => {
			return response.nodes;
		});
	}

	public getActiveConnectionNodes(): TreeNode[] {
		return Object.values(this._activeObjectExplorerNodes);
	}

	public async refreshNodeInView(connectionId: string, nodePath: string): Promise<TreeNode> {
		// Get the tree node and call refresh from the provider
		let treeNode = await this.getTreeNode(connectionId, nodePath);
		await this.refreshTreeNode(treeNode.getSession(), treeNode);

		// Get the new tree node, refresh it in the view, and expand it if needed
		treeNode = await this.getTreeNode(connectionId, nodePath);
		await this._serverTreeView.refreshElement(treeNode);
		if (treeNode.children.length > 0) {
			await treeNode.setExpandedState(TreeItemCollapsibleState.Expanded);
		}
		return treeNode;
	}

	private async setNodeExpandedState(treeNode: TreeNode, expandedState: TreeItemCollapsibleState): Promise<void> {
		treeNode = await this.getUpdatedTreeNode(treeNode);
		let expandNode = this.getTreeItem(treeNode);
		if (expandedState === TreeItemCollapsibleState.Expanded) {
			await this._serverTreeView.reveal(expandNode);
		}
		return this._serverTreeView.setExpandedState(expandNode, expandedState);
	}

	private async setNodeSelected(treeNode: TreeNode, selected: boolean, clearOtherSelections: boolean = undefined): Promise<void> {
		treeNode = await this.getUpdatedTreeNode(treeNode);
		let selectNode = this.getTreeItem(treeNode);
		if (selected) {
			await this._serverTreeView.reveal(selectNode);
		}
		return this._serverTreeView.setSelected(selectNode, selected, clearOtherSelections);
	}

	private async getChildren(treeNode: TreeNode): Promise<TreeNode[]> {
		treeNode = await this.getUpdatedTreeNode(treeNode);
		if (treeNode.isAlwaysLeaf) {
			return [];
		}
		if (!treeNode.children) {
			await this.resolveTreeNodeChildren(treeNode.getSession(), treeNode);
		}
		return treeNode.children;
	}

	private async isExpanded(treeNode: TreeNode): Promise<boolean> {
		treeNode = await this.getUpdatedTreeNode(treeNode);
		do {
			let expandNode = this.getTreeItem(treeNode);
			if (!this._serverTreeView.isExpanded(expandNode)) {
				return false;
			}
			treeNode = treeNode.parent;
		} while (treeNode);

		return true;
	}

	private getTreeItem(treeNode: TreeNode): TreeNode | ConnectionProfile {
		let rootNode = this._activeObjectExplorerNodes[treeNode.getConnectionProfile().id];
		if (treeNode === rootNode) {
			return treeNode.connection;
		}
		return treeNode;
	}

	private getUpdatedTreeNode(treeNode: TreeNode): Promise<TreeNode> {
		return this.getTreeNode(treeNode.getConnectionProfile().id, treeNode.nodePath).then(treeNode => {
			if (!treeNode) {
				throw new Error(nls.localize('treeNodeNoLongerExists', 'The given tree node no longer exists'));
			}
			return treeNode;
		});
	}

	public async getTreeNode(connectionId: string, nodePath: string): Promise<TreeNode> {
		let parentNode = this._activeObjectExplorerNodes[connectionId];
		if (!parentNode) {
			return undefined;
		}
		if (!nodePath) {
			return parentNode;
		}
		let currentNode = parentNode;
		while (currentNode.nodePath !== nodePath) {
			let nextNode = undefined;
			if (!currentNode.isAlwaysLeaf && !currentNode.children) {
				await this.resolveTreeNodeChildren(currentNode.getSession(), currentNode);
			}
			if (currentNode.children) {
				// Look at the next node in the path, which is the child object with the longest path where the desired path starts with the child path
				let children = currentNode.children.filter(child => nodePath.startsWith(child.nodePath));
				if (children.length > 0) {
					nextNode = children.reduce((currentMax, candidate) => currentMax.nodePath.length < candidate.nodePath.length ? candidate : currentMax);
				}
			}
			if (!nextNode) {
				return undefined;
			}
			currentNode = nextNode;
		}
		return currentNode;
	}
}