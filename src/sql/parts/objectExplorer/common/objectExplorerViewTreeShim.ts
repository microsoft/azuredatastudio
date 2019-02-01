/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ITreeItem } from 'sql/workbench/common/views';
import { IObjectExplorerService } from 'sql/parts/objectExplorer/common/objectExplorerService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { TreeNode } from 'sql/parts/objectExplorer/common/treeNode';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';

import { IConnectionProfile } from 'sqlops';

import { TreeItemCollapsibleState } from 'vs/workbench/common/views';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { TPromise } from 'vs/base/common/winjs.base';

export const SERVICE_ID = 'oeShimService';
export const IOEShimService = createDecorator<IOEShimService>(SERVICE_ID);

export interface IOEShimService {
	_serviceBrand: any;
	getChildren(node: ITreeItem, identifier: any): TPromise<ITreeItem[]>;
	providerExists(providerId: string): boolean;
}

export class OEShimService implements IOEShimService {
	_serviceBrand: any;

	// maps a datasource to a provider handle to a session
	private sessionMap = new Map<any, Map<string, string>>();

	constructor(
		@IObjectExplorerService private oe: IObjectExplorerService,
		@IConnectionManagementService private cm: IConnectionManagementService,
		@ICapabilitiesService private capabilities: ICapabilitiesService
	) {
	}

	private createSession(providerId: string, node: ITreeItem): TPromise<string> {
		let connProfile = new ConnectionProfile(this.capabilities, node.payload);
		return TPromise.wrap(this.oe.createNewSession(providerId, connProfile).then(e => e.sessionId));
	}

	private async connectAndCreateSession(providerId: string, node: ITreeItem): TPromise<string> {
		// check if we need to connect first
		// if (this.cm.providerRegistered(providerId)) {
		// 	let connProfile = new ConnectionProfile(this.capabilities, node.payload);
		// 	await this.cm.connectIfNotConnected(connProfile);
		// }
		return this.createSession(providerId, node);
	}

	public async getChildren(node: ITreeItem, identifier: any): TPromise<ITreeItem[]> {
		if (!this.sessionMap.has(identifier)) {
			this.sessionMap.set(identifier, new Map<string, string>());
		}
		if (!this.sessionMap.get(identifier).has(node.providerHandle)) {
			this.sessionMap.get(identifier).set(node.providerHandle, await this.connectAndCreateSession(node.providerHandle, node));
		}
		let sessionId = this.sessionMap.get(identifier).get(node.providerHandle);
		let treeNode = new TreeNode(undefined, undefined, undefined, node.handle, undefined, undefined, undefined, undefined, undefined, undefined);
		let profile: IConnectionProfile = node.payload || {
			providerName: node.providerHandle,
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
		}, treeNode).then(e => {
			return e.map(n => {
				return <ITreeItem>{
					parentHandle: n.parent.id,
					handle: n.nodePath,
					collapsibleState: n.isAlwaysLeaf ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
					label: n.label,
					icon: n.iconType,
					providerHandle: n.providerHandle || n.getConnectionProfile().providerName,
					payload: n.payload,
					contextValue: n.nodeTypeId
				};
			});
		}));
	}

	public providerExists(providerId: string): boolean {
		return this.oe.providerRegistered(providerId);
	}
}
