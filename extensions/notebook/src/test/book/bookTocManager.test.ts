/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { IBookTocManager, BookTocManager } from '../../book/bookTocManager';
import { BookTreeItem, BookTreeItemFormat, BookTreeItemType } from '../../book/bookTreeItem';
import * as yaml from 'js-yaml';
import { BookModel } from '../../book/bookModel';
import * as sinon from 'sinon';
import { IJupyterBookSectionV2, JupyterBookSection } from '../../contracts/content';
import * as fs from 'fs';
import * as os from 'os';
import * as uuid from 'uuid';

describe('BookTocManagerTests', function () {

	describe('CreatingBooks', () => {
		let bookTocManager: IBookTocManager;
		let notebooks: string[];
		let books: BookModel[];
		let tableOfContents: JupyterBookSection;
		let rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
		let bookFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
		afterEach(function (): void {
			sinon.restore();
		});

		beforeEach(() => {
			notebooks = ['/temp/SubFolder/notebook1.ipynb', '/temp/SubFolder/notebook2.ipynb', '/temp/SubFolder/notebook3.ipynb'];
			let subsections: IJupyterBookSectionV2[] = [];
			notebooks.forEach(nb => {
				subsections.push({
					title: path.parse(nb).name,
					file: path.parse(nb).name
				});
			});

			tableOfContents = {
				title: 'index',
				file: 'index',
				expand_sections: true,
				sections: subsections
			}

			// Mock Book Data
			let bookTreeItemFormat1: BookTreeItemFormat = {
				contentPath: path.join(rootFolderPath, 'index.md'),
				root: rootFolderPath,
				tableOfContents: {
					sections: [
						{
							file: path.join(path.sep, 'notebook1'),
							title: path.join(path.sep, 'notebook1')
						},
						{
							file: path.join(path.sep, 'notebook2'),
							title: path.join(path.sep, 'notebook2')
						},
						{
							file: path.join(path.sep, 'notebook3'),
							title: path.join(path.sep, 'notebook3')
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
			bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(path.join(path.sep, 'temp', 'SubFolder', 'notebook1.ipynb')))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
			bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(path.join(path.sep, 'temp', 'SubFolder', 'notebook2.ipynb')))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
			bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isValue(path.join(path.sep, 'temp', 'SubFolder2', 'notebook3.ipynb')))).returns((uri: string) => TypeMoq.Mock.ofType<BookTreeItem>().object);
			bookModel1Mock.setup(model => model.getNotebook(TypeMoq.It.isAnyString())).returns((uri: string) => undefined);

			books = [bookModel1Mock.object];
			bookTocManager = new BookTocManager();
		});

		it('should create a table of contents for a given folder', async () => {
			bookTocManager.createBook(bookFolderPath, rootFolderPath);
			let file = await fs.promises.readFile(path.join(bookFolderPath, '_toc.yml'), 'utf8');
			let toc = yaml.safeLoad(file);
			console.log(toc);
			should(toc).be.equal(tableOfContents);
		});

		it('all notebooks should be in the toc', async () => {
			if (books) {

			}

		});

		it('should ignore invalid file extensions', async () => {
		});

		it('if the bookPath already exists then it will ask to overwrite', async () => {
		});

		it('should have subsections in TOC if there are subfolders', async () => {
		});

		it('the created book should open in ADS', async () => {
		});
	});
});
