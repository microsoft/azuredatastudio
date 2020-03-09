/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { IBookTrustManager, BookTrustManager } from '../../book/bookTrustManager';
import { BookTreeItem, BookTreeItemFormat, BookTreeItemType } from '../../book/bookTreeItem';

describe('BookTrustManagerTests', function () {

	describe('TrustingInWorkspaces', () => {
		let bookTrustManager: IBookTrustManager;
		let trustedSubFolders: string[];
		let workspaceDetails: object;
		let books: any[];

		beforeEach(() => {
			trustedSubFolders = ['/SubFolder/'];

			workspaceDetails = {
				getConfiguration: () => {
					return {
						get: () => trustedSubFolders,
						update: () => { }
					};
				},
				workspaceFolders: [
					{
						uri: {
							fsPath: '/temp/'
						}
					},
					{
						uri: {
							fsPath: '/temp2/'
						}
					},
				]
			};

			let bookTreeItemFormat1:BookTreeItemFormat = {
				root: '/temp/SubFolder/',
				tableOfContents: {
					sections: [
						{
							url: path.join(path.sep, 'sample', 'notebook')
						},
						{
							url: path.join(path.sep, 'sample', 'notebook2')
						}
					]
				},
				isUntitled: undefined,
				page: undefined,
				title: undefined,
				treeItemCollapsibleState: undefined,
				type: BookTreeItemType.Book
			};

			let bookTreeItemFormat2:BookTreeItemFormat = {
				root: '/temp/SubFolder2/',
				tableOfContents: {
					sections: [
						{
							url: path.join(path.sep, 'sample', 'notebook')
						}
					]
				},
				isUntitled: undefined,
				page: undefined,
				title: undefined,
				treeItemCollapsibleState: undefined,
				type: BookTreeItemType.Book
			};

			let bookTreeItemFormat3: BookTreeItemFormat = {
				root: '/temp2/SubFolder3/',
				tableOfContents: {
					sections: [
						{
							url: path.join(path.sep, 'sample', 'notebook')
						}
					]
				},
				isUntitled: undefined,
				page: undefined,
				title: undefined,
				treeItemCollapsibleState: undefined,
				type: BookTreeItemType.Book
			};

			books = [{
				bookItems: [new BookTreeItem(bookTreeItemFormat1, undefined), new BookTreeItem(bookTreeItemFormat2, undefined)]
			}, {
				bookItems: [new BookTreeItem(bookTreeItemFormat3, undefined)]
			}];
			// @ts-ignore
			bookTrustManager = new BookTrustManager(books, workspaceDetails);
		});

		it('should trust notebooks in a trusted book within a workspace', async () => {
			let notebookUri1 = '/temp/SubFolder/content/sample/notebook.ipynb';
			let notebookUri2 = '/temp/SubFolder/content/sample/notebook2.ipynb';

			let isNotebook1Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri1);
			let isNotebook2Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri2);

			should(isNotebook1Trusted).be.true("Notebook 1 should be trusted");
			should(isNotebook2Trusted).be.true("Notebook 2 should be trusted");

		});

		it('should NOT trust a notebook in an untrusted book within a workspace', async () => {
			let notebookUri = '/temp/SubFolder2/content/sample/notebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Notebook should be trusted");
		});

		it('should trust notebook after book has been trusted within a workspace', async () => {
			let notebookUri = '/temp/SubFolder2/content/sample/notebook.ipynb';
			let isNotebookTrustedBeforeChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedBeforeChange).be.false("Notebook should NOT be trusted");

			// add the notebook
			trustedSubFolders.push('/SubFolder2/');

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.true("Notebook should be trusted");
		});

		it('should NOT trust a notebook when untrusting a book within a workspace', async () => {
			let notebookUri = '/temp/SubFolder/content/sample/notebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.true("Notebook should be trusted");

			// remove trusted subfolders
			trustedSubFolders = [];

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.false("Notebook should not be trusted after book removal");
		});

		it('should NOT trust an unknown book within a workspace', async () => {
			let notebookUri = '/randomfolder/randomsubfolder/content/randomnotebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Random notebooks should not be trusted");
		});

		it('should NOT trust notebook inside trusted subfolder when absent in table of contents ', async() => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');

			let notebookUri = '/temp/SubFolder/content/sample/notInToc.ipynb';

			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Notebook should NOT be trusted");
		});
	});

	describe('TrustingInFolder', () => {

		let bookTrustManager: IBookTrustManager;
		let trustedFolders: string[];
		let workspaceDetails: object;
		let books: any[];

		this.beforeEach(() => {
			trustedFolders = ['/temp/SubFolder/'];

			workspaceDetails = {
				// @ts-ignore
				getConfiguration: () => {
					return {
						get: () => trustedFolders,
						update: () => { }
					};
				},
				workspaceFolders: []
			};
			let bookTreeItemFormat1:BookTreeItemFormat = {
				root: '/temp/SubFolder/',
				tableOfContents: {
					sections: [
						{
							url: path.join(path.sep, 'sample', 'notebook')
						},
						{
							url: path.join(path.sep, 'sample', 'notebook2')
						}
					]
				},
				isUntitled: undefined,
				page: undefined,
				title: undefined,
				treeItemCollapsibleState: undefined,
				type: BookTreeItemType.Book
			};

			let bookTreeItemFormat2:BookTreeItemFormat = {
				root: '/temp/SubFolder2/',
				tableOfContents: {
					sections: [
						{
							url: path.join(path.sep, 'sample', 'notebook')
						},
						{
							url: path.join(path.sep, 'sample', 'notebook2')
						}
					]
				},
				isUntitled: undefined,
				page: undefined,
				title: undefined,
				treeItemCollapsibleState: undefined,
				type: BookTreeItemType.Book
			};

			books = [{
				bookItems: [new BookTreeItem(bookTreeItemFormat1, undefined)]
			}, {
				bookItems: [new BookTreeItem(bookTreeItemFormat2, undefined)],
			}];
			// @ts-ignore
			bookTrustManager = new BookTrustManager(books, workspaceDetails);
		});

		it('should trust notebooks in a trusted book in a folder', async () => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');

			let notebookUri1 = '/temp/SubFolder/content/sample/notebook.ipynb';
			let notebookUri2 = '/temp/SubFolder/content/sample/notebook2.ipynb';

			let isNotebook1Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri1);
			let isNotebook2Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri2);

			should(isNotebook1Trusted).be.true("Notebook 1 should be trusted");
			should(isNotebook2Trusted).be.true("Notebook 2 should be trusted");

		});

		it('should NOT trust a notebook in an untrusted book in a folder', async () => {
			let notebookUri = '/temp/SubFolder2/content/sample/notebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Notebook should be trusted");
		});

		it('should trust notebook after book has been added to a folder', async () => {
			let notebookUri = '/temp/SubFolder2/content/sample/notebook.ipynb';
			let isNotebookTrustedBeforeChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedBeforeChange).be.false("Notebook should NOT be trusted");

			bookTrustManager.setBookAsTrusted('/temp/SubFolder2/');

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.true("Notebook should be trusted");
		});

		it('should NOT trust a notebook when untrusting a book in folder', async () => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');
			let notebookUri = '/temp/SubFolder/content/sample/notebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.true("Notebook should be trusted");

			bookTrustManager.setBookAsUntrusted('/temp/SubFolder/');

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.false("Notebook should not be trusted after book removal");
		});

		it('should NOT trust an unknown book', async () => {
			let notebookUri = '/randomfolder/randomsubfolder/content/randomnotebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Random notebooks should not be trusted");
		});

		it('should NOT trust notebook inside trusted subfolder when absent in table of contents ', async() => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');

			let notebookUri = '/temp/SubFolder/content/sample/notInToc.ipynb';

			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Notebook should NOT be trusted");
		});

	});
});
