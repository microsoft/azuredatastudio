/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as constants from '../common/constants';
import { IPrompter } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';
import { BookTreeItem, BookTreeItemType } from './bookTreeItem';
import { BookModel } from './bookModel';
import { Deferred } from '../common/promise';
import { IBookTrustManager, BookTrustManager } from './bookTrustManager';
import * as loc from '../common/localizedConstants';
import * as glob from 'fast-glob';
import { getPinnedNotebooks, confirmMessageDialog, getNotebookType, FileExtension, IPinnedNotebook } from '../common/utils';
import { IBookPinManager, BookPinManager } from './bookPinManager';
import { BookTocManager, IBookTocManager, quickPickResults } from './bookTocManager';
import { CreateBookDialog } from '../dialog/createBookDialog';
import { AddFileDialog } from '../dialog/addFileDialog';
import { getContentPath } from './bookVersionHandler';
import { TelemetryReporter, BookTelemetryView, NbTelemetryActions } from '../telemetry';

interface BookSearchResults {
	notebookPaths: string[];
	bookPaths: string[];
}

export class BookTreeViewProvider implements vscode.TreeDataProvider<BookTreeItem>, azdata.nb.NavigationProvider, vscode.DragAndDropController<BookTreeItem> {
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
	public books: BookModel[] = [];
	public currentBook: BookModel;
	supportedTypes = ['text/treeitems'];

	constructor(workspaceFolders: vscode.WorkspaceFolder[], extensionContext: vscode.ExtensionContext, openAsUntitled: boolean, view: string, public providerId: string) {
		this._openAsUntitled = openAsUntitled;
		this._extensionContext = extensionContext;
		this.bookPinManager = new BookPinManager();
		this.viewId = view;
		this.initialize(workspaceFolders).catch(e => console.error(e));
		this.prompter = new CodeAdapter();
		this._bookTrustManager = new BookTrustManager(this.books);
		this.bookTocManager = new BookTocManager();
		this._bookViewer = vscode.window.createTreeView(this.viewId, { showCollapseAll: true, canSelectMany: true, treeDataProvider: this, dragAndDropController: this });
		this._bookViewer.onDidChangeVisibility(async e => {
			await this.initialized;
			// Whenever the viewer changes visibility then try and reveal the currently active document
			// in the tree view
			let openDocument = azdata.nb.activeNotebookEditor;
			let notebookPath = openDocument?.document.uri;
			// Find the book that this notebook belongs to
			const book = this.books.find(book => notebookPath?.fsPath.replace(/\\/g, '/').indexOf(book.bookPath) >= -1);
			// Only reveal if...
			if (e.visible && // If the view is currently visible - if not then we'll just wait until this is called when the view is made visible
				book && // The notebook is part of a book in the viewlet (otherwise nothing to reveal)
				(this._openAsUntitled ? notebookPath?.scheme === 'untitled' : notebookPath?.scheme !== 'untitled')) // The notebook is of the correct type for this tree view
			{
				await this.revealDocumentInTreeView(notebookPath, true, true);
			}
		});
		this._extensionContext.subscriptions.push(azdata.nb.registerNavigationProvider(this));
	}

