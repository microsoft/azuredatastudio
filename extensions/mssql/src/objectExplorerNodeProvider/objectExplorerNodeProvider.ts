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
import { SqlClusterLookUp } from '../sqlClusterLookUp';
import { ICommandObjectExplorerContext } from './command';

const outputChannel = vscode.window.createOutputChannel(constants.providerId);

export class SqlObjectExplorerNodeProvider extends ProviderBase implements sqlops.ObjectExplorerNodeProvider, ITreeChangeHandler {
	public readonly supportedProviderId: string = constants.providerId;
	private sessionMap: Map<string, SqlClusterSession>;
	private expandCompleteEmitter = new vscode.EventEmitter<sqlops.ObjectExplorerExpandInfo>();

	constructor(private appContext: AppContext) {
		super();
		this.sessionMap = new Map<string, SqlClusterSession>();
		this.appContext.registerService<SqlObjectExplorerNodeProvider>(constants.ObjectExplorerService, this);
	}

	handleSessionOpen(sqlSession: sqlops.ObjectExplorerSession): Thenable<boolean> {
		return new Promise((resolve, reject) => {
			if (!sqlSession) {
				reject('handleSessionOpen requires a session object to be passed');
			} else {
				resolve(this.doSessionOpen(sqlSession));
			}
		});
	}

	private async doSessionOpen(sqlSession: sqlops.ObjectExplorerSession): Promise<boolean> {
		if (!sqlSession && !sqlSession.sessionId) { return false; }

		let sqlSessionId = sqlSession.sessionId;
		let sqlConnProfile = await sqlops.objectexplorer.getSessionConnectionProfile(sqlSessionId);
		if (!sqlConnProfile) { return false; }

		let clusterConnInfo = await SqlClusterLookUp.getSqlClusterConnInfo(sqlConnProfile);
		let clusterConnection = new SqlClusterConnection(clusterConnInfo);
		let clusterSession = new SqlClusterSession(
			{
				sqlClusterConnection: clusterConnection,
				sqlSession: sqlSession,
				sqlConnProfile: sqlConnProfile,
				appContext: this.appContext,
				changeHandler: this
			}
		);
		this.sessionMap.set(sqlSession.sessionId, clusterSession);
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
			sessionId: sqlClustersession.sessionId,
			nodePath: nodeInfo.nodePath,
			errorMessage: undefined,
			nodes: []
		};
		try {
			let node = await sqlClustersession.rootNode.findNodeByPath(nodeInfo.nodePath, true);
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
				this.appContext.apiWrapper.showErrorMessage(localize('sessionNotFound', 'Session for node {0} does not exist', node.nodePath));
			} else {
				let nodeInfo = node.getNodeInfo();
				let expandInfo: sqlops.ExpandNodeInfo = {
					nodePath: nodeInfo.nodePath,
					sessionId: session.sessionId
				};
				await this.refreshNode(expandInfo);
			}
		} catch (err) {
			outputChannel.appendLine(localize('notifyError', 'Error notifying of node change: {0}', err));
		}
	}

	private getSqlClusterSessionForNode(node: TreeNode): SqlClusterSession {
		let sqlClusterSession: SqlClusterSession = undefined;
		while (node !== undefined) {
			if (node instanceof DataServicesNode) {
				sqlClusterSession = node.sqlClusterSession;
				break;
			} else {
				node = node.parent;
			}
		}
		return sqlClusterSession;
	}

	async findSqlClusterNodeBySqlContext<T extends TreeNode>(sqlContext: ICommandObjectExplorerContext | sqlops.ObjectExplorerContext): Promise<T> {
		let node: T = undefined;
		let sqlOeContext = 'explorerContext' in sqlContext ? sqlContext.explorerContext : sqlContext;
		let sqlConnProfile = sqlOeContext.connectionProfile;
		let session = this.findSqlClusterSessionBySqlConnProfile(sqlConnProfile);
		if (session) {
			if (sqlOeContext.isConnectionNode) {
				// Note: ideally fix so we verify T matches RootNode and go from there
				node = <T><any>session.rootNode;
			} else {
				// Find the node under the session
				node = <T><any>await session.rootNode.findNodeByPath(sqlOeContext.nodeInfo.nodePath, true);
			}
		}
		return node;
	}

	public findSqlClusterSessionBySqlConnProfile(sqlConnProfile: sqlops.IConnectionProfile): SqlClusterSession {
		return Array.from(this.sessionMap.values())
			.find(s => s.isMatchedSqlConnProfile(sqlConnProfile));
	}
}

