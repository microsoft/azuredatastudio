/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, EventEmitter, Event, TreeItem } from 'vscode';
import { AppContext } from '../../appContext';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from '../treeNode';
import { CmsResourceEmptyTreeNode } from './cmsResourceEmptyTreeNode';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';
import { CmsResourceMessageTreeNode } from '../messageTreeNode';
import { CmsResourceTreeNode } from './cmsResourceTreeNode';

export class CmsResourceTreeProvider implements TreeDataProvider<TreeNode>, ICmsResourceTreeChangeHandler {

	private _appContext: AppContext;

	public constructor(
		public readonly appContext: AppContext
	) {
		this._appContext = appContext;
	}

	public async getChildren(element?: TreeNode): Promise<TreeNode[]> {
		if (element) {
			let children = await element.getChildren(true);
			return children;
		}

		if (!this.isSystemInitialized) {
			// Kick off loading the saved servers but then immediately return the loading node so
			// the user isn't left with an empty tree while we load the nodes
			this.loadSavedServers().catch(err => this._appContext.apiWrapper.showErrorMessage(localize('cms.resource.tree.treeProvider.loadError', "Unexpected error occured while loading saved servers {0}", err)));
			return [CmsResourceMessageTreeNode.create(CmsResourceTreeProvider.loadingLabel, undefined)];
		}
		try {
			let registeredCmsServers = this.appContext.cmsUtils.registeredCmsServers;
			if (registeredCmsServers && registeredCmsServers.length > 0) {
				this.isSystemInitialized = true;
				return registeredCmsServers.map((server) => {
					return new CmsResourceTreeNode(
						server.name,
						server.description,
						server.ownerUri,
						server.connection,
						this._appContext, this, null);
				}).sort((a, b) => a.name.localeCompare(b.name));
			} else {
				return [new CmsResourceEmptyTreeNode()];
			}
		} catch (error) {
			return [new CmsResourceEmptyTreeNode()];
		}
	}

	public get onDidChangeTreeData(): Event<TreeNode> {
		return this._onDidChangeTreeData.event;
	}

	public notifyNodeChanged(node: TreeNode): void {
		this._onDidChangeTreeData.fire(node);
	}

	public async refresh(node: TreeNode): Promise<void> {
		this._onDidChangeTreeData.fire(node);
	}

	public getTreeItem(element: TreeNode): TreeItem | Thenable<TreeItem> {
		return element.getTreeItem();
	}

	private async loadSavedServers(): Promise<void> {
		try {
			// Optimistically set to true so we don't double-load if something refreshes the tree while
			// we're loading.
			this.isSystemInitialized = true;
			// Call to collect all locally saved CMS servers
			// to determine whether the system has been initialized.
			const cachedServers = this._appContext.cmsUtils.getSavedServers();
			if (cachedServers && cachedServers.length > 0) {
				const servers: CmsResourceTreeNode[] = [];
				for (let i = 0; i < cachedServers.length; ++i) {
					const server = cachedServers[i];
					servers.push(new CmsResourceTreeNode(
						server.name,
						server.description,
						server.ownerUri,
						server.connection,
						this._appContext, this, null));
					await this.appContext.cmsUtils.cacheRegisteredCmsServer(server.name, server.description,
						server.ownerUri, server.connection);
				}
			}
			this._onDidChangeTreeData.fire(undefined);
		} catch (error) {
			// Reset so we can try loading again
			this.isSystemInitialized = false;
			throw error; //re-throw and let caller handler error
		}
	}

	public isSystemInitialized: boolean = false;
	private _onDidChangeTreeData = new EventEmitter<TreeNode>();

	private static readonly loadingLabel = localize('cms.resource.tree.treeProvider.loadingLabel', "Loading ...");
}
