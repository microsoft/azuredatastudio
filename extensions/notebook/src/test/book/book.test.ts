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
import { BookTreeItem } from '../../book/bookTreeItem';
import { promisify } from 'util';
import { MockExtensionContext } from '../common/stubs';
import { exists } from '../../common/utils';

export interface ExpectedBookItem {
	title: string;
	url?: string;
	sections?: any[];
	external?: boolean;
	previousUri?: string | undefined;
	nextUri?: string | undefined;
}

export function equalBookItems(book: BookTreeItem, expectedBook: ExpectedBookItem): void {
	should(book.title).equal(expectedBook.title);
	should(book.uri).equal(expectedBook.url);
	if (expectedBook.previousUri || expectedBook.nextUri) {
		let prevUri = book.previousUri ? book.previousUri.toLocaleLowerCase() : undefined;
		should(prevUri).equal(expectedBook.previousUri);
		let nextUri = book.nextUri ? book.nextUri.toLocaleLowerCase() : undefined;
		should(nextUri).equal(expectedBook.nextUri);
	}
}

describe('BookTreeViewProviderTests', function() {

	describe('BookTreeViewProvider', () => {

		let mockExtensionContext: vscode.ExtensionContext;
		let nonBookFolderPath: string;
		let bookFolderPath: string;
		let rootFolderPath: string;
		let expectedNotebook1: ExpectedBookItem;
		let expectedNotebook2: ExpectedBookItem;
		let expectedNotebook3: ExpectedBookItem;
		let expectedMarkdown: ExpectedBookItem;
		let expectedExternalLink: ExpectedBookItem;
		let expectedBook: ExpectedBookItem;

		this.beforeAll(async () => {
			mockExtensionContext = new MockExtensionContext();
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			nonBookFolderPath = path.join(rootFolderPath, `NonBook`);
			bookFolderPath = path.join(rootFolderPath, `Book`);
			let dataFolderPath = path.join(bookFolderPath, '_data');
			let contentFolderPath = path.join(bookFolderPath, 'content');
			let configFile = path.join(bookFolderPath, '_config.yml');
			let tableOfContentsFile = path.join(dataFolderPath, 'toc.yml');
			let notebook1File = path.join(contentFolderPath, 'notebook1.ipynb');
			let notebook2File = path.join(contentFolderPath, 'notebook2.ipynb');
			let notebook3File = path.join(contentFolderPath, 'notebook3.ipynb');
			let markdownFile = path.join(contentFolderPath, 'markdown.md');
			expectedNotebook1 = {
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
			const bookTreeViewProvider = new BookTreeViewProvider([], mockExtensionContext, false, 'bookTreeView');
			await bookTreeViewProvider.initialized;
		});

		it('should initialize correctly with workspace containing non-book path', async () => {
			let folder: vscode.WorkspaceFolder = {
				uri: vscode.Uri.file(nonBookFolderPath),
				name: '',
				index: 0
			};
			const bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView');
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
			const bookTreeViewProvider = new BookTreeViewProvider([book, nonBook], mockExtensionContext, false, 'bookTreeView');
			await bookTreeViewProvider.initialized;
			should(bookTreeViewProvider.books.length).equal(1, 'Expected book was not initialized');
		});

		describe('BookTreeViewProvider.getChildren', function (): void {
			let bookTreeViewProvider: BookTreeViewProvider;
			let book: BookTreeItem;
			let notebook1: BookTreeItem;

			this.beforeAll(async () => {
				let folder: vscode.WorkspaceFolder = {
					uri: vscode.Uri.file(rootFolderPath),
					name: '',
					index: 0
				};
				bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView');
				let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
				await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
			});

			it('should return all book nodes when element is undefined', async function (): Promise<void> {
				const children = await bookTreeViewProvider.getChildren();
				should(children).be.Array();
				should(children.length).equal(1);
				book = children[0];
				should(book.title).equal(expectedBook.title);
			});

			it('should return all page nodes when element is a book', async function (): Promise<void> {
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

			it('should return all sections when element is a notebook', async function (): Promise<void> {
				const children = await bookTreeViewProvider.getChildren(notebook1);
				should(children).be.Array();
				should(children.length).equal(2);
				const notebook2 = children[0];
				const notebook3 = children[1];
				equalBookItems(notebook2, expectedNotebook2);
				equalBookItems(notebook3, expectedNotebook3);
			});

			this.afterAll(async function () {
				console.log('Removing temporary files...');
				if (await exists(rootFolderPath)) {
					await promisify(rimraf)(rootFolderPath);
				}
				console.log('Successfully removed temporary files.');
			});
		});

	});

	describe('BookTreeViewProvider.getTableOfContentFiles', function (): void {
		let rootFolderPath: string;
		let tableOfContentsFile: string;
		let bookTreeViewProvider: BookTreeViewProvider;
		let folder: vscode.WorkspaceFolder;

		this.beforeAll(async () => {
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			let dataFolderPath = path.join(rootFolderPath, '_data');
			tableOfContentsFile = path.join(dataFolderPath, 'toc.yml');
			let tableOfContentsFileIgnore = path.join(rootFolderPath, 'toc.yml');
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
			bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView');
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
		});

		it('should ignore toc.yml files not in _data folder', async () => {
			await bookTreeViewProvider.currentBook.getTableOfContentFiles(rootFolderPath);
			for (let p of bookTreeViewProvider.currentBook.tableOfContentPaths) {
				should(p.toLocaleLowerCase()).equal(tableOfContentsFile.replace(/\\/g, '/').toLocaleLowerCase());
			}
		});

		this.afterAll(async function () {
			if (await exists(rootFolderPath)) {
				await promisify(rimraf)(rootFolderPath);
			}
		});
	});


	describe('BookTreeViewProvider.getBooks @UNSTABLE@', function (): void {
		let rootFolderPath: string;
		let configFile: string;
		let folder: vscode.WorkspaceFolder;
		let bookTreeViewProvider: BookTreeViewProvider;
		let tocFile: string;

		this.beforeAll(async () => {
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			let dataFolderPath = path.join(rootFolderPath, '_data');
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
			bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView');
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
		});

		it('should show error message if config.yml file not found', async () => {
			await bookTreeViewProvider.currentBook.readBooks();
			should(bookTreeViewProvider.errorMessage.toLocaleLowerCase()).equal(('ENOENT: no such file or directory, open \'' + configFile + '\'').toLocaleLowerCase());
		});

		it('should show error if toc.yml file format is invalid', async function(): Promise<void> {
			await fs.writeFile(configFile, 'title: Test Book');
			await bookTreeViewProvider.currentBook.readBooks();
			should(bookTreeViewProvider.errorMessage).equal('Error: Test Book has an incorrect toc.yml file');
		});

		this.afterAll(async function () {
			if (await exists(rootFolderPath)) {
				await promisify(rimraf)(rootFolderPath);
			}
		});
	});


	describe('BookTreeViewProvider.getSections @UNSTABLE@', function (): void {
		let rootFolderPath: string;
		let tableOfContentsFile: string;
		let bookTreeViewProvider: BookTreeViewProvider;
		let folder: vscode.WorkspaceFolder;
		let expectedNotebook2: ExpectedBookItem;

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
			bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext, false, 'bookTreeView');
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([bookTreeViewProvider.initialized, errorCase.then(() => { throw new Error('BookTreeViewProvider did not initialize in time'); })]);
		});

		it('should show error if notebook or markdown file is missing', async function(): Promise<void> {
			let books = bookTreeViewProvider.currentBook.bookItems;
			let children = await bookTreeViewProvider.currentBook.getSections({ sections: [] }, books[0].sections, rootFolderPath);
			should(bookTreeViewProvider.errorMessage).equal('Missing file : Notebook1');
			// Rest of book should be detected correctly even with a missing file
			equalBookItems(children[0], expectedNotebook2);
		});

		this.afterAll(async function () {
			if (await exists(rootFolderPath)) {
				await promisify(rimraf)(rootFolderPath);
			}
		});
	});
});
