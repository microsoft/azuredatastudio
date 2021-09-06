/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { AppContext } from '../../appContext';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from '../treeNode';
import { AzureResourceAccountNotSignedInTreeNode } from './accountNotSignedInTreeNode';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceErrorMessageUtil, equals } from '../utils';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { FlatAccountTreeNode } from './flatAccountTreeNode';
import { Logger } from '../../utils/Logger';
import { AzureAccount } from 'azurecore';

export class ConnectionDialogTreeProvider implements vscode.TreeDataProvider<TreeNode>, IAzureResourceTreeChangeHandler {
	public isSystemInitialized: boolean = false;

	private accounts: AzureAccount[];
	private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode>();
	private loadingAccountsPromise: Promise<void>;

	public constructor(private readonly appContext: AppContext) {
		azdata.accounts.onDidChangeAccounts(async (e: azdata.DidChangeAccountsParams) => {
			// This event sends it per provider, we need to make sure we get all the azure related accounts
			let accounts = await azdata.accounts.getAllAccounts();
			accounts = accounts.filter(a => a.key.providerId.startsWith('azure'));
			// the onDidChangeAccounts event will trigger in many cases where the accounts didn't actually change
			// the notifyNodeChanged event triggers a refresh which triggers a getChildren which can trigger this callback
			// this below check short-circuits the infinite callback loop
			this.setSystemInitialized();
			if (!equals(accounts, this.accounts)) {
				this.accounts = accounts;
				this.notifyNodeChanged(undefined);
			}
		});
	}

	public async getChildren(element?: TreeNode): Promise<TreeNode[]> {
		if (element) {
			return element.getChildren(true);
		}

		if (!this.isSystemInitialized) {
			if (!this.loadingAccountsPromise) {
				this.loadingAccountsPromise = this.loadAccounts();
			}
			return [AzureResourceMessageTreeNode.create(localize('azure.resource.tree.treeProvider.loadingLabel', "Loading ..."), undefined)];
		}

		if (this.accounts && this.accounts.length > 0) {
			const accountNodes: FlatAccountTreeNode[] = [];
			const errorMessages: string[] = [];
			// We are doing sequential account loading to avoid the Azure request throttling
			for (const account of this.accounts) {
				try {
					const accountNode = new FlatAccountTreeNode(account, this.appContext, this);
					await accountNode.updateLabel();
					accountNodes.push(accountNode);
				}
				catch (error) {
					errorMessages.push(AzureResourceErrorMessageUtil.getErrorMessage(error));
				}
			}
			if (errorMessages.length > 0) {
				const showAccountsAction = localize('azure.resource.tree.treeProvider.openAccountsDialog', "Show Azure accounts");
				void vscode.window.showErrorMessage(localize('azure.resource.tree.treeProvider.accountLoadError', "Failed to load some Azure accounts. {0}", errorMessages.join(',')), showAccountsAction).then(result => {
					if (result === showAccountsAction) {
						void vscode.commands.executeCommand('azure.resource.signin');
					}
				});
			}

			return accountNodes;
		} else {
			return [new AzureResourceAccountNotSignedInTreeNode()];
		}
	}

	private async loadAccounts(): Promise<void> {
		try {
			this.accounts = await azdata.accounts.getAllAccounts();
			// System has been initialized
			this.setSystemInitialized();
			this._onDidChangeTreeData.fire(undefined);
		} catch (err) {
			// Skip for now, we can assume that the accounts changed event will eventually notify instead
			Logger.error('loadAccounts failed with the following error: {0}', err.message ?? err);
			this.isSystemInitialized = false;
		}
	}

	private setSystemInitialized(): void {
		this.isSystemInitialized = true;
		this.loadingAccountsPromise = undefined;
	}

	public get onDidChangeTreeData(): vscode.Event<TreeNode> {
		return this._onDidChangeTreeData.event;
	}

	public notifyNodeChanged(node: TreeNode): void {
		this._onDidChangeTreeData.fire(node);
	}

	public async refresh(node: TreeNode, isClearingCache: boolean): Promise<void> {
		if (isClearingCache) {
			if ((node instanceof AzureResourceContainerTreeNodeBase)) {
				node.clearCache();
			}
		}

		this._onDidChangeTreeData.fire(node);
	}

	public getTreeItem(element: TreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element.getTreeItem();
	}
}
