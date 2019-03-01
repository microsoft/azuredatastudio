/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeDataProvider, EventEmitter, Event, TreeItem } from 'vscode';
import { setInterval, clearInterval } from 'timers';
import { AppContext } from '../../appContext';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
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
			return element.getChildren(true);
		}

		if (!this.isSystemInitialized && !this._loadingTimer) {
			this._loadingTimer = setInterval(async () => {
				try {
					// Call to collect all locally saved CMS servers
					// to determine whether the system has been initialized.


					// System has been initialized (only if there's an ownerUri or locally saved CMS Servers)
					// this.isSystemInitialized = true;

					if (this._loadingTimer) {
						clearInterval(this._loadingTimer);
					}

					this._onDidChangeTreeData.fire(undefined);
				} catch (error) {
					// System not initialized yet
					this.isSystemInitialized = false;
				}
			}, CmsResourceTreeProvider.loadingTimerInterval);
			return [CmsResourceMessageTreeNode.create(CmsResourceTreeProvider.loadingLabel, undefined)];
		}
		try {
			let registeredCmsServers = this.appContext.apiWrapper.registeredCmsServers;
			if (registeredCmsServers && registeredCmsServers.length > 0) {
				this.isSystemInitialized = true;
				return registeredCmsServers.map((server) => new CmsResourceTreeNode(server.name, server.description,
					 server.registeredServers, server.serverGroups, this._appContext, this, null));
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

	public async refresh(node: TreeNode, isClearingCache: boolean): Promise<void> {
		this._onDidChangeTreeData.fire(node);
	}

	public getTreeItem(element: TreeNode): TreeItem | Thenable<TreeItem> {
		return element.getTreeItem();
	}

	public isSystemInitialized: boolean = false;

	private _loadingTimer: NodeJS.Timer = undefined;
	private _onDidChangeTreeData = new EventEmitter<TreeNode>();

	private static readonly loadingLabel = localize('cms.resource.tree.treeProvider.loadingLabel', 'Loading ...');
	private static readonly loadingTimerInterval = 0;
}
