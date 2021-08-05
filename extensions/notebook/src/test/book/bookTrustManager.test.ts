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
		let runs = [
			{
				it: 'using the jupyter-book legacy version < 0.7.0',
				book1: {
					'notebook1': path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook.ipynb'),
					'notebook2': path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook2.ipynb'),
					'notebook3': path.join(path.sep, 'temp', 'SubFolder2', 'content', 'sample', 'notebook.ipynb'),
					'notInTocNb': path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notInToc.ipynb')
				},
				book2: {
					'notebook1': path.join(path.sep, 'temp2', 'SubFolder', 'content', 'sample', 'notebook.ipynb')
				},
				unknownBook: {
					'unknownNotebook': path.join(path.sep, 'randomfolder', 'randomsubfolder', 'content', 'randomnotebook.ipynb')
				}
			}, {
				it: 'using jupyter-book versions >= 0.7.0',
				book1: {
					'notebook1': path.join(path.sep, 'temp', 'SubFolder', 'sample', 'notebook.ipynb'),
					'notebook2': path.join(path.sep, 'temp', 'SubFolder', 'sample', 'notebook2.ipynb'),
					'notebook3': path.join(path.sep, 'temp', 'SubFolder2', 'sample', 'notebook.ipynb'),
					'notInTocNb': path.join(path.sep, 'temp', 'SubFolder', 'sample', 'notInToc.ipynb')
				},
				book2: {
					'notebook1': path.join(path.sep, 'temp2', 'SubFolder', 'sample', 'notebook.ipynb')
				},
				unknownBook: {
					'unknownNotebook': path.join(path.sep, 'randomfolder', 'randomsubfolder', 'randomnotebook.ipynb')
				}
			}
		];
		runs.forEach(function (run) {
			describe('Trusting in Workspaces ' + run.it, function (): void {

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
					bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(run.book1.notebook1))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
					bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(run.book1.notebook2))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
					bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(run.book1.notebook3))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
					bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isAnyString())).returns((uri: string) => undefined);

					let bookModel2Mock: TypeMoq.IMock<BookModel> = TypeMoq.Mock.ofType<BookModel>();
					bookModel2Mock.setup(model => model.bookItems).returns(() => [new BookTreeItem(bookTreeItemFormat3, undefined)]);
					bookModel2Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(run.book2.notebook1))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
					bookModel2Mock.setup(model => model.getNotebook(TypeMoq.It.isAnyString())).returns((uri: string) => undefined);

					books = [bookModel1Mock.object, bookModel2Mock.object];

					bookTrustManager = new BookTrustManager(books);
				});

				it('should trust notebooks in a trusted book within a workspace', async () => {
					let notebookUri1 = run.book1.notebook1;
					let notebookUri2 = run.book1.notebook2;

					let isNotebook1Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri1);
					let isNotebook2Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri2);

					should(isNotebook1Trusted).be.true('Notebook 1 should be trusted');
					should(isNotebook2Trusted).be.true('Notebook 2 should be trusted');
				});

				it('should NOT trust a notebook in an untrusted book within a workspace', async () => {
					let notebookUri = run.book1.notebook3;
					let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrusted).be.false('Notebook should not be trusted');
				});

				it('should trust notebook after book has been trusted within a workspace', async () => {
					let notebookUri = run.book1.notebook3;
					let isNotebookTrustedBeforeChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrustedBeforeChange).be.false('Notebook should NOT be trusted');

					// add another book subfolder
					bookTrustManager.setBookAsTrusted('/SubFolder2/', true);

					let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrustedAfterChange).be.true('Notebook should be trusted');
				});

				it('should NOT trust a notebook when untrusting a book within a workspace', async () => {
					let notebookUri = run.book1.notebook1;
					let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrusted).be.true('Notebook should be trusted');

					// remove trusted subfolders
					trustedSubFolders = [];

					let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrustedAfterChange).be.false('Notebook should not be trusted after book removal');
				});

				it('should NOT trust an unknown book within a workspace', async () => {
					let notebookUri = run.unknownBook.unknownNotebook;
					let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrusted).be.false('Random notebooks should not be trusted');
				});

				it('should NOT trust notebook inside trusted subfolder when absent in table of contents ', async () => {
					bookTrustManager.setBookAsTrusted('/temp/SubFolder/', true);

					let notebookUri = run.book1.notInTocNb;
					let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrusted).be.false('Notebook should NOT be trusted');
				});
			});
		});
	});



	describe('TrustingInFolder', () => {

		let bookTrustManager: IBookTrustManager;
		let books: BookModel[];
		let trustedFolders: string[] = [];

		let runs = [
			{
				it: 'using the jupyter-book legacy version < 0.7.0',
				book1: {
					'notebook1': path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook.ipynb'),
					'notebook2': path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notebook2.ipynb'),
					'notInTocNb': path.join(path.sep, 'temp', 'SubFolder', 'content', 'sample', 'notInToc.ipynb')
				},
				book2: {
					'notebook1': path.join(path.sep, 'temp', 'SubFolder2', 'content', 'sample', 'notebook.ipynb'),
					'notebook2': path.join(path.sep, 'temp', 'SubFolder2', 'content', 'sample', 'notebook2.ipynb')
				},
				unknownBook: {
					'unknownNotebook': path.join(path.sep, 'randomfolder', 'randomsubfolder', 'content', 'randomnotebook.ipynb')
				}
			}, {
				it: 'using jupyter-book versions >= 0.7.0',
				book1: {
					'notebook1': path.join(path.sep, 'temp', 'SubFolder', 'sample', 'notebook.ipynb'),
					'notebook2': path.join(path.sep, 'temp', 'SubFolder', 'sample', 'notebook2.ipynb'),
					'notInTocNb': path.join(path.sep, 'temp', 'SubFolder', 'sample', 'notInToc.ipynb')
				},
				book2: {
					'notebook1': path.join(path.sep, 'temp', 'SubFolder2', 'sample', 'notebook.ipynb'),
					'notebook2': path.join(path.sep, 'temp', 'SubFolder2', 'sample', 'notebook2.ipynb')
				},
				unknownBook: {
					'unknownNotebook': path.join(path.sep, 'randomfolder', 'randomsubfolder', 'randomnotebook.ipynb')
				}
			}
		];
		runs.forEach(function (run) {
			describe('Trusting in Workspaces ' + run.it, function (): void {
				beforeEach(() => {
					trustedFolders = [];
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
					bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(run.book1.notebook1))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
					bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(run.book1.notebook2))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
					bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isAnyString())).returns((uri: string) => undefined);

					let bookModel2Mock: TypeMoq.IMock<BookModel> = TypeMoq.Mock.ofType<BookModel>();
					bookModel2Mock.setup(model => model.bookItems).returns(() => [new BookTreeItem(bookTreeItemFormat2, undefined)]);
					bookModel2Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(run.book2.notebook1))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
					bookModel2Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(run.book2.notebook2))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
					bookModel2Mock.setup(model => model.getNotebook(TypeMoq.It.isAnyString())).returns((uri: string) => undefined);

					books = [bookModel1Mock.object, bookModel2Mock.object];

					bookTrustManager = new BookTrustManager(books);
				});

				it('should trust notebooks in a trusted book in a folder', async () => {
					bookTrustManager.setBookAsTrusted('/temp/SubFolder/', true);

					let notebookUri1 = run.book1.notebook1;
					let notebookUri2 = run.book1.notebook2;

					let isNotebook1Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri1);
					let isNotebook2Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri2);

					should(isNotebook1Trusted).be.true('Notebook 1 should be trusted');
					should(isNotebook2Trusted).be.true('Notebook 2 should be trusted');

				});

				it('should NOT trust a notebook in an untrusted book in a folder', async () => {
					//Set book as not trusted before running test
					bookTrustManager.setBookAsTrusted('/temp/SubFolder2/', false);

					let notebookUri = run.book2.notebook1;
					let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrusted).be.false('Notebook not should be trusted');
				});

				it('should trust notebook after book has been added to a folder @UNSTABLE@', async () => {
					let notebookUri = run.book2.notebook1;
					let isNotebookTrustedBeforeChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrustedBeforeChange).be.false('Notebook should NOT be trusted');

					bookTrustManager.setBookAsTrusted('/temp/SubFolder2/', true);

					let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrustedAfterChange).be.true('Notebook should be trusted');
				});

				it('should NOT trust a notebook when removing all books from folders', async () => {
					bookTrustManager.setBookAsTrusted('/temp/SubFolder/', true);
					bookTrustManager.setBookAsTrusted('/temp/SubFolder2/', true);
					let notebookUri = run.book1.notebook1;
					let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);
					let notebook2Uri = run.book2.notebook1;
					let isNotebook2Trusted = bookTrustManager.isNotebookTrustedByDefault(notebook2Uri);

					should(isNotebookTrusted).be.true('Notebook should be trusted');
					should(isNotebook2Trusted).be.true('Notebook2 should be trusted');

					trustedFolders = [];

					let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);
					let isNotebook2TrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebook2Uri);

					should(isNotebookTrustedAfterChange).be.false('Notebook should not be trusted after book removal');
					should(isNotebook2TrustedAfterChange).be.false('Notebook2 should not be trusted after book removal');
				});

				it('should NOT trust an unknown book', async () => {
					let notebookUri = run.unknownBook.unknownNotebook;
					let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrusted).be.false('Random notebooks should not be trusted');
				});

				it('should NOT trust notebook inside trusted subfolder when absent in table of contents ', async () => {
					bookTrustManager.setBookAsTrusted('/temp/SubFolder/', true);

					let notebookUri = run.book1.notInTocNb;
					let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

					should(isNotebookTrusted).be.false('Notebook should NOT be trusted');
				});
			});
		});
	});
});
