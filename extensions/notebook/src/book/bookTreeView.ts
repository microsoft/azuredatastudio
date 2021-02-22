/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as constants from '../common/constants';
import { IPrompter, IQuestion, QuestionTypes } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';
import { BookTreeItem, BookTreeItemType } from './bookTreeItem';
import { BookModel } from './bookModel';
import { Deferred } from '../common/promise';
import { IBookTrustManager, BookTrustManager } from './bookTrustManager';
import * as loc from '../common/localizedConstants';
import * as glob from 'fast-glob';
import { debounce, getPinnedNotebooks } from '../common/utils';
import { IBookPinManager, BookPinManager } from './bookPinManager';
import { BookTocManager, IBookTocManager, quickPickResults } from './bookTocManager';
import { getContentPath } from './bookVersionHandler';
import { TelemetryReporter, BookTelemetryView, NbTelemetryActions } from '../telemetry';

interface BookSearchResults {
	notebookPaths: string[];
	bookPaths: string[];
}

export class BookTreeViewProvider implements vscode.TreeDataProvider<BookTreeItem>, azdata.nb.NavigationProvider {
	private _onDidChangeTreeData: vscode.EventEmitter<BookTreeItem | undefined> = new vscode.EventEmitter<BookTreeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<BookTreeItem | undefined> = this._onDidChangeTreeData.event;
	private _extensionContext: vscode.ExtensionContext;
	private prompter: IPrompter;
	private _initializeDeferred: Deferred<void> = new Deferred<void>();
	private _openAsUntitled: boolean;
	private _bookTrustManager: IBookTrustManager;
	public bookPinManager: IBookPinManager;
	public bookTocManager: IBookTocManager;

	private _bookViewer: vscode.TreeView<BookTreeItem>;
	public viewId: string;
	public books: BookModel[];
	public currentBook: BookModel;

	constructor(workspaceFolders: vscode.WorkspaceFolder[], extensionContext: vscode.ExtensionContext, openAsUntitled: boolean, view: string, public providerId: string) {
		this._openAsUntitled = openAsUntitled;
		this._extensionContext = extensionContext;
		this.books = [];
		this.bookPinManager = new BookPinManager();
		this.viewId = view;
		this.initialize(workspaceFolders).catch(e => console.error(e));
		this.prompter = new CodeAdapter();
		this._bookTrustManager = new BookTrustManager(this.books);

		this._extensionContext.subscriptions.push(azdata.nb.registerNavigationProvider(this));
	}

	private async initialize(workspaceFolders: vscode.WorkspaceFolder[]): Promise<void> {
		if (this.viewId === constants.PINNED_BOOKS_VIEWID) {
			await Promise.all(getPinnedNotebooks().map(async (notebook) => {
				try {
					await this.createAndAddBookModel(notebook.notebookPath, true, notebook.bookPath);
				} catch {
					// no-op, not all workspace folders are going to be valid books
				}
			}));
		} else {
			await Promise.all(workspaceFolders.map(async (workspaceFolder) => {
				try {
					await this.loadNotebooksInFolder(workspaceFolder.uri.fsPath);
				} catch {
					// no-op, not all workspace folders are going to be valid books
				}
			}));
		}

		this._initializeDeferred.resolve();
	}

	public get initialized(): Promise<void> {
		return this._initializeDeferred.promise;
	}

	get _visitedNotebooks(): string[] {
		return this._extensionContext.globalState.get(constants.visitedNotebooksMementoKey, []);
	}

	set _visitedNotebooks(value: string[]) {
		this._extensionContext.globalState.update(constants.visitedNotebooksMementoKey, value);
	}

	setFileWatcher(book: BookModel): void {
		fs.watchFile(book.tableOfContentsPath, async (curr, prev) => {
			if (curr.mtime > prev.mtime) {
				await this.initializeBookContents(book);
			}
		});
	}

