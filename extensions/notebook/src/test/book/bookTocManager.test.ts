/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as should from 'should';
import * as path from 'path';
import { BookTocManager, hasSections, quickPickResults } from '../../book/bookTocManager';
import { BookTreeItem, BookTreeItemFormat, BookTreeItemType } from '../../book/bookTreeItem';
import * as sinon from 'sinon';
import { IJupyterBookSectionV1, IJupyterBookSectionV2, JupyterBookSection } from '../../contracts/content';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as uuid from 'uuid';
import { exists } from '../../common/utils';
import * as rimraf from 'rimraf';
import { promisify } from 'util';
import { BookModel } from '../../book/bookModel';
import { MockExtensionContext } from '../common/stubs';
import { BookTreeViewProvider } from '../../book/bookTreeView';
import { NavigationProviders } from '../../common/constants';
import * as loc from '../../common/localizedConstants';

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
			should((bookTocManager.tableofContents[2] as IJupyterBookSectionV2).file).be.equal(path.join(subfolder, 'readme'));
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
		let bookTocManager: BookTocManager;
		let sourceBookModel: BookModel;
		let targetBookModel: BookModel;
		let targetBook: BookTreeItem;
		let sectionC: BookTreeItem;
		let sectionA: BookTreeItem;
		let sectionB: BookTreeItem;
		let notebook: BookTreeItem;
		let duplicatedNotebook: BookTreeItem;
		let sourceBookFolderPath: string = path.join(os.tmpdir(), uuid.v4(), 'sourceBook');
		let targetBookFolderPath: string = path.join(os.tmpdir(), uuid.v4(), 'targetBook');
		let duplicatedNotebookPath: string = path.join(os.tmpdir(), uuid.v4(), 'duplicatedNotebook');
		let runs = [
			{
				it: 'using the jupyter-book legacy version < 0.7.0',
				version: 'v1',
				sourceBook: {
					'rootBookFolderPath': sourceBookFolderPath,
					'bookContentFolderPath': path.join(sourceBookFolderPath, 'content'),
					'tocPath': path.join(sourceBookFolderPath, '_data', 'toc.yml'),
					'readme': path.join(sourceBookFolderPath, 'content', 'readme.md'),
					'toc': [
						{
							'title': 'Notebook 1',
							'file': path.join(path.sep, 'sectionA', 'notebook1')
						},
						{
							'title': 'Notebook 2',
							'file': path.join(path.sep, 'sectionA', 'notebook2')
						}
					]
				},
				sectionA: {
					'contentPath': path.join(sourceBookFolderPath, 'content', 'sectionA', 'readme.md'),
					'sectionRoot': path.join(sourceBookFolderPath, 'content', 'sectionA'),
					'sectionName': 'Section A',
					'notebook1': path.join(sourceBookFolderPath, 'content', 'sectionA', 'notebook1.ipynb'),
					'notebook2': path.join(sourceBookFolderPath, 'content', 'sectionA', 'notebook2.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 1',
							'file': path.join(path.sep, 'sectionA', 'notebook1')
						},
						{
							'title': 'Notebook 2',
							'file': path.join(path.sep, 'sectionA', 'notebook2')
						}
					]
				},
				sectionB: {
					'contentPath': path.join(sourceBookFolderPath, 'content', 'sectionB', 'readme.md'),
					'sectionRoot': path.join(sourceBookFolderPath, 'content', 'sectionB'),
					'sectionName': 'Section B',
					'notebook3': path.join(sourceBookFolderPath, 'content', 'sectionB', 'notebook3.ipynb'),
					'notebook4': path.join(sourceBookFolderPath, 'content', 'sectionB', 'notebook4.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 3',
							'file': path.join(path.sep, 'sectionB', 'notebook3')
						},
						{
							'title': 'Notebook 4',
							'file': path.join(path.sep, 'sectionB', 'notebook4')
						}
					]
				},
				notebook5: {
					'contentPath': path.join(sourceBookFolderPath, 'content', 'notebook5.ipynb')
				},
				targetBook: {
					'rootBookFolderPath': targetBookFolderPath,
					'bookContentFolderPath': path.join(targetBookFolderPath, 'content'),
					'tocPath': path.join(targetBookFolderPath, '_data', 'toc.yml'),
					'readme': path.join(targetBookFolderPath, 'content', 'readme.md'),
					'toc': [
						{
							'title': 'Welcome page',
							'file': path.join(path.sep, 'readme'),
						},
						{
							'title': 'Section C',
							'file': path.join(path.sep, 'sectionC', 'readme'),
							'sections': [
								{
									'title': 'Notebook 6',
									'file': path.join(path.sep, 'sectionC', 'notebook6')
								}
							]
						}
					]
				},
				sectionC: {
					'contentPath': path.join(targetBookFolderPath, 'content', 'sectionC', 'readme.md'),
					'sectionRoot': path.join(targetBookFolderPath, 'content', 'sectionC'),
					'sectionName': 'Section C',
					'notebook6': path.join(targetBookFolderPath, 'content', 'sectionC', 'notebook6.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 6',
							'file': path.join(path.sep, 'sectionC', 'notebook6')
						}
					]
				}
			}, {
				it: 'using the jupyter-book legacy version >= 0.7.0',
				version: 'v2',
				sourceBook: {
					'rootBookFolderPath': sourceBookFolderPath,
					'bookContentFolderPath': sourceBookFolderPath,
					'tocPath': path.join(sourceBookFolderPath, '_toc.yml'),
					'readme': path.join(sourceBookFolderPath, 'readme.md')
				},
				sectionA: {
					'contentPath': path.join(sourceBookFolderPath, 'sectionA', 'readme.md'),
					'sectionRoot': path.join(sourceBookFolderPath, 'sectionA'),
					'sectionName': 'Section A',
					'notebook1': path.join(sourceBookFolderPath, 'sectionA', 'notebook1.ipynb'),
					'notebook2': path.join(sourceBookFolderPath, 'sectionA', 'notebook2.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 1',
							'file': path.join(path.sep, 'sectionA', 'notebook1')
						},
						{
							'title': 'Notebook 2',
							'file': path.join(path.sep, 'sectionA', 'notebook2')
						}
					]
				},
				sectionB: {
					'contentPath': path.join(sourceBookFolderPath, 'sectionB', 'readme.md'),
					'sectionRoot': path.join(sourceBookFolderPath, 'sectionB'),
					'sectionName': 'Section B',
					'notebook3': path.join(sourceBookFolderPath, 'sectionB', 'notebook3.ipynb'),
					'notebook4': path.join(sourceBookFolderPath, 'sectionB', 'notebook4.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 3',
							'file': path.join(path.sep, 'sectionB', 'notebook3')
						},
						{
							'title': 'Notebook 4',
							'file': path.join(path.sep, 'sectionB', 'notebook4')
						}
					]
				},
				notebook5: {
					'contentPath': path.join(sourceBookFolderPath, 'notebook5.ipynb')
				},
				targetBook: {
					'rootBookFolderPath': targetBookFolderPath,
					'bookContentFolderPath': targetBookFolderPath,
					'tocPath': path.join(targetBookFolderPath, '_toc.yml'),
					'readme': path.join(targetBookFolderPath, 'readme.md'),
					'toc': [
						{
							'title': 'Welcome',
							'file': path.join(path.sep, 'readme'),
						},
						{
							'title': 'Section C',
							'file': path.join(path.sep, 'sectionC', 'readme'),
							'sections': [
								{
									'title': 'Notebook 6',
									'file': path.join(path.sep, 'sectionC', 'notebook6')
								}
							]
						}
					]
				},
				sectionC: {
					'contentPath': path.join(targetBookFolderPath, 'sectionC', 'readme.md'),
					'sectionRoot': path.join(targetBookFolderPath, 'sectionC'),
					'sectionName': 'Section C',
					'notebook6': path.join(targetBookFolderPath, 'sectionC', 'notebook6.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 6',
							'file': path.join(path.sep, 'sectionC', 'notebook6')
						}
					]
				}
			}
		];

		runs.forEach(function (run) {
			describe('Editing Books ' + run.it, function (): void {
				beforeEach(async () => {
					let targetBookTreeItemFormat: BookTreeItemFormat = {
						contentPath: run.targetBook.readme,
						root: run.targetBook.rootBookFolderPath,
						tableOfContents: {
							sections: run.targetBook.toc
						},
						isUntitled: undefined,
						title: 'Target Book',
						treeItemCollapsibleState: undefined,
						type: BookTreeItemType.Book,
						version: run.version,
						page: run.targetBook.toc
					};

					let sectionCTreeItemFormat: BookTreeItemFormat = {
						title: run.sectionC.sectionName,
						contentPath: run.sectionC.contentPath,
						root: run.targetBook.rootBookFolderPath,
						tableOfContents: {
							sections: run.sectionC.sectionFormat
						},
						isUntitled: undefined,
						treeItemCollapsibleState: undefined,
						type: BookTreeItemType.Markdown,
						version: run.version,
						page: run.sectionC.sectionFormat
					};

					// section A is from source book
					let sectionATreeItemFormat: BookTreeItemFormat = {
						title: run.sectionA.sectionName,
						contentPath: run.sectionA.contentPath,
						root: run.sourceBook.rootBookFolderPath,
						tableOfContents: {
							sections: run.sectionA.sectionFormat
						},
						isUntitled: undefined,
						treeItemCollapsibleState: undefined,
						type: BookTreeItemType.Markdown,
						version: run.version,
						page: run.sectionA.sectionFormat
					};

					// section B is from source book
					let sectionBTreeItemFormat: BookTreeItemFormat = {
						title: run.sectionB.sectionName,
						contentPath: run.sectionB.contentPath,
						root: run.sourceBook.rootBookFolderPath,
						tableOfContents: {
							sections: run.sectionB.sectionFormat
						},
						isUntitled: undefined,
						treeItemCollapsibleState: undefined,
						type: BookTreeItemType.Markdown,
						version: run.version,
						page: run.sectionB.sectionFormat
					};

					// notebook5 is from source book
					let notebookTreeItemFormat: BookTreeItemFormat = {
						title: '',
						contentPath: run.notebook5.contentPath,
						root: run.sourceBook.rootBookFolderPath,
						tableOfContents: {
							sections: [
								{
									'title': 'Notebook 5',
									'file': path.join(path.sep, 'notebook5')
								}
							]
						},
						isUntitled: undefined,
						treeItemCollapsibleState: undefined,
						type: BookTreeItemType.Notebook,
						version: run.version,
						page: {
							sections: [
								{
									'title': 'Notebook 5',
									'file': path.join(path.sep, 'notebook5')
								}
							]
						}
					};

					let duplicatedNbTreeItemFormat: BookTreeItemFormat = {
						title: 'Duplicated Notebook',
						contentPath: path.join(duplicatedNotebookPath, 'notebook5.ipynb'),
						root: duplicatedNotebookPath,
						tableOfContents: {
							sections: [
								{
									'title': 'Notebook 5',
									'file': path.join(path.sep, 'notebook5')
								}
							]
						},
						isUntitled: undefined,
						treeItemCollapsibleState: undefined,
						type: BookTreeItemType.Notebook,
						version: run.version,
						page: {
							sections: [
								{
									'title': 'Notebook 5',
									'file': path.join(path.sep, 'notebook5')
								}
							]
						}
					};

					targetBook = new BookTreeItem(targetBookTreeItemFormat, undefined);
					sectionC = new BookTreeItem(sectionCTreeItemFormat, undefined);
					sectionA = new BookTreeItem(sectionATreeItemFormat, undefined);
					sectionB = new BookTreeItem(sectionBTreeItemFormat, undefined);
					notebook = new BookTreeItem(notebookTreeItemFormat, undefined);
					duplicatedNotebook = new BookTreeItem(duplicatedNbTreeItemFormat, undefined);


					sectionC.uri = path.join('sectionC', 'readme');
					sectionA.uri = path.join('sectionA', 'readme');
					sectionB.uri = path.join('sectionB', 'readme');

					targetBook.contextValue = 'savedBook';
					sectionA.contextValue = 'section';
					sectionB.contextValue = 'section';
					sectionC.contextValue = 'section';
					notebook.contextValue = 'savedNotebook';
					duplicatedNotebook.contextValue = 'savedNotebook';

					sectionC.tableOfContentsPath = run.targetBook.tocPath;
					sectionA.tableOfContentsPath = run.sourceBook.tocPath;
					sectionB.tableOfContentsPath = run.sourceBook.tocPath;
					notebook.tableOfContentsPath = run.sourceBook.tocPath;
					duplicatedNotebook.tableOfContentsPath = run.sourceBook.tocPath;

					sectionA.sections = run.sectionA.sectionFormat;
					sectionB.sections = run.sectionB.sectionFormat;
					sectionC.sections = run.sectionC.sectionFormat;
					notebook.sections = [
						{
							'title': 'Notebook 5',
							'file': path.join(path.sep, 'notebook5')
						}
					];
					duplicatedNotebook.sections = notebook.sections;

					await fs.promises.mkdir(run.targetBook.bookContentFolderPath, { recursive: true });
					await fs.promises.mkdir(run.sectionA.contentPath, { recursive: true });
					await fs.promises.mkdir(run.sectionB.contentPath, { recursive: true });
					await fs.promises.mkdir(run.sectionC.contentPath, { recursive: true });
					await fs.promises.mkdir(duplicatedNotebookPath, { recursive: true });

					await fs.writeFile(run.sectionA.notebook1, '');
					await fs.writeFile(run.sectionA.notebook2, '');
					await fs.writeFile(run.sectionB.notebook3, '');
					await fs.writeFile(run.sectionB.notebook4, '');
					await fs.writeFile(run.sectionC.notebook6, '');
					await fs.writeFile(run.notebook5.contentPath, '');
					await fs.writeFile(duplicatedNotebook.book.contentPath, '');
					await fs.writeFile(path.join(run.targetBook.rootBookFolderPath, '_config.yml'), 'title: Target Book');
					await fs.writeFile(path.join(run.sourceBook.rootBookFolderPath, '_config.yml'), 'title: Source Book');


					if (run.version === 'v1') {
						await fs.promises.mkdir(path.dirname(run.targetBook.tocPath), { recursive: true });
						await fs.promises.mkdir(path.dirname(run.sourceBook.tocPath), { recursive: true });
					}

					// target book
					await fs.writeFile(run.targetBook.tocPath, '- title: Welcome\n  file: /readme\n- title: Section C\n  file: /sectionC/readme\n  sections:\n  - title: Notebook6\n    file: /sectionC/notebook6');
					// source book
					await fs.writeFile(run.sourceBook.tocPath, '- title: Notebook 5\n  file: /notebook5\n- title: Section A\n  file: /sectionA/readme\n  sections:\n  - title: Notebook1\n    file: /sectionA/notebook1\n  - title: Notebook2\n    file: /sectionA/notebook2');

					const mockExtensionContext = new MockExtensionContext();

					sourceBookModel = new BookModel(run.sourceBook.rootBookFolderPath, false, false, mockExtensionContext, undefined);
					targetBookModel = new BookModel(run.targetBook.rootBookFolderPath, false, false, mockExtensionContext, undefined);
					// create book model mock objects
					sinon.stub(sourceBookModel, 'bookItems').value([sectionA]);
					sinon.stub(targetBookModel, 'bookItems').value([targetBook]);
				});


				it('Add section to book', async () => {
					bookTocManager = new BookTocManager(targetBookModel, sourceBookModel);
					await bookTocManager.updateBook(sectionA, targetBook, undefined);
					const listFiles = await fs.promises.readdir(path.join(run.targetBook.bookContentFolderPath, 'sectionA'));
					const listSourceFiles = await fs.promises.readdir(path.join(run.sourceBook.bookContentFolderPath));
					should(JSON.stringify(listSourceFiles).includes('sectionA')).be.false('The source book files should not contain the section A files');
					should(JSON.stringify(listFiles)).be.equal(JSON.stringify(['notebook1.ipynb', 'notebook2.ipynb', 'readme.md']), 'The files of the section should be moved to the target book folder');
				});

				it('Add section to section', async () => {
					bookTocManager = new BookTocManager(targetBookModel, sourceBookModel);
					await bookTocManager.updateBook(sectionB, sectionC, {
						'title': 'Notebook 6',
						'file': path.join(path.sep, 'sectionC', 'notebook6')
					});
					const sectionCFiles = await fs.promises.readdir(path.join(run.targetBook.bookContentFolderPath, 'sectionC'));
					const sectionBFiles = await fs.promises.readdir(path.join(run.targetBook.bookContentFolderPath, 'sectionB'));
					should(JSON.stringify(sectionCFiles)).be.equal(JSON.stringify(['notebook6.ipynb', 'readme.md']), 'sectionB has been moved under target book content directory');
					should(JSON.stringify(sectionBFiles)).be.equal(JSON.stringify(['notebook3.ipynb', 'notebook4.ipynb', 'readme.md']), ' Verify that the files on sectionB had been moved to the targetBook');
				});

				it('Add notebook to book', async () => {
					bookTocManager = new BookTocManager(targetBookModel);
					await bookTocManager.updateBook(notebook, targetBook);
					const listFiles = await fs.promises.readdir(run.targetBook.bookContentFolderPath);
					should(JSON.stringify(listFiles).includes('notebook5.ipynb')).be.true('Notebook 5 should be under the target book content folder');
				});

				it('Add duplicated notebook to book', async () => {
					bookTocManager = new BookTocManager(targetBookModel);
					await bookTocManager.updateBook(notebook, targetBook);
					await bookTocManager.updateBook(duplicatedNotebook, targetBook);
					const listFiles = await fs.promises.readdir(run.targetBook.bookContentFolderPath);
					should(JSON.stringify(listFiles).includes('notebook5 - 2.ipynb')).be.true('Should rename the notebook to notebook5 - 2.ipynb');
					should(JSON.stringify(listFiles).includes('notebook5.ipynb')).be.true('Should keep notebook5.ipynb');
				});

				it('Recovery method is called after error', async () => {
					const mockExtensionContext = new MockExtensionContext();
					const recoverySpy = sinon.spy(BookTocManager.prototype, 'recovery');
					sinon.stub(BookTocManager.prototype, 'updateBook').throws(new Error('Unexpected error.'));
					const bookTreeViewProvider = new BookTreeViewProvider([], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
					const results: quickPickResults = {
						book: targetBook,
						quickPickSection: {
							label: loc.labelAddToLevel,
							description: undefined
						}
					}
					bookTocManager = new BookTocManager(targetBookModel);
					sinon.stub(bookTreeViewProvider, 'getSelectionQuickPick').returns(Promise.resolve(results));
					try {
						await bookTreeViewProvider.editBook(notebook);
					} catch (error) {
						should(recoverySpy.calledOnce).be.true('If unexpected error then recovery method is called.');
					}
				});

				it('Clean up folder with files didnt move', async () => {
					bookTocManager = new BookTocManager(targetBookModel);
					bookTocManager.movedFiles.set(notebook.book.contentPath, 'movedtest');
					await fs.writeFile(path.join(run.sourceBook.bookContentFolderPath, 'test.ipynb'), '');
					await bookTocManager.cleanUp(path.dirname(notebook.book.contentPath));
					const listFiles = await fs.promises.readdir(path.dirname(notebook.book.contentPath));
					should(JSON.stringify(listFiles).includes('test.ipynb')).be.true('Notebook test.ipynb should not be removed');
				});

				it('Clean up folder when there is an empty folder within the modified directory', async () => {
					await fs.promises.mkdir(path.join(run.sourceBook.bookContentFolderPath, 'test'));
					bookTocManager.modifiedDir.add(path.join(run.sourceBook.bookContentFolderPath, 'test'));
					bookTocManager.movedFiles.set(notebook.book.contentPath, 'movedtest');
					await bookTocManager.cleanUp(path.dirname(notebook.book.contentPath));
					const listFiles = await fs.promises.readdir(run.sourceBook.bookContentFolderPath);
					should(JSON.stringify(listFiles).includes('test')).be.true('Empty directories within the moving element directory are not deleted');
				});

				afterEach(async function (): Promise<void> {
					sinon.restore();
					if (await exists(sourceBookFolderPath)) {
						await promisify(rimraf)(sourceBookFolderPath);
					}
					if (await exists(targetBookFolderPath)) {
						await promisify(rimraf)(targetBookFolderPath);
					}
				});
			});
		});
	});
});
