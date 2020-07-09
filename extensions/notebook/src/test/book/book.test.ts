/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

export interface IExpectedBookItem {
	title: string;
	url?: string;
	sections?: any[];
	external?: boolean;
	previousUri?: string | undefined;
	nextUri?: string | undefined;
}

export function equalBookItems(book: BookTreeItem, expectedBook: IExpectedBookItem): void {
	should(book.title).equal(expectedBook.title);
	should(path.posix.parse(book.uri)).deepEqual(path.posix.parse(expectedBook.url));
	if (expectedBook.previousUri || expectedBook.nextUri) {
		let prevUri = book.previousUri ? book.previousUri.toLocaleLowerCase() : undefined;
		let expectedPrevUri = expectedBook.previousUri ? expectedBook.previousUri.replace(/\\/g, '/') : undefined;
		should(prevUri).equal(expectedPrevUri);
		let nextUri = book.nextUri ? book.nextUri.toLocaleLowerCase() : undefined;
		let expectedNextUri = expectedBook.nextUri ? expectedBook.nextUri.replace(/\\/g, '/') : undefined;
		should(nextUri).equal(expectedNextUri);
	}
}

describe('BookTreeViewProviderTests', function () {
	describe('BookTreeViewProvider', () => {

		let mockExtensionContext: vscode.ExtensionContext;
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
				url: '/notebook1',
				previousUri: undefined,
				nextUri: notebook2File.toLocaleLowerCase()
			};
			expectedNotebook2 = {
				title: 'Notebook2',
				url: '/notebook2',
				previousUri: notebook1File.toLocaleLowerCase(),
				nextUri: notebook3File.toLocaleLowerCase()
			};
			expectedNotebook3 = {
				title: 'Notebook3',
				url: '/notebook3',
				previousUri: notebook2File.toLocaleLowerCase(),
				nextUri: undefined
			};
			expectedMarkdown = {
				title: 'Markdown',
				url: '/markdown'
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

		describe('getChildren', function (): void {
			let bookTreeViewProvider: BookTreeViewProvider;
			let providedbookTreeViewProvider: BookTreeViewProvider;
			let book: BookTreeItem;
			let notebook1: BookTreeItem;

			this.beforeAll(async () => {
				let folder: vscode.WorkspaceFolder = {
					uri: vscode.Uri.file(rootFolderPath),
					name: '',
					index: 0
				};
				bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
				providedbookTreeViewProvider = new BookTreeViewProvider([], mockExtensionContext, true, 'providedBooksView', NavigationProviders.ProvidedBooksNavigator);
				let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
				await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
				await Promise.race([providedbookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('ProvidedBooksTreeViewProvider did not initialize in time'); })]);
				await providedbookTreeViewProvider.openBook(bookFolderPath, undefined, false, false);
			});

			it('bookTreeViewProvider should return all book nodes when element is undefined', async function (): Promise<void> {
				const children = await bookTreeViewProvider.getChildren();
				should(children).be.Array();
				should(children.length).equal(1);
				book = children[0];
				should(book.title).equal(expectedBook.title);
			});

			it('bookTreeViewProvider should return all page nodes when element is a book', async function (): Promise<void> {
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

			it('bookTreeViewProvider should return all sections when element is a notebook', async function (): Promise<void> {
				const children = await bookTreeViewProvider.getChildren(notebook1);
				should(children).be.Array();
				should(children.length).equal(2);
				const notebook2 = children[0];
				const notebook3 = children[1];
				equalBookItems(notebook2, expectedNotebook2);
				equalBookItems(notebook3, expectedNotebook3);
			});

			it('bookTreeViewProvider should set notebooks trusted to true on trustBook', async () => {
				let notebook1Path = path.join(rootFolderPath, 'Book', 'content', 'notebook1.ipynb');
				let bookTrustManager: BookTrustManager = new BookTrustManager(bookTreeViewProvider.books);
				let isTrusted = bookTrustManager.isNotebookTrustedByDefault(vscode.Uri.file(notebook1Path).fsPath);
				should(isTrusted).equal(false, 'Notebook should not be trusted by default');

				bookTreeViewProvider.trustBook(bookTreeViewProvider.currentBook.bookItems[0]);
				isTrusted = bookTrustManager.isNotebookTrustedByDefault(vscode.Uri.file(notebook1Path).fsPath);
				should(isTrusted).equal(true, 'Failed to set trust on trustBook');

			});

			it('bookTreeViewProvider getNavigation should get previous and next urls correctly from the bookModel', async () => {
				let notebook1Path = path.join(rootFolderPath, 'Book', 'content', 'notebook1.ipynb');
				let notebook2Path = path.join(rootFolderPath, 'Book', 'content', 'notebook2.ipynb');
				let notebook3Path = path.join(rootFolderPath, 'Book', 'content', 'notebook3.ipynb');
				const result = await bookTreeViewProvider.getNavigation(vscode.Uri.file(notebook2Path));
				should(result.hasNavigation).be.true('getNavigation failed to get previous and next urls');
				should(result.next.fsPath).equal(vscode.Uri.file(notebook3Path).fsPath, 'getNavigation failed to get the next url');
				should(result.previous.fsPath).equal(vscode.Uri.file(notebook1Path).fsPath, 'getNavigation failed to get the previous url');

			});

			it('providedBookTreeViewProvider should return all book nodes when element is undefined', async function (): Promise<void> {
				const children = await providedbookTreeViewProvider.getChildren();
				should(children).be.Array();
				should(children.length).equal(1);
				book = children[0];
				should(book.title).equal(expectedBook.title);
			});

			it('providedBookTreeViewProvider should return all page nodes when element is a book', async function (): Promise<void> {
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

			it('providedBookTreeViewProvider should return all sections when element is a notebook', async function (): Promise<void> {
				const children = await providedbookTreeViewProvider.getChildren(notebook1);
				should(children).be.Array();
				should(children.length).equal(2);
				const notebook2 = children[0];
				const notebook3 = children[1];
				equalBookItems(notebook2, expectedNotebook2);
				equalBookItems(notebook3, expectedNotebook3);
			});

			it('providedBookTreeViewProvider getNavigation should get previous and next urls correctly from the bookModel', async () => {
				let notebook1Path = path.join(rootFolderPath, 'Book', 'content', 'notebook1.ipynb');
				let notebook2Path = path.join(rootFolderPath, 'Book', 'content', 'notebook2.ipynb');
				let notebook3Path = path.join(rootFolderPath, 'Book', 'content', 'notebook3.ipynb');
				const result = await providedbookTreeViewProvider.getNavigation(vscode.Uri.file(notebook2Path));
				should(result.hasNavigation).be.true('getNavigation failed to get previous and next urls');
				should(result.next.fsPath).equal(notebook3Path, 'getNavigation failed to get the next url');
				should(result.previous.fsPath).equal(notebook1Path, 'getNavigation failed to get the previous url');
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

	describe('BookTreeViewProvider.getTableOfContentFiles', function (): void {
		let rootFolderPath: string;
		let tableOfContentsFile: string;
		let bookTreeViewProvider: BookTreeViewProvider;
		let folder: vscode.WorkspaceFolder;

		this.beforeAll(async () => {
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			let dataFolderPath: string = path.join(rootFolderPath, '_data');
			tableOfContentsFile = path.join(dataFolderPath, 'toc.yml');
			let tableOfContentsFileIgnore: string = path.join(rootFolderPath, 'toc.yml');
			await fs.mkdir(rootFolderPath);
			await fs.mkdir(dataFolderPath);
			await fs.writeFile(tableOfContentsFile, '- title: Notebook1\n  url: /notebook1\n  sections:\n  - title: Notebook2\n    url: /notebook2\n  - title: Notebook3\n    url: /notebook3\n- title: Markdown\n  url: /markdown\n- title: GitHub\n  url: https://github.com/\n  external: true');
			await fs.writeFile(tableOfContentsFileIgnore, '');
			const mockExtensionContext = new MockExtensionContext();
			folder = {
				uri: vscode.Uri.file(rootFolderPath),
				name: '',
				index: 0
			};
			bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
		});

		it('should ignore toc.yml files not in _data folder', async () => {
			await bookTreeViewProvider.currentBook.loadTableOfContentFiles(rootFolderPath);
			let path = bookTreeViewProvider.currentBook.tableOfContentsPath;
			should(vscode.Uri.file(path).fsPath).equal(vscode.Uri.file(tableOfContentsFile).fsPath);
		});

		this.afterAll(async function (): Promise<void> {
			if (await exists(rootFolderPath)) {
				await promisify(rimraf)(rootFolderPath);
			}
		});
	});


	describe('BookTreeViewProvider.getBooks', function (): void {
		let rootFolderPath: string;
		let configFile: string;
		let folder: vscode.WorkspaceFolder;
		let bookTreeViewProvider: BookTreeViewProvider;
		let tocFile: string;

		this.beforeAll(async () => {
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			let dataFolderPath: string = path.join(rootFolderPath, '_data');
			configFile = path.join(rootFolderPath, '_config.yml');
			tocFile = path.join(dataFolderPath, 'toc.yml');
			await fs.mkdir(rootFolderPath);
			await fs.mkdir(dataFolderPath);
			await fs.writeFile(tocFile, 'title: Test');
			const mockExtensionContext = new MockExtensionContext();
			folder = {
				uri: vscode.Uri.file(rootFolderPath),
				name: '',
				index: 0
			};
			bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
		});

		it('should show error message if config.yml file not found', async () => {
			await bookTreeViewProvider.currentBook.readBooks();
			should(bookTreeViewProvider.currentBook.errorMessage.toLocaleLowerCase()).equal(('Failed to read book '+ bookTreeViewProvider.currentBook.bookPath +': ENOENT: no such file or directory, open \'' + configFile + '\'').toLocaleLowerCase());
		});

		it('should show error if toc.yml file format is invalid', async function (): Promise<void> {
			await fs.writeFile(configFile, 'title: Test Book');
			await bookTreeViewProvider.currentBook.readBooks();
			should(bookTreeViewProvider.currentBook.errorMessage.toLocaleLowerCase()).equal(('Failed to read book '+ bookTreeViewProvider.currentBook.bookPath +': Invalid toc file').toLocaleLowerCase());
		});

		this.afterAll(async function (): Promise<void> {
			if (await exists(rootFolderPath)) {
				await promisify(rimraf)(rootFolderPath);
			}
		});
	});


	describe('BookTreeViewProvider.getSections', function (): void {
		let rootFolderPath: string;
		let tableOfContentsFile: string;
		let bookTreeViewProvider: BookTreeViewProvider;
		let folder: vscode.WorkspaceFolder;
		let expectedNotebook2: IExpectedBookItem;

		this.beforeAll(async () => {
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			let dataFolderPath = path.join(rootFolderPath, '_data');
			let contentFolderPath = path.join(rootFolderPath, 'content');
			let configFile = path.join(rootFolderPath, '_config.yml');
			tableOfContentsFile = path.join(dataFolderPath, 'toc.yml');
			let notebook2File = path.join(contentFolderPath, 'notebook2.ipynb');
			expectedNotebook2 = {
				title: 'Notebook2',
				url: '/notebook2',
				previousUri: undefined,
				nextUri: undefined
			};
			await fs.mkdir(rootFolderPath);
			await fs.mkdir(dataFolderPath);
			await fs.mkdir(contentFolderPath);
			await fs.writeFile(configFile, 'title: Test Book');
			await fs.writeFile(tableOfContentsFile, '- title: Notebook1\n  url: /notebook1\n- title: Notebook2\n  url: /notebook2');
			await fs.writeFile(notebook2File, '');

			const mockExtensionContext = new MockExtensionContext();
			folder = {
				uri: vscode.Uri.file(rootFolderPath),
				name: '',
				index: 0
			};
			bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
		});

		it('should show error if notebook or markdown file is missing', async function (): Promise<void> {
			let books: BookTreeItem[] = bookTreeViewProvider.currentBook.bookItems;
			let children = await bookTreeViewProvider.currentBook.getSections({ sections: [] }, books[0].sections, rootFolderPath);
			should(bookTreeViewProvider.currentBook.errorMessage).equal('Missing file : Notebook1');
			// rest of book should be detected correctly even with a missing file
			equalBookItems(children[0], expectedNotebook2);
		});

		this.afterAll(async function (): Promise<void> {
			if (await exists(rootFolderPath)) {
				await promisify(rimraf)(rootFolderPath);
			}
		});
	});

	describe('BookTreeViewProvider.Commands', function (): void {
		let rootFolderPath: string;
		let tableOfContentsFile: string;
		let bookTreeViewProvider: BookTreeViewProvider;

		this.beforeAll(async () => {
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			let dataFolderPath = path.join(rootFolderPath, '_data');
			let contentFolderPath = path.join(rootFolderPath, 'content');
			let configFile = path.join(rootFolderPath, '_config.yml');
			tableOfContentsFile = path.join(dataFolderPath, 'toc.yml');
			let notebook2File = path.join(contentFolderPath, 'notebook2.ipynb');
			await fs.mkdir(rootFolderPath);
			await fs.mkdir(dataFolderPath);
			await fs.mkdir(contentFolderPath);
			await fs.writeFile(configFile, 'title: Test Book');
			await fs.writeFile(tableOfContentsFile, '- title: Notebook1\n  url: /notebook1\n- title: Notebook2\n  url: /notebook2');
			await fs.writeFile(notebook2File, '');

			const mockExtensionContext = new MockExtensionContext();
			bookTreeViewProvider = new BookTreeViewProvider([], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
		});

		it('should add book and initialize book on openBook', async () => {
			should(bookTreeViewProvider.books.length).equal(0, 'Invalid books on initialize.');
			await bookTreeViewProvider.openBook(rootFolderPath);
			should(bookTreeViewProvider.books.length).equal(1, 'Failed to initialize the book on open');
		});

		it('should remove book on closeBook', async () => {
			await bookTreeViewProvider.openBook(rootFolderPath);
			should(bookTreeViewProvider.books.length).equal(1, 'Failed to initialize the book on open');
			await bookTreeViewProvider.closeBook(bookTreeViewProvider.books[0].bookItems[0]);
			should(bookTreeViewProvider.books.length).equal(0, 'Failed to remove the book on close');
		});

		it('should add book when bookPath contains special characters on openBook', async () => {
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
			should(bookTreeViewProvider.books.length).equal(1, 'Failed to initialize the book on open');
		});

		it('should get notebook path with untitled schema on openNotebookAsUntitled', async () => {
			let notebookUri = bookTreeViewProvider.getUntitledNotebookUri(path.join(rootFolderPath, 'content', 'notebook2.ipynb'));
			should(notebookUri.scheme).equal('untitled', 'Failed to get untitled uri of the resource');
		});

		this.afterAll(async function (): Promise<void> {
			if (await exists(rootFolderPath)) {
				await promisify(rimraf)(rootFolderPath);
			}
		});
	});

	describe('BookTreeViewProvider.openNotebookFolder', function (): void {
		let rootFolderPath: string;
		let bookFolderPath: string;
		let bookTitle: string;
		let notebookFolderPath: string;
		let tableOfContentsFile: string;
		let standaloneNotebookTitle: string;
		let standaloneNotebookFile: string;
		let bookTreeViewProvider: BookTreeViewProvider;

		this.beforeAll(async () => {
			rootFolderPath = path.join(os.tmpdir(), `BookFolderTest_${uuid.v4()}`);
			bookFolderPath = path.join(rootFolderPath, 'BookTestData');
			let dataFolderPath = path.join(bookFolderPath, '_data');
			let contentFolderPath = path.join(bookFolderPath, 'content');
			let configFile = path.join(bookFolderPath, '_config.yml');
			tableOfContentsFile = path.join(dataFolderPath, 'toc.yml');
			let bookNotebookFile = path.join(contentFolderPath, 'notebook1.ipynb');
			notebookFolderPath = path.join(rootFolderPath, 'NotebookTestData');
			standaloneNotebookTitle = 'notebook2';
			standaloneNotebookFile = path.join(notebookFolderPath, `${standaloneNotebookTitle}.ipynb`);
			await fs.mkdir(rootFolderPath);
			await fs.mkdir(bookFolderPath);
			await fs.mkdir(dataFolderPath);
			await fs.mkdir(contentFolderPath);
			await fs.mkdir(notebookFolderPath);
			bookTitle = 'Test Book';
			await fs.writeFile(configFile, `title: ${bookTitle}`);
			await fs.writeFile(tableOfContentsFile, '- title: Notebook1\n  url: /notebook1');
			await fs.writeFile(bookNotebookFile, '');
			await fs.writeFile(standaloneNotebookFile, '');

			const mockExtensionContext = new MockExtensionContext();
			bookTreeViewProvider = new BookTreeViewProvider([], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
		});

		it('should include books and notebooks when opening parent folder', async () => {
			await bookTreeViewProvider.loadNotebooksInFolder(rootFolderPath);
			should(bookTreeViewProvider.books.length).equal(2, 'Should have loaded a book and a notebook');

			validateIsBook(bookTreeViewProvider.books[0]);
			validateIsNotebook(bookTreeViewProvider.books[1]);
		});

		it('should include only books when opening books folder', async () => {
			await bookTreeViewProvider.loadNotebooksInFolder(bookFolderPath);
			should(bookTreeViewProvider.books.length).equal(1, 'Should have loaded only one book');

			validateIsBook(bookTreeViewProvider.books[0]);
		});

		it('should include only notebooks when opening notebooks folder', async () => {
			await bookTreeViewProvider.loadNotebooksInFolder(notebookFolderPath);
			should(bookTreeViewProvider.books.length).equal(1, 'Should have loaded only one notebook');

			validateIsNotebook(bookTreeViewProvider.books[0]);
		});

		this.afterEach(async function (): Promise<void> {
			let bookItems = await bookTreeViewProvider.getChildren();
			await Promise.all(bookItems.map(bookItem => bookTreeViewProvider.closeBook(bookItem)));
		});

		this.afterAll(async function (): Promise<void> {
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
			should(bookDetails.title).equal(bookTitle);
			should(bookDetails.contentPath).equal(tableOfContentsFile.replace(/\\/g, '/'));
			should(bookDetails.root).equal(bookFolderPath.replace(/\\/g, '/'));
			should(bookDetails.tableOfContents.sections).not.equal(undefined);
			should(bookDetails.page).not.equal(undefined);
		};

		let validateIsNotebook = (book: BookModel) => {
			should(book.isNotebook).be.true();
			should(book.bookItems.length).equal(1);

			let bookItem = book.bookItems[0];
			should(book.getAllNotebooks().get(vscode.Uri.file(standaloneNotebookFile).fsPath)).equal(bookItem);

			let bookDetails = bookItem.book;
			should(bookDetails.type).equal(BookTreeItemType.Notebook);
			should(bookDetails.title).equal(standaloneNotebookTitle);
			should(bookDetails.contentPath).equal(standaloneNotebookFile.replace(/\\/g, '/'));
			should(bookDetails.root).equal(notebookFolderPath.replace(/\\/g, '/'));
			should(bookDetails.tableOfContents.sections).equal(undefined);
			should(bookDetails.page.sections).equal(undefined);
		};
	});
});
