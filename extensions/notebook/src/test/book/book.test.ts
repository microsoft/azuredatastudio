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
import * as assert from 'assert';

const SEED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

describe('BookTreeViewProvider.getChildren', function (): void {
	let rootFolderPath: string;
	const expectedNotebook = {
		title: 'Notebook',
		url: '/notebook'
	};
	const expectedMarkdown = {
		title: 'Markdown',
		url: '/markdown'
	};
	const expectedExternalLink = {
		title: 'GitHub',
		url: 'https://github.com/',
		external: true
	};
	const expectedBook = {
		sections: [expectedNotebook, expectedMarkdown, expectedExternalLink],
		title: 'Test Book'
	};

	let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
	let bookTreeViewProvider: BookTreeViewProvider;
	let book: BookTreeItem;

	this.beforeAll(async () => {
		try {
			let testFolder = '';
			for (let i = 0; i < 8; i++) {
				testFolder += SEED.charAt(Math.floor(Math.random() * SEED.length));
			}
			rootFolderPath =  path.join(os.tmpdir(), 'BookTestData_' + testFolder);
			let dataFolderPath = path.join(rootFolderPath, '_data');
			let contentFolderPath = path.join(rootFolderPath, 'content');
			let configFile = path.join(rootFolderPath, '_config.yml');
			let tableOfContentsFile = path.join(dataFolderPath, 'toc.yml');
			let notebookFile = path.join(contentFolderPath, 'notebook.ipynb');
			let markdownFile = path.join(contentFolderPath, 'markdown.md');
			await fs.mkdir(rootFolderPath);
			await fs.mkdir(dataFolderPath);
			await fs.mkdir(contentFolderPath);
			await fs.writeFile(configFile, 'title: Test Book');
			await fs.writeFile(tableOfContentsFile, '- title: Notebook\n  url: /notebook\n- title: Markdown\n  url: /markdown\n- title: GitHub\n  url: https://github.com/\n  external: true');
			await fs.writeFile(notebookFile, '');
			await fs.writeFile(markdownFile, '');
			mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
			let folder: vscode.WorkspaceFolder = {
				uri: vscode.Uri.file(rootFolderPath),
				name: '',
				index: 0
			};
			bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext.object);
		} catch (e) {
			assert.ok(false, e);
		}
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
		const notebook = children[0];
		const markdown = children[1];
		const externalLink = children[2];
		should(notebook.title).equal(expectedNotebook.title);
		should(notebook.uri).equal(expectedNotebook.url);
		should(markdown.title).equal(expectedMarkdown.title);
		should(markdown.uri).equal(expectedMarkdown.url);
		should(externalLink.title).equal(expectedExternalLink.title);
		should(externalLink.uri).equal(expectedExternalLink.url);
	});

	this.afterAll(async function () {
		if (fs.existsSync(rootFolderPath)) {
			rimraf.sync(rootFolderPath);
		}
	});
});
