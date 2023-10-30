/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ProviderId } from './connectionProvider';

const RootNode: string = 'root';

/**
 * This class implements the ObjectExplorerProvider interface that is responsible for providing the connection tree view content.
 */
export class ObjectExplorerProvider implements azdata.ObjectExplorerProvider {
	constructor(private context: vscode.ExtensionContext) {
	}

	onSessionCreatedEmitter: vscode.EventEmitter<azdata.ObjectExplorerSession> = new vscode.EventEmitter<azdata.ObjectExplorerSession>();
	onSessionCreated: vscode.Event<azdata.ObjectExplorerSession> = this.onSessionCreatedEmitter.event;

	onSessionDisconnectedEmitter: vscode.EventEmitter<azdata.ObjectExplorerSession> = new vscode.EventEmitter<azdata.ObjectExplorerSession>();
	onSessionDisconnected: vscode.Event<azdata.ObjectExplorerSession> = this.onSessionDisconnectedEmitter.event;

	onExpandCompletedEmitter: vscode.EventEmitter<azdata.ObjectExplorerExpandInfo> = new vscode.EventEmitter<azdata.ObjectExplorerExpandInfo>();
	onExpandCompleted: vscode.Event<azdata.ObjectExplorerExpandInfo> = this.onExpandCompletedEmitter.event;

	createNewSession(connInfo: azdata.ConnectionInfo): Thenable<azdata.ObjectExplorerSessionResponse> {
		setTimeout(() => {
			this.onSessionCreatedEmitter.fire({
				sessionId: '1',
				success: true,
				rootNode: {
					nodePath: RootNode,
					nodeType: 'server',
					label: 'abc',
					isLeaf: false,
					parentNodePath: ''
				}
			});
		}, 500);
		return Promise.resolve({
			sessionId: '1'
		});
	}
	closeSession(closeSessionInfo: azdata.ObjectExplorerCloseSessionInfo): Thenable<azdata.ObjectExplorerCloseSessionResponse> {
		return Promise.resolve({
			sessionId: '1',
			success: true
		});
	}
	registerOnSessionCreated(handler: (response: azdata.ObjectExplorerSession) => any): void {
		this.onSessionCreated((e) => {
			handler(e);
		});
	}
	registerOnSessionDisconnected?(handler: (response: azdata.ObjectExplorerSession) => any): void {
		this.onSessionDisconnected((e) => {
			handler(e);
		});
	}

	/**
	 * This is called when a node is being expanded for the first time
	 */
	expandNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
		this.executeExpandNode(nodeInfo);
		return Promise.resolve(true);
	}

	/**
	 * This is called when a node is being refreshed, This is triggered by the 'Refresh' context menu item of the node.
	 */
	refreshNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
		this.executeExpandNode(nodeInfo);
		return Promise.resolve(true);
	}
	findNodes(findNodesInfo: azdata.FindNodesInfo): Thenable<azdata.ObjectExplorerFindNodesResponse> {
		throw new Error('Method not implemented.');
	}
	registerOnExpandCompleted(handler: (response: azdata.ObjectExplorerExpandInfo) => any): void {
		this.onExpandCompleted((e) => {
			handler(e);
		});
	}
	handle?: number;
	providerId: string = ProviderId;

	private executeExpandNode(nodeInfo: azdata.ExpandNodeInfo): void {
		setTimeout(() => {
			const timestamp = new Date(Date.now()).toLocaleTimeString();
			this.onExpandCompletedEmitter.fire({
				sessionId: nodeInfo.sessionId,
				nodePath: nodeInfo.nodePath,
				nodes: [
					{
						nodePath: nodeInfo.nodePath + '/1',
						nodeType: '',
						icon: {
							light: this.context.asAbsolutePath('images/group.svg'),
							dark: this.context.asAbsolutePath('images/group_inverse.svg')
						},
						label: `obj 1 - ${timestamp}`,
						isLeaf: false,
						parentNodePath: nodeInfo.nodePath
					}, {
						nodePath: nodeInfo.nodePath + '/2',
						nodeType: '',
						icon: azdata.SqlThemeIcon.Column,
						label: `obj 2 - ${timestamp}`,
						isLeaf: false,
						parentNodePath: nodeInfo.nodePath
					}
				]
			});
		}, 500);
	}

	public async updateNode(node: azdata.ObjectExplorerContext): Promise<void> {
		const node1 = await azdata.objectexplorer.getNode(node.connectionProfile.id, node.isConnectionNode ? RootNode : node.nodeInfo.nodePath);
		await node1.refresh();
	}
}
