/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ITreeItem } from 'sql/workbench/common/views';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { TreeNode } from 'sql/parts/objectExplorer/common/treeNode';
import { IConnectionManagementService, ConnectionType } from 'sql/platform/connection/common/connectionManagement';
import { Deferred } from 'sql/base/common/promise';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';

import { IConnectionProfile } from 'azdata';

import { TreeItemCollapsibleState } from 'vs/workbench/common/views';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { TPromise } from 'vs/base/common/winjs.base';
import { hash } from 'vs/base/common/hash';
import { generateUuid } from 'vs/base/common/uuid';

export const SERVICE_ID = 'oeShimService';
export const IOEShimService = createDecorator<IOEShimService>(SERVICE_ID);

export interface IOEShimService {
	_serviceBrand: any;
	getChildren(node: ITreeItem, viewId: string): Promise<ITreeItem[]>;
	disconnectNode(viewId: string, node: ITreeItem): Promise<boolean>;
	providerExists(providerId: string): boolean;
}

export class OEShimService implements IOEShimService {
	_serviceBrand: any;

	private sessionMap = new Map<number, string>();
	private nodeHandleMap = new Map<number, string>();

	constructor(
		@IObjectExplorerService private oe: IObjectExplorerService,
		@IConnectionManagementService private cm: IConnectionManagementService,
		@IConnectionDialogService private cd: IConnectionDialogService,
		@ICapabilitiesService private capabilities: ICapabilitiesService
	) {
	}

	private async createSession(viewId: string, providerId: string, node: ITreeItem): Promise<string> {
		let deferred = new Deferred<string>();
		let connProfile = new ConnectionProfile(this.capabilities, node.payload);
		connProfile.saveProfile = false;
		if (this.cm.providerRegistered(providerId)) {
			let userProfile = await this.cd.openDialogAndWait(this.cm, { connectionType: ConnectionType.default, showDashboard: false }, connProfile, undefined, undefined, false);
			if (userProfile) {
				connProfile = new ConnectionProfile(this.capabilities, userProfile);
			} else {
				return Promise.reject('User canceled');
			}
		}
		let sessionResp = await this.oe.createNewSession(providerId, connProfile);
		let disp = this.oe.onUpdateObjectExplorerNodes(e => {
			if (e.connection.id === connProfile.id) {
				if (e.errorMessage) {
					deferred.reject();
					return;
				}
				let rootNode = this.oe.getSession(sessionResp.sessionId).rootNode;
				// this is how we know it was shimmed
				if (rootNode.nodePath) {
					this.nodeHandleMap.set(generateNodeMapKey(viewId, node), rootNode.nodePath);
				}
			}
			disp.dispose();
			deferred.resolve(sessionResp.sessionId);
		});
		return deferred.promise;
	}

	public async disconnectNode(viewId: string, node: ITreeItem): Promise<boolean> {
		// we assume only nodes with payloads can be connected
		// check to make sure we have an existing connection
		let key = generateSessionMapKey(viewId, node);
		let session = this.sessionMap.get(key);
		if (session) {
			let closed = (await this.oe.closeSession(node.childProvider, this.oe.getSession(session))).success;
			if (closed) {
				this.sessionMap.delete(key);
			}
			return closed;
		}
		return Promise.resolve(false);
	}

	private async getOrCreateSession(viewId: string, node: ITreeItem): Promise<string> {
		// verify the map is correct
		let key = generateSessionMapKey(viewId, node);
		if (!this.sessionMap.has(key)) {
			this.sessionMap.set(key, await this.createSession(viewId, node.childProvider, node));
		}
		return this.sessionMap.get(key);
	}

	public async getChildren(node: ITreeItem, viewId: string): Promise<ITreeItem[]> {
		if (node.payload) {
			let sessionId = await this.getOrCreateSession(viewId, node);
			let requestHandle = this.nodeHandleMap.get(generateNodeMapKey(viewId, node)) || node.handle;
			let treeNode = new TreeNode(undefined, undefined, undefined, requestHandle, undefined, undefined, undefined, undefined, undefined, undefined);
			treeNode.connection = new ConnectionProfile(this.capabilities, node.payload);
			return this.oe.resolveTreeNodeChildren({
				success: undefined,
				sessionId,
				rootNode: undefined,
				errorMessage: undefined
			}, treeNode).then(e => e.map(n => this.treeNodeToITreeItem(viewId, n, node)));
		} else {
			return Promise.resolve([]);
		}
	}

	private treeNodeToITreeItem(viewId: string, node: TreeNode, parentNode: ITreeItem): ITreeItem {
		let handle = generateUuid();
		let nodePath = node.nodePath;
		let newTreeItem = {
			parentHandle: node.parent.id,
			handle,
			collapsibleState: node.isAlwaysLeaf ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
			label: {
				label: node.label
			},
			childProvider: node.childProvider || parentNode.childProvider,
			providerHandle: parentNode.childProvider,
			payload: node.payload || parentNode.payload,
			contextValue: node.nodeTypeId
		};
		this.nodeHandleMap.set(generateNodeMapKey(viewId, newTreeItem), nodePath);
		return newTreeItem;
	}

	public providerExists(providerId: string): boolean {
		return this.oe.providerRegistered(providerId);
	}
}

function generateSessionMapKey(viewId: string, node: ITreeItem): number {
	return hash([viewId, node.childProvider, node.payload]);
}

function generateNodeMapKey(viewId: string, node: ITreeItem): number {
	return hash([viewId, node.handle]);
}