	trustBook(bookTreeItem?: BookTreeItem): void {
		let bookPathToTrust: string = bookTreeItem ? bookTreeItem.root : this.currentBook?.bookPath;
		if (bookPathToTrust) {
			let trustChanged = this._bookTrustManager.setBookAsTrusted(bookPathToTrust, true);
			if (trustChanged) {
				let notebookDocuments = azdata.nb.notebookDocuments;
				if (notebookDocuments) {
					// update trust state of opened items
					notebookDocuments.forEach(document => {
						let notebook = this.currentBook?.getNotebook(document.uri.fsPath);
						if (notebook && this._bookTrustManager.isNotebookTrustedByDefault(document.uri.fsPath)) {
							document.setTrusted(true);
						}
					});
				}
				TelemetryReporter.createActionEvent(BookTelemetryView, NbTelemetryActions.TrustNotebook).send();
				vscode.window.showInformationMessage(loc.msgBookTrusted);
			} else {
				vscode.window.showInformationMessage(loc.msgBookAlreadyTrusted);
			}
		}
	}

	async pinNotebook(bookTreeItem: BookTreeItem): Promise<void> {
		let bookPathToUpdate = bookTreeItem.book?.contentPath;
		if (bookPathToUpdate) {
			let pinStatusChanged = await this.bookPinManager.pinNotebook(bookTreeItem);
			TelemetryReporter.createActionEvent(BookTelemetryView, NbTelemetryActions.PinNotebook).send();
			if (pinStatusChanged) {
				bookTreeItem.contextValue = 'pinnedNotebook';
			}
		}
	}

	async unpinNotebook(bookTreeItem: BookTreeItem): Promise<void> {
		let bookPathToUpdate = bookTreeItem.book?.contentPath;
		if (bookPathToUpdate) {
			let pinStatusChanged = await this.bookPinManager.unpinNotebook(bookTreeItem);
			if (pinStatusChanged) {
				bookTreeItem.contextValue = 'savedNotebook';
			}
		}
	}

	async createBook(bookPath: string, contentPath: string): Promise<void> {
		bookPath = path.normalize(bookPath);
		contentPath = path.normalize(contentPath);
		await this.bookTocManager.createBook(bookPath, contentPath);
		TelemetryReporter.createActionEvent(BookTelemetryView, NbTelemetryActions.CreateBook).send();
	}

	async getSelectionQuickPick(movingElement: BookTreeItem): Promise<quickPickResults> {
		let bookOptions: vscode.QuickPickItem[] = [];
		let pickedSection: vscode.QuickPickItem;
		this.books.forEach(book => {
			if (!book.isNotebook) {
				bookOptions.push({ label: book.bookItems[0].title, detail: book.bookPath });
			}
		});
		let pickedBook = await vscode.window.showQuickPick(bookOptions, {
			canPickMany: false,
			placeHolder: loc.labelBookFolder
		});

		if (pickedBook && movingElement) {
			const updateBook = this.books.find(book => book.bookPath === pickedBook.detail).bookItems[0];
			if (updateBook) {
				let bookSections = updateBook.sections;
				while (bookSections?.length > 0) {
					bookOptions = [{ label: loc.labelAddToLevel, detail: pickedSection ? pickedSection.detail : '' }];
					bookSections.forEach(section => {
						if (section.sections) {
							bookOptions.push({ label: section.title ? section.title : section.file, detail: section.file });
						}
					});
					bookSections = [];
					if (bookOptions.length > 1) {
						pickedSection = await vscode.window.showQuickPick(bookOptions, {
							canPickMany: false,
							placeHolder: loc.labelBookSection
						});

						if (pickedSection && pickedSection.label === loc.labelAddToLevel) {
							break;
						}
						else if (pickedSection && pickedSection.detail) {
							if (updateBook.root === movingElement.root && pickedSection.detail === movingElement.uri) {
								pickedSection = undefined;
							} else {
								bookSections = updateBook.findChildSection(pickedSection.detail).sections;
							}
						}
					}
				}
			}
			return { quickPickSection: pickedSection, book: updateBook };
		}
		return undefined;
	}

