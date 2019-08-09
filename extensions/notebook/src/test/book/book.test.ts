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
import { BookTreeViewProvider } from '../../book/bookTreeView';
import { BookTreeItem } from '../../book/bookTreeItem';

const SEED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export interface ExpectedBookItem {
	title: string;
	url?: string;
	sections?: any[];
	external?: boolean;
	previousUri?: string | undefined;
	nextUri?: string | undefined;
}

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
		let testFolder = '';
		for (let i = 0; i < 8; i++) {
			testFolder += SEED.charAt(Math.floor(Math.random() * SEED.length));
		}
		rootFolderPath =  path.join(os.tmpdir(), 'BookTestData_' + testFolder);
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
			nextUri: notebook2File
		};
		expectedNotebook2 = {
			title: 'Notebook2',
			url: '/notebook2',
			previousUri: notebook1File,
			nextUri: notebook3File
		};
		expectedNotebook3 = {
			title: 'Notebook3',
			url: '/notebook3',
			previousUri: notebook2File,
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
		fs.mkdirSync(rootFolderPath);
		fs.mkdirSync(dataFolderPath);
		fs.mkdirSync(contentFolderPath);
		fs.writeFileSync(configFile, 'title: Test Book');
		fs.writeFileSync(tableOfContentsFile, '- title: Notebook1\n  url: /notebook1\n  sections:\n  - title: Notebook2\n    url: /notebook2\n  - title: Notebook3\n    url: /notebook3\n- title: Markdown\n  url: /markdown\n- title: GitHub\n  url: https://github.com/\n  external: true');
		fs.writeFileSync(notebook1File, '');
		fs.writeFileSync(notebook2File, '');
		fs.writeFileSync(notebook3File, '');
		fs.writeFileSync(markdownFile, '');
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		let folder: vscode.WorkspaceFolder = {
			uri: vscode.Uri.file(rootFolderPath),
			name: '',
			index: 0
		};
		bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext.object);
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
		should(notebook1.title).equal(expectedNotebook1.title);
		should(notebook1.uri).equal(expectedNotebook1.url);
		should(notebook1.previousUri).equal(expectedNotebook1.previousUri);
		should(notebook1.nextUri).equal(expectedNotebook1.nextUri);
		should(markdown.title).equal(expectedMarkdown.title);
		should(markdown.uri).equal(expectedMarkdown.url);
		should(externalLink.title).equal(expectedExternalLink.title);
		should(externalLink.uri).equal(expectedExternalLink.url);
	});

	it('should return all sections when element is a notebook', async function (): Promise<void> {
		const children = await bookTreeViewProvider.getChildren(notebook1);
		should(children).be.Array();
		should(children.length).equal(2);
		const notebook2 = children[0];
		const notebook3 = children[1];
		should(notebook2.title).equal(expectedNotebook2.title);
		should(notebook2.uri).equal(expectedNotebook2.url);
		should(notebook2.previousUri).equal(expectedNotebook2.previousUri);
		should(notebook2.nextUri).equal(expectedNotebook2.nextUri);
		should(notebook3.title).equal(expectedNotebook3.title);
		should(notebook3.uri).equal(expectedNotebook3.url);
		should(notebook3.previousUri).equal(expectedNotebook3.previousUri);
		should(notebook3.nextUri).equal(expectedNotebook3.nextUri);
	});

	this.afterAll(async function () {
		if (fs.existsSync(rootFolderPath)) {
			rimraf.sync(rootFolderPath);
		}
	});
});
