/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import * as vscode from 'vscode';
// import * as should from 'should';
// import * as TypeMoq from 'typemoq';
// import * as path from 'path';
// import * as fs from 'fs';
// import * as rimraf from 'rimraf';
// import * as os from 'os';
// import { BookTreeViewProvider } from '../../book/bookTreeView';
// import { BookTreeItem } from '../../book/bookTreeItem';

// describe('BookTreeViewProvider.getChildren', function (): void {
// 	const rootFolderPath = path.join(os.tmpdir(), 'testBook');
// 	const dataFolderPath = path.join(rootFolderPath, '_data');
// 	const contentFolderPath = path.join(rootFolderPath, 'content');
// 	const configFile = path.join(rootFolderPath, '_config.yml');
// 	const tableOfContentsFile = path.join(dataFolderPath, 'toc.yml');
// 	const notebookFile = path.join(contentFolderPath, 'notebook.ipynb');
// 	const markdownFile = path.join(contentFolderPath, 'markdown.md');
// 	const expectedNotebook = {
// 		title: 'Notebook',
// 		url: '/notebook'
// 	};
// 	const expectedMarkdown = {
// 		title: 'Markdown',
// 		url: '/markdown'
// 	};
// 	const expectedExternalLink = {
// 		title: 'GitHub',
// 		url: 'https://github.com/',
// 		external: true
// 	};
// 	const expectedBook = {
// 		sections: [expectedNotebook, expectedMarkdown, expectedExternalLink],
// 		title: 'Test Book'
// 	};

// 	let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
// 	let bookTreeViewProvider: BookTreeViewProvider;
// 	let book: BookTreeItem;

// 	this.beforeAll(async () => {
// 		fs.mkdirSync(rootFolderPath);
// 		fs.mkdirSync(dataFolderPath);
// 		fs.mkdirSync(contentFolderPath);
// 		fs.writeFileSync(configFile, 'title: Test Book');
// 		fs.writeFileSync(tableOfContentsFile, '- title: Notebook\n  url: /notebook\n- title: Markdown\n  url: /markdown\n- title: GitHub\n  url: https://github.com/\n  external: true');
// 		fs.writeFileSync(notebookFile, '');
// 		fs.writeFileSync(markdownFile, '');
// 		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
// 		let folder: vscode.WorkspaceFolder = {
// 			uri: vscode.Uri.parse(rootFolderPath),
// 			name: '',
// 			index: 0
// 		};
// 		bookTreeViewProvider = new BookTreeViewProvider([folder], mockExtensionContext.object);
// 	});

// 	it('should return all book nodes when element is undefined', async function (): Promise<void> {
// 		const children = await bookTreeViewProvider.getChildren();
// 		should(children).be.Array();
// 		should(children.length).equal(1);
// 		book = children[0];
// 		should(book.title).equal(expectedBook.title);
// 	});

// 	it('should return all page nodes when element is a book', async function (): Promise<void> {
// 		const children = await bookTreeViewProvider.getChildren(book);
// 		should(children).be.Array();
// 		should(children.length).equal(3);
// 		const notebook = children[0];
// 		const markdown = children[1];
// 		const externalLink = children[2];
// 		should(notebook.title).equal(expectedNotebook.title);
// 		should(notebook.uri).equal(expectedNotebook.url);
// 		should(markdown.title).equal(expectedMarkdown.title);
// 		should(markdown.uri).equal(expectedMarkdown.url);
// 		should(externalLink.title).equal(expectedExternalLink.title);
// 		should(externalLink.uri).equal(expectedExternalLink.url);
// 	});

// 	after(async function () {
// 		if (fs.existsSync(rootFolderPath)) {
// 			rimraf.sync(rootFolderPath);
// 		}
// 	});
// });
