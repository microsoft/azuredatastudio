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
import { equalsIgnoreCase } from 'vs/base/common/strings';
import { hash } from 'vs/base/common/hash';
import { generateUuid } from 'vs/base/common/uuid';
import { URI } from 'vs/base/common/uri';

export const SERVICE_ID = 'oeShimService';
export const IOEShimService = createDecorator<IOEShimService>(SERVICE_ID);

export interface IOEShimService {
	_serviceBrand: any;
	getChildren(node: ITreeItem, identifier: any): Promise<ITreeItem[]>;
	providerExists(providerId: string): boolean;
}

export class OEShimService implements IOEShimService {
	_serviceBrand: any;

	// maps a datasource to a provider handle to a session
	private sessionMap = new Map<any, Map<number, string>>();
	private nodeIdMap = new Map<string, string>();

	constructor(
		@IObjectExplorerService private oe: IObjectExplorerService,
		@IConnectionManagementService private cm: IConnectionManagementService,
		@IConnectionDialogService private cd: IConnectionDialogService,
		@ICapabilitiesService private capabilities: ICapabilitiesService
	) {
	}

	private async createSession(providerId: string, node: ITreeItem): TPromise<string> {
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
					node.handle = this.oe.getSession(sessionResp.sessionId).rootNode.nodePath;
				}
			}
			disp.dispose();
			deferred.resolve(sessionResp.sessionId);
		});
		return TPromise.wrap(deferred.promise);
	}

	public async getChildren(node: ITreeItem, identifier: any): Promise<ITreeItem[]> {
		try {
			if (!this.sessionMap.has(identifier)) {
				this.sessionMap.set(identifier, new Map<number, string>());
			}
			if (!this.sessionMap.get(identifier).has(hash(node.payload || node.childProvider))) {
				this.sessionMap.get(identifier).set(hash(node.payload || node.childProvider), await this.createSession(node.childProvider, node));
			}
			if (this.nodeIdMap.has(node.handle)) {
				node.handle = this.nodeIdMap.get(node.handle);
			}
			let sessionId = this.sessionMap.get(identifier).get(hash(node.payload || node.childProvider));
			let treeNode = new TreeNode(undefined, undefined, undefined, node.handle, undefined, undefined, undefined, undefined, undefined, undefined);
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
			}, treeNode).then(e => e.map(n => this.mapNodeToITreeItem(n, node))));
		} catch (e) {
			return TPromise.as([]);
		}
	}

	private mapNodeToITreeItem(node: TreeNode, parentNode: ITreeItem): ITreeItem {
		let handle = generateUuid();
		this.nodeIdMap.set(handle, node.nodePath);
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
