/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import * as constants from '../../common/constants';
import { IBookPinManager, BookPinManager } from '../../book/bookPinManager';
import { BookTreeItem, BookTreeItemFormat } from '../../book/bookTreeItem';
import * as vscode from 'vscode';
import { BookModel } from '../../book/bookModel';
import * as sinon from 'sinon';
import { isBookItemPinned, BookTreeItemType } from '../../common/utils';

describe('BookPinManagerTests', function () {

	describe('PinningNotebooks', () => {
		let bookPinManager: IBookPinManager;
		let pinnedNotebooks: string[];
		let books: BookModel[];

		afterEach(function (): void {
			sinon.restore();
		});

		beforeEach(() => {
			pinnedNotebooks = ['/temp/SubFolder/content/sample/notebook1.ipynb', '/temp/SubFolder/content/sample/notebook2.ipynb'];

			// Mock Workspace Configuration
			let workspaceConfigurtionMock: TypeMoq.IMock<vscode.WorkspaceConfiguration> = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			workspaceConfigurtionMock.setup(config => config.get(TypeMoq.It.isValue(constants.pinnedBooksConfigKey))).returns(() => [].concat(pinnedNotebooks));
			workspaceConfigurtionMock.setup(config => config.update(TypeMoq.It.isValue(constants.pinnedBooksConfigKey), TypeMoq.It.isAny(), TypeMoq.It.isValue(false))).returns((key: string, newValues: string[]) => {
				pinnedNotebooks.splice(0, pinnedNotebooks.length, ...newValues);
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
				contentPath: '/temp/SubFolder/content/sample/notebook1.ipynb',
				root: '/temp/SubFolder/',
				tableOfContents: {
					sections: [
						{
							url: path.join(path.sep, 'sample', 'notebook1')
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
				contentPath: '/temp/SubFolder2/content/sample/notebook.ipynb',
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
				contentPath: '/temp2/SubFolder3/content/sample/notebook.ipynb',
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

			bookPinManager = new BookPinManager();
		});

		it('should have notebooks in the pinnedBooksConfigKey when pinned within a workspace', async () => {
			let notebookUri1 = books[0].bookItems[0].book.contentPath;

			let isNotebook1Pinned = isBookItemPinned(notebookUri1);

			should(isNotebook1Pinned).be.true('Notebook 1 should be pinned');
		});

		it('should NOT pin a notebook that is not pinned within a workspace', async () => {
			let notebookUri = path.join(path.sep, 'temp', 'SubFolder2', 'content', 'sample', 'notebook.ipynb');
			let isNotebookPinned = isBookItemPinned(notebookUri);

			should(isNotebookPinned).be.false('Notebook should not be pinned');
		});

		it('should pin notebook after book has been pinned from viewlet within a workspace', async () => {
			let notebookUri = books[0].bookItems[1].book.contentPath;

			let isNotebookPinnedBeforeChange = isBookItemPinned(notebookUri);
			should(isNotebookPinnedBeforeChange).be.false('Notebook should NOT be pinned');

			// mock pin book item from viewlet
			await bookPinManager.pinNotebook(books[0].bookItems[1]);

			let isNotebookPinnedAfterChange = isBookItemPinned(notebookUri);
			should(isNotebookPinnedAfterChange).be.true('Notebook should be pinned');
		});

		it('should NOT pin a notebook when unpinned from viewlet within a workspace', async () => {
			let notebookUri = books[0].bookItems[0].book.contentPath;
			let isNotebookPinned = isBookItemPinned(notebookUri);

			should(isNotebookPinned).be.true('Notebook should be pinned');

			await bookPinManager.unpinNotebook(books[0].bookItems[0]);
			let isNotebookPinnedAfterChange = isBookItemPinned(notebookUri);

			should(isNotebookPinnedAfterChange).be.false('Notebook should not be pinned after notebook is unpinned');
		});
	});
});