	private async initialize(workspaceFolders: vscode.WorkspaceFolder[]): Promise<void> {
		if (this.viewId === constants.PINNED_BOOKS_VIEWID) {
			await Promise.all(getPinnedNotebooks().map(async (notebook) => {
				try {
					await this.createAndAddBookModel(notebook.notebookPath, true, notebook);
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
		void this._extensionContext.globalState.update(constants.visitedNotebooksMementoKey, value);
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
				TelemetryReporter.sendActionEvent(BookTelemetryView, NbTelemetryActions.TrustNotebook);
				void vscode.window.showInformationMessage(loc.msgBookTrusted);
			} else {
				void vscode.window.showInformationMessage(loc.msgBookAlreadyTrusted);
			}
		}
	}

	async pinNotebook(bookTreeItem: BookTreeItem): Promise<void> {
		let bookPathToUpdate = bookTreeItem.book?.contentPath;
		if (bookPathToUpdate) {
			let pinStatusChanged = await this.bookPinManager.pinNotebook(bookTreeItem);
			TelemetryReporter.sendActionEvent(BookTelemetryView, NbTelemetryActions.PinNotebook);
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
				bookTreeItem.contextValue = getNotebookType(bookTreeItem.book);
			}
		}
	}

	async createBook(): Promise<void> {
		const dialog = new CreateBookDialog(this.bookTocManager);
		TelemetryReporter.sendActionEvent(BookTelemetryView, NbTelemetryActions.CreateBook);
		return dialog.createDialog();
	}

	async bookSectionQuickPick(): Promise<quickPickResults> {
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

		if (pickedBook) {
			const updateBook = this.books.find(book => book.bookPath === pickedBook.detail).bookItems[0];
			if (updateBook) {
				let bookSections = updateBook.sections;
				while (bookSections) {
					bookOptions = [{ label: loc.labelAddToLevel, detail: pickedSection ? pickedSection.detail : '' }];
					bookSections.forEach(section => {
						if (section.sections) {
							bookOptions.push({ label: section.title ? section.title : section.file, detail: section.file });
						}
					});
					bookSections = undefined;
					if (bookOptions.length >= 1) {
						pickedSection = await vscode.window.showQuickPick(bookOptions, {
							canPickMany: false,
							placeHolder: loc.labelBookSection
						});

						if (pickedSection && pickedSection.label === loc.labelAddToLevel) {
							break;
						}
						else if (pickedSection && pickedSection.detail) {
							bookSections = updateBook.findChildSection(pickedSection.detail).sections;
						}
					}
				}
			}
			return pickedSection ? { quickPickSection: pickedSection, book: updateBook } : undefined;
		}
		return undefined;
	}

	/**
	 * Move selected tree items (sections/notebooks) using the move option tree item entry point.
	 * A quick pick menu will show all the possible books and sections for the user to choose
	 * the target element to add the selected tree items.
	 * @param treeItems Elements to be moved
	 */
	async moveTreeItems(treeItems: BookTreeItem[]): Promise<void> {
		TelemetryReporter.sendActionEvent(BookTelemetryView, NbTelemetryActions.MoveNotebook);
		const selectionResults = await this.bookSectionQuickPick();
		if (selectionResults) {
			let pickedSection = selectionResults.quickPickSection;
			// filter target from sources
			let movingElements = treeItems.filter(item => item.uri !== pickedSection.detail);
			const targetBookItem = selectionResults.book;
			const targetSection = pickedSection.detail !== undefined ? targetBookItem.findChildSection(pickedSection.detail) : undefined;
			let sourcesByBook = this.groupTreeItemsByBookModel(movingElements);
			const targetBookModel = this.books.find(book => book.bookPath === targetBookItem.book.root);
			for (let [bookModel, items] of sourcesByBook) {
				this.bookTocManager = new BookTocManager(bookModel, targetBookModel);
				await this.bookTocManager.updateBook(items, targetBookItem, targetSection);
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
			}

			if (showPreview) {
				this.currentBook = this.books.find(book => book.bookPath === bookPath);
				await this._bookViewer.reveal(this.currentBook.bookItems[0], { expand: vscode.TreeItemCollapsibleState.Expanded, focus: true, select: true });
				await this.showPreviewFile(urlToOpen);
			}

			TelemetryReporter.sendActionEvent(BookTelemetryView, NbTelemetryActions.OpenBook);
		} catch (e) {
			// if there is an error remove book from context
			const index = this.books.findIndex(book => book.bookPath === bookPath);
			if (index !== -1) {
				this.books.splice(index, 1);
			}
			void vscode.window.showErrorMessage(loc.openFileError(bookPath, e instanceof Error ? e.message : e));
		}
	}

	async addNotebookToPinnedView(bookItem: BookTreeItem): Promise<void> {
		let notebookPath: string = bookItem.book.contentPath;
		if (notebookPath) {
			let notebookDetails: IPinnedNotebook = bookItem.book.root ? { bookPath: bookItem.book.root, notebookPath: notebookPath, title: bookItem.book.title } : { notebookPath: notebookPath };
			await this.createAndAddBookModel(notebookPath, true, notebookDetails);
		}
	}

	async removeNotebookFromPinnedView(bookItem: BookTreeItem): Promise<void> {
		let notebookPath: string = bookItem.book.contentPath;
		if (notebookPath) {
			await this.closeBook(bookItem);
		}
	}

	async createMarkdownFile(bookItem: BookTreeItem): Promise<void> {
		const book = this.books.find(b => b.bookPath === bookItem.root);
		this.bookTocManager = new BookTocManager(book);
		const dialog = new AddFileDialog(this.bookTocManager, bookItem, FileExtension.Markdown);
		await dialog.createDialog();
	}

	async createNotebook(bookItem: BookTreeItem): Promise<void> {
		const book = this.books.find(b => b.bookPath === bookItem.root);
		this.bookTocManager = new BookTocManager(book);
		const dialog = new AddFileDialog(this.bookTocManager, bookItem, FileExtension.Notebook);
		await dialog.createDialog();
	}

	async removeNotebook(bookItem: BookTreeItem): Promise<void> {
		const book = this.books.find(b => b.bookPath === bookItem.root);
		this.bookTocManager = new BookTocManager(book);
		return this.bookTocManager.removeNotebook(bookItem);
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
			TelemetryReporter.sendActionEvent(BookTelemetryView, NbTelemetryActions.CloseBook);
		} catch (e) {
			void vscode.window.showErrorMessage(loc.closeBookError(book.root, e instanceof Error ? e.message : e));
		} finally {
			// remove watch on toc file.
			if (deletedBook && !deletedBook.isNotebook) {
				deletedBook.unwatchTOC();
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
	private async createAndAddBookModel(bookPath: string, isNotebook: boolean, notebookDetails?: IPinnedNotebook): Promise<void> {
		if (!this.books.find(x => x.bookPath === bookPath)) {
			const book: BookModel = new BookModel(bookPath, this._openAsUntitled, isNotebook, this._extensionContext, this._onDidChangeTreeData, notebookDetails);
			await book.initializeContents();
			this.books.push(book);
			if (!this.currentBook) {
				this.currentBook = book;
			}
			this._onDidChangeTreeData.fire(undefined);
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
			TelemetryReporter.sendActionEvent(BookTelemetryView, NbTelemetryActions.OpenNotebookFromBook);
		} catch (e) {
			void vscode.window.showErrorMessage(loc.openNotebookError(resource, e instanceof Error ? e.message : e));
		}
	}

	/**
	 * Reveals the given uri in the tree view.
	 * @param uri The path to the notebook. If it's undefined then the current active notebook is revealed in the Tree View.
	 * @param shouldReveal A boolean to expand the parent node.
	 * @param shouldFocus A boolean to focus on the tree item.
	 */
	async revealDocumentInTreeView(uri: vscode.Uri | undefined, shouldReveal: boolean, shouldFocus: boolean): Promise<BookTreeItem | undefined> {
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
			bookItem = notebookPath ? await this.findAndExpandParentNode(notebookPath, shouldFocus) : undefined;
			// Select + focus item in viewlet if books viewlet is already open, or if we pass in variable
			if (bookItem?.contextValue && bookItem.contextValue !== 'pinnedNotebook') {
				// Note: 3 is the maximum number of levels that the vscode APIs let you expand to
				await this._bookViewer.reveal(bookItem, { select: true, focus: shouldFocus, expand: true });
			}
		}

		return bookItem;
	}

	async findAndExpandParentNode(notebookPath: string, shouldFocus: boolean): Promise<BookTreeItem | undefined> {
		notebookPath = notebookPath.replace(/\\/g, '/');
		const parentBook = this.books.find(b => notebookPath.indexOf(b.bookPath) > -1);
		if (!parentBook) {
			// No parent book, likely because the Notebook is at the top level and not under a Notebook.
			// Nothing to expand in that case so just return immediately
			return undefined;
		}
		this.currentBook = parentBook;
		let bookItem: BookTreeItem = parentBook.getNotebook(notebookPath);
		if (bookItem) {
			// We already have the Notebook loaded so just return it immediately
			return bookItem;
		}
		// We couldn't find the Notebook which may mean that we don't have it loaded yet, starting from
		// the top we'll expand nodes until we find the parent of the Notebook we're looking for
		// get the children of root node and expand the nodes to the notebook level.
		await this.getChildren(parentBook.rootNode);
		// The path to the Notebook we're looking for (these are the nodes we're looking to expand)
		const notebookFolders = notebookPath.split('/');
		// Find number of directories between the Notebook path and the root of the book it's contained in
		// so we know how many parent nodes to expand
		let depthOfNotebookInBook: number = path.relative(notebookPath, parentBook.bookPath).split(path.sep).length;
		// Walk the tree, expanding parent nodes as needed to load the child nodes until
		// we find the one for our Notebook
		while (depthOfNotebookInBook > -1) {
			// check if the notebook is available in already expanded levels.
			bookItem = parentBook.bookItems.find(b => b.tooltip === notebookPath);
			if (bookItem) {
				return bookItem;
			}
			// Walk down from the top level parent folder one level at each iteration
			// and keep expanding until we reach the target notebook leaf
			let parentBookPath: string = notebookFolders.slice(0, notebookFolders.length - depthOfNotebookInBook).join('/');
			let bookItemToExpand = parentBook.bookItems.find(b => b.tooltip.indexOf(parentBookPath) > -1) ??
				parentBook.bookItems.find(b => path.relative(notebookPath, b.tooltip)?.split(path.sep)?.length === depthOfNotebookInBook);

			if (!bookItemToExpand) {
				// if the book isn't found, check if the book is in the same level as the parent
				// since bookItems will not have them yet, check the sections->file property
				bookItemToExpand = parentBook.bookItems.find(b => b.sections?.find(n => notebookFolders[notebookFolders.length - depthOfNotebookInBook - 1].indexOf(n.file.substring(n.file.lastIndexOf('/') + 1)) > -1));
				// book isn't found even in the same level, break out and return.
				if (!bookItemToExpand) {
					break;
				}
				// increment to reset the depth since parent is in the same level
				depthOfNotebookInBook++;
			}
			if (!bookItemToExpand.hasChildren) {
				// We haven't loaded children of this node yet so do that now so we can
				// continue expanding and search its children
				await this.getChildren(bookItemToExpand);
			}
			try {
				// TO DO: Check why the reveal fails during initial load with 'TreeError [bookTreeView] Tree element not found'
				await this._bookViewer.reveal(bookItemToExpand, { select: false, focus: shouldFocus, expand: true });
			}
			catch (e) {
				console.error(e);
			}
			depthOfNotebookInBook--;
		}
		return bookItem;
	}

	openMarkdown(resource: string): void {
		try {
			void vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(resource));
		} catch (e) {
			void vscode.window.showErrorMessage(loc.openMarkdownError(resource, e instanceof Error ? e.message : e));
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
			void vscode.window.showErrorMessage(loc.openUntitledNotebookError(resource, e instanceof Error ? e.message : e));
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
						let doReplace = await confirmMessageDialog(this.prompter, loc.confirmReplace);
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
						void vscode.commands.executeCommand('bookTreeView.openBook', destinationUri.fsPath, false, undefined);
					}
				}
			}
		}
	}

	public async searchJupyterBooks(treeItem?: BookTreeItem): Promise<void> {
		let folderToSearch: string;
		if (treeItem && treeItem.sections !== undefined) {
			folderToSearch = treeItem.uri ? getContentPath(treeItem.book.version, treeItem.book.root, path.dirname(treeItem.uri)) : getContentPath(treeItem.book.version, treeItem.book.root, '');
		} else if (this.currentBook && !this.currentBook.isNotebook) {
			folderToSearch = path.join(this.currentBook.contentFolderPath);
		} else {
			void vscode.window.showErrorMessage(loc.noBooksSelectedError);
		}

		if (folderToSearch) {
			let filesToIncludeFiltered = path.join(folderToSearch, '**', '*.md') + ',' + path.join(folderToSearch, '**', '*.ipynb');
			void vscode.commands.executeCommand('workbench.action.findInFiles', { filesToInclude: filesToIncludeFiltered, query: '' });
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

	public async loadNotebooksInFolder(folderPath: string, urlToOpen?: string, showPreview?: boolean): Promise<void> {
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
			void vscode.window.showErrorMessage(loc.openExternalLinkError(resource, e instanceof Error ? e.message : e));
		}
	}

	async getTreeItem(element: BookTreeItem): Promise<vscode.TreeItem> {
		return element;
	}

	getChildren(element?: BookTreeItem): Thenable<BookTreeItem[]> {
		if (element) {
			if (element.sections) {
				return Promise.resolve(this.currentBook.getSections(element));
			} else {
				return Promise.resolve([]);
			}
		} else {
			return Promise.resolve(this.books.map(book => book.rootNode));
		}
	}

	/**
	 * Optional method on the vscode interface.
	 * Implementing getParent, due to reveal method in extHostTreeView.ts
	 * throwing error if it is not implemented.
	 */
	getParent(element?: BookTreeItem): vscode.ProviderResult<BookTreeItem> {
		return element?.parent;
	}

	getUntitledNotebookUri(resource: string): vscode.Uri {
		let untitledFileName = vscode.Uri.parse(`untitled:${resource}`);
		if (!this.currentBook.getAllNotebooks().get(untitledFileName.fsPath) && !this.currentBook.getAllNotebooks().get(path.basename(untitledFileName.fsPath))) {
			let notebook = this.currentBook.getAllNotebooks().get(resource);
			this.currentBook.getAllNotebooks().set(path.basename(untitledFileName.fsPath), notebook);
		}
		return untitledFileName;
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

	groupTreeItemsByBookModel(treeItems: BookTreeItem[]): Map<BookModel, BookTreeItem[]> {
		const sourcesByBook = new Map<BookModel, BookTreeItem[]>();
		for (let item of treeItems) {
			const book = this.books.find(book => book.bookPath === item.book.root);
			if (sourcesByBook.has(book)) {
				sourcesByBook.get(book).push(item);
			} else {
				sourcesByBook.set(book, [item]);
			}
		}
		return sourcesByBook;
	}

	async onDrop(sources: vscode.TreeDataTransfer, target: BookTreeItem): Promise<void> {
		if (target.contextValue === BookTreeItemType.savedBook || target.contextValue === BookTreeItemType.section) {
			TelemetryReporter.sendActionEvent(BookTelemetryView, NbTelemetryActions.DragAndDrop);
			// gets the tree items that are dragged and dropped
			let treeItems = JSON.parse(await sources.items.get(this.supportedTypes[0])!.asString()) as BookTreeItem[];
			let rootItems = this.getLocalRoots(treeItems);
			rootItems = rootItems.filter(item => item.resourceUri !== target.resourceUri);
			if (rootItems && target) {
				let sourcesByBook = this.groupTreeItemsByBookModel(rootItems);
				const targetBook = this.books.find(book => book.bookPath === target.book.root);
				for (let [book, items] of sourcesByBook) {
					this.bookTocManager = new BookTocManager(book, targetBook);
					await this.bookTocManager.updateBook(items, target);
				}
			}
		}
	}

	/**
	 * From the tree items moved find the local roots.
	 * We don't need to move a child element if the parent element has been selected as well, since every time that an element is moved
	 * we add its children.
	 * @param bookItems that have been dragged and dropped
	 * @returns an array of tree items that do not share a parent element.
	 */
	public getLocalRoots(bookItems: BookTreeItem[]): BookTreeItem[] {
		const localRoots = [];
		for (let i = 0; i < bookItems.length; i++) {
			const parent = bookItems[i].book.parent;
			if (parent) {
				const isInList = bookItems.find(item => item.resourceUri.path === parent.resourceUri.path && parent.contextValue !== 'savedBook');
				if (isInList === undefined) {
					localRoots.push(bookItems[i]);
				}
			} else {
				localRoots.push(bookItems[i]);
			}
		}
		return localRoots;
	}

	dispose(): void { }
}