export class SqlClusterSession {
	private _sqlClusterConnection: SqlClusterConnection;
	private _sqlSession: sqlops.ObjectExplorerSession;
	private _sqlConnProfile: sqlops.IConnectionProfile;
	private _rootNode: SqlClusterRootNode;

	constructor(arg: SqlClusterSessionArg) {
		this._sqlClusterConnection = arg.sqlClusterConnection;
		this._sqlSession = arg.sqlSession;
		this._sqlConnProfile = arg.sqlConnProfile;
		this._rootNode = new SqlClusterRootNode(this,
			new TreeDataContext(arg.appContext.extensionContext, arg.changeHandler),
			arg.sqlSession.rootNode.nodePath);
	}

	public get sqlClusterConnection(): SqlClusterConnection { return this._sqlClusterConnection; }
	public get sqlSession(): sqlops.ObjectExplorerSession { return this._sqlSession; }
	public get sqlConnProfile(): sqlops.IConnectionProfile { return this._sqlConnProfile; }
	public get sessionId(): string { return this._sqlSession.sessionId; }
	public get rootNode(): SqlClusterRootNode { return this._rootNode; }

	public isMatchedSqlConnProfile(sqlConnProfile: sqlops.IConnectionProfile): boolean {
		return this._sqlConnProfile.id === sqlConnProfile.id;
	}
}

interface SqlClusterSessionArg {
	sqlClusterConnection: SqlClusterConnection;
	sqlSession: sqlops.ObjectExplorerSession;
	sqlConnProfile: sqlops.IConnectionProfile;
	appContext: AppContext;
	changeHandler: ITreeChangeHandler;
}

class SqlClusterRootNode extends TreeNode {
	private _children: TreeNode[];
	private _sqlClusterSession: SqlClusterSession;
	private _treeDataContext: TreeDataContext;
	private _nodePath: string;

	constructor(sqlClusterSession: SqlClusterSession, treeDataContext: TreeDataContext, nodePath: string) {
		super();
		this._sqlClusterSession = sqlClusterSession;
		this._treeDataContext = treeDataContext;
		this._nodePath = nodePath;
	}

	public get sqlClusterSession(): SqlClusterSession {
		return this._sqlClusterSession;
	}

	public get nodePath(): string {
		return this._nodePath;
	}

	public getChildren(refreshChildren: boolean): TreeNode[] | Promise<TreeNode[]> {
		if (refreshChildren || !this._children) {
			this._children = [];
			let dataServicesNode = new DataServicesNode(this._sqlClusterSession, this._treeDataContext, this._nodePath);
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
	private _sqlClusterSession: SqlClusterSession;
	private _treeDataContext: TreeDataContext;
	private _nodePath: string;
	constructor(sqlClusterSession: SqlClusterSession, treeDataContext: TreeDataContext, nodePath: string) {
		super();
		this._sqlClusterSession = sqlClusterSession;
		this._treeDataContext = treeDataContext;
		this._nodePath = nodePath;
	}

	public get sqlClusterSession(): SqlClusterSession {
		return this._sqlClusterSession;
	}

	public get nodePath(): string {
		return this._nodePath;
	}

	public getChildren(refreshChildren: boolean): TreeNode[] | Promise<TreeNode[]> {
		if (refreshChildren || !this._children) {
			this._children = [];
			let fileSource: IFileSource = this.sqlClusterSession.sqlClusterConnection.createHdfsFileSource();
			let hdfsNode = new ConnectionNode(this._treeDataContext, localize('hdfsFolder', 'HDFS'), fileSource);
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