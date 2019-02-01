/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { ProviderBase } from './providerBase';
import { SqlClusterConnection } from './connection';
import * as utils from '../utils';
import { TreeNode } from './treeNodes';
import { ConnectionNode, TreeDataContext, ITreeChangeHandler } from './hdfsProvider';
import { IFileSource } from './fileSources';
import { AppContext } from '../appContext';
import * as constants from '../constants';
import { SqlClusterLookUp } from '../bigDataClusterLookUp';
import { Cipher } from 'crypto';

const outputChannel = vscode.window.createOutputChannel(constants.providerId);
export interface IEndpoint {
	serviceName: string;
	ipAddress: string;
	port: number;
}

export class MssqlObjectExplorerNodeProvider extends ProviderBase implements sqlops.ObjectExplorerNodeProvider, ITreeChangeHandler {
	public readonly supportedProviderId: string = constants.providerId;
	private sessionMap: Map<string, SqlClusterSession>;
	private expandCompleteEmitter = new vscode.EventEmitter<sqlops.ObjectExplorerExpandInfo>();

	constructor(private appContext: AppContext) {
		super();

		this.sessionMap = new Map<string, SqlClusterSession>();
		this.appContext.registerService<MssqlObjectExplorerNodeProvider>(constants.ObjectExplorerService, this);
	}

	handleSessionOpen(sqlMasterSession: sqlops.ObjectExplorerSession): Thenable<boolean> {
		return new Promise((resolve, reject) => {
			if (!sqlMasterSession) {
				reject('handleSessionOpen requires a session object to be passed');
			} else {
				resolve(this.doSessionOpen(sqlMasterSession));
			}
		});
	}

	private async doSessionOpen(sqlMasterSession: sqlops.ObjectExplorerSession): Promise<boolean> {
		let sqlMasterConnProfile = await sqlops.objectexplorer.getSessionConnectionProfile(sqlMasterSession.sessionId);
		if (!sqlMasterConnProfile) { return false; }

		let clusterConnInfo = await SqlClusterLookUp.lookUpSqlClusterInfo(sqlMasterConnProfile);
		let clusterConnection = new SqlClusterConnection(clusterConnInfo);
		clusterConnection.saveUriWithPrefix(constants.objectExplorerPrefix);

		let clusterSession = new SqlClusterSession(clusterConnection, sqlMasterSession.sessionId);
		clusterSession.root = new RootNode(clusterSession, new TreeDataContext(this.appContext.extensionContext, this),
			sqlMasterSession.rootNode.nodePath);
		this.sessionMap.set(sqlMasterSession.sessionId, clusterSession);
		return true;
	}

	expandNode(nodeInfo: sqlops.ExpandNodeInfo, isRefresh: boolean = false): Thenable<boolean> {
		return new Promise((resolve, reject) => {
			if (!nodeInfo) {
				reject('expandNode requires a nodeInfo object to be passed');
			} else {
				resolve(this.doExpandNode(nodeInfo, isRefresh));
			}
		});
	}

	private async doExpandNode(nodeInfo: sqlops.ExpandNodeInfo, isRefresh: boolean = false): Promise<boolean> {
		let sqlClusterSession = this.sessionMap.get(nodeInfo.sessionId);
		let response = {
			sessionId: nodeInfo.sessionId,
			nodePath: nodeInfo.nodePath,
			errorMessage: undefined,
			nodes: []
		};

		if (!sqlClusterSession) {
			// This is not an error case. Just fire reponse with empty nodes for example: request from standalone SQL instance
			this.expandCompleteEmitter.fire(response);
			return false;
		} else {
			setTimeout(() => {

				// Running after promise resolution as we need the Ops Studio-side map to have been updated
				// Intentionally not awaiting or catching errors.
				// Any failure in startExpansion should be emitted in the expand complete result
				// We want this to be async and ideally return true before it completes
				this.startExpansion(sqlClusterSession, nodeInfo, isRefresh);
			}, 10);
		}
		return true;
	}

	private async startExpansion(sqlClustersession: SqlClusterSession, nodeInfo: sqlops.ExpandNodeInfo, isRefresh: boolean = false): Promise<void> {
		let expandResult: sqlops.ObjectExplorerExpandInfo = {
			sessionId: sqlClustersession.uri,
			nodePath: nodeInfo.nodePath,
			errorMessage: undefined,
			nodes: []
		};
		try {
			let node = await sqlClustersession.root.findNodeByPath(nodeInfo.nodePath, true);
			if (node) {
				expandResult.errorMessage = node.getNodeInfo().errorMessage;
				let children = await node.getChildren(true);
				if (children) {
					expandResult.nodes = children.map(c => c.getNodeInfo());
					// There is only child returned when failure happens
					if (children.length === 1) {
						let child = children[0].getNodeInfo();
						if (child && child.nodeType === constants.MssqlClusterItems.Error) {
							expandResult.errorMessage = child.label;
							expandResult.nodes = [];
						}
					}
				}
			}
		} catch (error) {
			expandResult.errorMessage = utils.getErrorMessage(error);
		}
		this.expandCompleteEmitter.fire(expandResult);
	}

	refreshNode(nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
		// TODO #3815 implement properly
		return this.expandNode(nodeInfo, true);
	}

	handleSessionClose(closeSessionInfo: sqlops.ObjectExplorerCloseSessionInfo): void {
		this.sessionMap.delete(closeSessionInfo.sessionId);
	}

