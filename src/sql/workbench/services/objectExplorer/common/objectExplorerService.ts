/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { NodeType } from 'sql/parts/objectExplorer/common/nodeType';
import { TreeNode, TreeItemCollapsibleState } from 'sql/parts/objectExplorer/common/treeNode';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { Event, Emitter } from 'vs/base/common/event';
import * as sqlops from 'sqlops';
import * as nls from 'vs/nls';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { warn, error } from 'sql/base/common/log';
import { ServerTreeView } from 'sql/parts/objectExplorer/viewlet/serverTreeView';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import * as Utils from 'sql/platform/connection/common/utils';

export const SERVICE_ID = 'ObjectExplorerService';

export const IObjectExplorerService = createDecorator<IObjectExplorerService>(SERVICE_ID);

export interface NodeExpandInfoWithProviderId extends sqlops.ObjectExplorerExpandInfo {
	providerId: string;
}

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

	onNodeExpanded(sessionResponse: NodeExpandInfoWithProviderId);

	/**
	 * Register a ObjectExplorer provider
	 */
	registerProvider(providerId: string, provider: sqlops.ObjectExplorerProvider): void;

	registerNodeProvider(expander: sqlops.ObjectExplorerNodeProvider): void;

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

	/**
	 * For Testing purpose only. Get the context menu actions for an object explorer node.
	*/
	getNodeActions(connectionId: string, nodePath: string): Thenable<string[]>;

	getSessionConnectionProfile(sessionId: string): sqlops.IConnectionProfile;

	getSession(sessionId: string): sqlops.ObjectExplorerSession;

	providerRegistered(providerId: string): boolean;
}

interface SessionStatus {
	nodes: { [nodePath: string]: NodeStatus };
	connection: ConnectionProfile;
	expandNodeTimer?: number;
}

interface NodeStatus {
	expandEmitter: Emitter<NodeExpandInfoWithProviderId>;
}

export interface ObjectExplorerNodeEventArgs {
	connection: IConnectionProfile;
	errorMessage: string;
}

export interface NodeInfoWithConnection {
	connectionId: string;
	nodeInfo: sqlops.NodeInfo;
}

export interface TopLevelChildrenPath {
	providerId: string;
	supportedProviderId: string;
	groupingId: number;
	path: string[];
	providerObject: sqlops.ObjectExplorerNodeProvider | sqlops.ObjectExplorerProvider;
}

export class ObjectExplorerService implements IObjectExplorerService {

	public _serviceBrand: any;

	private _disposables: IDisposable[] = [];

	private _providers: { [handle: string]: sqlops.ObjectExplorerProvider; } = Object.create(null);

