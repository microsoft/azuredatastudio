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
import { IConnectionManagementService, IConnectionDialogService, ConnectionType } from 'sql/platform/connection/common/connectionManagement';
import { Deferred } from 'sql/base/common/promise';

import { IConnectionProfile } from 'sqlops';

import { TreeItemCollapsibleState } from 'vs/workbench/common/views';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { TPromise } from 'vs/base/common/winjs.base';
import { equalsIgnoreCase } from 'vs/base/common/strings';

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
		@IConnectionDialogService private cd: IConnectionDialogService,
		@ICapabilitiesService private capabilities: ICapabilitiesService
	) {
	}

	private async createSession(providerId: string, node: ITreeItem): TPromise<string> {
		let deferred = new Deferred<string>();
		let connProfile = new ConnectionProfile(this.capabilities, node.payload);
		connProfile.saveProfile = false;
		if (this.cm.providerRegistered(providerId)) {
			connProfile = new ConnectionProfile(this.capabilities, await this.cd.openDialogAndWaitButDontConnect(this.cm, { connectionType: ConnectionType.default, showDashboard: false }, connProfile));
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

	public async getChildren(node: ITreeItem, identifier: any): TPromise<ITreeItem[]> {
		if (!this.sessionMap.has(identifier)) {
			this.sessionMap.set(identifier, new Map<string, string>());
		}
		if (!this.sessionMap.get(identifier).has(node.childProvider)) {
			this.sessionMap.get(identifier).set(node.childProvider, await this.createSession(node.childProvider, node));
		}
		let sessionId = this.sessionMap.get(identifier).get(node.childProvider);
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
		}, treeNode).then(e => e.map(n => mapNodeToITreeItem(n, node.childProvider))));
	}

	public providerExists(providerId: string): boolean {
		return this.oe.providerRegistered(providerId);
	}
}

function mapNodeToITreeItem(node: TreeNode, parentproviderHandle: string): ITreeItem {
	let icon: string;
	let iconDark: string;
	if (equalsIgnoreCase(parentproviderHandle, 'mssql')) {
		if (node.iconType) {
			icon = (typeof node.iconType === 'string') ? node.iconType : node.iconType.id;
		} else {
			icon = node.nodeTypeId;
			if (node.nodeStatus) {
				icon = node.nodeTypeId + '_' + node.nodeStatus;
			}
			if (node.nodeSubType) {
				icon = node.nodeTypeId + '_' + node.nodeSubType;
			}
		}
		icon = icon.toLowerCase();
		iconDark = icon;
	} else {
		icon = node.iconType as string;
		iconDark = node.nodeSubType;
	}
	return {
		parentHandle: node.parent.id,
		handle: node.nodePath,
		collapsibleState: node.isAlwaysLeaf ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
		label: node.label,
		icon,
		// this is just because we need to have some mapping
		iconDark,
		childProvider: node.childProvider || parentproviderHandle,
		providerHandle: parentproviderHandle,
		payload: node.payload,
		contextValue: node.nodeTypeId
	};
}
