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
import { HadoopConnectionProvider, Connection } from './connectionProvider';
import * as utils from './utils';
import { TreeNode } from './treeNodes';
import { ConnectionNode, TreeDataContext, ITreeChangeHandler } from './hdfsProvider';
import { IFileSource } from './fileSources';
import { AppContext } from './appContext';
import * as constants from './constants';

export class HadoopObjectExplorerNodeProvider extends ProviderBase implements sqlops.ObjectExplorerNodeProvider, ITreeChangeHandler {
    public readonly supportedProviderId: string = constants.mssqlProviderId;
    public readonly groupingId: number = constants.objectexplorerGroupingId;
    private sessionMap: Map<string, Session>;
    private sessionCreatedEmitter = new vscode.EventEmitter<sqlops.ObjectExplorerSession>();
    private expandCompleteEmitter = new vscode.EventEmitter<sqlops.ObjectExplorerExpandInfo>();

    constructor(private connectionProvider: HadoopConnectionProvider, private appContext: AppContext) {
        super();
        if (!this.connectionProvider) {
            throw new Error(localize('connectionProviderRequired', 'Connection provider is required'));
        }
        this.sessionMap = new Map();
        this.appContext.registerService<HadoopObjectExplorerNodeProvider>(constants.ObjectExplorerService, this);
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
        if (!session) {
            let connectionProfile = await sqlops.objectexplorer.getSessionConnectionProfile(nodeInfo.sessionId);
            if (connectionProfile) {
                let credentials = await sqlops.connection.getCredentials(connectionProfile.id);
                let serverInfo = await sqlops.connection.getServerInfo(connectionProfile.id);
                let endpoints = serverInfo.options.clusterEndpoints;
                let index = endpoints.findIndex(ep => ep.serviceName === constants.hadoopKnoxEndpointName);

                let connInfo: sqlops.connection.Connection = {
                    options: {
                        'host': endpoints[index].ipAddress,
                        'groupId': connectionProfile.options.groupId,
                        'knoxport': '',
                        'user': 'root', //connectionProfile.options.userName cluster setup has to have the same user for master and big data cluster
                        'password': credentials.password,
                    },
                    providerName: constants.hadoopKnoxProviderName,
                    connectionId: UUID.generateUuid()
                };

                let connection = new Connection(connInfo);
                connection.saveUriWithPrefix(constants.objectExplorerPrefix);
                session = new Session(connection, nodeInfo.sessionId);
                session.root = new RootNode(session, new TreeDataContext(this.appContext.extensionContext, this), nodeInfo.nodePath);
                this.sessionMap.set(nodeInfo.sessionId, session);
                let expandResult: sqlops.ObjectExplorerExpandInfo = {
                    sessionId: session.uri,
                    nodePath: nodeInfo.nodePath,
                    errorMessage: undefined,
                    nodes: []
                };
                try {
                    let node = await session.root.findNodeByPath(nodeInfo.nodePath, true);
                    if (!node) {
                        expandResult.errorMessage = localize('nodeNotFound', 'Cannot expand object explorer node. Couldn\t find node for path {0}', nodeInfo.nodePath);
                    } else {
                        expandResult.errorMessage = node.getNodeInfo().errorMessage;
                        if (node.getNodeInfo().nodeType === 'hadoop:root') {
                            expandResult.nodes = [node.getNodeInfo()];
                        }
                    }

                } catch (error) {
                    expandResult.errorMessage = utils.getErrorMessage(error);
                }
                this.expandCompleteEmitter.fire(expandResult);
            }
            else {
                this.expandCompleteEmitter.fire({
                    sessionId: nodeInfo.sessionId,
                    nodePath: nodeInfo.nodePath,
                    errorMessage: localize('sessionIdNotFound', 'Cannot expand object explorer node. Couldn\'t find session for uri {0}', nodeInfo.sessionId),
                    nodes: undefined
                });
                return false;
            }
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

    private async startExpansion(session: Session, nodeInfo: sqlops.ExpandNodeInfo, isRefresh: boolean = false): Promise<void> {
        let expandResult: sqlops.ObjectExplorerExpandInfo = {
            sessionId: session.uri,
            nodePath: nodeInfo.nodePath,
            errorMessage: undefined,
            nodes: []
        };
        try {
            let node = await session.root.findNodeByPath(nodeInfo.nodePath, true);
            if (!node) {
                expandResult.errorMessage = localize('nodeNotFound', 'Cannot expand object explorer node. Couldn\t find node for path {0}', nodeInfo.nodePath);
            } else {
                expandResult.errorMessage = node.getNodeInfo().errorMessage;
                let children = await node.getChildren(true);
                if (children) {
                    expandResult.nodes = children.map(c => c.getNodeInfo());
                }
            }
        } catch (error) {
            expandResult.errorMessage = utils.getErrorMessage(error);
        }
        this.expandCompleteEmitter.fire(expandResult);
    }

    refreshNode(nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
        // TODO #658 implement properly
        return this.expandNode(nodeInfo, true);
    }

    closeSession(closeSessionInfo: sqlops.ObjectExplorerCloseSessionInfo): Thenable<sqlops.ObjectExplorerCloseSessionResponse> {
        // TODO #583 cleanup any resources we've opened
        let deleted = this.sessionMap.delete(closeSessionInfo.sessionId);
        let response: sqlops.ObjectExplorerCloseSessionResponse = {
            success: deleted,
            sessionId: closeSessionInfo.sessionId
        };
        return Promise.resolve(response);
    }

    findNodes(findNodesInfo: sqlops.FindNodesInfo): Thenable<sqlops.ObjectExplorerFindNodesResponse> {
        // TODO #659 implement
        let response: sqlops.ObjectExplorerFindNodesResponse = {
            nodes: []
        };
        return Promise.resolve(response);
    }

    registerOnSessionCreated(handler: (response: sqlops.ObjectExplorerSession) => any): void {
        this.sessionCreatedEmitter.event(handler);
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
            // TODO #667 log to output channel
            // localize('notifyError', 'Error notifying of node change: {0}', error);
        }
    }

    private getSessionForNode(node: TreeNode): Session {
        let rootNode: RootNode = undefined;
        while (rootNode === undefined && node !== undefined) {
            if (node instanceof RootNode) {
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

    async findNodeForContext<T extends TreeNode>(explorerContext: sqlops.ObjectExplorerContext): Promise<T> {
        let node: T = undefined;
        let session = this.findSessionForConnection(explorerContext.connectionProfile);
        if (session) {
            if (explorerContext.isConnectionNode) {
                // Note: ideally fix so we verify T matches RootNode and go from there
                node = <T><any>session.root;
            } else {
                // Find the node under the session
                node = <T><any>await session.root.findNodeByPath(explorerContext.nodeInfo.nodePath, true);
            }
        }
        return node;
    }

    private findSessionForConnection(connectionProfile: sqlops.IConnectionProfile): Session {
        for (let session of this.sessionMap.values()) {
            // This is likely wrong but suffices for now.
            if (session.connection && session.connection.isMatch(connectionProfile)) {
                return session;
            }
        }
        return undefined;
    }
}

export class Session {
    private _root: RootNode;
    constructor(private _connection: Connection, private sessionId?: string) {
    }

    public get uri(): string {
        return this.sessionId || this._connection.uri;
    }

    public get connection(): Connection {
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
    constructor(private _session: Session, private context: TreeDataContext, private nodePath: string) {
        super();
    }

    public get session(): Session {
        return this._session;
    }

    public get nodePathValue(): string {
        return this.nodePath + '/' + constants.dataService;
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
            nodeType: 'hadoop:root',
            nodeSubType: undefined,
            iconType: 'folder'
        };
        return nodeInfo;
    }
}