	findNodes(findNodesInfo: sqlops.FindNodesInfo): Thenable<sqlops.ObjectExplorerFindNodesResponse> {
		// TODO #3814 implement
		let response: sqlops.ObjectExplorerFindNodesResponse = {
			nodes: []
		};
		return Promise.resolve(response);
	}

	registerOnExpandCompleted(handler: (response: sqlops.ObjectExplorerExpandInfo) => any): void {
		this.expandCompleteEmitter.event(handler);
	}

	notifyNodeChanged(node: TreeNode): void {
		this.notifyNodeChangesAsync(node);
	}

	private async notifyNodeChangesAsync(node: TreeNode): Promise<void> {
		try {
			let session = this.getSessionForNode(node);
			if (!session) {
				this.appContext.apiWrapper.showErrorMessage(localize('sessionNotFound', 'Session for node {0} does not exist', node.nodePathValue));
			} else {
				let nodeInfo = node.getNodeInfo();
				let expandInfo: sqlops.ExpandNodeInfo = {
					nodePath: nodeInfo.nodePath,
					sessionId: session.uri
				};
				await this.refreshNode(expandInfo);
			}
		} catch (err) {
			outputChannel.appendLine(localize('notifyError', 'Error notifying of node change: {0}', err));
		}
	}

	private getSessionForNode(node: TreeNode): SqlClusterSession {
		let rootNode: DataServicesNode = undefined;
		while (rootNode === undefined && node !== undefined) {
			if (node instanceof DataServicesNode) {
				rootNode = node;
				break;
			} else {
				node = node.parent;
			}
		}
		if (rootNode) {
			return rootNode.session;
		}
		// Not found
		return undefined;
	}

	async findNodeForContext<T extends TreeNode>(sqlMasterContext: sqlops.ObjectExplorerContext): Promise<T> {
		let node: T = undefined;
		let sqlMasterConnProfile = sqlMasterContext.connectionProfile;
		let clusterConnectionInfo: sqlops.ConnectionInfo = await SqlClusterLookUp.lookUpSqlClusterInfo(sqlMasterConnProfile);
		let options = clusterConnectionInfo.options;
		let session = this.findClusterSession(options['groupId'], options['host'], options['knoxport'], options['user']);
		if (session) {
			if (sqlMasterContext.isConnectionNode) {
				// Note: ideally fix so we verify T matches RootNode and go from there
				node = <T><any>session.root;
			} else {
				// Find the node under the session
				node = <T><any>await session.root.findNodeByPath(sqlMasterContext.nodeInfo.nodePath, true);
			}
		}
		return node;
	}

	private findClusterSession(groupId: string, ip: string, port: string, username: string): SqlClusterSession {
		let clusterSecssion: SqlClusterSession = this.sessionMap ?
			Array.from(this.sessionMap.values()).find(e => {
				let conn = e.connection;
				return conn.groupId === groupId && conn.host === ip &&
					conn.knoxport === port && conn.user === username;
			}) :
			undefined;
		return clusterSecssion;
	}
}

export class SqlClusterSession {
	private _root: RootNode;
	constructor(private _connection: SqlClusterConnection, private sessionId?: string) {
	}

	public get uri(): string {
		return this.sessionId || this._connection.uri;
	}

	public get connection(): SqlClusterConnection {
		return this._connection;
	}

	public set root(node: RootNode) {
		this._root = node;
	}

	public get root(): RootNode {
		return this._root;
	}
}

class RootNode extends TreeNode {
	private children: TreeNode[];
	constructor(private _session: SqlClusterSession, private context: TreeDataContext, private nodePath: string) {
		super();
	}

	public get session(): SqlClusterSession {
		return this._session;
	}

	public get nodePathValue(): string {
		return this.nodePath;
	}

	public getChildren(refreshChildren: boolean): TreeNode[] | Promise<TreeNode[]> {
		if (refreshChildren || !this.children) {
			this.children = [];
			let dataServicesNode = new DataServicesNode(this._session, this.context, this.nodePath);
			dataServicesNode.parent = this;
			this.children.push(dataServicesNode);
		}
		return this.children;
	}

	getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		throw new Error('Not intended for use in a file explorer view.');
	}

	getNodeInfo(): sqlops.NodeInfo {
		let nodeInfo: sqlops.NodeInfo = {
			label: localize('rootLabel', 'Root'),
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: 'sqlCluster:root',
			nodeSubType: undefined,
			iconType: 'folder'
		};
		return nodeInfo;
	}
}

class DataServicesNode extends TreeNode {
	private children: TreeNode[];
	constructor(private _session: SqlClusterSession, private context: TreeDataContext, private nodePath: string) {
		super();
	}

	public get session(): SqlClusterSession {
		return this._session;
	}

	public get nodePathValue(): string {
		return this.nodePath;
	}

	public getChildren(refreshChildren: boolean): TreeNode[] | Promise<TreeNode[]> {
		if (refreshChildren || !this.children) {
			this.children = [];
			let hdfsNode = new ConnectionNode(this.context, localize('hdfsFolder', 'HDFS'), this.createHdfsFileSource());
			hdfsNode.parent = this;
			this.children.push(hdfsNode);
		}
		return this.children;
	}

	private createHdfsFileSource(): IFileSource {
		return this.session.connection.createHdfsFileSource();
	}

	getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		throw new Error('Not intended for use in a file explorer view.');
	}

	getNodeInfo(): sqlops.NodeInfo {
		let nodeInfo: sqlops.NodeInfo = {
			label: localize('dataServicesLabel', 'Data Services'),
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: 'dataservices',
			nodeSubType: undefined,
			iconType: 'folder'
		};
		return nodeInfo;
	}
}