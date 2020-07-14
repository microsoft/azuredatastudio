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
import { IFileSource } from './fileSources';
import { AppContext } from '../appContext';
import * as constants from '../constants';
import * as SqlClusterLookUp from '../sqlClusterLookUp';
import { ICommandObjectExplorerContext } from './command';
import { IPrompter, IQuestion, QuestionTypes } from '../prompts/question';

export const mssqlOutputChannel = vscode.window.createOutputChannel(constants.providerId);

export class MssqlObjectExplorerNodeProvider extends ProviderBase implements azdata.ObjectExplorerNodeProvider, ITreeChangeHandler {
	public readonly supportedProviderId: string = constants.providerId;
	private sessionMap: Map<string, SqlClusterSession>;
	private expandCompleteEmitter = new vscode.EventEmitter<azdata.ObjectExplorerExpandInfo>();

	constructor(private prompter: IPrompter, private appContext: AppContext) {
		super();
		this.sessionMap = new Map<string, SqlClusterSession>();
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

		let clusterConnInfo = await SqlClusterLookUp.getSqlClusterConnection(sqlConnProfile);
		if (!clusterConnInfo) { return false; }

		let clusterConnection = new SqlClusterConnection(clusterConnInfo);
		let clusterSession = new SqlClusterSession(clusterConnection, session, sqlConnProfile, this.appContext, this);
		this.sessionMap.set(session.sessionId, clusterSession);
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
		let session = this.sessionMap.get(nodeInfo.sessionId);
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

				// Running after promise resolution as we need the Ops Studio-side map to have been updated
				// Intentionally not awaiting or catching errors.
				// Any failure in startExpansion should be emitted in the expand complete result
				// We want this to be async and ideally return true before it completes
				this.startExpansion(session, nodeInfo, isRefresh);
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
							// First prompt for username (defaulting to existing username)
							let username: string = await this.promptInput(localize('promptUsername', "Please provide the username to connect to HDFS:"), session.sqlClusterConnection.user);
							// Only update the username if it's different than the original (the update functions ignore falsy values)
							if (username === session.sqlClusterConnection.user) {
								username = '';
							}
							session.sqlClusterConnection.updateUsername(username);

							// And then prompt for password
							const password: string = await this.promptPassword(localize('prmptPwd', "Please provide the password to connect to HDFS:"));
							session.sqlClusterConnection.updatePassword(password);

							if (username || password) {
								await node.updateFileSource(session.sqlClusterConnection);
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

	private async promptInput(promptMsg: string, defaultValue: string): Promise<string> {
		return await this.prompter.promptSingle(<IQuestion>{
			type: QuestionTypes.input,
			name: 'inputPrompt',
			message: promptMsg,
			default: defaultValue
		}).then(confirmed => <string>confirmed);
	}

	private async promptPassword(promptMsg: string): Promise<string> {
		return await this.prompter.promptSingle(<IQuestion>{
			type: QuestionTypes.password,
			name: 'passwordPrompt',
			message: promptMsg,
			default: ''
		}).then(confirmed => <string>confirmed);
	}

	refreshNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
		// TODO #3815 implement properly
		return this.expandNode(nodeInfo, true);
	}

	handleSessionClose(closeSessionInfo: azdata.ObjectExplorerCloseSessionInfo): void {
		this.sessionMap.delete(closeSessionInfo.sessionId);
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
		this.notifyNodeChangesAsync(node);
	}

	private async notifyNodeChangesAsync(node: TreeNode): Promise<void> {
		try {
			let session = this.getSqlClusterSessionForNode(node);
			if (!session) {
				vscode.window.showErrorMessage(localize('sessionNotFound', "Session for node {0} does not exist", node.nodePathValue));
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

	public findSqlClusterSessionBySqlConnProfile(connectionProfile: azdata.IConnectionProfile): SqlClusterSession {
		for (let session of this.sessionMap.values()) {
			if (session.isMatchedSqlConnection(connectionProfile)) {
				return session;
			}
		}
		return undefined;
	}
}

class SqlClusterSession {
	private _rootNode: SqlClusterRootNode;

	constructor(
		private _sqlClusterConnection: SqlClusterConnection,
		private _sqlSession: azdata.ObjectExplorerSession,
		private _sqlConnectionProfile: azdata.IConnectionProfile,
		private _appContext: AppContext,
		private _changeHandler: ITreeChangeHandler
	) {
		this._rootNode = new SqlClusterRootNode(this,
			new TreeDataContext(this._appContext.extensionContext, this._changeHandler),
			this._sqlSession.rootNode.nodePath);
	}

	public get sqlClusterConnection(): SqlClusterConnection { return this._sqlClusterConnection; }
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
			return this.refreshChildren();
		}
		return this._children;
	}

	private async refreshChildren(): Promise<TreeNode[]> {
		this._children = [];
		let fileSource: IFileSource = await this.session.sqlClusterConnection.createHdfsFileSource();
		let hdfsNode = new ConnectionNode(this._treeDataContext, localize('hdfsFolder', "HDFS"), fileSource);
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
