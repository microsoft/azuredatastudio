/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as rimraf from 'rimraf';
import * as os from 'os';
import * as uuid from 'uuid';
import { BookTreeViewProvider } from '../../book/bookTreeView';
import { BookTreeItem } from '../../book/bookTreeItem';

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

describe.skip('BookTreeViewProviderTests', function() {

	describe('BookTreeViewProvider.getChildren', function (): void {
		let rootFolderPath: string;
		let expectedNotebook1: ExpectedBookItem;
		let expectedNotebook2: ExpectedBookItem;
		let expectedNotebook3: ExpectedBookItem;
		let expectedMarkdown: ExpectedBookItem;
		let expectedExternalLink: ExpectedBookItem;
		let expectedBook: ExpectedBookItem;

		let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
		let bookTreeViewProvider: BookTreeViewProvider;
		let book: BookTreeItem;
		let notebook1: BookTreeItem;

		this.beforeAll(async () => {
			console.log('Generating random rootFolderPath...');
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			console.log('Random rootFolderPath generated.');
			let dataFolderPath = path.join(rootFolderPath, '_data');
			let contentFolderPath = path.join(rootFolderPath, 'content');
			let configFile = path.join(rootFolderPath, '_config.yml');
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
			console.log('Creating temporary folders and files...');
			await fs.mkdir(rootFolderPath);
			await fs.mkdir(dataFolderPath);
			await fs.mkdir(contentFolderPath);
			await fs.writeFile(configFile, 'title: Test Book');
			await fs.writeFile(tableOfContentsFile, '- title: Notebook1\n  url: /notebook1\n  sections:\n  - title: Notebook2\n    url: /notebook2\n  - title: Notebook3\n    url: /notebook3\n- title: Markdown\n  url: /markdown\n- title: GitHub\n  url: https://github.com/\n  external: true');
			await fs.writeFile(notebook1File, '');
			await fs.writeFile(notebook2File, '');
			await fs.writeFile(notebook3File, '');
			await fs.writeFile(markdownFile, '');
			console.log('Temporary folders and files created.');
			mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
			let folder: vscode.WorkspaceFolder = {
				uri: vscode.Uri.file(rootFolderPath),
				name: '',
				index: 0
			};
			console.log('Creating BookTreeViewProvider...');
			bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext.object);
			let tocRead = new Promise((resolve, reject) => bookTreeViewProvider.onReadAllTOCFiles(() => resolve()));
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([tocRead, errorCase.then(() => { throw new Error('Table of Contents were not ready in time'); })]);
			console.log('BookTreeViewProvider successfully created.');
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
			if (fs.existsSync(rootFolderPath)) {
				rimraf.sync(rootFolderPath);
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
			let dataFolderPath = path.join(rootFolderPath, '_data');
			tableOfContentsFile = path.join(dataFolderPath, 'toc.yml');
			let tableOfContentsFileIgnore = path.join(rootFolderPath, 'toc.yml');
			await fs.mkdir(rootFolderPath);
			await fs.mkdir(dataFolderPath);
			await fs.writeFile(tableOfContentsFile, '');
			await fs.writeFile(tableOfContentsFileIgnore, '');
			let mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
			folder = {
				uri: vscode.Uri.file(rootFolderPath),
				name: '',
				index: 0
			};
			bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext.object);
			let tocRead = new Promise((resolve, reject) => bookTreeViewProvider.onReadAllTOCFiles(() => resolve()));
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([tocRead, errorCase.then(() => { throw new Error('Table of Contents were not ready in time'); })]);
		});

		it('should ignore toc.yml files not in _data folder', function(): void {
			bookTreeViewProvider.getTableOfContentFiles([folder.uri.toString()]);
			for (let p of bookTreeViewProvider.tableOfContentPaths) {
				should(p.toLocaleLowerCase()).equal(tableOfContentsFile.replace(/\\/g, '/').toLocaleLowerCase());
			}
		});

		this.afterAll(async function () {
			if (fs.existsSync(rootFolderPath)) {
				rimraf.sync(rootFolderPath);
			}
		});
	});


	describe('BookTreeViewProvider.getBooks', function (): void {
		let rootFolderPath: string;
		let configFile: string;
		let folder: vscode.WorkspaceFolder;
		let bookTreeViewProvider: BookTreeViewProvider;
		let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;

		this.beforeAll(async () => {
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			let dataFolderPath = path.join(rootFolderPath, '_data');
			configFile = path.join(rootFolderPath, '_config.yml');
			let tableOfContentsFile = path.join(dataFolderPath, 'toc.yml');
			await fs.mkdir(rootFolderPath);
			await fs.mkdir(dataFolderPath);
			await fs.writeFile(tableOfContentsFile, 'title: Test');
			mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
			folder = {
				uri: vscode.Uri.file(rootFolderPath),
				name: '',
				index: 0
			};
			bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext.object);
			let tocRead = new Promise((resolve, reject) => bookTreeViewProvider.onReadAllTOCFiles(() => resolve()));
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([tocRead, errorCase.then(() => { throw new Error('Table of Contents were not ready in time'); })]);
		});

		it('should show error message if config.yml file not found', function(): void {
			bookTreeViewProvider.getBooks();
			should(bookTreeViewProvider.errorMessage.toLocaleLowerCase()).equal(('ENOENT: no such file or directory, open \'' + configFile + '\'').toLocaleLowerCase());
		});
		it('should show error if toc.yml file format is invalid', async function(): Promise<void> {
			await fs.writeFile(configFile, 'title: Test Book');
			bookTreeViewProvider.getBooks();
			should(bookTreeViewProvider.errorMessage).equal('Error: Test Book has an incorrect toc.yml file');
		});

		this.afterAll(async function () {
			if (fs.existsSync(rootFolderPath)) {
				rimraf.sync(rootFolderPath);
			}
		});
	});


	describe('BookTreeViewProvider.getSections', function (): void {
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

			let mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
			folder = {
				uri: vscode.Uri.file(rootFolderPath),
				name: '',
				index: 0
			};
			bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext.object);
			let tocRead = new Promise((resolve, reject) => bookTreeViewProvider.onReadAllTOCFiles(() => resolve()));
			let errorCase = new Promise((resolve, reject) => setTimeout(() => resolve(), 5000));
			await Promise.race([tocRead, errorCase.then(() => { throw new Error('Table of Contents were not ready in time'); })]);
		});

		it('should show error if notebook or markdown file is missing', async function(): Promise<void> {
			let books = bookTreeViewProvider.getBooks();
			let children = await bookTreeViewProvider.getSections({ sections: [] }, (await books)[0].sections, rootFolderPath);
			should(bookTreeViewProvider.errorMessage).equal('Missing file : Notebook1');
			// Rest of book should be detected correctly even with a missing file
			equalBookItems(children[0], expectedNotebook2);
		});

		this.afterAll(async function () {
			if (fs.existsSync(rootFolderPath)) {
				rimraf.sync(rootFolderPath);
			}
		});
	});
});



