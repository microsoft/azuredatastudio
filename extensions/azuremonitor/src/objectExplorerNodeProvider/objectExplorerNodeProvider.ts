/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ProviderBase } from './providerBase';
import { AzureMonitorClusterConnection } from './connection';
import { TreeNode } from './treeNodes';
import { AppContext } from '../appContext';
import * as constants from '../constants';
import { ICommandObjectExplorerContext } from './command';
import { outputChannel } from '../azuremonitorServer';

export interface ITreeChangeHandler {
	notifyNodeChanged(node: TreeNode): void;
}

export class AzureMonitorObjectExplorerNodeProvider extends ProviderBase implements azdata.ObjectExplorerNodeProvider, ITreeChangeHandler {
	public readonly supportedProviderId: string = constants.providerId;
	private expandCompleteEmitter = new vscode.EventEmitter<azdata.ObjectExplorerExpandInfo>();

	constructor(private appContext: AppContext) {
		super();
		this.appContext.registerService<AzureMonitorObjectExplorerNodeProvider>(constants.ObjectExplorerService, this);
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

		let connProfile = await azdata.objectexplorer.getSessionConnectionProfile(session.sessionId);
		if (!connProfile) { return false; }

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

	private async doExpandNode(nodeInfo: azdata.ExpandNodeInfo, _isRefresh: boolean = false): Promise<boolean> {
		let response = {
			sessionId: nodeInfo.sessionId!,
			nodePath: nodeInfo.nodePath!,
			errorMessage: undefined,
			nodes: []
		};

		this.expandCompleteEmitter.fire(response);

		return true;
	}

	refreshNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
		return this.expandNode(nodeInfo, true);
	}

	handleSessionClose(_closeSessionInfo: azdata.ObjectExplorerCloseSessionInfo): void {
	}

	findNodes(_findNodesInfo: azdata.FindNodesInfo): Thenable<azdata.ObjectExplorerFindNodesResponse> {
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
			outputChannel.appendLine(localize('notifyError', "Error notifying of node change: {0}", err));
		}
	}

	private getSqlClusterSessionForNode(node?: TreeNode): SqlClusterSession | undefined {
		let sqlClusterSession: SqlClusterSession | undefined = undefined;
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

	async findSqlClusterNodeByContext<T extends TreeNode>(context: ICommandObjectExplorerContext | azdata.ObjectExplorerContext): Promise<T | undefined> {
		let node: T | undefined = undefined;
		let explorerContext = 'explorerContext' in context ? context.explorerContext : context;
		let sqlConnProfile = explorerContext.connectionProfile;
		let session = this.findSqlClusterSessionBySqlConnProfile(sqlConnProfile!);
		if (session) {
			if (explorerContext.isConnectionNode) {
				// Note: ideally fix so we verify T matches RootNode and go from there
				node = <T><any>session.rootNode;
			} else {
				// Find the node under the session
				node = <T><any>await session.rootNode.findNodeByPath(explorerContext?.nodeInfo?.nodePath!, true);
			}
		}
		return node;
	}

	public findSqlClusterSessionBySqlConnProfile(_connectionProfile: azdata.IConnectionProfile): SqlClusterSession | undefined {
		return undefined;
	}
}

export class SqlClusterSession {
	private _rootNode: SqlClusterRootNode;

	constructor(
		private _sqlClusterConnection: AzureMonitorClusterConnection,
		private _sqlSession: azdata.ObjectExplorerSession,
		private _sqlConnectionProfile: azdata.IConnectionProfile
	) {
		this._rootNode = new SqlClusterRootNode(this,
			this._sqlSession.rootNode.nodePath!);
	}

	public get sqlClusterConnection(): AzureMonitorClusterConnection { return this._sqlClusterConnection; }
	public get sqlSession(): azdata.ObjectExplorerSession { return this._sqlSession; }
	public get sqlConnectionProfile(): azdata.IConnectionProfile { return this._sqlConnectionProfile; }
	public get sessionId(): string { return this._sqlSession.sessionId!; }
	public get rootNode(): SqlClusterRootNode { return this._rootNode; }

	public isMatchedSqlConnection(sqlConnProfile: azdata.IConnectionProfile): boolean {
		return this._sqlConnectionProfile.id === sqlConnProfile.id;
	}
}

class SqlClusterRootNode extends TreeNode {
	private _children: TreeNode[] = [];
	constructor(
		private _session: SqlClusterSession,
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
		return this._children;
	}

	getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		throw new Error('Not intended for use in a file explorer view.');
	}

	getNodeInfo(): azdata.NodeInfo {
		let nodeInfo: azdata.NodeInfo = {
			label: localize('rootLabel', "Root")!,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath()!,
			nodeStatus: undefined,
			nodeType: 'sqlCluster:root',
			nodeSubType: undefined,
			iconType: 'folder'
		};
		return nodeInfo;
	}
}
