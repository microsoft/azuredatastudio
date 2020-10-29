/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import { BookTocManager } from '../../book/bookTocManager';
import { BookTreeItem, BookTreeItemFormat, BookTreeItemType } from '../../book/bookTreeItem';
//import * as yaml from 'js-yaml';
import * as sinon from 'sinon';
import { IJupyterBookSectionV2 } from '../../contracts/content';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as uuid from 'uuid';

export function equalTOC(actualToc: IJupyterBookSectionV2[], expectedToc: IJupyterBookSectionV2[]): boolean {
	for(let [i,section] of actualToc.entries()){
		if(section.title !== expectedToc[i].title || section.file !== expectedToc[i].file){
			return false;
		}
	}
	return true;
}

describe('BookTocManagerTests', function () {
	describe('CreatingBooks', () => {
		let notebooks: string[];
		let bookFolderPath: string;
		let rootFolderPath: string;
		let root2FolderPath: string;
		const subfolder = 'Subfolder'

		afterEach(function (): void {
			sinon.restore();
		});

		beforeEach(async () => {
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			bookFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			root2FolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			notebooks = ['notebook1.ipynb', 'notebook2.ipynb', 'notebook3.ipynb', 'index.md', 'readme.md'];

			await fs.mkdir(rootFolderPath);
			await fs.writeFile(path.join(rootFolderPath, notebooks[0]), '');
			await fs.writeFile(path.join(rootFolderPath, notebooks[1]), '');
			await fs.writeFile(path.join(rootFolderPath, notebooks[2]), '');
			await fs.writeFile(path.join(rootFolderPath, notebooks[3]), '');

			await fs.mkdir(root2FolderPath);
			await fs.mkdir(path.join(root2FolderPath, subfolder));
			await fs.writeFile(path.join(root2FolderPath, notebooks[0]), '');
			await fs.writeFile(path.join(root2FolderPath, subfolder, notebooks[1]), '');
			await fs.writeFile(path.join(root2FolderPath, subfolder, notebooks[2]), '');
			await fs.writeFile(path.join(root2FolderPath, subfolder, notebooks[4]), '');
			await fs.writeFile(path.join(root2FolderPath, notebooks[3]), '');
		});

		it('should create a table of contents with no sections if there are only notebooks in folder', async function (): Promise<void> {
			let bookTocManager: BookTocManager = new BookTocManager();
			await bookTocManager.createBook(bookFolderPath, rootFolderPath);
			let listFiles = await fs.promises.readdir(bookFolderPath);
			should(bookTocManager.tableofContents.length).be.equal(4);
			should(listFiles.length).be.equal(6);
		});

		it('should create a table of contents with sections if folder contains submodules', async () => {
			let bookTocManager: BookTocManager = new BookTocManager();
			let expectedSection: IJupyterBookSectionV2[] = [{
				title: 'notebook2',
				file: path.join(subfolder,'notebook2')
			},
			{
				title: 'notebook3',
				file: path.join(subfolder,'notebook3')
			}];
			await bookTocManager.createBook(bookFolderPath, root2FolderPath);
			should(equalTOC(bookTocManager.tableofContents[2].sections, expectedSection)).be.true;
			should(bookTocManager.tableofContents[2].file).be.equal(path.join(subfolder, 'readme'));
		});

		it('should ignore invalid file extensions', async () => {
			await fs.writeFile(path.join(rootFolderPath, 'test.txt'), '');
			let bookTocManager: BookTocManager = new BookTocManager();
			await bookTocManager.createBook(bookFolderPath, rootFolderPath);
			let listFiles = await fs.promises.readdir(bookFolderPath);
			should(bookTocManager.tableofContents.length).be.equal(4);
			should(listFiles.length).be.equal(7);
		});
	});

	describe('EditingBooks', () => {
		let bookItem : BookTreeItem;
		let bookItem2: BookTreeItem;

		afterEach(function (): void {
			sinon.restore();
		});

		beforeEach(() => {
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
				type: BookTreeItemType.Book,
				version: 'v1'
			};

			let bookTreeItemFormat2: BookTreeItemFormat = {
				contentPath: '/temp/SubFolder2/readme.md',
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
				type: BookTreeItemType.Markdown,
				version: 'v1'
			};

			bookItem = new BookTreeItem(bookTreeItemFormat1, undefined);
			bookItem2 = new BookTreeItem(bookTreeItemFormat2, undefined);
		});

		it('add notebook to book', async () => {
			bookItem.contextValue = 'savedBook';
			bookItem2.contextValue = 'section';
			let bookTocManager: BookTocManager = new BookTocManager();
			await bookTocManager.updateBook(bookItem2, bookItem);
		});
	});
});