	async editBook(movingElement: BookTreeItem): Promise<void> {
		const selectionResults = await this.getSelectionQuickPick(movingElement);
		const pickedSection = selectionResults.quickPickSection;
		const updateBook = selectionResults.book;
		if (pickedSection && updateBook) {
			const targetSection = pickedSection.detail !== undefined ? updateBook.findChildSection(pickedSection.detail) : undefined;
			if (movingElement.tableOfContents.sections) {
				if (movingElement.contextValue === 'savedNotebook') {
					let sourceBook = this.books.find(book => book.getNotebook(path.normalize(movingElement.book.contentPath)));
					movingElement.tableOfContents.sections = sourceBook?.bookItems[0].sections;
				}
			}
			const sourceBook = this.books.find(book => book.bookPath === movingElement.book.root);
			const targetBook = this.books.find(book => book.bookPath === updateBook.book.root);
			this.bookTocManager = new BookTocManager(targetBook, sourceBook);
			// remove watch on toc file from source book.
			if (sourceBook) {
				fs.unwatchFile(sourceBook.tableOfContentsPath);
			}
			try {
				await this.bookTocManager.updateBook(movingElement, updateBook, targetSection);
			} catch (e) {
				await this.bookTocManager.recovery();
				vscode.window.showErrorMessage(loc.editBookError(updateBook.book.contentPath, e instanceof Error ? e.message : e));
			} finally {
				try {
					await targetBook.initializeContents();
				} finally {
					if (sourceBook && sourceBook.bookPath !== targetBook.bookPath) {
						// refresh source book model to pick up latest changes
						await sourceBook.initializeContents();
					}
					this._onDidChangeTreeData.fire(undefined);
					// even if it fails, we still need to watch the toc file again.
					if (sourceBook) {
						this.setFileWatcher(sourceBook);
					}
				}
			}
		}
	}

	async openBook(bookPath: string, urlToOpen?: string, showPreview?: boolean, isNotebook?: boolean): Promise<void> {
		try {
			// Convert path to posix style for easier comparisons
			bookPath = bookPath.replace(/\\/g, '/');

			// Check if the book is already open in viewlet.
			let existingBook = this.books.find(book => book.bookPath === bookPath);
			if (existingBook?.bookItems.length > 0) {
				this.currentBook = existingBook;
			} else {
				await this.createAndAddBookModel(bookPath, !!isNotebook);
				this.currentBook = this.books.find(book => book.bookPath === bookPath);
			}

			if (showPreview) {
				this._bookViewer.reveal(this.currentBook.bookItems[0], { expand: vscode.TreeItemCollapsibleState.Expanded, focus: true, select: true });
				await this.showPreviewFile(urlToOpen);
			}

			TelemetryReporter.createActionEvent(BookTelemetryView, NbTelemetryActions.OpenBook).send();
			// add file watcher on toc file.
			if (!isNotebook) {
				fs.watchFile(this.currentBook.tableOfContentsPath, async (curr, prev) => {
					if (curr.mtime > prev.mtime) {
						let book = this.books.find(book => book.bookPath === bookPath);
						if (book) {
							await this.initializeBookContents(book);
						}
					}
				});
			}
		} catch (e) {
			// if there is an error remove book from context
			const index = this.books.findIndex(book => book.bookPath === bookPath);
			if (index !== -1) {
				this.books.splice(index, 1);
			}
			vscode.window.showErrorMessage(loc.openFileError(bookPath, e instanceof Error ? e.message : e));
		}
	}

	async addNotebookToPinnedView(bookItem: BookTreeItem): Promise<void> {
		let notebookPath: string = bookItem.book.contentPath;
		if (notebookPath) {
			let rootPath: string = bookItem.book.root ? bookItem.book.root : '';
			await this.createAndAddBookModel(notebookPath, true, rootPath);
		}
	}

	async removeNotebookFromPinnedView(bookItem: BookTreeItem): Promise<void> {
		let notebookPath: string = bookItem.book.contentPath;
		if (notebookPath) {
			await this.closeBook(bookItem);
		}
	}

	@debounce(1500)
	async initializeBookContents(book: BookModel): Promise<void> {
		await book.initializeContents().then(() => {
			this._onDidChangeTreeData.fire(undefined);
		});
	}

