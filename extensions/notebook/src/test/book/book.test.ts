/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as should from 'should';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as rimraf from 'rimraf';
import * as os from 'os';
import * as uuid from 'uuid';
import { BookTreeViewProvider } from '../../book/bookTreeView';
import { BookTreeItem, BookTreeItemType } from '../../book/bookTreeItem';
import { promisify } from 'util';
import { MockExtensionContext } from '../common/stubs';
import { exists } from '../../common/utils';
import { BookModel } from '../../book/bookModel';
import { BookTrustManager } from '../../book/bookTrustManager';
import { NavigationProviders } from '../../common/constants';
import { openFileError } from '../../common/localizedConstants';
import * as sinon from 'sinon';
import { AppContext } from '../../common/appContext';

export interface IExpectedBookItem {
	title: string;
	file?: string;
	url?: string;
	sections?: any[];
	external?: boolean;
	previousUri?: string | undefined;
	nextUri?: string | undefined;
}

export function equalBookItems(book: BookTreeItem, expectedBook: IExpectedBookItem, errorMsg?: string): void {
	should(book.title).equal(expectedBook.title, `Book titles do not match, expected ${expectedBook?.title} and got ${book?.title}`);
	if (expectedBook.file) {
		should(path.posix.parse(book.uri)).deepEqual(path.posix.parse(expectedBook.file));
	} else {
		should(path.posix.parse(book.uri)).deepEqual(path.posix.parse(expectedBook.url));
	}
	if (expectedBook.previousUri || expectedBook.nextUri) {
		let prevUri = book.previousUri ? book.previousUri.toLocaleLowerCase() : undefined;
		let expectedPrevUri = expectedBook.previousUri ? expectedBook.previousUri.replace(/\\/g, '/') : undefined;
		should(prevUri).equal(expectedPrevUri, errorMsg ?? `PreviousUri\'s do not match, expected ${expectedPrevUri} and got ${prevUri}`);
		let nextUri = book.nextUri ? book.nextUri.toLocaleLowerCase() : undefined;
		let expectedNextUri = expectedBook.nextUri ? expectedBook.nextUri.replace(/\\/g, '/') : undefined;
		should(nextUri).equal(expectedNextUri, errorMsg ?? `NextUri\'s do not match, expected ${expectedNextUri} and got ${nextUri}`);
	}
}

