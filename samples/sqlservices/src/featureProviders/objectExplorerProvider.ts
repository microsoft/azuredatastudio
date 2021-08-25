/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ProviderId } from './connectionProvider';

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
					nodePath: 'root',
					nodeType: 'server',
					label: 'abc',
					isLeaf: false
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
	expandNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
		setTimeout(() => {
			this.onExpandCompletedEmitter.fire({
				sessionId: nodeInfo.sessionId,
				nodePath: nodeInfo.nodePath,
				nodes: [
					{
						nodePath: 'root/1',
						nodeType: '',
						icon: {
							light: this.context.asAbsolutePath('images/group.svg'),
							dark: this.context.asAbsolutePath('images/group_inverse.svg')
						},
						label: 'obj 1',
						isLeaf: false
					}, {
						nodePath: 'root/2',
						nodeType: '',
						icon: azdata.SqlThemeIcon.Column,
						label: 'obj 2',
						isLeaf: false
					}
				]
			});
		}, 500);
		return Promise.resolve(true);
	}
	refreshNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
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
}
