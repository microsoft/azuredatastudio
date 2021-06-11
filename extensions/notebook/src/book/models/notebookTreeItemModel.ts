/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IPinnedNotebook } from '../../common/utils';
import { NotebookTreeviewItem, NotebookTreeviewItemType } from '../bookTreeItem';
import * as path from 'path';

export abstract class NotebookTreeModel {
	public notebookItem: NotebookTreeviewItem;
	private _bookItems: NotebookTreeviewItem[];
	private _errorMessage: string;

	/**
		 * The root tree item for this model
		 */
	private _rootNode: NotebookTreeviewItem;

	constructor(
		public readonly itemPath: string,
		public readonly openAsUntitled: boolean,
		public readonly isNotebook: boolean,
		public _extensionContext: vscode.ExtensionContext,
		//private _onDidChangeTreeData: vscode.EventEmitter<NotebookTreeviewItem | undefined>,
		public readonly pinnedNotebookDetails?: IPinnedNotebook) { }

	public get bookItems(): NotebookTreeviewItem[] {
		return this._bookItems;
	}
	public set bookItems(bookItems: NotebookTreeviewItem[]) {
		bookItems.forEach(b => {
			// only add unique notebooks
			if (!this._bookItems.includes(b)) {
				this._bookItems.push(b);
			}
		});
	}
	public get rootNode(): NotebookTreeviewItem {
		return this._rootNode;
	}

	public set rootNode(node: NotebookTreeviewItem) {
		this._rootNode = node;
	}

	public get errorMessage(): string {
		return this._errorMessage;
	}

	public set errorMessage(errMsg: string) {
		this._errorMessage = errMsg;
	}

	public readNotebook(): Promise<NotebookTreeviewItem> {
		let pathDetails = path.parse(this.itemPath);
		let notebookItem = new NotebookTreeviewItem({
			title: this.pinnedNotebookDetails?.title ?? pathDetails.name,
			contentPath: this.itemPath,
			root: this.pinnedNotebookDetails?.bookPath ?? pathDetails.dir,
			tableOfContents: { sections: undefined },
			page: { sections: undefined },
			type: NotebookTreeviewItemType.Notebook,
			treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Expanded,
			isUntitled: this.openAsUntitled,
		},
			{
				light: this._extensionContext.asAbsolutePath('resources/light/notebook.svg'),
				dark: this._extensionContext.asAbsolutePath('resources/dark/notebook_inverse.svg')
			}
		);
		this.notebookItem = notebookItem;
		this.rootNode = notebookItem;
		return Promise.resolve(notebookItem);
	}

	public abstract readBook(): Promise<NotebookTreeviewItem[]>;
}

export class NotebookModel extends NotebookTreeModel {
	constructor(
		public readonly notebookPath: string,
		public readonly openAsUntitled: boolean,
		_extensionContext: vscode.ExtensionContext,
		public readonly pinnedNotebookDetails?: IPinnedNotebook) {
		super(notebookPath, openAsUntitled, true, _extensionContext, pinnedNotebookDetails);
	}

	public readBook(): Promise<NotebookTreeviewItem[]> {
		throw new Error('Method not implemented.');
	}

}
