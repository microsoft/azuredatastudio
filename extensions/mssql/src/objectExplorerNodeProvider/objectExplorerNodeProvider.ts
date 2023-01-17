/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ProviderBase } from './providerBase';
import { SqlClusterConnection } from './connection';
import * as utils from '../utils';
import { TreeNode } from './treeNodes';
import { ConnectionNode, TreeDataContext, ITreeChangeHandler } from './hdfsProvider';
import { AppContext } from '../appContext';
import * as constants from '../constants';
import { ICommandObjectExplorerContext } from './command';
import { IPrompter, IQuestion, QuestionTypes } from '../prompts/question';
import { getSqlClusterConnectionParams } from '../sqlClusterLookUp';

export const mssqlOutputChannel = vscode.window.createOutputChannel(constants.providerId);

export class MssqlObjectExplorerNodeProvider extends ProviderBase implements azdata.ObjectExplorerNodeProvider, ITreeChangeHandler {
	public readonly supportedProviderId: string = constants.providerId;
	private clusterSessionMap: Map<string, SqlClusterSession>;
	private expandCompleteEmitter = new vscode.EventEmitter<azdata.ObjectExplorerExpandInfo>();

	constructor(private prompter: IPrompter, private appContext: AppContext) {
		super();
		this.clusterSessionMap = new Map<string, SqlClusterSession>();
		this.appContext.registerService<MssqlObjectExplorerNodeProvider>(constants.ObjectExplorerService, this);
	}

	handleSessionOpen(session: azdata.ObjectExplorerSession): Thenable<boolean> {
		return new Promise((resolve, reject) => {
			if (!session) {
				reject('handleSessionOpen requires a session object to be passed');
			} else {
				resolve(this.doSessionOpen(session));
			}
		});
	}

	private async doSessionOpen(session: azdata.ObjectExplorerSession): Promise<boolean> {
		if (!session || !session.sessionId) { return false; }

		let sqlConnProfile = await azdata.objectexplorer.getSessionConnectionProfile(session.sessionId);
		if (!sqlConnProfile) { return false; }

		const isBigDataCluster = await utils.isBigDataCluster(sqlConnProfile.id);
		if (!isBigDataCluster) { return false; }

		let clusterSession = new SqlClusterSession(session, sqlConnProfile, this.appContext, this);
		this.clusterSessionMap.set(session.sessionId, clusterSession);
		return true;
	}

	expandNode(nodeInfo: azdata.ExpandNodeInfo, isRefresh: boolean = false): Thenable<boolean> {
		return new Promise((resolve, reject) => {
			if (!nodeInfo) {
				reject('expandNode requires a nodeInfo object to be passed');
			} else {
				resolve(this.doExpandNode(nodeInfo, isRefresh));
			}
		});
	}