	async closeBook(book: BookTreeItem): Promise<void> {
		// remove book from the saved books
		let deletedBook: BookModel;
		try {
			let targetPath = book.book.type === BookTreeItemType.Book ? book.root : book.book.contentPath;
			let targetBook = this.books.find(b => b.bookPath === targetPath);
			let index: number = this.books.indexOf(targetBook);
			if (index > -1) {
				deletedBook = this.books.splice(index, 1)[0];
				if (this.currentBook === deletedBook) {
					this.currentBook = this.books.length > 0 ? this.books[this.books.length - 1] : undefined;
				}
				this._onDidChangeTreeData.fire(undefined);
			}
			TelemetryReporter.createActionEvent(BookTelemetryView, NbTelemetryActions.CloseBook).send();
		} catch (e) {
			vscode.window.showErrorMessage(loc.closeBookError(book.root, e instanceof Error ? e.message : e));
		} finally {
			// remove watch on toc file.
			if (deletedBook && !deletedBook.isNotebook) {
				fs.unwatchFile(deletedBook.tableOfContentsPath);
			}
		}
	}

	/**
	 * Creates a model for the specified folder path and adds it to the known list of books if we
	 * were able to successfully parse it.
	 * @param bookPath The path to the book folder to create the model for
	 * @param isNotebook A boolean value to know we are creating a model for a notebook or a book
	 * @param notebookBookRoot For pinned notebooks we need to know if the notebook is part of a book or it's a standalone notebook
	 */
	private async createAndAddBookModel(bookPath: string, isNotebook: boolean, notebookBookRoot?: string): Promise<void> {
		if (!this.books.find(x => x.bookPath === bookPath)) {
			const book: BookModel = new BookModel(bookPath, this._openAsUntitled, isNotebook, this._extensionContext, notebookBookRoot);
			await book.initializeContents();
			this.books.push(book);
			if (!this.currentBook) {
				this.currentBook = book;
			}
			this._bookViewer = vscode.window.createTreeView(this.viewId, { showCollapseAll: true, treeDataProvider: this });
			this._bookViewer.onDidChangeVisibility(e => {
				let openDocument = azdata.nb.activeNotebookEditor;
				let notebookPath = openDocument?.document.uri;
				// call reveal only once on the correct view
				if (e.visible && ((!this._openAsUntitled && notebookPath?.scheme !== 'untitled') || (this._openAsUntitled && notebookPath?.scheme === 'untitled'))) {
					this.revealActiveDocumentInViewlet();
				}
			});
		}
	}

	async showPreviewFile(urlToOpen?: string): Promise<void> {
		if (this.currentBook) {
			let urlPath: string;
			if (this.currentBook.isNotebook) {
				urlPath = urlToOpen && this.currentBook.bookPath === urlToOpen ? this.currentBook.bookPath : undefined;
			} else {
				if (urlToOpen) {
					const bookRoot = this.currentBook.bookItems[0];
					const sectionToOpen = bookRoot.findChildSection(urlToOpen);
					urlPath = sectionToOpen?.file;
				} else {
					urlPath = this.currentBook.bookItems[0].tableOfContents.sections[0].file;
				}
			}
			if (urlPath) {
				if (this.currentBook.isNotebook) {
					if (urlPath.endsWith('.md')) {
						this.openMarkdown(urlPath);
					}
					else if (urlPath.endsWith('.ipynb')) {
						await this.openNotebook(urlPath);
					}
				} else {
					// The Notebook editor expects a posix path for the resource (it will still resolve to the correct fsPath based on OS)
					const sectionToOpenMarkdown: string = path.posix.join(this.currentBook.contentFolderPath, urlPath.concat('.md'));
					const sectionToOpenNotebook: string = path.posix.join(this.currentBook.contentFolderPath, urlPath.concat('.ipynb'));
					if (await fs.pathExists(sectionToOpenMarkdown)) {
						this.openMarkdown(sectionToOpenMarkdown);
					}
					else if (await fs.pathExists(sectionToOpenNotebook)) {
						await this.openNotebook(sectionToOpenNotebook);
					}
				}
			}
		}
	}

