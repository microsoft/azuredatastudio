/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { TreeNode, TreeItemCollapsibleState } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { Event, Emitter } from 'vs/base/common/event';
import * as azdata from 'azdata';
import * as nls from 'vs/nls';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import * as Utils from 'sql/platform/connection/common/utils';
import { ILogService } from 'vs/platform/log/common/log';
import { entries } from 'sql/base/common/collections';
import { values } from 'vs/base/common/collections';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ServerTreeActionProvider } from 'sql/workbench/services/objectExplorer/browser/serverTreeActionProvider';
import { ITree } from 'sql/base/parts/tree/browser/tree';
import { AsyncServerTree, ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { ObjectExplorerRequestStatus } from 'sql/workbench/services/objectExplorer/browser/treeSelectionHandler';

export const SERVICE_ID = 'ObjectExplorerService';

export const IObjectExplorerService = createDecorator<IObjectExplorerService>(SERVICE_ID);

export interface NodeExpandInfoWithProviderId extends azdata.ObjectExplorerExpandInfo {
	providerId: string;
}

export const enum ServerTreeViewView {
	all = 'all',
	active = 'active'
}

export const ERROR_NODE_TYPE = 'error';

export interface IServerTreeView {
	readonly tree: ITree | AsyncServerTree;
	readonly onSelectionOrFocusChange: Event<void>;
	isObjectExplorerConnectionUri(uri: string): boolean;
	deleteObjectExplorerNodeAndRefreshTree(profile: ConnectionProfile): Promise<void>;
	getSelection(): Array<ServerTreeElement>;
	isFocused(): boolean;
	refreshElement(node: ServerTreeElement): Promise<void>;
	readonly treeActionProvider: ServerTreeActionProvider;
	isExpanded(node?: ServerTreeElement): boolean;
	reveal(node: ServerTreeElement): Promise<void>;
	setExpandedState(node: ServerTreeElement, state?: TreeItemCollapsibleState): Promise<void>;
	setSelected(node: ServerTreeElement, selected?: boolean, clearOtherSelections?: boolean): Promise<void>;
	refreshTree(): Promise<void>;
	renderBody(container: HTMLElement): Promise<void>;
	layout(size: number): void;
	showFilteredTree(view: ServerTreeViewView): void;
	filterElementChildren(node: TreeNode): Promise<void>;
	getActionContext(element: ServerTreeElement): any;
	collapseAllConnections(): void;
	view: ServerTreeViewView;
}

export interface IObjectExplorerService {
	_serviceBrand: undefined;

	createNewSession(providerId: string, connection: ConnectionProfile): Promise<azdata.ObjectExplorerSessionResponse>;

	closeSession(providerId: string, session: azdata.ObjectExplorerSession): Promise<azdata.ObjectExplorerCloseSessionResponse | undefined>;

	expandNode(providerId: string, session: azdata.ObjectExplorerSession, node: TreeNode): Promise<azdata.ObjectExplorerExpandInfo>;

	refreshNode(providerId: string, session: azdata.ObjectExplorerSession, node: TreeNode): Promise<azdata.ObjectExplorerExpandInfo | undefined>;

	resolveTreeNodeChildren(session: azdata.ObjectExplorerSession, parentTree: TreeNode): Promise<TreeNode[]>;

	refreshTreeNode(session: azdata.ObjectExplorerSession, parentTree: TreeNode): Promise<TreeNode[]>;

	onSessionCreated(handle: number, sessionResponse: azdata.ObjectExplorerSession): void;

	onSessionDisconnected(handle: number, sessionResponse: azdata.ObjectExplorerSession): void;

	onNodeExpanded(sessionResponse: NodeExpandInfoWithProviderId): void;

	/**
	 * Register a ObjectExplorer provider
	 */
	registerProvider(providerId: string, provider: azdata.ObjectExplorerProvider): void;

	registerNodeProvider(expander: azdata.ObjectExplorerNodeProvider): void;

	getObjectExplorerNode(connection: IConnectionProfile): TreeNode | undefined;

	updateObjectExplorerNodes(connectionProfile: IConnectionProfile, requestStatus?: ObjectExplorerRequestStatus | undefined): Promise<void>;

	deleteObjectExplorerNode(connection: IConnectionProfile): Promise<void>;

	onUpdateObjectExplorerNodes: Event<ObjectExplorerNodeEventArgs>;

	registerServerTreeView(view: IServerTreeView): void;

	getSelectedProfileAndDatabase(): { profile?: ConnectionProfile, databaseName?: string } | undefined;

	isFocused(): boolean;

	onSelectionOrFocusChange: Event<void>;

	getServerTreeView(): IServerTreeView | undefined;

	findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames?: string[]): Promise<azdata.NodeInfo[]>;

	getActiveConnectionNodes(): TreeNode[];

	getTreeNode(connectionId?: string, nodePath?: string): Promise<TreeNode | undefined>;

	refreshNodeInView(connectionId: string, nodePath: string): Promise<TreeNode | undefined>;

	/**
	 * For Testing purpose only. Get the context menu actions for an object explorer node.
	*/
	getNodeActions(connectionId: string, nodePath: string): Promise<string[]>;

	getSessionConnectionProfile(sessionId: string): azdata.IConnectionProfile;

	getSession(sessionId: string): azdata.ObjectExplorerSession | undefined;

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
	errorMessage?: string;
}

