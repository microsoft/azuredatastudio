/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import { BookTocManager } from '../../book/bookTocManager';
import { BookTreeItem, BookTreeItemFormat, BookTreeItemType } from '../../book/bookTreeItem';
import * as yaml from 'js-yaml';
import * as sinon from 'sinon';
import { IJupyterBookSectionV2, JupyterBookSection } from '../../contracts/content';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as uuid from 'uuid';

export function equalTOC(actualToc: IJupyterBookSectionV2[], expectedToc: IJupyterBookSectionV2[]): boolean {
	for (let [i, section] of actualToc.entries()) {
		if (section.title !== expectedToc[i].title || section.file !== expectedToc[i].file) {
			return false;
		}
	}
	return true;
}

export function equalSections(actualSection: JupyterBookSection, expectedSection: JupyterBookSection): boolean {

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
				file: path.join(subfolder, 'notebook2')
			},
			{
				title: 'notebook3',
				file: path.join(subfolder, 'notebook3')
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
		let book: BookTreeItem;
		let bookSection: BookTreeItem;
		let bookSection2: BookTreeItem;
		let notebook: BookTreeItem;
		let rootBookFolderPath: string;
		let rootSectionFolderPath: string;
		let rootSection2FolderPath: string;
		let notebookContentPath: string;
		let bookTocManager: BookTocManager;

		afterEach(function (): void {
			sinon.restore();
		});

		beforeEach(async () => {
			rootBookFolderPath = path.join(os.tmpdir(), uuid.v4(), 'Book');
			rootSectionFolderPath = path.join(os.tmpdir(), uuid.v4(), 'BookSection');
			rootSection2FolderPath = path.join(os.tmpdir(), uuid.v4(), 'BookSection2');

			let bookTreeItemFormat1: BookTreeItemFormat = {
				contentPath: undefined,
				root: rootBookFolderPath,
				tableOfContents: {
					sections: [
						{
							url: path.join(path.sep, 'notebook')
						},
						{
							url: path.join(path.sep, 'notebook2')
						}
					]
				},
				isUntitled: undefined,
				title: undefined,
				treeItemCollapsibleState: undefined,
				type: BookTreeItemType.Book,
				version: 'v1',
				page: [
					{
						title: 'Notebook',
						url: path.join('notebook')
					},
					{
						title: 'Notebook 2',
						url: path.join('notebook2')
					}
				]
			};

			let bookTreeItemFormat2: BookTreeItemFormat = {
				title: 'Sample',
				contentPath: path.join(rootSectionFolderPath, 'content', 'sample', 'readme.md'),
				root: path.join(rootSectionFolderPath, 'content'),
				tableOfContents: {
					sections: [
						{
							url: path.join(path.sep, 'sample', 'notebook3')
						},
						{
							url: path.join(path.sep, 'sample', 'notebook4')
						}
					]
				},
				isUntitled: undefined,
				treeItemCollapsibleState: undefined,
				type: BookTreeItemType.Book,
				version: 'v1',
				page: [
					{
						title: 'Notebook 3',
						url: path.join('sample', 'notebook3')
					},
					{
						title: 'Notebook 4',
						url: path.join('sample', 'notebook4')
					}
				]
			};

			let bookTreeItemFormat3: BookTreeItemFormat = {
				title: 'Test',
				contentPath: path.join(rootSection2FolderPath, 'content', 'test', 'readme.md'),
				root: rootSection2FolderPath,
				tableOfContents: {
					sections: [
						{
							title: 'Test',
							url: path.join(path.sep, 'test', 'readme'),
							sections: [
								{
									url: path.join(path.sep, 'test', 'notebook5')
								},
								{
									url: path.join(path.sep, 'test', 'notebook6')
								}
							]
						},

					]
				},
				isUntitled: undefined,
				treeItemCollapsibleState: undefined,
				type: BookTreeItemType.Book,
				version: 'v1',
				page: [
					{
						title: 'Test',
						url: path.join(path.sep, 'test', 'readme'),
						sections: [
							{
								url: path.join(path.sep, 'test', 'notebook5')
							},
							{
								url: path.join(path.sep, 'test', 'notebook6')
							}
						]
					}
				]
			};

			let bookTreeItemFormat4: BookTreeItemFormat = {
				title: 'Test',
				contentPath: path.join(rootBookFolderPath, 'content', 'test', 'readme.md'),
				root: rootSection2FolderPath,
				tableOfContents: {
					sections: undefined
				},
				isUntitled: undefined,
				treeItemCollapsibleState: undefined,
				type: BookTreeItemType.Notebook,
				version: 'v1',
				page: {
					sections: undefined
				}
			};


			book = new BookTreeItem(bookTreeItemFormat1, undefined);
			bookSection = new BookTreeItem(bookTreeItemFormat2, undefined);
			bookSection2 = new BookTreeItem(bookTreeItemFormat3, undefined);
			notebook = new BookTreeItem(bookTreeItemFormat4, undefined);
			bookTocManager = new BookTocManager();

			bookSection.uri = path.join('sample', 'readme');
			bookSection2.uri = path.join('test', 'readme');

			book.contextValue = 'savedBook';
			bookSection.contextValue = 'section';
			bookSection2.contextValue = 'section';
			notebook.contextValue = 'savedNotebook';


			await fs.promises.mkdir(path.join(rootBookFolderPath, '_data'), { recursive: true });

			let content1Folder = path.join(rootBookFolderPath, 'content', 'sample');
			let content2Folder = path.join(rootSectionFolderPath, 'content', 'sample');
			let content3Folder = path.join(rootSection2FolderPath, 'content', 'test');
			await fs.promises.mkdir(content1Folder, { recursive: true });
			await fs.promises.mkdir(content2Folder, { recursive: true });
			await fs.promises.mkdir(content3Folder, { recursive: true });
			await fs.promises.mkdir(path.dirname(notebook.book.contentPath), { recursive: true });
			await fs.promises.mkdir(path.join(rootSection2FolderPath, '_data'), { recursive: true });
			await fs.writeFile(path.join(content2Folder, 'notebook3'), '');
			await fs.writeFile(path.join(content2Folder, 'notebook4'), '');
			await fs.writeFile(path.join(content3Folder, 'readme'), '');
			await fs.writeFile(notebook.book.contentPath, '');
		});

		it('Add section to book', async () => {
			await bookTocManager.updateBook(bookSection, book);
			let content = path.join(rootBookFolderPath, 'content', 'sample');
			const listFiles = await fs.promises.readdir(content);
			const tocFile = await fs.promises.readFile(path.join(rootBookFolderPath, '_data', 'toc.yml'), 'utf8');
			let toc = yaml.safeLoad(tocFile);
			should(JSON.stringify(listFiles)).be.equal(JSON.stringify(['notebook3', 'notebook4']), 'The files of the section should be moved to the books folder');
			should(toc.sections[2].title).be.equal(bookTocManager.newSection.title, 'The tableOfContents of the book should include the new section');
		});

		it('Add section to section', async () => {
			await bookTocManager.updateBook(bookSection, bookSection2);
			let content3Folder = path.join(rootSection2FolderPath, 'content', 'test', 'sample');
			let listFiles = await fs.promises.readdir(content3Folder);
			const tocFile = await fs.promises.readFile(path.join(rootSection2FolderPath, '_data', 'toc.yml'), 'utf8');
			let toc = yaml.safeLoad(tocFile);
			should(JSON.stringify(listFiles)).be.equal(JSON.stringify(['notebook3', 'notebook4']), 'The files of the section should be moved to the books folder');
			should(toc[0].sections[2].title).be.equal(bookTocManager.newSection.title, 'The tableOfContents of the book should include the new section');
		});

		it('Add notebook to book', async () => {
			await bookTocManager.updateBook(notebook, book);
			let content = path.join(rootBookFolderPath, 'content');
			let listFiles = await fs.promises.readdir(content);
			const tocFile = await fs.promises.readFile(path.join(rootBookFolderPath, '_data', 'toc.yml'), 'utf8');
			let toc = yaml.safeLoad(tocFile);
			should(listFiles.findIndex(f => f === 'readme.md')).not.be.equal(-1);
			should(toc.sections[2].title).be.equal(bookTocManager.newSection.title, 'The tableOfContents of the book should include the new notebook');
		});


	});
});