	async openNotebook(resource: string): Promise<void> {
		try {
			await vscode.commands.executeCommand(constants.BuiltInCommands.SetContext, constants.unsavedBooksContextKey, false);
			if (this._openAsUntitled) {
				await this.openNotebookAsUntitled(resource);
			} else {
				await azdata.nb.showNotebookDocument(vscode.Uri.file(resource));
				// let us keep a list of already visited notebooks so that we do not trust them again, potentially
				// overriding user changes
				let normalizedResource = path.normalize(resource);

				if (this._visitedNotebooks.indexOf(normalizedResource) === -1
					&& this._bookTrustManager.isNotebookTrustedByDefault(normalizedResource)) {
					let document = azdata.nb.notebookDocuments.find(document => document.fileName === resource);
					document?.setTrusted(true);
					this._visitedNotebooks = this._visitedNotebooks.concat([normalizedResource]);
				}
			}
			TelemetryReporter.createActionEvent(BookTelemetryView, NbTelemetryActions.OpenNotebookFromBook);
		} catch (e) {
			vscode.window.showErrorMessage(loc.openNotebookError(resource, e instanceof Error ? e.message : e));
		}
	}

	async revealActiveDocumentInViewlet(uri?: vscode.Uri, shouldReveal: boolean = true): Promise<BookTreeItem | undefined> {
		let bookItem: BookTreeItem;
		let notebookPath: string;
		// If no uri is passed in, try to use the current active notebook editor
		if (!uri) {
			let openDocument = azdata.nb.activeNotebookEditor;
			if (openDocument) {
				notebookPath = openDocument.document.uri.fsPath;
			}
		} else if (uri.fsPath) {
			notebookPath = uri.fsPath;
		}

		if (shouldReveal || this._bookViewer?.visible) {
			bookItem = notebookPath ? await this.findAndExpandParentNode(notebookPath) : undefined;
			// Select + focus item in viewlet if books viewlet is already open, or if we pass in variable
			if (bookItem?.contextValue && bookItem.contextValue !== 'pinnedNotebook') {
				// Note: 3 is the maximum number of levels that the vscode APIs let you expand to
				await this._bookViewer.reveal(bookItem, { select: true, focus: true, expand: true });
			}
		}
		return bookItem;
	}

	async findAndExpandParentNode(notebookPath: string): Promise<BookTreeItem> {
		let bookItem: BookTreeItem = this.currentBook?.getNotebook(notebookPath);
		// if the node is not expanded getNotebook returns undefined, try to expand the parent node or getChildren of
		// the root node.
		if (!bookItem) {
			// get the parent node and expand it if it's not already
			let allNodes = this.currentBook?.getAllNotebooks();
			let book = allNodes ? Array.from(allNodes?.keys())?.filter(x => x.indexOf(notebookPath.substring(0, notebookPath.lastIndexOf(path.sep))) > -1) : undefined;
			let bookNode = book?.length > 0 ? this.currentBook?.getNotebook(book.find(x => x.substring(0, x.lastIndexOf(path.sep)) === notebookPath.substring(0, notebookPath.lastIndexOf(path.sep)))) : undefined;
			if (bookNode) {
				if (this._bookViewer?.visible) {
					await this._bookViewer.reveal(bookNode, { select: true, focus: false, expand: 3 });
				} else {
					await this.getChildren(bookNode);
				}

				bookItem = this.currentBook?.getNotebook(notebookPath);
			}
		}
		return bookItem;
	}