	private _nodeProviders: { [handle: string]: sqlops.ObjectExplorerNodeProvider[]; } = Object.create(null);

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
		this._nodeProviders = {};
		this._onSelectionOrFocusChange = new Emitter<void>();
	}

	public getSession(sessionId: string): sqlops.ObjectExplorerSession {
		let session = this._sessions[sessionId];
		if (!session) {
			return undefined;
		}
		let node = this._activeObjectExplorerNodes[session.connection.id];
		return node ? node.getSession() : undefined;
	}

	public providerRegistered(providerId: string): boolean {
		return !!this._providers[providerId];
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
	public onNodeExpanded(expandResponse: NodeExpandInfoWithProviderId) {

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
	public onSessionCreated(handle: number, session: sqlops.ObjectExplorerSession): void {
		this.handleSessionCreated(session);
	}

	private async handleSessionCreated(session: sqlops.ObjectExplorerSession): Promise<void> {
		try {
			let connection: ConnectionProfile = undefined;
			let errorMessage: string = undefined;
			if (this._sessions[session.sessionId]) {
				connection = this._sessions[session.sessionId].connection;

				if (session && session.success && session.rootNode) {
					let server = this.toTreeNode(session.rootNode, null);
					server.connection = connection;
					server.session = session;
					this._activeObjectExplorerNodes[connection.id] = server;
				}
				else {
					errorMessage = session && session.errorMessage ? session.errorMessage :
						nls.localize('OeSessionFailedError', 'Failed to create Object Explorer session');
					error(errorMessage);
				}
				// Send on session created about the session to all node providers so they can prepare for node expansion
				let nodeProviders = this._nodeProviders[connection.providerName];
				if (nodeProviders) {
					let promises: Thenable<boolean>[] = nodeProviders.map(p => p.handleSessionOpen(session));
					await Promise.all(promises);
				}
			}
			else {
				warn(`cannot find session ${session.sessionId}`);
			}

			this.sendUpdateNodeEvent(connection, errorMessage);
		} catch (error) {
			warn(`cannot handle the session ${session.sessionId} in all nodeProviders`);
		}
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

	public expandNode(providerId: string, session: sqlops.ObjectExplorerSession, nodePath: string): Thenable<sqlops.ObjectExplorerExpandInfo> {
		return new Promise<sqlops.ObjectExplorerExpandInfo>((resolve, reject) => {
			let provider = this._providers[providerId];
			if (provider) {
				TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.ObjectExplorerExpand, { refresh: 0, provider: providerId });
				this.expandOrRefreshNode(providerId, session, nodePath).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(`Provider doesn't exist. id: ${providerId}`);
			}
		});
	}

	private callExpandOrRefreshFromProvider(provider: sqlops.ObjectExplorerProviderBase, nodeInfo: sqlops.ExpandNodeInfo, refresh: boolean = false) {
		if (refresh) {
			return provider.refreshNode(nodeInfo);
		} else {
			return provider.expandNode(nodeInfo);
		}
	}

	private expandOrRefreshNode(
		providerId: string,
		session: sqlops.ObjectExplorerSession,
		nodePath: string,
		refresh: boolean = false): Thenable<sqlops.ObjectExplorerExpandInfo> {
		let self = this;
		return new Promise<sqlops.ObjectExplorerExpandInfo>((resolve, reject) => {
			if (session.sessionId in self._sessions && self._sessions[session.sessionId]) {
				let newRequest = false;
				if (!self._sessions[session.sessionId].nodes[nodePath]) {
					self._sessions[session.sessionId].nodes[nodePath] = {
						expandEmitter: new Emitter<NodeExpandInfoWithProviderId>()
					};
					newRequest = true;
				}
				let provider = this._providers[providerId];
				if (provider) {
					let resultMap: Map<string, sqlops.ObjectExplorerExpandInfo> = new Map<string, sqlops.ObjectExplorerExpandInfo>();
					let allProviders: sqlops.ObjectExplorerProviderBase[] = [provider];

					let nodeProviders = this._nodeProviders[providerId];
					if (nodeProviders) {
						nodeProviders = nodeProviders.sort((a, b) => a.group.toLowerCase().localeCompare(b.group.toLowerCase()));
						allProviders.push(...nodeProviders);
					}

					self._sessions[session.sessionId].nodes[nodePath].expandEmitter.event((expandResult) => {
						if (expandResult && expandResult.providerId) {
							resultMap.set(expandResult.providerId, expandResult);
						} else {
							error('OE provider returns empty result or providerId');
						}

						// When get all responses from all providers, merge results
						if (resultMap.size === allProviders.length) {
							resolve(self.mergeResults(allProviders, resultMap, nodePath));

							// Have to delete it after get all reponses otherwise couldn't find session for not the first response
							if (newRequest) {
								delete self._sessions[session.sessionId].nodes[nodePath];
							}
						}
					});
					if (newRequest) {
						allProviders.forEach(provider => {
							self.callExpandOrRefreshFromProvider(provider, {
								sessionId: session.sessionId,
								nodePath: nodePath
							}, refresh).then(isExpanding => {
								if (!isExpanding) {
									// The provider stated it's not going to expand the node, therefore do not need to track when merging results
									let emptyResult: sqlops.ObjectExplorerExpandInfo = {
										errorMessage: undefined,
										nodePath: nodePath,
										nodes: [],
										sessionId: session.sessionId
									};
									resultMap.set(provider.providerId, emptyResult);
								}
							}, error => {
								reject(error);
							});
						});
					}
				}
			} else {
				reject(`session cannot find to expand node. id: ${session.sessionId} nodePath: ${nodePath}`);
			}
		});
	}

	private mergeResults(allProviders: sqlops.ObjectExplorerProviderBase[], resultMap: Map<string, sqlops.ObjectExplorerExpandInfo>, nodePath: string): sqlops.ObjectExplorerExpandInfo {
		let finalResult: sqlops.ObjectExplorerExpandInfo;
		let allNodes: sqlops.NodeInfo[] = [];
		let errorNode: sqlops.NodeInfo = {
			nodePath: nodePath,
			label: 'Error',
			errorMessage: '',
			nodeType: 'error',
			isLeaf: true,
			nodeSubType: '',
			nodeStatus: '',
			metadata: null
		};
		let errorMessages: string[] = [];
		for (let provider of allProviders) {
			if (resultMap.has(provider.providerId)) {
				let result = resultMap.get(provider.providerId);
				if (result) {
					if (!result.errorMessage) {
						finalResult = result;
						if (result.nodes !== undefined && result.nodes) {
							allNodes = allNodes.concat(result.nodes);
						}
					} else {
						errorMessages.push(result.errorMessage);
					}
				}
			}
		}
		if (finalResult) {
			if (errorMessages.length > 0) {
				if (errorMessages.length > 1) {
					errorMessages.unshift(nls.localize('nodeExpansionError', 'Mulitiple errors:'));
				}
				errorNode.errorMessage = errorMessages.join('\n');
				errorNode.label = errorNode.errorMessage;
				allNodes = [errorNode].concat(allNodes);
			}

			finalResult.nodes = allNodes;
		}
		return finalResult;
	}

	public refreshNode(providerId: string, session: sqlops.ObjectExplorerSession, nodePath: string): Thenable<sqlops.ObjectExplorerExpandInfo> {
		let provider = this._providers[providerId];
		if (provider) {
			TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.ObjectExplorerExpand, { refresh: 1, provider: providerId });
			return this.expandOrRefreshNode(providerId, session, nodePath, true);
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
						errorMessage: undefined,
						providerId: providerId
					});
				}
			});
		}

		let provider = this._providers[providerId];
		if (provider) {
			let nodeProviders = this._nodeProviders[providerId];
			if (nodeProviders) {
				for (let nodeProvider of nodeProviders) {
					nodeProvider.handleSessionClose({
						sessionId: session ? session.sessionId : undefined
					});
				}
			}
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

	public registerNodeProvider(nodeProvider: sqlops.ObjectExplorerNodeProvider): void {
		let nodeProviders = this._nodeProviders[nodeProvider.supportedProviderId] || [];
		nodeProviders.push(nodeProvider);
		this._nodeProviders[nodeProvider.supportedProviderId] = nodeProviders;
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

		let node = new TreeNode(nodeInfo.nodeType, nodeInfo.label, isLeaf, nodeInfo.nodePath,
			nodeInfo.nodeSubType, nodeInfo.nodeStatus, parent, nodeInfo.metadata, nodeInfo.iconType, {
				getChildren: treeNode => this.getChildren(treeNode),
				isExpanded: treeNode => this.isExpanded(treeNode),
				setNodeExpandedState: (treeNode, expandedState) => this.setNodeExpandedState(treeNode, expandedState),
				setNodeSelected: (treeNode, selected, clearOtherSelections: boolean = undefined) => this.setNodeSelected(treeNode, selected, clearOtherSelections)
			});
		node.childProvider = nodeInfo.childProvider;
		node.payload = nodeInfo.payload;
		return node;
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

	/**
	* For Testing purpose only. Get the context menu actions for an object explorer node
	*/
	public getNodeActions(connectionId: string, nodePath: string): Thenable<string[]> {
		return this.getTreeNode(connectionId, nodePath).then(node => {
			let actions = this._serverTreeView.treeActionProvider.getActions(this._serverTreeView.tree, this.getTreeItem(node));
			return actions.filter(action => action.label).map(action => action.label);
		});
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

	public getSessionConnectionProfile(sessionId: string): sqlops.IConnectionProfile {
		return this._sessions[sessionId].connection.toIConnectionProfile();
	}

	private async setNodeExpandedState(treeNode: TreeNode, expandedState: TreeItemCollapsibleState): Promise<void> {
		treeNode = await this.getUpdatedTreeNode(treeNode);
		if (!treeNode) {
			return Promise.resolve();
		}
		let expandNode = this.getTreeItem(treeNode);
		if (expandedState === TreeItemCollapsibleState.Expanded) {
			await this._serverTreeView.reveal(expandNode);
		}
		return this._serverTreeView.setExpandedState(expandNode, expandedState);
	}

	private async setNodeSelected(treeNode: TreeNode, selected: boolean, clearOtherSelections: boolean = undefined): Promise<void> {
		treeNode = await this.getUpdatedTreeNode(treeNode);
		if (!treeNode) {
			return Promise.resolve();
		}
		let selectNode = this.getTreeItem(treeNode);
		if (selected) {
			await this._serverTreeView.reveal(selectNode);
		}
		return this._serverTreeView.setSelected(selectNode, selected, clearOtherSelections);
	}

	private async getChildren(treeNode: TreeNode): Promise<TreeNode[]> {
		treeNode = await this.getUpdatedTreeNode(treeNode);
		if (!treeNode) {
			return Promise.resolve([]);
		}
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
		if (!treeNode) {
			return false;
		}
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
				// throw new Error(nls.localize('treeNodeNoLongerExists', 'The given tree node no longer exists'));
				return undefined;
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