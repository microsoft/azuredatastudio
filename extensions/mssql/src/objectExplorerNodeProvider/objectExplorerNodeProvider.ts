/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ProviderBase } from './providerBase';
import { SqlClusterConnection } from './connection';
import * as utils from '../utils';
import { TreeNode } from './treeNodes';
import { ConnectionNode, TreeDataContext, ITreeChangeHandler } from './hdfsProvider';
import { IFileSource } from './fileSources';
import { AppContext } from '../appContext';
import * as constants from '../constants';
import * as SqlClusterLookUp from '../sqlClusterLookUp';
import { ICommandObjectExplorerContext } from './command';

export const mssqlOutputChannel = vscode.window.createOutputChannel(constants.providerId);

export class MssqlObjectExplorerNodeProvider extends ProviderBase implements sqlops.ObjectExplorerNodeProvider, ITreeChangeHandler {
	public readonly supportedProviderId: string = constants.providerId;
	private sessionMap: Map<string, SqlClusterSession>;
	private expandCompleteEmitter = new vscode.EventEmitter<sqlops.ObjectExplorerExpandInfo>();

	constructor(private appContext: AppContext) {
		super();
		this.sessionMap = new Map<string, SqlClusterSession>();
		this.appContext.registerService<MssqlObjectExplorerNodeProvider>(constants.ObjectExplorerService, this);
	}

	handleSessionOpen(session: sqlops.ObjectExplorerSession): Thenable<boolean> {
		return new Promise((resolve, reject) => {
			if (!session) {
				reject('handleSessionOpen requires a session object to be passed');
			} else {
				resolve(this.doSessionOpen(session));
			}
		});
	}

	private async doSessionOpen(session: sqlops.ObjectExplorerSession): Promise<boolean> {
		if (!session || !session.sessionId) { return false; }

		let sqlConnProfile = await sqlops.objectexplorer.getSessionConnectionProfile(session.sessionId);
		if (!sqlConnProfile) { return false; }

		let clusterConnInfo = await SqlClusterLookUp.getSqlClusterConnection(sqlConnProfile);
		if (!clusterConnInfo) { return false; }

		let clusterConnection = new SqlClusterConnection(clusterConnInfo);
		let clusterSession = new SqlClusterSession(clusterConnection, session, sqlConnProfile, this.appContext, this);
		this.sessionMap.set(session.sessionId, clusterSession);
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
		let session = this.sessionMap.get(nodeInfo.sessionId);
		let response = {
			sessionId: nodeInfo.sessionId,
			nodePath: nodeInfo.nodePath,
			errorMessage: undefined,
			nodes: []
		};

		if (!session) {
			// This is not an error case. Just fire reponse with empty nodes for example: request from standalone SQL instance
			this.expandCompleteEmitter.fire(response);
			return false;
		} else {
			setTimeout(() => {

				// Running after promise resolution as we need the Ops Studio-side map to have been updated
				// Intentionally not awaiting or catching errors.
				// Any failure in startExpansion should be emitted in the expand complete result
				// We want this to be async and ideally return true before it completes
				this.startExpansion(session, nodeInfo, isRefresh);
			}, 10);
		}
		return true;
	}

	private async startExpansion(session: SqlClusterSession, nodeInfo: sqlops.ExpandNodeInfo, isRefresh: boolean = false): Promise<void> {
		let expandResult: sqlops.ObjectExplorerExpandInfo = {
			sessionId: session.sessionId,
			nodePath: nodeInfo.nodePath,
			errorMessage: undefined,
			nodes: []
		};
		try {
			let node = await session.rootNode.findNodeByPath(nodeInfo.nodePath, true);
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
			let session = this.getSqlClusterSessionForNode(node);
			if (!session) {
				this.appContext.apiWrapper.showErrorMessage(localize('sessionNotFound', 'Session for node {0} does not exist', node.nodePathValue));
			} else {
				let nodeInfo = node.getNodeInfo();
				let expandInfo: sqlops.ExpandNodeInfo = {
					nodePath: nodeInfo.nodePath,
					sessionId: session.sessionId
				};
				await this.refreshNode(expandInfo);
			}
		} catch (err) {
			mssqlOutputChannel.appendLine(localize('notifyError', 'Error notifying of node change: {0}', err));
		}
	}

