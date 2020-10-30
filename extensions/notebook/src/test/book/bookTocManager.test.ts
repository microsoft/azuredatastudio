/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import { BookTocManager, hasSections } from '../../book/bookTocManager';
import { BookTreeItem, BookTreeItemFormat, BookTreeItemType } from '../../book/bookTreeItem';
import * as yaml from 'js-yaml';
import * as sinon from 'sinon';
import { IJupyterBookSectionV1, IJupyterBookSectionV2, JupyterBookSection } from '../../contracts/content';
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
	let equalFiles = ((actualSection as IJupyterBookSectionV1).url === (expectedSection as IJupyterBookSectionV1).url || (actualSection as IJupyterBookSectionV2).file === (expectedSection as IJupyterBookSectionV2).file);
	if (actualSection.title === expectedSection.title && equalFiles &&
		hasSections(actualSection) && hasSections(expectedSection)) {
		for (const [index, section] of actualSection.sections.entries()) {
			equalSections(section, expectedSection.sections[index]);
		}
	} else {
		return false;
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
		let rootBookFolderPath: string = path.join(os.tmpdir(), uuid.v4(), 'Book');
		let rootSectionFolderPath: string = path.join(os.tmpdir(), uuid.v4(), 'BookSection');
		let rootSection2FolderPath: string = path.join(os.tmpdir(), uuid.v4(), 'BookSection2');
		let notebookFolder: string = path.join(os.tmpdir(), uuid.v4(), 'Notebook');
		let bookTocManager: BookTocManager;

		let runs = [
			{
				it: 'using the jupyter-book legacy version < 0.7.0',
				version: 'v1',
				url: 'file',
				book: {
					'rootBookFolderPath': rootBookFolderPath,
					'bookContentFolderPath': path.join(rootBookFolderPath, 'content', 'sample'),
					'bookDataFolderPath': path.join(rootBookFolderPath, '_data'),
					'notebook1': path.join(rootBookFolderPath, 'content', 'notebook'),
					'notebook2': path.join(rootBookFolderPath, 'content', 'notebook2'),
					'tocPath': path.join(rootBookFolderPath, '_data', 'toc.yml')
				},
				bookSection1: {
					'contentPath': path.join(rootSectionFolderPath, 'content', 'sample', 'readme.md'),
					'sectionRoot': rootSectionFolderPath,
					'sectionName': 'Sample',
					'bookContentFolderPath': path.join(rootSectionFolderPath, 'content', 'sample'),
					'bookDataFolderPath': path.join(rootSectionFolderPath, '_data'),
					'notebook3': path.join(rootSectionFolderPath, 'content', 'sample', 'notebook3'),
					'notebook4': path.join(rootSectionFolderPath, 'content', 'sample', 'notebook4'),
					'tocPath': path.join(rootSectionFolderPath, '_data', 'toc.yml')
				},
				bookSection2: {
					'contentPath': path.join(rootSection2FolderPath, 'content', 'test', 'readme.md'),
					'sectionRoot': rootSection2FolderPath,
					'sectionName': 'Test',
					'bookContentFolderPath': path.join(rootSection2FolderPath, 'content', 'test'),
					'bookDataFolderPath': path.join(rootSection2FolderPath, '_data'),
					'notebook5': path.join(rootSection2FolderPath, 'content', 'test', 'notebook5'),
					'notebook6': path.join(rootSection2FolderPath, 'content', 'test', 'notebook6'),
					'tocPath': path.join(rootSection2FolderPath, '_data', 'toc.yml')
				},
				notebook: {
					'contentPath': path.join(notebookFolder, 'test', 'readme.md')
				},
				section: [
					{
						'title': 'Notebook',
						'url': path.join(path.sep, 'notebook')
					},
					{
						'title': 'Notebook 2',
						'url': path.join(path.sep, 'notebook2')
					}
				],
				section1: [
					{
						'title': 'Notebook 3',
						'url': path.join('sample', 'notebook3')
					},
					{
						'title': 'Notebook 4',
						'url': path.join('sample', 'notebook4')
					}
				],
				section2: [
						{
							'title': 'Notebook 5',
							'url': path.join(path.sep, 'test', 'notebook5')
						},
						{
							'title': 'Notebook 6',
							'url': path.join(path.sep, 'test', 'notebook6')
						}
					]
			}, {
				it: 'using jupyter-book versions >= 0.7.0',
				version: 'v2',
				url: 'file',
				book: {
					'bookContentFolderPath': path.join(rootBookFolderPath, 'sample'),
					'rootBookFolderPath': rootBookFolderPath,
					'notebook1': path.join(rootBookFolderPath, 'notebook'),
					'notebook2': path.join(rootBookFolderPath, 'notebook2'),
					'tocPath': path.join(rootBookFolderPath, '_toc.yml')
				},
				bookSection1: {
					'bookContentFolderPath': path.join(rootSectionFolderPath, 'sample'),
					'contentPath': path.join(rootSectionFolderPath, 'sample', 'readme.md'),
					'sectionRoot': rootSectionFolderPath,
					'sectionName': 'Sample',
					'notebook3': path.join(rootSectionFolderPath, 'sample', 'notebook3'),
					'notebook4': path.join(rootSectionFolderPath, 'sample', 'notebook4'),
					'tocPath': path.join(rootSectionFolderPath, '_toc.yml')
				},
				bookSection2: {
					'bookContentFolderPath': path.join(rootSection2FolderPath, 'test'),
					'contentPath': path.join(rootSection2FolderPath, 'test', 'readme.md'),
					'sectionRoot': rootSection2FolderPath,
					'sectionName': 'Test',
					'notebook5': path.join(rootSection2FolderPath, 'test', 'notebook5'),
					'notebook6': path.join(rootSection2FolderPath, 'test', 'notebook6'),
					'tocPath': path.join(rootSection2FolderPath, '_toc.yml')
				},
				notebook: {
					'contentPath': path.join(notebookFolder, 'test', 'readme.md')
				},
				section: [
					{
						'title': 'Notebook',
						'file': path.join(path.sep, 'notebook')
					},
					{
						'title': 'Notebook 2',
						'file': path.join(path.sep, 'notebook2')
					}
				],
				section1: [
					{
						'title': 'Notebook 3',
						'file': path.join('sample', 'notebook3')
					},
					{
						'title': 'Notebook 4',
						'file': path.join('sample', 'notebook4')
					}
				],
				section2: [
						{
							'title': 'Notebook 5',
							'file': path.join(path.sep, 'test', 'notebook5')
						},
						{
							'title': 'Notebook 6',
							'file': path.join(path.sep, 'test', 'notebook6')
						}
					]
			}
		];

		runs.forEach(function (run) {
			describe('Editing Books ' + run.it, function (): void {
				beforeEach(async () => {
					let bookTreeItemFormat1: BookTreeItemFormat = {
						contentPath: run.version === 'v1' ? path.join(run.book.rootBookFolderPath, 'content', 'index.md') : path.join(run.book.rootBookFolderPath, 'index.md'),
						root: run.book.rootBookFolderPath,
						tableOfContents: {
							sections: run.section
						},
						isUntitled: undefined,
						title: undefined,
						treeItemCollapsibleState: undefined,
						type: BookTreeItemType.Book,
						version: run.version,
						page: run.section
					};

					let bookTreeItemFormat2: BookTreeItemFormat = {
						title: run.bookSection1.sectionName,
						contentPath: run.bookSection1.contentPath,
						root: run.bookSection1.sectionRoot,
						tableOfContents: {
							sections: run.section1
						},
						isUntitled: undefined,
						treeItemCollapsibleState: undefined,
						type: BookTreeItemType.Book,
						version: run.version,
						page: run.section1
					};

					let bookTreeItemFormat3: BookTreeItemFormat = {
						title: run.bookSection2.sectionName,
						contentPath: run.bookSection2.contentPath,
						root: run.bookSection2.sectionRoot,
						tableOfContents: {
							sections: run.section2
						},
						isUntitled: undefined,
						treeItemCollapsibleState: undefined,
						type: BookTreeItemType.Book,
						version: run.version,
						page: run.section2
					};

					let bookTreeItemFormat4: BookTreeItemFormat = {
						title: run.bookSection2.sectionName,
						contentPath: run.notebook.contentPath,
						root: run.bookSection2.sectionRoot,
						tableOfContents: {
							sections: undefined
						},
						isUntitled: undefined,
						treeItemCollapsibleState: undefined,
						type: BookTreeItemType.Notebook,
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


					await fs.promises.mkdir(run.book.bookContentFolderPath, { recursive: true });
					await fs.promises.mkdir(run.bookSection1.bookContentFolderPath, { recursive: true });
					await fs.promises.mkdir(run.bookSection2.bookContentFolderPath, { recursive: true });
					await fs.promises.mkdir(path.dirname(run.notebook.contentPath), { recursive: true });

					if (run.book.bookDataFolderPath && run.bookSection1.bookDataFolderPath && run.bookSection2.bookDataFolderPath) {
						await fs.promises.mkdir(run.book.bookDataFolderPath, { recursive: true });
						await fs.promises.mkdir(run.bookSection1.bookDataFolderPath, { recursive: true });
						await fs.promises.mkdir(run.bookSection2.bookDataFolderPath, { recursive: true });
					}
					await fs.writeFile(run.book.notebook1, '');
					await fs.writeFile(run.book.notebook2, '');
					await fs.writeFile(run.bookSection1.notebook3, '');
					await fs.writeFile(run.bookSection1.notebook4, '');
					await fs.writeFile(run.bookSection2.notebook5, '');
					await fs.writeFile(run.bookSection2.notebook6, '');
					await fs.writeFile(run.notebook.contentPath, '');
				});

				it('Add section to book', async () => {
					await bookTocManager.updateBook(bookSection, book);
					const listFiles = await fs.promises.readdir(run.book.bookContentFolderPath);
					const tocFile = await fs.promises.readFile(run.book.tocPath, 'utf8');
					let toc = yaml.safeLoad(tocFile);
					should(JSON.stringify(listFiles)).be.equal(JSON.stringify(['notebook3', 'notebook4']), 'The files of the section should be moved to the books folder');
					should(equalSections(toc.sections[2], bookTocManager.newSection)).be.true;
				});

				it('Add section to section', async () => {
					await bookTocManager.updateBook(bookSection, bookSection2);
					let listFiles = await fs.promises.readdir(path.join(run.bookSection2.bookContentFolderPath, 'sample'));
					const tocFile = await fs.promises.readFile(path.join(run.bookSection2.tocPath), 'utf8');
					let toc = yaml.safeLoad(tocFile);
					should(JSON.stringify(listFiles)).be.equal(JSON.stringify(['notebook3', 'notebook4']), 'The files of the section should be moved to the books folder');
					should(equalSections(toc[1].sections, bookTocManager.newSection)).be.true;
				});

				it('Add notebook to book', async () => {
					await bookTocManager.updateBook(notebook, book);
					const folder = run.version === 'v1' ? path.join(run.book.rootBookFolderPath, 'content') : path.join(run.book.rootBookFolderPath);
					let listFiles = await fs.promises.readdir(folder);
					const tocFile = await fs.promises.readFile(run.book.tocPath, 'utf8');
					let toc = yaml.safeLoad(tocFile);
					should(listFiles.findIndex(f => f === 'readme.md')).not.equal(-1);
					should(equalSections(toc.sections[2], bookTocManager.newSection)).be.true;
				});
			});
		});
	});
});
