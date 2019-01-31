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

export const SERVICE_ID = 'oeShimService';
export const IOEShimService = createDecorator<IOEShimService>(SERVICE_ID);

export interface IOEShimService {
	createSession(providerId: string, node: ITreeItem): TPromise<string>;
	getChildren(sessionId: string, nodePath: string): TPromise<ITreeItem[]>;
	providerExists(providerId: string): boolean;
}

export class OEShimService implements IOEShimService {

	constructor(
		@IObjectExplorerService private oe: IObjectExplorerService,
		@ICapabilitiesService private capabilities: ICapabilitiesService
	) {
	}

	public createSession(providerId: string, node: ITreeItem): TPromise<string> {
		let connProfile = new ConnectionProfile(this.capabilities, node.payload);
		return TPromise.wrap(this.oe.createNewSession(providerId, connProfile).then(e => e.sessionId));
	}

	public getChildren(sessionId: string, nodePath: string): TPromise<ITreeItem[]> {
		let treeNode = new TreeNode(undefined, undefined, undefined, nodePath, undefined, undefined, undefined, undefined, undefined, undefined);
		return TPromise.wrap(this.oe.resolveTreeNodeChildren(this.oe.getSession(sessionId), treeNode).then(e => {
			return e.map(n => {
				return <ITreeItem>{
					parentHandle: n.parent.id,
					handle: n.id,
					collapsibleState: n.isExpanded() ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed
				};
			});
		}));
	}

	public providerExists(providerId: string): boolean {
		return true;
	}
}
