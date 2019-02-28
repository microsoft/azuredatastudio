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

import { IConnectionProfile } from 'sqlops';

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

	// maps a view id -> provider -> payload -> sessionId
	private sessionMap = new Map<string, Map<string, Map<number, string>>>();
	// map view id -> tree node id -> provider node id
	private nodeIdMap = new Map<string, Map<string, string>>();

	constructor(
		@IObjectExplorerService private oe: IObjectExplorerService,
		@IConnectionManagementService private cm: IConnectionManagementService,
		@IConnectionDialogService private cd: IConnectionDialogService,
		@ICapabilitiesService private capabilities: ICapabilitiesService
	) {
	}

	private async createSession(viewId: string, providerId: string, node: ITreeItem): TPromise<string> {
		let deferred = new Deferred<string>();
		let connProfile = new ConnectionProfile(this.capabilities, node.payload);
		connProfile.saveProfile = false;
		if (this.cm.providerRegistered(providerId)) {
			connProfile = new ConnectionProfile(this.capabilities, await this.cd.openDialogAndWait(this.cm, { connectionType: ConnectionType.default, showDashboard: false }, connProfile, undefined, false));
		}
		let sessionResp = await this.oe.createNewSession(providerId, connProfile);
		let disp = this.oe.onUpdateObjectExplorerNodes(e => {
			if (e.connection.id === connProfile.id) {
				let rootNode = this.oe.getSession(sessionResp.sessionId).rootNode;
				// this is how we know it was shimmed
				if (rootNode.nodePath) {
					if (!this.nodeIdMap.get(viewId)) {
						this.nodeIdMap.set(viewId, new Map<string, string>());
					}
					this.nodeIdMap.get(viewId).set(node.handle, rootNode.nodePath);
				}
			}
			disp.dispose();
			deferred.resolve(sessionResp.sessionId);
		});
		return TPromise.wrap(deferred.promise);
	}

	public async disconnectNode(viewId: string, node: ITreeItem): Promise<boolean> {
		return (await this.oe.closeSession(node.childProvider, this.oe.getSession(this.sessionMap.get(viewId).get(node.childProvider).get(hash(node.payload))))).success;
	}

	private async getSession(viewId: string, node: ITreeItem): Promise<string> {
		// verify the map is correct
		if (!this.sessionMap.has(viewId)) {
			this.sessionMap.set(viewId, new Map<string, Map<number, string>>());
		}
		if (!this.sessionMap.get(viewId).has(node.childProvider)) {
			this.sessionMap.get(viewId).set(node.childProvider, new Map<number, string>());
		}
		if (!this.sessionMap.get(viewId).get(node.childProvider).has(hash(node.payload))) {
			this.sessionMap.get(viewId).get(node.childProvider).set(hash(node.payload), await this.createSession(viewId, node.childProvider, node));
		}
		return this.sessionMap.get(viewId).get(node.childProvider).get(hash(node.payload));
	}

	public async getChildren(node: ITreeItem, viewId: string): Promise<ITreeItem[]> {
		try {
			let sessionId = await this.getSession(viewId, node);
			let requestHandle = node.handle;
			if (this.nodeIdMap.has(viewId) && this.nodeIdMap.get(viewId).has(node.handle)) {
				requestHandle = this.nodeIdMap.get(viewId).get(node.handle);
			}
			let treeNode = new TreeNode(undefined, undefined, undefined, requestHandle, undefined, undefined, undefined, undefined, undefined, undefined);
			let profile: IConnectionProfile = node.payload || {
				providerName: node.childProvider,
				authenticationType: undefined,
				azureTenantId: undefined,
				connectionName: undefined,
				databaseName: undefined,
				groupFullName: undefined,
				groupId: undefined,
				id: undefined,
				options: undefined,
				password: undefined,
				savePassword: undefined,
				saveProfile: undefined,
				serverName: undefined,
				userName: undefined,
			};
			treeNode.connection = new ConnectionProfile(this.capabilities, profile);
			return TPromise.wrap(this.oe.resolveTreeNodeChildren({
				success: undefined,
				sessionId,
				rootNode: undefined,
				errorMessage: undefined
			}, treeNode).then(e => e.map(n => this.mapNodeToITreeItem(viewId, n, node))));
		} catch (e) {
			return TPromise.as([]);
		}
	}

	private mapNodeToITreeItem(viewId: string, node: TreeNode, parentNode: ITreeItem): ITreeItem {
		let handle = generateUuid();
		if (!this.nodeIdMap.has(viewId)) {
			this.nodeIdMap.set(viewId, new Map<string, string>());
		}
		this.nodeIdMap.get(viewId).set(handle, node.nodePath);
		return {
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
	}

	public providerExists(providerId: string): boolean {
		return this.oe.providerRegistered(providerId);
	}
}
