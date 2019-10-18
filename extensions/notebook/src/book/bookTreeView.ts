/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { IPrompter, QuestionTypes, IQuestion } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';
import { BookTreeItem } from './bookTreeItem';
import * as nls from 'vscode-nls';
import { isEditorTitleFree } from '../common/utils';
import { BookModel } from './bookModel';
import { Deferred } from '../common/promise';

const localize = nls.loadMessageBundle();

export class BookTreeViewProvider implements vscode.TreeDataProvider<BookTreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<BookTreeItem | undefined> = new vscode.EventEmitter<BookTreeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<BookTreeItem | undefined> = this._onDidChangeTreeData.event;
	private _throttleTimer: any;
	private _resource: string;
	private _extensionContext: vscode.ExtensionContext;
	private prompter: IPrompter;
	private _initializeDeferred: Deferred<void> = new Deferred<void>();

	// For testing
	private _errorMessage: string;
	private _onReadAllTOCFiles: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	private _openAsUntitled: boolean;
	public viewId: string;
	public books: BookModel[];
	public currentBook: BookModel;

	constructor(workspaceFolders: vscode.WorkspaceFolder[], extensionContext: vscode.ExtensionContext, openAsUntitled: boolean, view: string) {
		this._openAsUntitled = openAsUntitled;
		this._extensionContext = extensionContext;
		this.books = [];
		this.initialize(workspaceFolders.map(a => a.uri.fsPath));
		this.viewId = view;
		this.prompter = new CodeAdapter();

	}

	private async initialize(bookPaths: string[]): Promise<void> {
		await vscode.commands.executeCommand('setContext', 'untitledBooks', this._openAsUntitled);
		await Promise.all(bookPaths.map(async (bookPath) => {
			let book: BookModel = new BookModel(bookPath, this._openAsUntitled, this._extensionContext);
			await book.initializeContents();
			this.books.push(book);
			if (!this.currentBook) {
				this.currentBook = book;
			}
		}));
		this._initializeDeferred.resolve();
	}

	public get onReadAllTOCFiles(): vscode.Event<void> {
		return this._onReadAllTOCFiles.event;
	}

	public get initialized(): Promise<void> {
		return this._initializeDeferred.promise;
	}

	async openBook(bookPath: string, urlToOpen?: string): Promise<void> {
		try {
			let books: BookModel[] = this.books.filter(book => book.bookPath === bookPath) || [];
			// Check if the book is already open in viewlet.
			if (books.length > 0 && books[0].bookItems) {
				this.currentBook = books[0];
				this.showPreviewFile(urlToOpen);
			}
			else {
				await this.initialize([bookPath]);
				let bookViewer = vscode.window.createTreeView(this.viewId, { showCollapseAll: true, treeDataProvider: this });
				this.currentBook = this.books.filter(book => book.bookPath === bookPath)[0];
				bookViewer.reveal(this.currentBook.bookItems[0], { expand: vscode.TreeItemCollapsibleState.Expanded, focus: true, select: true });
				this.showPreviewFile(urlToOpen);
			}
		} catch (e) {
			vscode.window.showErrorMessage(localize('openBookError', "Open book {0} failed: {1}",
				bookPath,
				e instanceof Error ? e.message : e));
		}
	}

	async showPreviewFile(urlToOpen?: string): Promise<void> {
		if (this.currentBook) {
			const bookRoot = this.currentBook.bookItems[0];
			const sectionToOpen = bookRoot.findChildSection(urlToOpen);
			const urlPath = sectionToOpen ? sectionToOpen.url : bookRoot.tableOfContents.sections[0].url;
			const sectionToOpenMarkdown: string = path.join(this.currentBook.bookPath, 'content', urlPath.concat('.md'));
			const sectionToOpenNotebook: string = path.join(this.currentBook.bookPath, 'content', urlPath.concat('.ipynb'));
			if (await fs.pathExists(sectionToOpenMarkdown)) {
				this.openMarkdown(sectionToOpenMarkdown);
			}
			else if (await fs.pathExists(sectionToOpenNotebook)) {
				this.openNotebook(sectionToOpenNotebook);
			}
		}
	}

	async openNotebook(resource: string): Promise<void> {
		try {
			if (this._openAsUntitled) {
				this.openNotebookAsUntitled(resource);
			}
			else {
				let doc = await vscode.workspace.openTextDocument(resource);
				vscode.window.showTextDocument(doc);
			}
		} catch (e) {
			vscode.window.showErrorMessage(localize('openNotebookError', "Open notebook {0} failed: {1}",
				resource,
				e instanceof Error ? e.message : e));
		}
	}

	openMarkdown(resource: string): void {
		this.runThrottledAction(resource, () => {
			try {
				vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(resource));
			} catch (e) {
				vscode.window.showErrorMessage(localize('openMarkdownError', "Open markdown {0} failed: {1}",
					resource,
					e instanceof Error ? e.message : e));
			}
		});
	}

	openNotebookAsUntitled(resource: string): void {
		try {
			let untitledFileName: vscode.Uri = this.getUntitledNotebookUri(resource);
			vscode.workspace.openTextDocument(resource).then((document) => {
				let initialContent = document.getText();
				azdata.nb.showNotebookDocument(untitledFileName, {
					connectionProfile: null,
					initialContent: initialContent,
					initialDirtyState: false
				});
			});
		} catch (e) {
			vscode.window.showErrorMessage(localize('openUntitledNotebookError', "Open untitled notebook {0} as untitled failed: {1}",
				resource,
				e instanceof Error ? e.message : e));
		}
	}

	async saveJupyterBooks(): Promise<void> {
		if (this.currentBook.bookPath) {
			const allFilesFilter = localize('allFiles', "All Files");
			let filter: any = {};
			filter[allFilesFilter] = '*';
			let uris = await vscode.window.showOpenDialog({
				filters: filter,
				canSelectFiles: false,
				canSelectMany: false,
				canSelectFolders: true,
				openLabel: localize('labelPickFolder', "Pick Folder")
			});
			if (uris && uris.length > 0) {
				let pickedFolder = uris[0];
				let destinationUri: vscode.Uri = vscode.Uri.file(path.join(pickedFolder.fsPath, path.basename(this.currentBook.bookPath)));
				if (destinationUri) {
					if (await fs.pathExists(destinationUri.fsPath)) {
						let doReplace = await this.confirmReplace();
						if (!doReplace) {
							return undefined;
						}
						else {
							//remove folder if exists
							await fs.remove(destinationUri.fsPath);
						}
					}
					//make directory for each contribution book.
					await fs.mkdir(destinationUri.fsPath);
					await fs.copy(this.currentBook.bookPath, destinationUri.fsPath);

					//remove book from the untitled books and open it from Saved books
					let untitledBookIndex: number = this.books.indexOf(this.currentBook);
					if (untitledBookIndex > -1) {
						this.books.splice(untitledBookIndex, 1);
						this.currentBook = undefined;
						this._onDidChangeTreeData.fire();
						vscode.commands.executeCommand('bookTreeView.openBook', destinationUri.fsPath, false, undefined);
					}
				}
			}
		}
	}

	public async searchJupyterBooks(): Promise<void> {
		if (this.currentBook && this.currentBook.bookPath) {
			let filesToIncludeFiltered = path.join(this.currentBook.bookPath, '**', '*.md') + ',' + path.join(this.currentBook.bookPath, '**', '*.ipynb');
			vscode.commands.executeCommand('workbench.action.findInFiles', { filesToInclude: filesToIncludeFiltered, query: '' });
		}
	}

	private runThrottledAction(resource: string, action: () => void) {
		const isResourceChange = resource !== this._resource;
		if (isResourceChange) {
			clearTimeout(this._throttleTimer);
			this._throttleTimer = undefined;
		}

		this._resource = resource;

		// Schedule update if none is pending
		if (!this._throttleTimer) {
			if (isResourceChange) {
				action();
			} else {
				this._throttleTimer = setTimeout(() => action(), 300);
			}
		}
	}

	openExternalLink(resource: string): void {
		try {
			vscode.env.openExternal(vscode.Uri.parse(resource));
		} catch (e) {
			vscode.window.showErrorMessage(localize('openExternalLinkError', "Open link {0} failed: {1}",
				resource,
				e instanceof Error ? e.message : e));
		}
	}

	getTreeItem(element: BookTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: BookTreeItem): Thenable<BookTreeItem[]> {
		if (element) {
			if (element.sections) {
				return Promise.resolve(this.currentBook.getSections(element.tableOfContents, element.sections, element.root).then(sections => { return sections; }));
			} else {
				return Promise.resolve([]);
			}
		} else {
			let booksitems: BookTreeItem[] = [];
			this.books.map(book => {
				booksitems = booksitems.concat(book.bookItems);
			});
			return Promise.resolve(booksitems);
		}
	}


	getParent(element?: BookTreeItem): vscode.ProviderResult<BookTreeItem> {
		if (element) {
			let parentPath;
			if (element.root.endsWith('.md')) {
				parentPath = path.join(this.currentBook.bookPath, 'content', 'readme.md');
				if (parentPath === element.root) {
					return undefined;
				}
			}
			else if (element.root.endsWith('.ipynb')) {
				let baseName: string = path.basename(element.root);
				parentPath = element.root.replace(baseName, 'readme.md');
			}
			else {
				return undefined;
			}
			return this.currentBook.getAllBooks().get(parentPath);
		} else {
			return undefined;
		}
	}

	public get errorMessage() {
		return this._errorMessage;
	}

	getUntitledNotebookUri(resource: string): vscode.Uri {
		let untitledFileName: vscode.Uri;
		if (process.platform === 'win32') {
			let title = path.join(path.dirname(resource), this.findNextUntitledFileName(resource));
			untitledFileName = vscode.Uri.parse(`untitled:${title}`);
		}
		else {
			untitledFileName = vscode.Uri.parse(resource).with({ scheme: 'untitled' });
		}
		if (!this.currentBook.getAllBooks().get(untitledFileName.fsPath) && !this.currentBook.getAllBooks().get(path.basename(untitledFileName.fsPath))) {
			let notebook = this.currentBook.getAllBooks().get(resource);
			this.currentBook.getAllBooks().set(path.basename(untitledFileName.fsPath), notebook);
		}
		return untitledFileName;
	}

	findNextUntitledFileName(filePath: string): string {
		const baseName = path.basename(filePath);
		let idx = 0;
		let title = `${baseName}`;
		do {
			const suffix = idx === 0 ? '' : `-${idx}`;
			title = `${baseName}${suffix}`;
			idx++;
		} while (!isEditorTitleFree(title));

		return title;
	}

	//Confirmation message dialog
	private async confirmReplace(): Promise<boolean> {
		return await this.prompter.promptSingle<boolean>(<IQuestion>{
			type: QuestionTypes.confirm,
			message: localize('confirmReplace', "Folder already exists. Are you sure you want to delete and replace this folder?"),
			default: false
		});
	}


}