	openMarkdown(resource: string): void {
		try {
			vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(resource));
		} catch (e) {
			vscode.window.showErrorMessage(loc.openMarkdownError(resource, e instanceof Error ? e.message : e));
		}
	}

	async openNotebookAsUntitled(resource: string): Promise<void> {
		try {
			await vscode.commands.executeCommand(constants.BuiltInCommands.SetContext, constants.unsavedBooksContextKey, true);
			let untitledFileName: vscode.Uri = this.getUntitledNotebookUri(resource);
			let document: vscode.TextDocument = await vscode.workspace.openTextDocument(resource);
			await azdata.nb.showNotebookDocument(untitledFileName, {
				connectionProfile: null,
				initialContent: document.getText(),
				initialDirtyState: false
			});
		} catch (e) {
			vscode.window.showErrorMessage(loc.openUntitledNotebookError(resource, e instanceof Error ? e.message : e));
		}
	}

	async saveJupyterBooks(): Promise<void> {
		if (this.currentBook?.bookPath) {
			const allFilesFilter = loc.allFiles;
			let filter: any = {};
			filter[allFilesFilter] = '*';
			let uris = await vscode.window.showOpenDialog({
				filters: filter,
				canSelectFiles: false,
				canSelectMany: false,
				canSelectFolders: true,
				openLabel: loc.labelSelectFolder
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
						this._onDidChangeTreeData.fire(undefined);
						vscode.commands.executeCommand('bookTreeView.openBook', destinationUri.fsPath, false, undefined);
					}
				}
			}
		}
	}

	public async searchJupyterBooks(treeItem?: BookTreeItem): Promise<void> {
		let folderToSearch: string;
		if (treeItem && treeItem.sections !== undefined) {
			folderToSearch = treeItem.uri ? getContentPath(treeItem.version, treeItem.book.root, path.dirname(treeItem.uri)) : getContentPath(treeItem.version, treeItem.book.root, '');
		} else if (this.currentBook && !this.currentBook.isNotebook) {
			folderToSearch = path.join(this.currentBook.contentFolderPath);
		} else {
			vscode.window.showErrorMessage(loc.noBooksSelectedError);
		}

		if (folderToSearch) {
			let filesToIncludeFiltered = path.join(folderToSearch, '**', '*.md') + ',' + path.join(folderToSearch, '**', '*.ipynb');
			vscode.commands.executeCommand('workbench.action.findInFiles', { filesToInclude: filesToIncludeFiltered, query: '' });
		}
	}

	public async openNewBook(): Promise<void> {
		const allFilesFilter = loc.allFiles;
		let filter: any = {};
		filter[allFilesFilter] = '*';
		let uris = await vscode.window.showOpenDialog({
			filters: filter,
			canSelectFiles: false,
			canSelectMany: false,
			canSelectFolders: true,
			openLabel: loc.labelBookFolder
		});
		if (uris && uris.length > 0) {
			let bookPath = uris[0];
			await this.openBook(bookPath.fsPath, undefined, true);
		}
	}

	public async openNotebookFolder(folderPath?: string, urlToOpen?: string, showPreview?: boolean): Promise<void> {
		if (!folderPath) {
			const allFilesFilter = loc.allFiles;
			let filter: any = {};
			filter[allFilesFilter] = '*';
			let uris = await vscode.window.showOpenDialog({
				filters: filter,
				canSelectFiles: false,
				canSelectMany: false,
				canSelectFolders: true,
				openLabel: loc.labelSelectFolder
			});
			folderPath = uris && uris.length > 0 ? uris[0].fsPath : undefined;
		}

		if (folderPath) {
			await this.loadNotebooksInFolder(folderPath, urlToOpen, showPreview);
		}
	}

	public async loadNotebooksInFolder(folderPath: string, urlToOpen?: string, showPreview?: boolean) {
		let bookCollection = await this.getNotebooksInTree(folderPath);
		for (let i = 0; i < bookCollection.bookPaths.length; i++) {
			await this.openBook(bookCollection.bookPaths[i], urlToOpen, showPreview);
		}
		for (let i = 0; i < bookCollection.notebookPaths.length; i++) {
			await this.openBook(bookCollection.notebookPaths[i], urlToOpen, showPreview, true);
		}
	}

	private async getNotebooksInTree(folderPath: string): Promise<BookSearchResults> {
		let tocTrimLength: number;
		let ignorePaths: string[] = [];

		let notebookConfig = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		let maxDepth = notebookConfig[constants.maxBookSearchDepth];
		// Use default value if user enters an invalid value
		if (maxDepth === null || maxDepth === undefined || maxDepth < 0) {
			maxDepth = 10;
		} else if (maxDepth === 0) { // No limit of search depth if user enters 0
			maxDepth = undefined;
		}

		let escapedPath = glob.escapePath(folderPath.replace(/\\/g, '/'));
		let bookV1Filter = path.posix.join(escapedPath, '**', '_data', 'toc.yml');
		let bookV2Filter = path.posix.join(escapedPath, '**', '_toc.yml');
		let bookPaths = await glob([bookV1Filter, bookV2Filter], { deep: maxDepth });
		let ignoreNotebook: string[];
		bookPaths = bookPaths.map(function (path) {
			if (path.includes('/_data/toc.yml')) {
				tocTrimLength = '/_data/toc.yml'.length * -1;
				ignoreNotebook = ['/**/*.ipynb'];
			} else {
				tocTrimLength = '/_toc.yml'.length * -1;
				ignoreNotebook = ['/**/*.ipynb', '/*.ipynb'];
			}
			path = path.slice(0, tocTrimLength);
			ignoreNotebook.map(notebook => ignorePaths.push(glob.escapePath(path) + notebook));
			return path;
		});

		let notebookFilter = path.posix.join(escapedPath, '**', '*.ipynb');

		let notebookPaths = await glob(notebookFilter, { ignore: ignorePaths, deep: maxDepth });

		return { notebookPaths: notebookPaths, bookPaths: bookPaths };
	}

	async openExternalLink(resource: string): Promise<void> {
		try {
			await vscode.env.openExternal(vscode.Uri.parse(resource));
		} catch (e) {
			vscode.window.showErrorMessage(loc.openExternalLinkError(resource, e instanceof Error ? e.message : e));
		}
	}

	getTreeItem(element: BookTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: BookTreeItem): Thenable<BookTreeItem[]> {
		if (element) {
			if (element.sections) {
				return Promise.resolve(this.currentBook.getSections(element.tableOfContents, element.sections, element.root, element.book).then(sections => { return sections; }));
			} else {
				return Promise.resolve([]);
			}
		} else {
			let bookItems: BookTreeItem[] = [];
			this.books.map(book => {
				bookItems = bookItems.concat(book.bookItems);
			});
			return Promise.resolve(bookItems);
		}
	}

	/**
	 * Optional method on the vscode interface.
	 * Implementing getParent, due to reveal method in extHostTreeView.ts
	 * throwing error if it is not implemented.
	 */
	getParent(element?: BookTreeItem): vscode.ProviderResult<BookTreeItem> {
		// Remove it for perf issues.
		return undefined;
	}

	getUntitledNotebookUri(resource: string): vscode.Uri {
		let untitledFileName = vscode.Uri.parse(`untitled:${resource}`);
		if (!this.currentBook.getAllNotebooks().get(untitledFileName.fsPath) && !this.currentBook.getAllNotebooks().get(path.basename(untitledFileName.fsPath))) {
			let notebook = this.currentBook.getAllNotebooks().get(resource);
			this.currentBook.getAllNotebooks().set(path.basename(untitledFileName.fsPath), notebook);
		}
		return untitledFileName;
	}

	//Confirmation message dialog
	private async confirmReplace(): Promise<boolean> {
		return await this.prompter.promptSingle<boolean>(<IQuestion>{
			type: QuestionTypes.confirm,
			message: loc.confirmReplace,
			default: false
		});
	}

	getNavigation(uri: vscode.Uri): Thenable<azdata.nb.NavigationResult> {
		let result: azdata.nb.NavigationResult;
		let notebook = this.currentBook?.getNotebook(uri.fsPath);
		if (notebook) {
			result = {
				hasNavigation: true,
				previous: notebook.previousUri ?
					this.currentBook?.openAsUntitled ? this.getUntitledNotebookUri(notebook.previousUri) : vscode.Uri.file(notebook.previousUri) : undefined,
				next: notebook.nextUri ? this.currentBook?.openAsUntitled ? this.getUntitledNotebookUri(notebook.nextUri) : vscode.Uri.file(notebook.nextUri) : undefined
			};
		} else {
			result = {
				hasNavigation: false,
				previous: undefined,
				next: undefined
			};
		}
		return Promise.resolve(result);
	}
}
