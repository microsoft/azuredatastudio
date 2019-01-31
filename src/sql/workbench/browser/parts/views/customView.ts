/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDataSource, ITree } from 'vs/base/parts/tree/browser/tree';
import { ViewContainer, TreeItemCollapsibleState } from 'vs/workbench/common/views';
import { IProgressService2 } from 'vs/workbench/services/progress/common/progress';
import { TPromise } from 'vs/base/common/winjs.base';
import { IOEShimService } from 'sql/parts/objectExplorer/common/objectExplorerViewTreeShim';
import { ITreeItem } from 'sql/workbench/common/views';

class TreeDataSource implements IDataSource {

	private sessionMap = new Map<string, string>();

	constructor(
		private container: ViewContainer,
		@IProgressService2 private progressService: IProgressService2,
		@IOEShimService private objectExplorerService: IOEShimService
	) {
	}

	getId(tree: ITree, node: ITreeItem): string {
		return node.handle;
	}

	hasChildren(tree: ITree, node: ITreeItem): boolean {
		return this.objectExplorerService.providerExists(node.providerHandle) && node.collapsibleState !== TreeItemCollapsibleState.None;
	}

	getChildren(tree: ITree, node: ITreeItem): TPromise<any[]> {
		if (this.objectExplorerService.providerExists(node.providerHandle)) {
			return TPromise.wrap(this.progressService.withProgress({ location: this.container }, async () => {
				if (!this.sessionMap.has(node.providerHandle)) {
					let resp = await this.objectExplorerService.createSession(node.providerHandle, node);
					this.sessionMap.set(node.providerHandle, resp);
				}
				let sessId = this.sessionMap.get(node.providerHandle);
				return this.objectExplorerService.getChildren(sessId, node.handle);
			}));
		}
		return TPromise.as([]);
	}

	shouldAutoexpand(tree: ITree, node: ITreeItem): boolean {
		return node.collapsibleState === TreeItemCollapsibleState.Expanded;
	}

	getParent(tree: ITree, node: any): TPromise<any> {
		return TPromise.as(null);
	}
}
