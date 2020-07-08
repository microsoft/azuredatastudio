/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import * as constants from '../../common/constants';
import { IBookTrustManager, BookTrustManager } from '../../book/bookTrustManager';
import { BookTreeItem, BookTreeItemFormat, BookTreeItemType } from '../../book/bookTreeItem';
import * as vscode from 'vscode';
import { BookModel } from '../../book/bookModel';
import * as sinon from 'sinon';

describe('BookTrustManagerTests', function () {

	describe('TrustingInWorkspaces', () => {
		let bookTrustManager: IBookTrustManager;
		let trustedSubFolders: string[];
		let books: BookModel[];

		afterEach(function (): void {
			sinon.restore();
		});

		beforeEach(() => {
			trustedSubFolders = ['/SubFolder/'];

			// Mock Workspace Configuration
			let workspaceConfigurtionMock: TypeMoq.IMock<vscode.WorkspaceConfiguration> = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			workspaceConfigurtionMock.setup(config => config.get(TypeMoq.It.isValue(constants.trustedBooksConfigKey))).returns(() => [].concat(trustedSubFolders));
			workspaceConfigurtionMock.setup(config => config.update(TypeMoq.It.isValue(constants.trustedBooksConfigKey), TypeMoq.It.isAny(), TypeMoq.It.isValue(false))).returns((key: string, newValues: string[]) => {
				trustedSubFolders.splice(0, trustedSubFolders.length, ...newValues); // Replace
				return Promise.resolve();
			});

			sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => {
				return <vscode.WorkspaceFolder[]>[{
					uri: {
						fsPath: '/temp/'
					},
				},
				{
					uri: {
						fsPath: '/temp2/'
					}
				},
				];
			});

			sinon.stub(vscode.workspace, 'getConfiguration').returns(workspaceConfigurtionMock.object);

			// Mock Book Data
			let bookTreeItemFormat1: BookTreeItemFormat = {
				contentPath: undefined,
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

			let bookTreeItemFormat2: BookTreeItemFormat = {
				contentPath: undefined,
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
				contentPath: undefined,
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

			let bookModel1Mock: TypeMoq.IMock<BookModel> = TypeMoq.Mock.ofType<BookModel>();
			bookModel1Mock.setup(model => model.bookItems).returns(() => [new BookTreeItem(bookTreeItemFormat1, undefined), new BookTreeItem(bookTreeItemFormat2, undefined)]);
			bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook.ipynb')))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
			bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook2.ipynb')))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
			bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(path.join(path.sep, 'temp', 'SubFolder2', 'content', 'sample', 'notebook.ipynb')))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
			bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isAnyString())).returns((uri: string) => undefined);

			let bookModel2Mock: TypeMoq.IMock<BookModel> = TypeMoq.Mock.ofType<BookModel>();
			bookModel2Mock.setup(model => model.bookItems).returns(() => [new BookTreeItem(bookTreeItemFormat3, undefined)]);
			bookModel2Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(path.join(path.sep, 'temp2', 'SubFolder', 'content', 'sample', 'notebook.ipynb')))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
			bookModel2Mock.setup(model => model.getNotebook(TypeMoq.It.isAnyString())).returns((uri: string) => undefined);

			books = [bookModel1Mock.object, bookModel2Mock.object];

			bookTrustManager = new BookTrustManager(books);
		});

		it('should trust notebooks in a trusted book within a workspace', async () => {
			let notebookUri1 = path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook.ipynb');
			let notebookUri2 = path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook2.ipynb');

			let isNotebook1Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri1);
			let isNotebook2Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri2);

			should(isNotebook1Trusted).be.true('Notebook 1 should be trusted');
			should(isNotebook2Trusted).be.true('Notebook 2 should be trusted');

		});

		it('should NOT trust a notebook in an untrusted book within a workspace', async () => {
			let notebookUri = path.join(path.sep, 'temp', 'SubFolder2', 'content', 'sample', 'notebook.ipynb');
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false('Notebook should be trusted');
		});

		it('should trust notebook after book has been trusted within a workspace', async () => {
			let notebookUri = path.join(path.sep, 'temp', 'SubFolder2', 'content', 'sample', 'notebook.ipynb');
			let isNotebookTrustedBeforeChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedBeforeChange).be.false('Notebook should NOT be trusted');

			// add another book subfolder
			bookTrustManager.setBookAsTrusted('/SubFolder2/');

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.true('Notebook should be trusted');
		});

		it('should NOT trust a notebook when untrusting a book within a workspace', async () => {
			let notebookUri = path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook.ipynb');
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.true('Notebook should be trusted');

			// remove trusted subfolders
			trustedSubFolders = [];

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.false('Notebook should not be trusted after book removal');
		});

		it('should NOT trust an unknown book within a workspace', async () => {
			let notebookUri = path.join(path.sep, 'randomfolder', 'randomsubfolder', 'content', 'randomnotebook.ipynb');
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false('Random notebooks should not be trusted');
		});

		it('should NOT trust notebook inside trusted subfolder when absent in table of contents ', async () => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');

			let notebookUri = path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notInToc.ipynb');
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false('Notebook should NOT be trusted');
		});
	});

	describe('TrustingInFolder', () => {

		let bookTrustManager: IBookTrustManager;
		let books: BookModel[];
		let trustedFolders: string[] = [];

		beforeEach(() => {
			// Mock Workspace Configuration
			let workspaceConfigurtionMock: TypeMoq.IMock<vscode.WorkspaceConfiguration> = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			workspaceConfigurtionMock.setup(config => config.get(TypeMoq.It.isValue(constants.trustedBooksConfigKey))).returns(() => [].concat(trustedFolders));
			workspaceConfigurtionMock.setup(config => config.update(TypeMoq.It.isValue(constants.trustedBooksConfigKey), TypeMoq.It.isAny(), TypeMoq.It.isValue(vscode.ConfigurationTarget.Global))).returns((key: string, newValues: string[], target: vscode.ConfigurationTarget) => {
				trustedFolders.splice(0, trustedFolders.length, ...newValues); // Replace
				return Promise.resolve();
			});

			let bookTreeItemFormat1: BookTreeItemFormat = {
				contentPath: undefined,
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

			let bookTreeItemFormat2: BookTreeItemFormat = {
				contentPath: undefined,
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

			let bookModel1Mock: TypeMoq.IMock<BookModel> = TypeMoq.Mock.ofType<BookModel>();
			bookModel1Mock.setup(model => model.bookItems).returns(() => [new BookTreeItem(bookTreeItemFormat1, undefined)]);
			bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook.ipynb')))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
			bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook2.ipynb')))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
			bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isAnyString())).returns((uri: string) => undefined);

			let bookModel2Mock: TypeMoq.IMock<BookModel> = TypeMoq.Mock.ofType<BookModel>();
			bookModel2Mock.setup(model => model.bookItems).returns(() => [new BookTreeItem(bookTreeItemFormat2, undefined)]);
			bookModel2Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(path.join(path.sep, 'temp', 'SubFolder2', 'content', 'sample', 'notebook.ipynb')))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
			bookModel2Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(path.join(path.sep, 'temp', 'SubFolder2', 'content', 'sample', 'notebook2.ipynb')))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
			bookModel2Mock.setup(model => model.getNotebook(TypeMoq.It.isAnyString())).returns((uri: string) => undefined);

			books = [bookModel1Mock.object, bookModel2Mock.object];

			bookTrustManager = new BookTrustManager(books);
		});

		it('should trust notebooks in a trusted book in a folder', async () => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');

			let notebookUri1 = path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook.ipynb');
			let notebookUri2 = path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook2.ipynb');

			let isNotebook1Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri1);
			let isNotebook2Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri2);

			should(isNotebook1Trusted).be.true('Notebook 1 should be trusted');
			should(isNotebook2Trusted).be.true('Notebook 2 should be trusted');

		});

		it('should NOT trust a notebook in an untrusted book in a folder', async () => {
			let notebookUri = path.join(path.sep, 'temp', 'SubFolder2', 'content', 'sample', 'notebook.ipynb');
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false('Notebook should be trusted');
		});

		it('should trust notebook after book has been added to a folder', async () => {
			let notebookUri = path.join(path.sep, 'temp', 'SubFolder2', 'content', 'sample', 'notebook.ipynb');
			let isNotebookTrustedBeforeChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedBeforeChange).be.false('Notebook should NOT be trusted');

			bookTrustManager.setBookAsTrusted('/temp/SubFolder2/');

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.true('Notebook should be trusted');
		});

		it('should NOT trust a notebook when untrusting a book in folder', async () => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');
			let notebookUri = path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook.ipynb');
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.true('Notebook should be trusted');

			trustedFolders = [];

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.false('Notebook should not be trusted after book removal');
		});

		it('should NOT trust an unknown book', async () => {
			let notebookUri = path.join(path.sep, 'randomfolder', 'randomsubfolder', 'content', 'randomnotebook.ipynb');
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false('Random notebooks should not be trusted');
		});

		it('should NOT trust notebook inside trusted subfolder when absent in table of contents ', async () => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');

			let notebookUri = path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notInToc.ipynb');
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false('Notebook should NOT be trusted');
		});

	});
});