describe('BooksTreeViewTests', function () {
	describe('BookTreeViewProvider', () => {
		let mockExtensionContext: vscode.ExtensionContext;
		let appContext: AppContext;
		let nonBookFolderPath: string;
		let bookFolderPath: string;
		let rootFolderPath: string;
		let expectedNotebook1: IExpectedBookItem;
		let expectedNotebook2: IExpectedBookItem;
		let expectedNotebook3: IExpectedBookItem;
		let expectedMarkdown: IExpectedBookItem;
		let expectedExternalLink: IExpectedBookItem;
		let expectedBook: IExpectedBookItem;

		this.beforeAll(async () => {
			mockExtensionContext = new MockExtensionContext();
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			nonBookFolderPath = path.join(rootFolderPath, `NonBook`);
			bookFolderPath = path.join(rootFolderPath, `Book`);
			let dataFolderPath: string = path.join(bookFolderPath, '_data');
			let contentFolderPath: string = path.join(bookFolderPath, 'content');
			let configFile: string = path.join(bookFolderPath, '_config.yml');
			let tableOfContentsFile: string = path.join(dataFolderPath, 'toc.yml');
			let notebook1File: string = path.join(contentFolderPath, 'notebook1.ipynb');
			let notebook2File: string = path.join(contentFolderPath, 'notebook2.ipynb');
			let notebook3File: string = path.join(contentFolderPath, 'notebook3.ipynb');
			let markdownFile: string = path.join(contentFolderPath, 'markdown.md');
			expectedNotebook1 = {
				// tslint:disable-next-line: quotemark
				title: 'Notebook1',
				file: '/notebook1',
				previousUri: undefined,
				nextUri: notebook2File.toLocaleLowerCase()
			};
			expectedNotebook2 = {
				title: 'Notebook2',
				file: '/notebook2',
				previousUri: notebook1File.toLocaleLowerCase(),
				nextUri: notebook3File.toLocaleLowerCase()
			};
			expectedNotebook3 = {
				title: 'Notebook3',
				file: '/notebook3',
				previousUri: notebook2File.toLocaleLowerCase(),
				nextUri: undefined
			};
			expectedMarkdown = {
				title: 'Markdown',
				file: '/markdown'
			};
			expectedExternalLink = {
				title: 'GitHub',
				url: 'https://github.com/',
				external: true
			};
			expectedBook = {
				sections: [expectedNotebook1, expectedMarkdown, expectedExternalLink],
				title: 'Test Book'
			};

			await fs.mkdir(rootFolderPath);
			await fs.mkdir(bookFolderPath);
			await fs.mkdir(nonBookFolderPath);
			await fs.mkdir(dataFolderPath);
			await fs.mkdir(contentFolderPath);
			await fs.writeFile(configFile, 'title: Test Book');
			await fs.writeFile(tableOfContentsFile, '- title: Notebook1\n  url: /notebook1\n  sections:\n  - title: Notebook2\n    url: /notebook2\n  - title: Notebook3\n    url: /notebook3\n- title: Markdown\n  url: /markdown\n- title: GitHub\n  url: https://github.com/\n  external: true');
			await fs.writeFile(notebook1File, '');
			await fs.writeFile(notebook2File, '');
			await fs.writeFile(notebook3File, '');
			await fs.writeFile(markdownFile, '');
		});

		it('bookProviders should be initialized on extension activate', async () => {
			appContext = (await vscode.extensions.getExtension('Microsoft.notebook').activate()).getAppContext();
			should(appContext).not.be.undefined();
			should(appContext.bookTreeViewProvider).not.be.undefined();
			should(appContext.providedBookTreeViewProvider).not.be.undefined();
			should(appContext.pinnedBookTreeViewProvider).not.be.undefined();
		});

		it('should initialize correctly with empty workspace array', async () => {
			const bookTreeViewProvider = new BookTreeViewProvider([], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
			await bookTreeViewProvider.initialized;
		});

		it('should initialize correctly with workspace containing non-book path', async () => {
			let folder: vscode.WorkspaceFolder = {
				uri: vscode.Uri.file(nonBookFolderPath),
				name: '',
				index: 0
			};
			const bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
			await bookTreeViewProvider.initialized;
		});

		it('should initialize correctly with workspace containing both book and non-book paths', async () => {
			const book: vscode.WorkspaceFolder = {
				uri: vscode.Uri.file(bookFolderPath),
				name: '',
				index: 0
			};
			const nonBook: vscode.WorkspaceFolder = {
				uri: vscode.Uri.file(nonBookFolderPath),
				name: '',
				index: 0
			};
			const bookTreeViewProvider = new BookTreeViewProvider([book, nonBook], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
			await bookTreeViewProvider.initialized;
			should(bookTreeViewProvider.books.length).equal(1, 'Expected book was not initialized');
		});

		describe('bookTreeViewProvider', function (): void {
			let bookTreeViewProvider: BookTreeViewProvider;
			let book: BookTreeItem;
			let notebook1: BookTreeItem;
			let notebook2: BookTreeItem;

			this.beforeAll(async () => {
				bookTreeViewProvider = appContext.bookTreeViewProvider;
				let errorCase = new Promise<void>((resolve, reject) => setTimeout(() => resolve(), 5000));
				await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
				await bookTreeViewProvider.openBook(bookFolderPath, undefined, false, false);
			});

			afterEach(function (): void {
				sinon.restore();
			});

			it('getChildren should return all book nodes when element is undefined', async function (): Promise<void> {
				const children = await bookTreeViewProvider.getChildren();
				should(children).be.Array();
				should(children.length).equal(1);
				book = children[0];
				should(book).equal(bookTreeViewProvider.currentBook.rootNode);
				should(book.title).equal(expectedBook.title);
			});

			it('getChildren should return all page nodes when element is a book', async function (): Promise<void> {
				const children = await bookTreeViewProvider.getChildren(book);
				should(children).be.Array();
				should(children.length).equal(3);
				notebook1 = children[0];
				const markdown = children[1];
				const externalLink = children[2];
				equalBookItems(notebook1, expectedNotebook1);
				equalBookItems(markdown, expectedMarkdown);
				equalBookItems(externalLink, expectedExternalLink);
			});

			it('getChildren should return all sections when element is a notebook', async function (): Promise<void> {
				const children = await bookTreeViewProvider.getChildren(notebook1);
				should(children).be.Array();
				should(children.length).equal(2);
				notebook2 = children[0];
				const notebook3 = children[1];
				equalBookItems(notebook2, expectedNotebook2);
				equalBookItems(notebook3, expectedNotebook3);
			});

			it('should set notebooks trusted to true on trustBook', async () => {
				let notebook1Path = notebook1.tooltip;
				let bookTrustManager: BookTrustManager = new BookTrustManager(bookTreeViewProvider.books);
				let isTrusted = bookTrustManager.isNotebookTrustedByDefault(notebook1Path);
				should(isTrusted).equal(false, 'Notebook should not be trusted by default');

				bookTreeViewProvider.trustBook(notebook1);
				isTrusted = bookTrustManager.isNotebookTrustedByDefault(notebook1Path);
				should(isTrusted).equal(true, 'Failed to set trust on trustBook');

			});

			it('getNavigation should get previous and next urls correctly from the bookModel', async () => {
				let notebook1Path = path.join(rootFolderPath, 'Book', 'content', 'notebook1.ipynb');
				let notebook2Path = path.join(rootFolderPath, 'Book', 'content', 'notebook2.ipynb');
				let notebook3Path = path.join(rootFolderPath, 'Book', 'content', 'notebook3.ipynb');
				const result = await bookTreeViewProvider.getNavigation(vscode.Uri.file(notebook2Path));
				should(result.hasNavigation).be.true('getNavigation failed to get previous and next urls');
				should(result.next.fsPath).equal(vscode.Uri.file(notebook3Path).fsPath, 'getNavigation failed to get the next url');
				should(result.previous.fsPath).equal(vscode.Uri.file(notebook1Path).fsPath, 'getNavigation failed to get the previous url');

			});

			it('getParent should return when element is a valid child notebook', async () => {
				let parent = await bookTreeViewProvider.getParent();
				should(parent).be.undefined();

				parent = await bookTreeViewProvider.getParent(notebook2);
				should(parent).not.be.undefined();
				equalBookItems(parent, expectedNotebook1);
			});

			it('revealActiveDocumentInViewlet should return correct bookItem for highlight', async () => {
				let notebook1Path = path.join(rootFolderPath, 'Book', 'content', 'notebook1.ipynb').replace(/\\/g, '/');
				let currentSelection = await bookTreeViewProvider.findAndExpandParentNode(notebook1Path, true);
				should(currentSelection).not.be.undefined();
				equalBookItems(currentSelection, expectedNotebook1);
			});

			it('revealActiveDocumentInViewlet should be called on showNotebook', async () => {
				let notebook1Path = path.join(rootFolderPath, 'Book', 'content', 'notebook1.ipynb');
				let notebook2Path = path.join(rootFolderPath, 'Book', 'content', 'notebook2.ipynb');
				let notebookUri = vscode.Uri.file(notebook2Path);

				let revealActiveDocumentInViewletSpy = sinon.spy(bookTreeViewProvider, 'revealDocumentInTreeView');
				await azdata.nb.showNotebookDocument(notebookUri);
				should(azdata.nb.notebookDocuments.find(doc => doc.fileName === notebookUri.fsPath)).not.be.undefined();
				should(revealActiveDocumentInViewletSpy.calledOnce).be.true('revealActiveDocumentInViewlet should have been called');

				notebookUri = vscode.Uri.file(notebook1Path);
				await azdata.nb.showNotebookDocument(notebookUri);
				should(azdata.nb.notebookDocuments.find(doc => doc.fileName === notebookUri.fsPath)).not.be.undefined();
				should(revealActiveDocumentInViewletSpy.calledTwice).be.true('revealActiveDocumentInViewlet should have been called twice');
			});

			this.afterAll(async () => {
				await vscode.commands.executeCommand('workbench.action.closeAllEditors');
			});

		});

		describe('providedBookTreeViewProvider', function (): void {
			let providedbookTreeViewProvider: BookTreeViewProvider;
			let book: BookTreeItem;
			let notebook1: BookTreeItem;

			this.beforeAll(async () => {
				providedbookTreeViewProvider = appContext.providedBookTreeViewProvider;
				let errorCase = new Promise<void>((resolve, reject) => setTimeout(() => resolve(), 5000));
				await Promise.race([providedbookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('ProvidedBooksTreeViewProvider did not initialize in time'); })]);
				await providedbookTreeViewProvider.openBook(bookFolderPath, undefined, false, false);
			});

			afterEach(function (): void {
				sinon.restore();
			});

			it('getChildren should return all book nodes when element is undefined', async function (): Promise<void> {
				const children = await providedbookTreeViewProvider.getChildren();
				should(children).be.Array();
				should(children.length).equal(1);
				book = children[0];
				should(book.title).equal(expectedBook.title);
			});

			it('getChildren should return all page nodes when element is a book', async function (): Promise<void> {
				const children = await providedbookTreeViewProvider.getChildren(book);
				should(children).be.Array();
				should(children.length).equal(3);
				notebook1 = children[0];
				const markdown = children[1];
				const externalLink = children[2];
				equalBookItems(notebook1, expectedNotebook1);
				equalBookItems(markdown, expectedMarkdown);
				equalBookItems(externalLink, expectedExternalLink);
			});

			it('getChildren should return all sections when element is a notebook', async function (): Promise<void> {
				const children = await providedbookTreeViewProvider.getChildren(notebook1);
				should(children).be.Array();
				should(children.length).equal(2);
				const notebook2 = children[0];
				const notebook3 = children[1];
				equalBookItems(notebook2, expectedNotebook2);
				equalBookItems(notebook3, expectedNotebook3);
			});

			it('getNavigation should get previous and next urls correctly from the bookModel', async () => {
				let notebook1Path = path.join(rootFolderPath, 'Book', 'content', 'notebook1.ipynb');
				let notebook2Path = path.join(rootFolderPath, 'Book', 'content', 'notebook2.ipynb');
				let notebook3Path = path.join(rootFolderPath, 'Book', 'content', 'notebook3.ipynb');
				const result = await providedbookTreeViewProvider.getNavigation(vscode.Uri.file(notebook2Path));
				should(result.hasNavigation).be.true('getNavigation failed to get previous and next urls');
				should(result.next.fsPath).equal(notebook3Path, 'getNavigation failed to get the next url');
				should(result.previous.fsPath).equal(notebook1Path, 'getNavigation failed to get the previous url');
			});

			it('revealActiveDocumentInViewlet should return correct bookItem for highlight', async () => {
				let notebook1Path = path.join(rootFolderPath, 'Book', 'content', 'notebook1.ipynb').replace(/\\/g, '/');
				let currentSelection = await providedbookTreeViewProvider.findAndExpandParentNode(notebook1Path, true);
				should(currentSelection).not.be.undefined();
				equalBookItems(currentSelection, expectedNotebook1);
			});

			it('revealActiveDocumentInViewlet should be called on showNotebook', async () => {
				const untitledNotebook1Uri = vscode.Uri.parse(`untitled:notebook1.ipynb`);
				const untitledNotebook2Uri = vscode.Uri.parse(`untitled:notebook2.ipynb`);

				let revealActiveDocumentInViewletSpy = sinon.spy(providedbookTreeViewProvider, 'revealDocumentInTreeView');
				await azdata.nb.showNotebookDocument(untitledNotebook1Uri);
				should(azdata.nb.notebookDocuments.find(doc => doc.fileName === untitledNotebook1Uri.fsPath)).not.be.undefined();
				should(revealActiveDocumentInViewletSpy.calledOnce).be.true('revealActiveDocumentInViewlet should have been called');

				await azdata.nb.showNotebookDocument(untitledNotebook2Uri);
				should(azdata.nb.notebookDocuments.find(doc => doc.fileName === untitledNotebook2Uri.fsPath)).not.be.undefined();
				should(revealActiveDocumentInViewletSpy.calledTwice).be.true('revealActiveDocumentInViewlet should have been called twice');
			});

			this.afterAll(async () => {
				await vscode.commands.executeCommand('workbench.action.closeAllEditors');
			});

		});

		describe('pinnedBookTreeViewProvider', function (): void {
			let pinnedTreeViewProvider: BookTreeViewProvider;
			let bookTreeViewProvider: BookTreeViewProvider;
			let bookItem: BookTreeItem;

			this.beforeAll(async () => {
				pinnedTreeViewProvider = appContext.pinnedBookTreeViewProvider;
				bookTreeViewProvider = appContext.bookTreeViewProvider;
				let errorCase = new Promise<void>((resolve, reject) => setTimeout(() => resolve(), 5000));
				await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
				await Promise.race([pinnedTreeViewProvider.initialized, errorCase.then(() => { throw new Error('PinnedTreeViewProvider did not initialize in time'); })]);
				await bookTreeViewProvider.openBook(bookFolderPath, undefined, false, false);
				bookItem = bookTreeViewProvider.books[0].bookItems[0];
			});

			afterEach(function (): void {
				sinon.restore();
			});

			it('pinnedBookTreeViewProvider should not have any books when there are no pinned notebooks', async function (): Promise<void> {
				const notebooks = pinnedTreeViewProvider.books;
				should(notebooks.length).equal(0, 'Pinned Notebooks view should not have any notebooks');
			});

			it('pinNotebook should add notebook to pinnedBookTreeViewProvider', async function (): Promise<void> {
				await vscode.commands.executeCommand('notebook.command.pinNotebook', bookItem);
				const notebooks = pinnedTreeViewProvider.books;
				should(notebooks.length).equal(1, 'Pinned Notebooks view should have a notebook');
			});

			it('unpinNotebook should remove notebook from pinnedBookTreeViewProvider', async function (): Promise<void> {
				await vscode.commands.executeCommand('notebook.command.unpinNotebook', pinnedTreeViewProvider.books[0].bookItems[0]);
				const notebooks = pinnedTreeViewProvider.books;
				should(notebooks.length).equal(0, 'Pinned Notebooks view should not have any notebooks');
			});

			it('pinNotebook should invoke bookPinManagers pinNotebook method', async function (): Promise<void> {
				let pinBookSpy = sinon.spy(bookTreeViewProvider.bookPinManager, 'pinNotebook');
				await bookTreeViewProvider.pinNotebook(bookItem);
				should(pinBookSpy.calledOnce).be.true('Should invoke bookPinManagers pinNotebook to update pinnedNotebooks config');
			});

			it('unpinNotebook should invoke bookPinManagers unpinNotebook method', async function (): Promise<void> {
				let unpinNotebookSpy = sinon.spy(bookTreeViewProvider.bookPinManager, 'unpinNotebook');
				await bookTreeViewProvider.unpinNotebook(bookItem);
				should(unpinNotebookSpy.calledOnce).be.true('Should invoke bookPinManagers unpinNotebook to update pinnedNotebooks config');
			});

			it('addNotebookToPinnedView should add notebook to the TreeViewProvider', async function (): Promise<void> {
				let notebooks = pinnedTreeViewProvider.books.length;
				await pinnedTreeViewProvider.addNotebookToPinnedView(bookItem);
				should(pinnedTreeViewProvider.books.length).equal(notebooks + 1, 'Should add the notebook as new item to the TreeViewProvider');
			});

			it('removeNotebookFromPinnedView should remove notebook from the TreeViewProvider', async function (): Promise<void> {
				let notebooks = pinnedTreeViewProvider.books.length;
				await pinnedTreeViewProvider.removeNotebookFromPinnedView(pinnedTreeViewProvider.books[0].bookItems[0]);
				should(pinnedTreeViewProvider.books.length).equal(notebooks - 1, 'Should remove the notebook from the TreeViewProvider');
			});
		});

		this.afterAll(async function (): Promise<void> {
			console.log('Removing temporary files...');
			if (await exists(rootFolderPath)) {
				await promisify(rimraf)(rootFolderPath);
			}
			console.log('Successfully removed temporary files.');
		});

	});

	describe('BookTreeViewProvider.getTableOfContentFiles', function () {
		let rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
		let bookTreeViewProvider: BookTreeViewProvider;
		let runs = [
			{
				it: 'v1',
				folderPaths: {
					'dataFolderPath': path.join(rootFolderPath, '_data'),
					'contentFolderPath': path.join(rootFolderPath, 'content'),
					'configFile': path.join(rootFolderPath, '_config.yml'),
					'tableOfContentsFile': path.join(rootFolderPath, '_data', 'toc.yml'),
					'notebook2File': path.join(rootFolderPath, 'content', 'notebook2.ipynb'),
					'tableOfContentsFileIgnore': path.join(rootFolderPath, 'toc.yml')
				},
				contents: {
					'config': 'title: Test Book',
					'toc': '- title: Notebook1\n  url: /notebook1\n  sections:\n  - title: Notebook2\n    url: /notebook2\n  - title: Notebook3\n    url: /notebook3\n- title: Markdown\n  url: /markdown\n- title: GitHub\n  url: https://github.com/\n  external: true'
				}
			},
			{
				it: 'v2',
				folderPaths: {
					'dataFolderPath': path.join(rootFolderPath, '_data'),
					'configFile': path.join(rootFolderPath, '_config.yml'),
					'tableOfContentsFile': path.join(rootFolderPath, '_toc.yml'),
					'notebook2File': path.join(rootFolderPath, 'notebook2.ipynb'),
					'tableOfContentsFileIgnore': path.join(rootFolderPath, '_data', 'toc.yml')
				},
				contents: {
					'config': 'title: Test Book',
					'toc': '- title: Notebook1\n  file: /notebook1\n  sections:\n  - title: Notebook2\n    file: /notebook2\n  - title: Notebook3\n    file: /notebook3\n- title: Markdown\n  file: /markdown\n- title: GitHub\n  url: https://github.com/\n'
				}
			}
		];
		runs.forEach(function (run) {
			describe('BookTreeViewProvider.getTableOfContentFiles on ' + run.it, function (): void {
				let folder: vscode.WorkspaceFolder;

				before(async () => {
					await fs.mkdir(rootFolderPath);
					await fs.mkdir(run.folderPaths.dataFolderPath);
					if (run.it === 'v1') {
						await fs.mkdir(run.folderPaths.contentFolderPath);
					}
					await fs.writeFile(run.folderPaths.tableOfContentsFile, run.contents.toc);
					await fs.writeFile(run.folderPaths.tableOfContentsFileIgnore, '');
					await fs.writeFile(run.folderPaths.notebook2File, '');
					await fs.writeFile(run.folderPaths.configFile, run.contents.config);

					const mockExtensionContext = new MockExtensionContext();
					folder = {
						uri: vscode.Uri.file(rootFolderPath),
						name: '',
						index: 0
					};
					bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
					let errorCase = new Promise<void>((resolve, reject) => setTimeout(() => resolve(), 5000));
					await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
					await bookTreeViewProvider.openBook(rootFolderPath, undefined, false, false);
				});

				if (run.it === 'v1') {
					it('should ignore toc.yml files not in _data folder', async () => {
						await bookTreeViewProvider.currentBook.readBookStructure();
						await bookTreeViewProvider.currentBook.loadTableOfContentFiles();
						let path = bookTreeViewProvider.currentBook.tableOfContentsPath;
						should(vscode.Uri.file(path).fsPath).equal(vscode.Uri.file(run.folderPaths.tableOfContentsFile).fsPath);
					});
				} else if (run.it === 'v2') {
					it('should ignore toc.yml files not under the root book folder', async () => {
						await bookTreeViewProvider.currentBook.readBookStructure();
						await bookTreeViewProvider.currentBook.loadTableOfContentFiles();
						let path = bookTreeViewProvider.currentBook.tableOfContentsPath;
						should(vscode.Uri.file(path).fsPath).equal(vscode.Uri.file(run.folderPaths.tableOfContentsFile).fsPath);
					});
				}

				after(async function (): Promise<void> {
					if (await exists(rootFolderPath)) {
						await promisify(rimraf)(rootFolderPath);
					}
				});
			});
		});
	});

	describe('BookTreeViewProvider.getBooks', function () {
		let rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
		let bookTreeViewProvider: BookTreeViewProvider;
		let runs = [
			{
				it: 'v1',
				folderPaths: {
					'dataFolderPath': path.join(rootFolderPath, '_data'),
					'contentFolderPath': path.join(rootFolderPath, 'content'),
					'configFile': path.join(rootFolderPath, '_config.yml'),
					'tableofContentsFile': path.join(rootFolderPath, '_data', 'toc.yml'),
					'notebook2File': path.join(rootFolderPath, 'content', 'notebook2.ipynb'),
				},
				contents: {
					'config': 'title: Test Book',
					'toc': '- title: Notebook1\n  url: /notebook1\n- title: Notebook2\n  url: /notebook2'
				}
			}, {
				it: 'v2',
				folderPaths: {
					'configFile': path.join(rootFolderPath, '_config.yml'),
					'tableofContentsFile': path.join(rootFolderPath, '_toc.yml'),
					'notebook2File': path.join(rootFolderPath, 'notebook2.ipynb'),
				},
				contents: {
					'config': 'title: Test Book',
					'toc': '- title: Notebook1\n  file: /notebook1\n- title: Notebook2\n  file: /notebook2'
				}
			}
		];
		runs.forEach(function (run) {
			describe('BookTreeViewProvider.getBooks on ' + run.it, function (): void {
				let folder: vscode.WorkspaceFolder;
				before(async () => {
					await fs.mkdir(rootFolderPath);
					if (run.it === 'v1') {
						await fs.mkdir(run.folderPaths.dataFolderPath);
						await fs.mkdir(run.folderPaths.contentFolderPath);
					}
					await fs.writeFile(run.folderPaths.tableofContentsFile, run.contents.config);
					await fs.writeFile(run.folderPaths.configFile, run.contents.config);
					const mockExtensionContext = new MockExtensionContext();
					folder = {
						uri: vscode.Uri.file(rootFolderPath),
						name: '',
						index: 0
					};
					bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
					let errorCase = new Promise<void>((resolve, reject) => setTimeout(() => resolve(), 5000));
					await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
				});

				it('should show error message if config.yml file not found', async () => {
					try {
						await bookTreeViewProvider.openBook(rootFolderPath, undefined, false, false);

					} catch (error) {
						should(error).equal(openFileError(bookTreeViewProvider.currentBook.bookPath, `ENOENT: no such file or directory, open '${run.folderPaths.configFile}'`));

					}
				});

				it('should show error if toc.yml file format is invalid', async function (): Promise<void> {
					try {
						await fs.writeFile(run.folderPaths.configFile, run.contents.config);
						await bookTreeViewProvider.openBook(rootFolderPath, undefined, false, false);
					} catch (error) {
						should(error).equal(openFileError(bookTreeViewProvider.currentBook.bookPath, `Invalid toc file`));
					}
				});

				after(async function (): Promise<void> {
					if (await exists(rootFolderPath)) {
						await promisify(rimraf)(rootFolderPath);
					}
				});
			});
		});
	});

	describe('BookTreeViewProvider.getSections', function () {
		let rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
		let bookTreeViewProvider: BookTreeViewProvider;
		let runs = [
			{
				it: 'v1',
				folderPaths: {
					'dataFolderPath': path.join(rootFolderPath, '_data'),
					'contentFolderPath': path.join(rootFolderPath, 'content'),
					'configFile': path.join(rootFolderPath, '_config.yml'),
					'tableofContentsFile': path.join(rootFolderPath, '_data', 'toc.yml'),
					'notebook2File': path.join(rootFolderPath, 'content', 'notebook2.ipynb'),
				},
				contents: {
					'config': 'title: Test Book',
					'toc': '- title: Notebook1\n  url: /notebook1\n- title: Notebook2\n  url: /notebook2'
				}
			}, {
				it: 'v2',
				folderPaths: {
					'configFile': path.join(rootFolderPath, '_config.yml'),
					'tableofContentsFile': path.join(rootFolderPath, '_toc.yml'),
					'notebook2File': path.join(rootFolderPath, 'notebook2.ipynb'),
				},
				contents: {
					'config': 'title: Test Book',
					'toc': '- title: Notebook1\n  file: /notebook1\n- title: Notebook2\n  file: /notebook2'
				}
			}
		];
		runs.forEach(function (run) {
			describe('BookTreeViewProvider.getSections on ' + run.it, function (): void {
				let folder: vscode.WorkspaceFolder[];
				let expectedNotebook2: IExpectedBookItem;

				before(async () => {
					expectedNotebook2 = {
						title: 'Notebook2',
						file: '/notebook2',
						previousUri: undefined,
						nextUri: undefined
					};
					await fs.mkdir(rootFolderPath);
					if (run.it === 'v1') {
						await fs.mkdir(run.folderPaths.dataFolderPath);
						await fs.mkdir(run.folderPaths.contentFolderPath);
					}
					await fs.writeFile(run.folderPaths.configFile, run.contents.config);
					await fs.writeFile(run.folderPaths.tableofContentsFile, run.contents.toc);
					await fs.writeFile(run.folderPaths.notebook2File, '');

					const mockExtensionContext = new MockExtensionContext();
					folder = [{
						uri: vscode.Uri.file(rootFolderPath),
						name: '',
						index: 0
					}];
					bookTreeViewProvider = new BookTreeViewProvider(folder, mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
					let errorCase = new Promise<void>((resolve, reject) => setTimeout(() => resolve(), 5000));
					await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
				});

				it('should show error if notebook or markdown file is missing', async function (): Promise<void> {
					let books: BookTreeItem[] = bookTreeViewProvider.currentBook.bookItems;
					let children = await bookTreeViewProvider.currentBook.getSections(books[0]);
					should(bookTreeViewProvider.currentBook.errorMessage).equal('Missing file : Notebook1 from '.concat(bookTreeViewProvider.currentBook.bookItems[0].title));
					// rest of book should be detected correctly even with a missing file
					equalBookItems(children[0], expectedNotebook2);
				});

				after(async function (): Promise<void> {
					if (await exists(rootFolderPath)) {
						await promisify(rimraf)(rootFolderPath);
					}
				});
			});
		});
	});

	describe('BookTreeViewProvider.Commands', function () {
		let rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
		let bookTreeViewProvider: BookTreeViewProvider;
		let runs = [
			{
				it: 'v1',
				folderPaths: {
					'dataFolderPath': path.join(rootFolderPath, '_data'),
					'contentFolderPath': path.join(rootFolderPath, 'content'),
					'configFile': path.join(rootFolderPath, '_config.yml'),
					'tableofContentsFile': path.join(rootFolderPath, '_data', 'toc.yml'),
					'notebook1File': path.join(rootFolderPath, 'content', 'notebook1.ipynb'),
					'notebook2File': path.join(rootFolderPath, 'content', 'notebook2.ipynb'),
					'markdownFile': path.join(rootFolderPath, 'content', 'readme.md')
				},
				contents: {
					'config': 'title: Test Book',
					'toc': '- title: Home\n  url: /readme\n- title: Notebook1\n  url: /notebook1\n- title: Notebook2\n  url: /notebook2'
				}
			},
			{
				it: 'v2',
				folderPaths: {
					'configFile': path.join(rootFolderPath, '_config.yml'),
					'tableofContentsFile': path.join(rootFolderPath, '_toc.yml'),
					'notebook1File': path.join(rootFolderPath, 'notebook1.ipynb'),
					'notebook2File': path.join(rootFolderPath, 'notebook2.ipynb'),
					'markdownFile': path.join(rootFolderPath, 'readme.md')
				},
				contents: {
					'config': 'title: Test Book',
					'toc': '- title: Home\n  file: /readme\n- title: Notebook1\n  file: /notebook1\n- title: Notebook2\n  file: /notebook2'
				}
			}
		];
		runs.forEach(function (run) {
			describe('BookTreeViewProvider.Commands on ' + run.it, function (): void {
				before(async () => {
					await fs.mkdir(rootFolderPath);
					if (run.it === 'v1') {
						await fs.mkdir(run.folderPaths.dataFolderPath);
						await fs.mkdir(run.folderPaths.contentFolderPath);
					}
					await fs.writeFile(run.folderPaths.configFile, run.contents.config);
					await fs.writeFile(run.folderPaths.tableofContentsFile, run.contents.toc);
					await fs.writeFile(run.folderPaths.notebook1File, '');
					await fs.writeFile(run.folderPaths.notebook2File, '');
					await fs.writeFile(run.folderPaths.markdownFile, '');

					const mockExtensionContext = new MockExtensionContext();
					bookTreeViewProvider = new BookTreeViewProvider([], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
					let errorCase = new Promise<void>((resolve, reject) => setTimeout(() => resolve(), 5000));
					await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
				});

				afterEach(async function (): Promise<void> {
					sinon.restore();
					await vscode.commands.executeCommand('workbench.action.closeAllEditors');
				});

				it('should add book and initialize book on openBook', async () => {
					should(bookTreeViewProvider.books.length).equal(0, 'Invalid books on initialize.');

					let showPreviewSpy = sinon.spy(bookTreeViewProvider, 'showPreviewFile');

					await bookTreeViewProvider.openBook(rootFolderPath);
					should(bookTreeViewProvider.books.length).equal(1, 'Failed to initialize the book on open');
					should(showPreviewSpy.notCalled).be.true('Should not call showPreviewFile when showPreview isn\' true');
				});

				it('openMarkdown should open markdown in the editor', async () => {
					let executeCommandSpy = sinon.spy(vscode.commands, 'executeCommand');
					let notebookPath = run.folderPaths.markdownFile;
					bookTreeViewProvider.openMarkdown(notebookPath);
					should(executeCommandSpy.calledWith('markdown.showPreview')).be.true('openMarkdown should have called markdown.showPreview');
				});

				// TODO: Need to investigate why it's failing on linux.
				it.skip('openNotebook should open notebook in the editor', async () => {
					let showNotebookSpy = sinon.spy(azdata.nb, 'showNotebookDocument');
					let notebookPath = run.folderPaths.notebook2File;
					await bookTreeViewProvider.openNotebook(notebookPath);
					should(showNotebookSpy.calledWith(vscode.Uri.file(notebookPath))).be.true(`Should have opened the notebook from ${notebookPath} in the editor.`);
				});

				it('openNotebookAsUntitled should open a notebook as untitled file in the editor @UNSTABLE@', async () => {
					let notebookPath = run.folderPaths.notebook2File;
					await bookTreeViewProvider.openNotebookAsUntitled(notebookPath);
					should(azdata.nb.notebookDocuments.find(doc => doc.uri.scheme === 'untitled')).not.be.undefined();
				});

				it('openExternalLink should open link', async () => {
					let executeCommandSpy = sinon.spy(vscode.commands, 'executeCommand');
					let notebookPath = run.folderPaths.markdownFile;
					bookTreeViewProvider.openMarkdown(notebookPath);
					should(executeCommandSpy.calledWith('markdown.showPreview')).be.true('openMarkdown should have called markdown.showPreview');
				});

				it('should call showPreviewFile on openBook when showPreview flag is set', async () => {
					await bookTreeViewProvider.closeBook(bookTreeViewProvider.books[0].bookItems[0]);
					let showPreviewSpy = sinon.spy(bookTreeViewProvider, 'showPreviewFile');

					await bookTreeViewProvider.openBook(rootFolderPath, undefined, true);
					should(bookTreeViewProvider.books.length).equal(1, 'Failed to initialize the book on open');
					should(showPreviewSpy.calledOnce).be.true('Should have called showPreviewFile.');
				});

				it('should add book when bookPath contains special characters on openBook @UNSTABLE@', async () => {
					let rootFolderPath2 = path.join(os.tmpdir(), `BookTestData(1)_${uuid.v4()}`);
					let dataFolderPath2 = path.join(rootFolderPath2, '_data');
					let contentFolderPath2 = path.join(rootFolderPath2, 'content');
					let configFile2 = path.join(rootFolderPath2, '_config.yml');
					let tableOfContentsFile2 = path.join(dataFolderPath2, 'toc.yml');
					let notebook2File2 = path.join(contentFolderPath2, 'notebook2.ipynb');
					await fs.mkdir(rootFolderPath2);
					await fs.mkdir(dataFolderPath2);
					await fs.mkdir(contentFolderPath2);
					await fs.writeFile(configFile2, 'title: Test Book');
					await fs.writeFile(tableOfContentsFile2, '- title: Notebook1\n  url: /notebook1\n- title: Notebook2\n  url: /notebook2');
					await fs.writeFile(notebook2File2, '');

					await bookTreeViewProvider.openBook(rootFolderPath2);
					should(bookTreeViewProvider.books.length).equal(2, 'Failed to initialize the book on open');

					await promisify(rimraf)(rootFolderPath2);
				});

				it('should get notebook path with untitled schema on openNotebookAsUntitled', async () => {
					let notebookUri = bookTreeViewProvider.getUntitledNotebookUri(run.folderPaths.notebook2File);
					should(notebookUri.scheme).equal('untitled', 'Failed to get untitled uri of the resource');
				});

				it('openNotebookFolder without folderPath should prompt for folder path and invoke loadNotebooksInFolder', async () => {
					const uri = vscode.Uri.file(rootFolderPath);
					sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([uri]));
					let loadNotebooksSpy = sinon.spy(bookTreeViewProvider, 'loadNotebooksInFolder');
					await bookTreeViewProvider.openNotebookFolder();

					should(loadNotebooksSpy.calledWith(uri.fsPath)).be.true('openNotebookFolder should have called loadNotebooksInFolder passing the folderPath');
				});

				it('openNotebookFolder with folderPath shouldn\'t prompt for folder path but invoke loadNotebooksInFolder with the provided folderPath', async () => {
					let showOpenDialogSpy = sinon.spy(vscode.window, 'showOpenDialog');
					let loadNotebooksSpy = sinon.spy(bookTreeViewProvider, 'loadNotebooksInFolder');
					await bookTreeViewProvider.openNotebookFolder(rootFolderPath);

					should(showOpenDialogSpy.notCalled).be.true('openNotebookFolder with folderPath shouldn\'t prompt to select folder');
					should(loadNotebooksSpy.calledOnce).be.true('openNotebookFolder should have called loadNotebooksInFolder');
				});

				it('openNewBook should prompt for notebook path and invoke openBook', async () => {
					sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([vscode.Uri.file(rootFolderPath)]));
					let openBookSpy = sinon.spy(bookTreeViewProvider, 'openBook');
					await bookTreeViewProvider.openNewBook();

					should(openBookSpy.calledOnce).be.true('openNewBook should have called openBook');
				});

				it('searchJupyterBooks should call command that opens Search view', async () => {
					let executeCommandSpy = sinon.spy(vscode.commands, 'executeCommand');
					await bookTreeViewProvider.searchJupyterBooks(bookTreeViewProvider.books[0].bookItems[0]);
					should(executeCommandSpy.calledWith('workbench.action.findInFiles')).be.true('searchJupyterBooks should have called command to open Search view');
				});

				it('saveJupyterBooks should prompt location and openBook', async () => {
					let saveFolderPath = path.join(os.tmpdir(), `Book_${uuid.v4()}`);
					await fs.mkdir(saveFolderPath);
					sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([vscode.Uri.file(saveFolderPath)]));
					let executeCommandSpy = sinon.spy(vscode.commands, 'executeCommand');
					await bookTreeViewProvider.saveJupyterBooks();
					should(executeCommandSpy.calledWith('bookTreeView.openBook')).be.true('saveJupyterBooks should have called command openBook after saving');

					await promisify(rimraf)(saveFolderPath);
				});

				it('should remove book on closeBook', async () => {
					await bookTreeViewProvider.openBook(rootFolderPath, undefined, true);
					should(bookTreeViewProvider.books.length).equal(1, 'Failed to initialize the book on open');
					let length: number = bookTreeViewProvider.books.length;
					await bookTreeViewProvider.closeBook(bookTreeViewProvider.books[0].bookItems[0]);
					should(bookTreeViewProvider.books.length).equal(length - 1, 'Failed to remove the book on close');
				});

				after(async function (): Promise<void> {
					if (await exists(rootFolderPath)) {
						await promisify(rimraf)(rootFolderPath);
					}
				});
			});
		});
	});

	describe('BookTreeViewProvider.openNotebookFolder', function () {
		let rootFolderPath = path.join(os.tmpdir(), `BookFolderTest_${uuid.v4()}`);
		let bookTreeViewProvider: BookTreeViewProvider;
		let runs = [
			{
				it: 'v1',
				folderPaths: {
					'bookFolderPath': path.join(rootFolderPath, 'BookTestData'),
					'dataFolderPath': path.join(rootFolderPath, 'BookTestData', '_data'),
					'contentFolderPath': path.join(rootFolderPath, 'BookTestData', 'content'),
					'configFile': path.join(rootFolderPath, 'BookTestData', '_config.yml'),
					'tableOfContentsFile': path.join(rootFolderPath, 'BookTestData', '_data', 'toc.yml'),
					'bookNotebookFile': path.join(rootFolderPath, 'BookTestData', 'content', 'notebook1.ipynb'),
					'notebookFolderPath': path.join(rootFolderPath, 'NotebookTestData'),
					'standaloneNotebookFile': path.join(rootFolderPath, 'NotebookTestData', 'notebook2.ipynb')
				},
				contents: {
					'config': 'title: Test Book',
					'toc': '- title: Notebook1\n  url: /notebook1',
					'bookTitle': 'Test Book',
					'standaloneNotebookTitle': 'notebook2'
				}
			},
			{
				it: 'v2',
				folderPaths: {
					'bookFolderPath': path.join(rootFolderPath, 'BookTestData'),
					'configFile': path.join(rootFolderPath, 'BookTestData', '_config.yml'),
					'tableOfContentsFile': path.join(rootFolderPath, 'BookTestData', '_toc.yml'),
					'bookNotebookFile': path.join(rootFolderPath, 'BookTestData', 'notebook1.ipynb'),
					'notebookFolderPath': path.join(rootFolderPath, 'NotebookTestData'),
					'standaloneNotebookFile': path.join(rootFolderPath, 'NotebookTestData', 'notebook2.ipynb')
				},
				contents: {
					'config': 'title: Test Book',
					'toc': '- title: Notebook1\n  file: /notebook1',
					'bookTitle': 'Test Book',
					'standaloneNotebookTitle': 'notebook2'
				}
			}];
		runs.forEach(function (run) {
			describe('BookTreeViewProvider.openNotebookFolder on ' + run.it, function (): void {
				before(async () => {

					await fs.mkdir(rootFolderPath);
					await fs.mkdir(run.folderPaths.bookFolderPath);
					if (run.it === 'v1') {
						await fs.mkdir(run.folderPaths.dataFolderPath);
						await fs.mkdir(run.folderPaths.contentFolderPath);
					}
					await fs.mkdir(run.folderPaths.notebookFolderPath);
					await fs.writeFile(run.folderPaths.configFile, run.contents.config);
					await fs.writeFile(run.folderPaths.tableOfContentsFile, run.contents.toc);
					await fs.writeFile(run.folderPaths.bookNotebookFile, '');
					await fs.writeFile(run.folderPaths.standaloneNotebookFile, '');

					const mockExtensionContext = new MockExtensionContext();
					bookTreeViewProvider = new BookTreeViewProvider([], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
					let errorCase = new Promise<void>((resolve, reject) => setTimeout(() => resolve(), 5000));
					await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
				});

				it('should include books and notebooks when opening parent folder', async () => {
					await bookTreeViewProvider.loadNotebooksInFolder(rootFolderPath);
					should(bookTreeViewProvider.books.length).equal(2, 'Should have loaded a book and a notebook');

					validateIsBook(bookTreeViewProvider.books[0]);
					validateIsNotebook(bookTreeViewProvider.books[1]);
				});

				it('should include only books when opening books folder', async () => {
					await bookTreeViewProvider.loadNotebooksInFolder(run.folderPaths.bookFolderPath);
					should(bookTreeViewProvider.books.length).equal(1, 'Should have loaded only one book');

					validateIsBook(bookTreeViewProvider.books[0]);
				});

				it('should include only notebooks when opening notebooks folder', async () => {
					await bookTreeViewProvider.loadNotebooksInFolder(run.folderPaths.notebookFolderPath);
					should(bookTreeViewProvider.books.length).equal(1, 'Should have loaded only one notebook');

					validateIsNotebook(bookTreeViewProvider.books[0]);
				});

				afterEach(async function (): Promise<void> {
					let bookItems = await bookTreeViewProvider.getChildren();
					await Promise.all(bookItems.map(bookItem => bookTreeViewProvider.closeBook(bookItem)));
				});

				after(async function (): Promise<void> {
					if (await exists(rootFolderPath)) {
						await promisify(rimraf)(rootFolderPath);
					}
				});

				let validateIsBook = (book: BookModel) => {
					should(book.isNotebook).be.false();
					should(book.bookItems.length).equal(1);

					let bookItem = book.bookItems[0];

					let bookDetails = bookItem.book;
					should(bookDetails.type).equal(BookTreeItemType.Book);
					should(bookDetails.title).equal(run.contents.bookTitle);
					should(bookDetails.contentPath).equal(run.folderPaths.tableOfContentsFile.replace(/\\/g, '/'));
					should(bookDetails.root).equal(run.folderPaths.bookFolderPath.replace(/\\/g, '/'));
					should(bookDetails.tableOfContents.sections).not.equal(undefined);
					should(bookDetails.page).not.equal(undefined);
				};

				let validateIsNotebook = (book: BookModel) => {
					should(book.isNotebook).be.true();
					should(book.bookItems.length).equal(1);

					let bookItem = book.bookItems[0];
					should(book.getAllNotebooks().get(vscode.Uri.file(run.folderPaths.standaloneNotebookFile).fsPath)).equal(bookItem);

					let bookDetails = bookItem.book;
					should(bookDetails.type).equal(BookTreeItemType.Notebook);
					should(bookDetails.title).equal(run.contents.standaloneNotebookTitle);
					should(bookDetails.contentPath).equal(run.folderPaths.standaloneNotebookFile.replace(/\\/g, '/'));
					should(bookDetails.root).equal(run.folderPaths.notebookFolderPath.replace(/\\/g, '/'));
					should(bookDetails.tableOfContents.sections).equal(undefined);
					should(bookDetails.page.sections).equal(undefined);
				};
			});
		});

	});
});