export interface NodeInfoWithConnection {
	connectionId: string;
	nodeInfo: azdata.NodeInfo;
}

export interface TopLevelChildrenPath {
	providerId: string;
	supportedProviderId: string;
	groupingId: number;
	path: string[];
	providerObject: azdata.ObjectExplorerNodeProvider | azdata.ObjectExplorerProvider;
}

const errSessionCreateFailed = nls.localize('OeSessionFailedError', "Failed to create Object Explorer session");

export class ObjectExplorerService implements IObjectExplorerService {

	public _serviceBrand: undefined;

	private _providers: { [handle: string]: azdata.ObjectExplorerProvider; } = Object.create(null);

	private _nodeProviders: { [handle: string]: azdata.ObjectExplorerNodeProvider[]; } = Object.create(null);

	private _activeObjectExplorerNodes: { [id: string]: TreeNode };
	private _sessions: { [sessionId: string]: SessionStatus };

	private _onUpdateObjectExplorerNodes: Emitter<ObjectExplorerNodeEventArgs>;

	private _serverTreeView?: IServerTreeView;

	private _onSelectionOrFocusChange: Emitter<void>;
	private _onNodeExpandedError: Emitter<NodeExpandInfoWithProviderId> = new Emitter<NodeExpandInfoWithProviderId>();

	private _onCreateNewSession: Emitter<azdata.ObjectExplorerSessionResponse> = new Emitter<azdata.ObjectExplorerSessionResponse>();

	private _connectionsWaitingForSession: Map<string, boolean> = new Map<string, boolean>();

	// Cache of tree nodes for each connection by session ids
	private _treeNodeCache: Map<string, Map<string, TreeNode>> = new Map<string, Map<string, TreeNode>>();