	private async doExpandNode(nodeInfo: azdata.ExpandNodeInfo, isRefresh: boolean = false): Promise<boolean> {
		let session = this.clusterSessionMap.get(nodeInfo.sessionId);
		let response: azdata.ObjectExplorerExpandInfo = {
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

				// Running after promise resolution as we need the ADS-side map to have been updated
				// Intentionally not awaiting or catching errors.
				// Any failure in startExpansion should be emitted in the expand complete result
				// We want this to be async and ideally return true before it completes
				this.startExpansion(session, nodeInfo, isRefresh).catch(err => console.log('Error expanding Object Explorer Node ', err));
			}, 10);
		}
		return true;
	}

	private hasExpansionError(children: TreeNode[]): boolean {
		if (children.find(c => c.errorStatusCode > 0)) {
			return true;
		}
		return false;
	}

	private async startExpansion(session: SqlClusterSession, nodeInfo: azdata.ExpandNodeInfo, isRefresh: boolean = false): Promise<void> {
		let expandResult: azdata.ObjectExplorerExpandInfo = {
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
				if (children && children.length > 0) {
					// Only child returned when failure happens : When failed with 'Unauthorized' error, prompt for password.
					if (children.length === 1 && this.hasExpansionError(children)) {
						if (children[0].errorStatusCode === 401) {
							const sqlClusterConnection = await session.getSqlClusterConnection();
							// First prompt for username (defaulting to existing username)
							let username = await this.prompter.promptSingle<string>(<IQuestion>{
								type: QuestionTypes.input,
								name: 'inputPrompt',
								message: localize('promptUsername', "Please provide the username to connect to HDFS:"),
								default: sqlClusterConnection.user
							});
							// Only update the username if it's different than the original (the update functions ignore falsy values)
							if (username === sqlClusterConnection.user) {
								username = '';
							}
							sqlClusterConnection.updateUsername(username);

							// And then prompt for password
							const password = await this.prompter.promptSingle<string>(<IQuestion>{
								type: QuestionTypes.password,
								name: 'passwordPrompt',
								message: localize('prmptPwd', "Please provide the password to connect to HDFS:"),
								default: ''
							});
							sqlClusterConnection.updatePassword(password);

							if (username || password) {
								await node.updateFileSource(sqlClusterConnection);
								children = await node.getChildren(true);
							}
						}
					}

					expandResult.nodes = children.map(c => c.getNodeInfo());
					if (children.length === 1 && this.hasExpansionError(children)) {
						let child = children[0].getNodeInfo();
						expandResult.errorMessage = child ? child.label : 'Unknown Error';
						expandResult.nodes = [];
					}
				}
			}
		} catch (error) {
			expandResult.errorMessage = utils.getErrorMessage(error);
		}
		this.expandCompleteEmitter.fire(expandResult);
	}

	refreshNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
		// TODO #3815 implement properly
		return this.expandNode(nodeInfo, true);
	}

	handleSessionClose(closeSessionInfo: azdata.ObjectExplorerCloseSessionInfo): void {
		this.clusterSessionMap.delete(closeSessionInfo.sessionId);
	}

	findNodes(findNodesInfo: azdata.FindNodesInfo): Thenable<azdata.ObjectExplorerFindNodesResponse> {
		// TODO #3814 implement
		let response: azdata.ObjectExplorerFindNodesResponse = {
			nodes: []
		};
		return Promise.resolve(response);
	}

	registerOnExpandCompleted(handler: (response: azdata.ObjectExplorerExpandInfo) => any): void {
		this.expandCompleteEmitter.event(handler);
	}

	notifyNodeChanged(node: TreeNode): void {
		void this.notifyNodeChangesAsync(node);
	}

	private async notifyNodeChangesAsync(node: TreeNode): Promise<void> {
		try {
			let session = this.getSqlClusterSessionForNode(node);
			if (!session) {
				void vscode.window.showErrorMessage(localize('sessionNotFound', "Session for node {0} does not exist", node.nodePathValue));
			} else {
				let nodeInfo = node.getNodeInfo();
				let expandInfo: azdata.ExpandNodeInfo = {
					nodePath: nodeInfo.nodePath,
					sessionId: session.sessionId
				};
				await this.refreshNode(expandInfo);
			}
		} catch (err) {
			mssqlOutputChannel.appendLine(localize('notifyError', "Error notifying of node change: {0}", err));
		}
	}

	private getSqlClusterSessionForNode(node: TreeNode): SqlClusterSession {
		let sqlClusterSession: SqlClusterSession = undefined;
		while (node !== undefined) {
			if (node instanceof SqlClusterRootNode) {
				sqlClusterSession = node.session;
				break;
			} else {
				node = node.parent;
			}
		}
		return sqlClusterSession;
	}

	async findSqlClusterNodeByContext<T extends TreeNode>(context: ICommandObjectExplorerContext | azdata.ObjectExplorerContext): Promise<T> {
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

	public findSqlClusterSessionBySqlConnProfile(connectionProfile: azdata.IConnectionProfile): SqlClusterSession | undefined {
		for (let session of this.clusterSessionMap.values()) {
			if (session.isMatchedSqlConnection(connectionProfile)) {
				return session;
			}
		}
		return undefined;
	}
}

export class SqlClusterSession {
	private _rootNode: SqlClusterRootNode;
	private _sqlClusterConnection: SqlClusterConnection | undefined = undefined;
	constructor(
		private _sqlSession: azdata.ObjectExplorerSession,
		private _sqlConnectionProfile: azdata.IConnectionProfile,
		private _appContext: AppContext,
		private _changeHandler: ITreeChangeHandler
	) {
		this._rootNode = new SqlClusterRootNode(this,
			new TreeDataContext(this._appContext.extensionContext, this._changeHandler),
			this._sqlSession.rootNode.nodePath);
	}

	public async getSqlClusterConnection(): Promise<SqlClusterConnection> {
		if (!this._sqlClusterConnection) {
			const sqlClusterConnectionParams = await getSqlClusterConnectionParams(this._sqlConnectionProfile, this._appContext);
			this._sqlClusterConnection = new SqlClusterConnection(sqlClusterConnectionParams);
		}
		return this._sqlClusterConnection;
	}
	public get sqlSession(): azdata.ObjectExplorerSession { return this._sqlSession; }
	public get sqlConnectionProfile(): azdata.IConnectionProfile { return this._sqlConnectionProfile; }
	public get sessionId(): string { return this._sqlSession.sessionId; }
	public get rootNode(): SqlClusterRootNode { return this._rootNode; }

	public isMatchedSqlConnection(sqlConnProfile: azdata.IConnectionProfile): boolean {
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
		super(undefined);
	}

	public get session(): SqlClusterSession {
		return this._session;
	}

	public get nodePathValue(): string {
		return this._nodePathValue;
	}

	public getChildren(refreshChildren: boolean): TreeNode[] | Promise<TreeNode[]> {
		if (refreshChildren || !this._children) {
			return this.refreshChildren();
		}
		return this._children;
	}

	private async refreshChildren(): Promise<TreeNode[]> {
		this._children = [];

		let hdfsNode = new ConnectionNode(this._treeDataContext, localize('hdfsFolder', "HDFS"), this.session);
		hdfsNode.parent = this;
		this._children.push(hdfsNode);
		return this._children;
	}

	getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		throw new Error('Not intended for use in a file explorer view.');
	}

	getNodeInfo(): azdata.NodeInfo {
		let nodeInfo: azdata.NodeInfo = {
			label: localize('rootLabel', "Root"),
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