	private getSqlClusterSessionForNode(node: TreeNode): SqlClusterSession {
		let sqlClusterSession: SqlClusterSession = undefined;
		while (node !== undefined) {
			if (node instanceof DataServicesNode) {
				sqlClusterSession = node.session;
				break;
			} else {
				node = node.parent;
			}
		}
		return sqlClusterSession;
	}

	async findSqlClusterNodeByContext<T extends TreeNode>(context: ICommandObjectExplorerContext | sqlops.ObjectExplorerContext): Promise<T> {
		let node: T = undefined;
		let explorerContext = 'explorerContext' in context ? context.explorerContext : context;
		let sqlConnProfile = explorerContext.connectionProfile;
		let session = this.findSqlClusterSessionBySqlConnProfile(sqlConnProfile);
		if (session) {
			if (explorerContext.isConnectionNode) {
				// Note: ideally fix so we verify T matches RootNode and go from there
				node = <T><any>session.rootNode;
			} else {
				// Find the node under the session
				node = <T><any>await session.rootNode.findNodeByPath(explorerContext.nodeInfo.nodePath, true);
			}
		}
		return node;
	}

	public findSqlClusterSessionBySqlConnProfile(connectionProfile: sqlops.IConnectionProfile): SqlClusterSession {
		for (let session of this.sessionMap.values()) {
			if (session.isMatchedSqlConnection(connectionProfile)) {
				return session;
			}
		}
		return undefined;
	}
}

export class SqlClusterSession {
	private _rootNode: SqlClusterRootNode;

	constructor(
		private _sqlClusterConnection: SqlClusterConnection,
		private _sqlSession: sqlops.ObjectExplorerSession,
		private _sqlConnectionProfile: sqlops.IConnectionProfile,
		private _appContext: AppContext,
		private _changeHandler: ITreeChangeHandler
	) {
		this._rootNode = new SqlClusterRootNode(this,
			new TreeDataContext(this._appContext.extensionContext, this._changeHandler),
			this._sqlSession.rootNode.nodePath);
	}

	public get sqlClusterConnection(): SqlClusterConnection { return this._sqlClusterConnection; }
	public get sqlSession(): sqlops.ObjectExplorerSession { return this._sqlSession; }
	public get sqlConnectionProfile(): sqlops.IConnectionProfile { return this._sqlConnectionProfile; }
	public get sessionId(): string { return this._sqlSession.sessionId; }
	public get rootNode(): SqlClusterRootNode { return this._rootNode; }

	public isMatchedSqlConnection(sqlConnProfile: sqlops.IConnectionProfile): boolean {
		return this._sqlConnectionProfile.id === sqlConnProfile.id;
	}
}

class SqlClusterRootNode extends TreeNode {
	private _children: TreeNode[];
	constructor(
		private _session: SqlClusterSession,
		private _treeDataContext: TreeDataContext,
		private _nodePathValue: string
	) {
		super();
	}

	public get session(): SqlClusterSession {
		return this._session;
	}

	public get nodePathValue(): string {
		return this._nodePathValue;
	}

	public getChildren(refreshChildren: boolean): TreeNode[] | Promise<TreeNode[]> {
		if (refreshChildren || !this._children) {
			this._children = [];
			let dataServicesNode = new DataServicesNode(this._session, this._treeDataContext, this._nodePathValue);
			dataServicesNode.parent = this;
			this._children.push(dataServicesNode);
		}
		return this._children;
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
	private _children: TreeNode[];
	constructor(private _session: SqlClusterSession, private _context: TreeDataContext, private _nodePath: string) {
		super();
	}

	public get session(): SqlClusterSession {
		return this._session;
	}

	public get nodePathValue(): string {
		return this._nodePath;
	}

	public getChildren(refreshChildren: boolean): TreeNode[] | Promise<TreeNode[]> {
		if (refreshChildren || !this._children) {
			this._children = [];
			let fileSource: IFileSource = this.session.sqlClusterConnection.createHdfsFileSource();
			let hdfsNode = new ConnectionNode(this._context, localize('hdfsFolder', 'HDFS'), fileSource);
			hdfsNode.parent = this;
			this._children.push(hdfsNode);
		}
		return this._children;
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