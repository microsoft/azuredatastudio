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

import { TreeItemCollapsibleState } from 'vs/workbench/common/views';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { TPromise } from 'vs/base/common/winjs.base';
import { IConnectionProfile } from 'sqlops';

export const SERVICE_ID = 'oeShimService';
export const IOEShimService = createDecorator<IOEShimService>(SERVICE_ID);

export interface IOEShimService {
	_serviceBrand: any;
	createSession(providerId: string, node: ITreeItem): TPromise<string>;
	getChildren(sessionId: string, nodePath: ITreeItem): TPromise<ITreeItem[]>;
	providerExists(providerId: string): boolean;
}

export class OEShimService implements IOEShimService {
	_serviceBrand: any;

	constructor(
		@IObjectExplorerService private oe: IObjectExplorerService,
		@ICapabilitiesService private capabilities: ICapabilitiesService
	) {
	}

	public createSession(providerId: string, node: ITreeItem): TPromise<string> {
		let connProfile = new ConnectionProfile(this.capabilities, node.payload);
		return TPromise.wrap(this.oe.createNewSession(providerId, connProfile).then(e => e.sessionId));
	}

	public getChildren(sessionId: string, node: ITreeItem): TPromise<ITreeItem[]> {
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
					payload: n.payload
				};
			});
		}));
	}

	public providerExists(providerId: string): boolean {
		return this.oe.providerRegistered(providerId);
	}
}