	// Cache of node filters for each connection by session ids
	private _nodeFilterCache: Map<string, Map<string, azdata.NodeFilter[]>> = new Map<string, Map<string, azdata.NodeFilter[]>>();

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@ILogService private logService: ILogService,
	) {
		this._onUpdateObjectExplorerNodes = new Emitter<ObjectExplorerNodeEventArgs>();
		this._activeObjectExplorerNodes = {};
		this._sessions = {};
		this._providers = {};
		this._nodeProviders = {};
		this._onSelectionOrFocusChange = new Emitter<void>();
	}

	public getSession(sessionId: string): azdata.ObjectExplorerSession | undefined {
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

	public async updateObjectExplorerNodes(connection: IConnectionProfile, requestStatus?: ObjectExplorerRequestStatus | undefined): Promise<void> {
		const withPassword = await this._connectionManagementService.addSavedPassword(connection);
		const connectionProfile = ConnectionProfile.fromIConnectionProfile(this._capabilitiesService, withPassword);
		return this.updateNewObjectExplorerNode(connectionProfile, requestStatus);
	}

	public async deleteObjectExplorerNode(connection: IConnectionProfile): Promise<void> {
		let connectionUri = connection.id!;
		let nodeTree = this._activeObjectExplorerNodes[connectionUri];
		if (nodeTree) {
			const session = nodeTree?.getSession();
			if (!session) {
				return;
			}
			this._treeNodeCache.delete(session.sessionId);
			this._nodeFilterCache.delete(session.sessionId);
			await this.closeSession(connection.providerName, session);
			delete this._activeObjectExplorerNodes[connectionUri];
			delete this._sessions[session.sessionId!];
		}
	}

	/**
	 * Gets called when expanded node response is ready
	 */
	public onNodeExpanded(expandResponse: NodeExpandInfoWithProviderId) {
		if (expandResponse.errorMessage) {
			this.logService.error(expandResponse.errorMessage);
		}

		let sessionStatus = this._sessions[expandResponse.sessionId!];
		if (sessionStatus) {
			const nodeStatus = sessionStatus.nodes[expandResponse.nodePath];
			if (nodeStatus) {
				if (!nodeStatus.expandEmitter) {
					this.logService.warn(`No expand emitter for session: ${expandResponse.sessionId} and node path: ${expandResponse.nodePath}`);
				} else {
					nodeStatus.expandEmitter.fire(expandResponse);
				}
			} else {
				this.logService.warn(`Cannot find node status for session: ${expandResponse.sessionId} and node path: ${expandResponse.nodePath}`);
				this._onNodeExpandedError.fire(expandResponse);
			}
		} else {
			this.logService.warn(`Cannot find session ${expandResponse.sessionId} for node path: ${expandResponse.nodePath}`);
			this._onNodeExpandedError.fire(expandResponse);
		}
	}

	/**
	 * Gets called when session is created
	 */
	public async onSessionCreated(handle: number, session: azdata.ObjectExplorerSession): Promise<void> {
		if (session && session.success) {
			await this.handleSessionCreated(session).catch((e) => this.logService.error(e));
		} else {
			let errorMessage = session && session.errorMessage ? session.errorMessage : errSessionCreateFailed;
			this.logService.error(errorMessage);
		}
	}

	private async handleSessionCreated(session: azdata.ObjectExplorerSession): Promise<void> {
		let connection: ConnectionProfile | undefined = undefined;
		let errorMessage: string | undefined = undefined;
		const sessionId = session.sessionId;


		await new Promise<void>((resolve, reject) => {
			const cleanup = () => {
				if (connection) {
					this._connectionsWaitingForSession.delete(connection.id);
				}
				createNewSessionListener.dispose();
			}

			const createNewSessionListener = this._onCreateNewSession.event((response) => {
				checkSessionAndConnection();
			});
			const checkSessionAndConnection = () => {
				/**
				 * Sometimes ads recieves handleSessionCreated from providers before the createNewSession response is recieved.
				 * We need to wait while the createNewSession response is recieved and the session map contains the session before we can continue.
				 */
				if (this._sessions[sessionId]) {
					connection = this._sessions[sessionId].connection;
					/**
					 * In certain cases, when we try to connect to a previously connected server, we may encounter a situation where the session is present in this._sessions,
					 * probably becaue the close session request was not completed successfully with the same session id for an older connection. While creating this new session,
					 * if we recieve the handleSessionCreated event before the createNewSession response is recieved, we will end up using the older connection stored in
					 * this._sessions[sessionId].connection. To avoid this, we check if the connection id is false in this._connectionsWaitingForSession. If it is not false,
					 * we know that the createNewSession response has been recieved and we have the correct connection.
					 */
					if (connection && this._connectionsWaitingForSession.get(connection.id) === false) {
						resolve();
						cleanup();
					}
				}
			}
			checkSessionAndConnection();
		});

		try {
			if (session.success && session.rootNode) {
				let server = this.toTreeNode(session.rootNode, undefined);
				this._treeNodeCache.set(sessionId, new Map<string, TreeNode>());
				this._treeNodeCache.get(sessionId)!.set(this.getTreeNodeCacheKey(server.toNodeInfo()), server);
				this._nodeFilterCache.set(sessionId, new Map<string, azdata.NodeFilter[]>());
				server.connection = connection;
				server.session = session;
				this._activeObjectExplorerNodes[connection!.id] = server;
			}
			else {
				errorMessage = session && session.errorMessage ? session.errorMessage : errSessionCreateFailed;
				this.logService.error(errorMessage);
			}
			// Send on session created about the session to all node providers so they can prepare for node expansion
			let nodeProviders = this._nodeProviders[connection!.providerName];
			if (nodeProviders) {
				const promises = nodeProviders.map(p => p.handleSessionOpen(session));
				await Promise.all(promises);
			}
		} catch (error) {
			this.logService.error(`An error occured while handling session ${sessionId} in all nodeProviders.`, error);
		} finally {
			this.sendUpdateNodeEvent(connection!, errorMessage);
		}

	}

	/**
	 * Gets called when session is disconnected
	 */
	public onSessionDisconnected(handle: number, session: azdata.ObjectExplorerSession): void {
		if (this._sessions[session.sessionId!]) {
			let connection: ConnectionProfile = this._sessions[session.sessionId!].connection;
			if (connection && this._connectionManagementService.isProfileConnected(connection)) {
				let uri: string = Utils.generateUri(connection);
				if (this._serverTreeView?.isObjectExplorerConnectionUri(uri)) {
					this._serverTreeView?.deleteObjectExplorerNodeAndRefreshTree(connection).then(() => {
						this.sendUpdateNodeEvent(connection, session.errorMessage);
						connection.isDisconnecting = true;
						this._connectionManagementService.disconnect(connection).then(() => {
							connection.isDisconnecting = false;
						}).catch((e) => this.logService.error(e));
					}).catch((e) => this.logService.error(e));
				}
			}
		} else {
			this.logService.warn(`Cannot find session ${session.sessionId}`);
		}
	}

	private sendUpdateNodeEvent(connection: ConnectionProfile, errorMessage?: string) {
		let eventArgs: ObjectExplorerNodeEventArgs = {
			connection: <IConnectionProfile>connection,
			errorMessage: errorMessage
		};
		this._onUpdateObjectExplorerNodes.fire(eventArgs);
	}

	private async updateNewObjectExplorerNode(connection: ConnectionProfile, requestStatus: ObjectExplorerRequestStatus | undefined): Promise<void> {
		if (this._activeObjectExplorerNodes[connection.id]) {
			this.sendUpdateNodeEvent(connection);
		} else {
			try {
				if (!requestStatus) {
					await this.createNewSession(connection.providerName, connection);
				}
			} catch (err) {
				this.sendUpdateNodeEvent(connection, err);
				throw err;
			}
		}
	}

	public getObjectExplorerNode(connection: IConnectionProfile): TreeNode | undefined {
		return this._activeObjectExplorerNodes[connection.id!];
	}

	public async createNewSession(providerId: string, connection: ConnectionProfile): Promise<azdata.ObjectExplorerSessionResponse> {
		const provider = this._providers[providerId];
		if (provider) {
			// set the connection to wait for session
			this._connectionsWaitingForSession.set(connection.id, true);
			const result = await provider.createNewSession(connection.toConnectionInfo());
			// some providers return a malformed create sessions responses which don't have a session id. We should throw an error in this case
			if (!result?.sessionId) {
				this.logService.error(`The session ID returned by provider "${providerId}" for connection "${connection.title}" is invalid.`);
				throw new Error(nls.localize('objectExplorerSessionIdMissing', 'The session ID returned by provider "{0}" for connection "{1}" is invalid.', providerId, connection.title));
			}
			if (this._sessions[result.sessionId]) {
				this.logService.trace(`Overwriting session ${result.sessionId}`);
			}
			this._sessions[result.sessionId] = {
				connection: connection,
				nodes: {}
			};
			// once the session is created, set the connection to not wait for session
			this._connectionsWaitingForSession.set(connection.id, false);
			this._onCreateNewSession.fire(result);
			return result;
		} else {
			this._connectionsWaitingForSession.delete(connection.id);
			throw new Error(`Provider doesn't exist. id: ${providerId}`);
		}
	}

	public async expandNode(providerId: string, session: azdata.ObjectExplorerSession, node: TreeNode): Promise<azdata.ObjectExplorerExpandInfo> {
		const provider = this._providers[providerId];
		if (provider) {
			this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.TelemetryAction.ObjectExplorerExpand)
				.withAdditionalProperties({
					refresh: false,
					provider: providerId
				}).send();
			return await this.expandOrRefreshNode(providerId, session, node);
		} else {
			throw new Error(`Provider doesn't exist. id: ${providerId}`);
		}
	}

	private async callExpandOrRefreshFromProvider(provider: azdata.ObjectExplorerProviderBase, nodeInfo: azdata.ExpandNodeInfo, refresh: boolean = false): Promise<boolean> {
		if (refresh) {
			return provider.refreshNode(nodeInfo);
		} else {
			return provider.expandNode(nodeInfo);
		}
	}

	private expandOrRefreshNode(
		providerId: string,
		session: azdata.ObjectExplorerSession,
		node: TreeNode,
		refresh: boolean = false): Promise<azdata.ObjectExplorerExpandInfo> {
		let self = this;
		return new Promise<azdata.ObjectExplorerExpandInfo>((resolve, reject) => {
			const sessionFilterCache = this._nodeFilterCache.get(session.sessionId!);
			// If the node has filters we need to cache them so that we can reapply them when the node is refreshed.
			if (node.filters && sessionFilterCache) {
				sessionFilterCache.set(this.getTreeNodeCacheKey(node), node.filters);
			}

			if (session.sessionId! in self._sessions && self._sessions[session.sessionId!]) {
				let newRequest = false;
				if (!self._sessions[session.sessionId!].nodes[node.nodePath]) {
					self._sessions[session.sessionId!].nodes[node.nodePath] = {
						expandEmitter: new Emitter<NodeExpandInfoWithProviderId>()
					};
					this.logService.trace(`Adding node ${node.nodePath} to session ${session.sessionId}`);
					newRequest = true;
				}
				let provider = this._providers[providerId];
				if (provider) {
					let resultMap: Map<string, azdata.ObjectExplorerExpandInfo> = new Map<string, azdata.ObjectExplorerExpandInfo>();
					let allProviders: azdata.ObjectExplorerProviderBase[] = [provider];

					let nodeProviders = this._nodeProviders[providerId];
					if (nodeProviders) {
						nodeProviders = nodeProviders.sort((a, b) => a.group!.toLowerCase().localeCompare(b.group!.toLowerCase()));
						allProviders.push(...nodeProviders);
					}
					this.logService.trace(`${session.sessionId}: got providers for node expansion: ${allProviders.map(p => p.providerId).join(', ')}`);

					const resolveExpansion = () => {
						const expansionResult = self.mergeResults(allProviders, resultMap, node.nodePath);
						if (expansionResult.errorMessage || expansionResult.nodes.some(n => n.errorMessage)) {
							this._onUpdateObjectExplorerNodes.fire({
								connection: node.getConnectionProfile(),
								errorMessage: expansionResult.errorMessage
							});
						}
						resolve(expansionResult);
						// Have to delete it after get all responses otherwise couldn't find session for not the first response
						if (newRequest) {
							delete self._sessions[session.sessionId!].nodes[node.nodePath];
							this.logService.trace(`Deleted node ${node.nodePath} from session ${session.sessionId}`);
						}
					}

					// Incase node status not found.
					this._onNodeExpandedError.event(e => {
						//Ignore errors from other sessions and nodepaths.
						if (e.sessionId === session.sessionId && e.nodePath === node.nodePath) {
							resultMap.set(e.providerId, e);
							// When get all responses from all providers, merge results
							if (resultMap.size === allProviders.length) {
								resolveExpansion();
							}
						}
					});

					self._sessions[session.sessionId!].nodes[node.nodePath].expandEmitter.event((expandResult: NodeExpandInfoWithProviderId) => {
						if (expandResult && expandResult.providerId) {
							this.logService.trace(`${session.sessionId}: Received expand result for node ${node.nodePath} from provider ${expandResult.providerId}`);
							resultMap.set(expandResult.providerId, expandResult);
							// If we got an error result back then send error our error event
							if (expandResult.errorMessage) {
								const errorType = expandResult.errorMessage.indexOf('Object Explorer task didn\'t complete') !== -1 ? 'Timeout' : 'Other';
								// For folders send the actual name of the folder for the MSSQL provider (since the nodeTypeId isn't useful in this case and the names are controlled by us)
								const nodeType = expandResult.providerId === mssqlProviderName && node.nodeTypeId === NodeType.Folder ? node.label : node.nodeTypeId;
								this._telemetryService.createErrorEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.TelemetryError.ObjectExplorerExpandError, undefined, errorType)
									.withAdditionalProperties({
										nodeType,
										providerId: expandResult.providerId
									}).send();
							}

						} else {
							this.logService.error('OE provider returns empty result or providerId');
						}

						// When get all responses from all providers, merge results
						if (resultMap.size === allProviders.length) {
							resolveExpansion();
						}
					});
					if (newRequest) {
						allProviders.forEach(provider => {
							let expandRequest: azdata.ExpandNodeInfo = {
								sessionId: session.sessionId!,
								nodePath: node.nodePath,
								securityToken: session.securityToken,
							};
							if (node?.filters?.length > 0) {
								expandRequest.filters = node.filters;
							}
							self.callExpandOrRefreshFromProvider(provider, expandRequest, refresh).then(isExpanding => {
								if (!isExpanding) {
									// The provider stated it's not going to expand the node, therefore do not need to track when merging results
									let emptyResult: azdata.ObjectExplorerExpandInfo = {
										errorMessage: undefined,
										nodePath: node.nodePath,
										nodes: [],
										sessionId: session.sessionId
									};
									resultMap.set(provider.providerId, emptyResult);
									if (resultMap.size === allProviders.length) {
										resolveExpansion();
									}
								}
							}, error => {
								reject(error);
							});
						});
					}
				}
			} else {
				reject(`session cannot find to expand node. id: ${session.sessionId} nodePath: ${node.nodePath}`);
			}
		});
	}

	private mergeResults(allProviders: azdata.ObjectExplorerProviderBase[], resultMap: Map<string, azdata.ObjectExplorerExpandInfo>, nodePath: string): azdata.ObjectExplorerExpandInfo {
		let finalResult: azdata.ObjectExplorerExpandInfo | undefined = {
			sessionId: undefined,
			nodePath: nodePath,
			nodes: []
		};
		let allNodes: azdata.NodeInfo[] = [];
		let errorNode: azdata.NodeInfo = {
			nodePath: '',
			parentNodePath: '',
			objectType: 'error',
			label: 'Error',
			errorMessage: '',
			nodeType: ERROR_NODE_TYPE,
			isLeaf: true,
			nodeSubType: '',
			nodeStatus: '',
			metadata: undefined
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
						finalResult.sessionId = result.sessionId;
						errorMessages.push(result.errorMessage);
					}
				}
			}
		}
		if (finalResult) {
			if (errorMessages.length > 0) {
				if (errorMessages.length > 1) {
					errorMessages.unshift(nls.localize('nodeExpansionError', "Multiple errors:"));
				}
				errorNode.errorMessage = errorMessages.join('\n');
				errorNode.label = errorNode.errorMessage;
				allNodes = [errorNode].concat(allNodes);
				this._onUpdateObjectExplorerNodes.fire({
					connection: undefined,
					errorMessage: errorNode.errorMessage
				});
			}
			finalResult.nodes = allNodes;
			finalResult.errorMessage = errorMessages.join('\n');
		}
		return finalResult;
	}

	public refreshNode(providerId: string, session: azdata.ObjectExplorerSession, node: TreeNode): Promise<azdata.ObjectExplorerExpandInfo | undefined> {
		let provider = this._providers[providerId];
		if (provider) {
			this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.TelemetryAction.ObjectExplorerExpand)
				.withAdditionalProperties({
					refresh: true,
					provider: providerId
				}).send();
			return this.expandOrRefreshNode(providerId, session, node, true);
		}
		return Promise.resolve(undefined);
	}

	public closeSession(providerId: string, session: azdata.ObjectExplorerSession): Promise<azdata.ObjectExplorerCloseSessionResponse | undefined> {
		// Complete any requests that are still open for the session
		let sessionStatus = this._sessions[session.sessionId!];
		if (sessionStatus && sessionStatus.nodes) {
			entries(sessionStatus.nodes).forEach((entry) => {
				const nodePath: string = entry[0];
				const nodeStatus: NodeStatus = entry[1] as NodeStatus;

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
			return Promise.resolve(provider.closeSession({
				sessionId: session ? session.sessionId : undefined
			}));
		}

		return Promise.resolve(undefined);
	}

	/**
	 * Register a ObjectExplorer provider
	 */
	public registerProvider(providerId: string, provider: azdata.ObjectExplorerProvider): void {
		this._providers[providerId] = provider;
	}

	public registerNodeProvider(nodeProvider: azdata.ObjectExplorerNodeProvider): void {
		let nodeProviders = this._nodeProviders[nodeProvider.supportedProviderId] || [];
		nodeProviders.push(nodeProvider);
		this._nodeProviders[nodeProvider.supportedProviderId] = nodeProviders;
	}

	public resolveTreeNodeChildren(session: azdata.ObjectExplorerSession, parentTree: TreeNode): Promise<TreeNode[]> {
		// Always refresh the node if it has an error or forceRefresh is set to true, otherwise expand it normally
		let needsRefresh = !!parentTree.errorStateMessage || parentTree.forceRefresh;
		parentTree.forceRefresh = false;
		return this.expandOrRefreshTreeNode(session, parentTree, needsRefresh);
	}

	public refreshTreeNode(session: azdata.ObjectExplorerSession, parentTree: TreeNode): Promise<TreeNode[]> {
		return this.expandOrRefreshTreeNode(session, parentTree, true);
	}

	private callExpandOrRefreshFromService(providerId: string, session: azdata.ObjectExplorerSession, node: TreeNode, refresh: boolean = false): Promise<azdata.ObjectExplorerExpandInfo | undefined> {
		if (refresh) {
			return this.refreshNode(providerId, session, node);
		} else {
			return this.expandNode(providerId, session, node);
		}
	}

	private async expandOrRefreshTreeNode(
		session: azdata.ObjectExplorerSession,
		parentTree: TreeNode,
		refresh: boolean = false): Promise<TreeNode[]> {
		let connection = parentTree.getConnectionProfile();
		if (connection) {
			// Refresh access token on connection if needed.
			let refreshResult = await this._connectionManagementService.refreshAzureAccountTokenIfNecessary(connection);
			if (refreshResult) {
				session.securityToken = {
					token: connection.options['azureAccountToken'],
					expiresOn: connection.options['expiresOn']
				};
			}
		}
		const providerName = connection?.providerName;
		if (!providerName) {
			throw new Error('Failed to expand node - no provider name');
		}
		const expandResult = await this.callExpandOrRefreshFromService(providerName, session, parentTree, refresh);
		const sessionTreeNodeCache = this._treeNodeCache.get(session.sessionId!);
		if (expandResult && expandResult.nodes) {
			// In case of refresh, we want to clear the cache of the descendants of the node being refreshed
			if (refresh && parentTree?.children) {
				const stack = [...parentTree.children];
				while (stack.length > 0) {
					const currentTreeNode = stack.pop();
					if (currentTreeNode) {
						sessionTreeNodeCache.delete(this.getTreeNodeCacheKey(currentTreeNode.toNodeInfo()));
						if (currentTreeNode.children) {
							stack.push(...currentTreeNode.children);
						}
					}
				}
			}
			const children = expandResult.nodes.map(node => {
				let treeNode: TreeNode | undefined;
				const cacheKey = this.getTreeNodeCacheKey(node);
				// In case of refresh, we want to update the existing node in the cache
				if (!refresh && sessionTreeNodeCache.has(cacheKey)) {
					treeNode = sessionTreeNodeCache.get(cacheKey);
				} else {
					treeNode = this.toTreeNode(node, parentTree);
					sessionTreeNodeCache.set(cacheKey, treeNode);
				}

				const filterCacheKey = this.getTreeNodeCacheKey(treeNode);
				const sessionFilterCache = this._nodeFilterCache.get(session.sessionId!);
				// If we get the node without any filter properties, we want to clear the filters for the node.
				if (treeNode?.filterProperties?.length > 0) {
					// Making sure we retain the filters for the node.
					if (sessionFilterCache?.has(filterCacheKey)) {
						treeNode.filters = sessionFilterCache.get(filterCacheKey) ?? [];
					} else {
						treeNode.filters = [];
					}
				} else {
					sessionFilterCache.delete(filterCacheKey);
					treeNode.filters = [];
				}
				return treeNode;
			});
			parentTree.children = children.filter(c => c !== undefined);
			return children;
		} else {
			throw new Error(expandResult?.errorMessage ? expandResult.errorMessage : 'Failed to expand node');
		}
	}

	private toTreeNode(nodeInfo: azdata.NodeInfo, parent?: TreeNode): TreeNode {
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

		let node = new TreeNode(nodeInfo.nodeType, nodeInfo.objectType, nodeInfo.label, isLeaf, nodeInfo.nodePath, nodeInfo.parentNodePath,
			nodeInfo.nodeSubType!, nodeInfo.nodeStatus, parent, nodeInfo.metadata, nodeInfo.iconType, nodeInfo.icon, nodeInfo.filterableProperties, {
			getChildren: (treeNode?: TreeNode) => this.getChildren(treeNode),
			isExpanded: treeNode => this.isExpanded(treeNode),
			setNodeExpandedState: async (treeNode, expandedState) => await this.setNodeExpandedState(treeNode, expandedState),
			setNodeSelected: (treeNode, selected, clearOtherSelections?: boolean) => this.setNodeSelected(treeNode, selected, clearOtherSelections)
		});
		node.childProvider = nodeInfo.childProvider;
		node.payload = nodeInfo.payload;
		return node;
	}

	public registerServerTreeView(view: IServerTreeView): void {
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
	public getSelectedProfileAndDatabase(): { profile?: ConnectionProfile, databaseName?: string } | undefined {
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
		return this._serverTreeView?.isFocused() ?? false;
	}

	public getServerTreeView() {
		return this._serverTreeView;
	}

	public async findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames: string[] = []): Promise<azdata.NodeInfo[]> {
		let rootNode = this._activeObjectExplorerNodes[connectionId];
		if (!rootNode) {
			return [];
		}
		let sessionId = rootNode?.session?.sessionId ?? '';
		const response = await this._providers[this._sessions[sessionId].connection.providerName].findNodes({
			type: type,
			name: name,
			schema: schema,
			database: database,
			parentObjectNames: parentObjectNames,
			sessionId: sessionId
		});
		return response.nodes;
	}

	public getActiveConnectionNodes(): TreeNode[] {
		return values(this._activeObjectExplorerNodes);
	}

	/**
	* For Testing purpose only. Get the context menu actions for an object explorer node
	*/
	public async getNodeActions(connectionId: string, nodePath: string): Promise<string[]> {
		const node = await this.getTreeNode(connectionId, nodePath);
		if (!node || !this._serverTreeView?.tree) {
			return [];
		}
		let treeItem = this.getTreeItem(node);
		if (!treeItem) {
			return [];
		}
		const actions = this._serverTreeView?.treeActionProvider.getActions(this._serverTreeView!.tree, treeItem);
		return actions?.filter(action => action.label).map(action => action.label) ?? [];
	}

	public async refreshNodeInView(connectionId: string, nodePath: string): Promise<TreeNode | undefined> {
		// Get the tree node and call refresh from the provider
		let treeNode = await this.getTreeNode(connectionId, nodePath);
		if (!treeNode) {
			return undefined;
		}
		const session = treeNode.getSession();
		if (session) {
			await this.refreshTreeNode(session, treeNode);
		}
		// Get the new tree node, refresh it in the view, and expand it if needed
		treeNode = await this.getTreeNode(connectionId, nodePath);
		if (!treeNode) {
			return undefined;
		}
		await this._serverTreeView?.refreshElement(this.getTreeItem(treeNode));
		if (treeNode?.children?.length ?? -1 > 0) {
			await treeNode?.setExpandedState(TreeItemCollapsibleState.Expanded);
		}
		return treeNode;
	}

	public getSessionConnectionProfile(sessionId: string): azdata.IConnectionProfile {
		return this._sessions[sessionId].connection.toIConnectionProfile();
	}

	private async setNodeExpandedState(treeNode?: TreeNode, expandedState?: TreeItemCollapsibleState): Promise<void> {
		treeNode = await this.getUpdatedTreeNode(treeNode);
		if (!treeNode) {
			return;
		}
		let expandNode = this.getTreeItem(treeNode);
		if (!expandNode) {
			return;
		}
		if (expandedState === TreeItemCollapsibleState.Expanded) {
			await this._serverTreeView?.reveal(expandNode);
		}
		return this._serverTreeView?.setExpandedState(expandNode, expandedState);
	}

	private async setNodeSelected(treeNode?: TreeNode, selected?: boolean, clearOtherSelections?: boolean): Promise<void> {
		treeNode = await this.getUpdatedTreeNode(treeNode);
		if (!treeNode) {
			return Promise.resolve();
		}
		let selectNode = this.getTreeItem(treeNode);
		if (!selectNode) {
			return;
		}
		if (selected) {
			await this._serverTreeView?.reveal(selectNode);
		}
		return this._serverTreeView?.setSelected(selectNode, selected, clearOtherSelections);
	}

	private async getChildren(treeNode?: TreeNode): Promise<TreeNode[]> {
		treeNode = await this.getUpdatedTreeNode(treeNode);
		if (!treeNode) {
			return Promise.resolve([]);
		}
		if (treeNode.isAlwaysLeaf) {
			return [];
		}
		if (!treeNode.children) {
			const session = treeNode.getSession();
			if (session) {
				await this.resolveTreeNodeChildren(session, treeNode);
			}
		}
		return treeNode.children ?? [];
	}

	private async isExpanded(treeNode?: TreeNode): Promise<boolean> {
		if (!treeNode) {
			return false;
		}
		treeNode = await this.getUpdatedTreeNode(treeNode);
		if (!treeNode) {
			return false;
		}
		do {
			let expandNode = this.getTreeItem(treeNode);
			if (!this._serverTreeView?.isExpanded(expandNode)) {
				return false;
			}
			treeNode = treeNode.parent;
		} while (treeNode);

		return true;
	}

	private getTreeItem(treeNode: TreeNode): TreeNode | ConnectionProfile | undefined {
		const idx = treeNode?.getConnectionProfile()?.id;
		if (!idx) {
			return undefined;
		}
		let rootNode = this._activeObjectExplorerNodes[idx];
		if (treeNode === rootNode) {
			return treeNode.connection;
		}
		return treeNode;
	}

	private async getUpdatedTreeNode(treeNode?: TreeNode): Promise<TreeNode | undefined> {
		const newTreeNode = await this.getTreeNode(treeNode?.getConnectionProfile()?.id, treeNode?.nodePath);
		if (!newTreeNode) {
			// throw new Error(nls.localize('treeNodeNoLongerExists', "The given tree node no longer exists"));
			return undefined;
		}
		return newTreeNode;
	}

	public async getTreeNode(connectionId?: string, nodePath?: string): Promise<TreeNode | undefined> {
		if (!connectionId) {
			return undefined;
		}
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
				const session = currentNode?.getSession();
				if (session) {
					await this.resolveTreeNodeChildren(session, currentNode);
				}
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

	private getTreeNodeCacheKey(node: azdata.NodeInfo | TreeNode): string {
		return node.nodePath;
	}
}
