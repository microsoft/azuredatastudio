/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as should from 'should';
import * as path from 'path';
import { BookTocManager, hasSections } from '../../book/bookTocManager';
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
import { BookVersion } from '../../book/bookVersionHandler';
import * as yaml from 'js-yaml';

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

function BookModelStub(root: string, bookItem: BookTreeItem, extension: MockExtensionContext): BookModel {
	const bookModel = new BookModel(root, false, false, extension, undefined);
	sinon.stub(bookModel, 'bookItems').value([bookItem]);
	sinon.stub(bookModel, 'unwatchTOC').returns();
	sinon.stub(bookModel, 'reinitializeContents').resolves();
	sinon.stub(bookModel, 'bookPath').value(root);
	return bookModel;
}

function createBookTreeItemFormat(item: any, root: string, version: BookVersion): BookTreeItemFormat {
	const pageFormat = item.type === BookTreeItemType.section ? {
		title: item.sectionName,
		file: item.uri,
		sections: item.sectionFormat
	} : item.sectionFormat;
	const sections = item.type === BookTreeItemType.section ? item.sectionFormat : [item.sectionFormat];
	return {
		title: item.sectionName,
		contentPath: item.contentPath,
		root: root,
		tableOfContents: {
			sections: sections
		},
		isUntitled: undefined,
		treeItemCollapsibleState: undefined,
		type: item.type,
		version: version,
		page: pageFormat
	};
}

describe('BookTocManagerTests', function () {
	describe('CreatingBooks', () => {
		let notebooks: string[];
		let bookFolderPath: string;
		let rootFolderPath: string;
		let root2FolderPath: string;
		const subfolder = 'Subfolder';

		afterEach(function (): void {
			sinon.restore();
		});

		beforeEach(async () => {
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			bookFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			root2FolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			notebooks = ['notebook1.ipynb', 'notebook2.ipynb', 'notebook3.ipynb', 'index.md'];

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
			await fs.writeFile(path.join(root2FolderPath, subfolder, notebooks[3]), '');
			await fs.writeFile(path.join(root2FolderPath, notebooks[3]), '');
		});

		it('should create a table of contents with no sections if there are only notebooks in folder', async function (): Promise<void> {
			let bookTocManager: BookTocManager = new BookTocManager();
			await bookTocManager.createBook(bookFolderPath, rootFolderPath);
			let listFiles = await fs.promises.readdir(bookFolderPath);
			should(bookTocManager.tableofContents.length).be.equal(4);
			should(listFiles.length).be.equal(6);
		});

		it.skip('should create a table of contents with sections if folder contains submodules', async () => { // TODO: chgagnon Fix from vscode merge
			let bookTocManager: BookTocManager = new BookTocManager();
			let expectedSection: IJupyterBookSectionV2[] = [{
				title: 'notebook2',
				file: path.posix.join(subfolder, 'notebook2')
			},
			{
				title: 'notebook3',
				file: path.posix.join(subfolder, 'notebook3')
			}];
			await bookTocManager.createBook(bookFolderPath, root2FolderPath);
			const index = bookTocManager.tableofContents.findIndex(entry => entry.file === path.posix.join(path.posix.sep, subfolder, 'index'));
			should(index).not.be.equal(-1, 'Should find a section with the Subfolder entry');
			if (index !== -1) {
				should(equalTOC(bookTocManager.tableofContents[index].sections, expectedSection)).be.true();
			}
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
				version: BookVersion.v1,
				sourceBook: {
					'rootBookFolderPath': sourceBookFolderPath,
					'bookContentFolderPath': path.posix.join(sourceBookFolderPath, 'content'),
					'tocPath': path.posix.join(sourceBookFolderPath, '_data', 'toc.yml'),
					'readme': path.posix.join(sourceBookFolderPath, 'content', 'readme.md'),
					'toc': [
						{
							'title': 'Notebook 1',
							'file': path.posix.join(path.posix.sep, 'sectionA', 'notebook1')
						},
						{
							'title': 'Notebook 2',
							'file': path.posix.join(path.posix.sep, 'sectionA', 'notebook2')
						}
					],
					'type': BookTreeItemType.savedBook
				},
				sectionA: {
					'contentPath': path.posix.join(sourceBookFolderPath, 'content', 'sectionA', 'readme.md'),
					'sectionRoot': path.posix.join(sourceBookFolderPath, 'content', 'sectionA'),
					'sectionName': 'Section A',
					'uri': path.posix.join(path.posix.sep, 'sectionA', 'readme'),
					'notebook1': path.posix.join(sourceBookFolderPath, 'content', 'sectionA', 'notebook1.ipynb'),
					'notebook2': path.posix.join(sourceBookFolderPath, 'content', 'sectionA', 'notebook2.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 1',
							'file': path.posix.join(path.posix.sep, 'sectionA', 'notebook1')
						},
						{
							'title': 'Notebook 2',
							'file': path.posix.join(path.posix.sep, 'sectionA', 'notebook2')
						}
					],
					'type': BookTreeItemType.section
				},
				sectionB: {
					'contentPath': path.posix.join(sourceBookFolderPath, 'content', 'sectionB', 'readme.md'),
					'sectionRoot': path.posix.join(sourceBookFolderPath, 'content', 'sectionB'),
					'sectionName': 'Section B',
					'uri': path.posix.join(path.posix.sep, 'sectionB', 'readme'),
					'notebook3': path.posix.join(sourceBookFolderPath, 'content', 'sectionB', 'notebook3.ipynb'),
					'notebook4': path.posix.join(sourceBookFolderPath, 'content', 'sectionB', 'notebook4.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 3',
							'file': path.posix.join(path.posix.sep, 'sectionB', 'notebook3')
						},
						{
							'title': 'Notebook 4',
							'file': path.posix.join(path.posix.sep, 'sectionB', 'notebook4')
						}
					],
					'type': BookTreeItemType.section
				},
				notebook5: {
					'contentPath': path.posix.join(sourceBookFolderPath, 'content', 'notebook5.ipynb'),
					'sectionFormat': {
						'title': 'Notebook 5',
						'file': path.posix.join(path.posix.sep, 'notebook5')
					},
					'type': BookTreeItemType.Notebook
				},
				duplicatedNotebook: {
					'contentPath': path.posix.join(duplicatedNotebookPath, 'notebook5.ipynb'),
					'sectionFormat': {
						'title': 'Notebook 5',
						'file': path.posix.join(path.posix.sep, 'notebook5')
					},
					'type': BookTreeItemType.Notebook
				},
				targetBook: {
					'rootBookFolderPath': targetBookFolderPath,
					'bookContentFolderPath': path.posix.join(targetBookFolderPath, 'content'),
					'tocPath': path.posix.join(targetBookFolderPath, '_data', 'toc.yml'),
					'readme': path.posix.join(targetBookFolderPath, 'content', 'readme.md'),
					'toc': [
						{
							'title': 'Welcome page',
							'file': path.posix.join(path.posix.sep, 'readme'),
						},
						{
							'title': 'Section C',
							'file': path.posix.join(path.posix.sep, 'sectionC', 'readme'),
							'sections': [
								{
									'title': 'Notebook 6',
									'file': path.posix.join(path.posix.sep, 'sectionC', 'notebook6')
								}
							]
						}
					],
					'type': BookTreeItemType.Book
				},
				sectionC: {
					'contentPath': path.posix.join(targetBookFolderPath, 'content', 'sectionC', 'readme.md'),
					'sectionRoot': path.posix.join(targetBookFolderPath, 'content', 'sectionC'),
					'sectionName': 'Section C',
					'uri': path.posix.join(path.posix.sep, 'sectionC', 'readme'),
					'notebook6': path.posix.join(targetBookFolderPath, 'content', 'sectionC', 'notebook6.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 6',
							'file': path.posix.join(path.posix.sep, 'sectionC', 'notebook6')
						}
					],
					'type': BookTreeItemType.section
				}
			}, {
				it: 'using the jupyter-book legacy version >= 0.7.0',
				version: BookVersion.v2,
				sourceBook: {
					'rootBookFolderPath': sourceBookFolderPath,
					'bookContentFolderPath': sourceBookFolderPath,
					'tocPath': path.posix.join(sourceBookFolderPath, '_toc.yml'),
					'readme': path.posix.join(sourceBookFolderPath, 'readme.md')
				},
				sectionA: {
					'contentPath': path.posix.join(sourceBookFolderPath, 'sectionA', 'readme.md'),
					'sectionRoot': path.posix.join(sourceBookFolderPath, 'sectionA'),
					'sectionName': 'Section A',
					'uri': path.posix.join(path.posix.sep, 'sectionA', 'readme'),
					'notebook1': path.posix.join(sourceBookFolderPath, 'sectionA', 'notebook1.ipynb'),
					'notebook2': path.posix.join(sourceBookFolderPath, 'sectionA', 'notebook2.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 1',
							'file': path.posix.join(path.posix.sep, 'sectionA', 'notebook1')
						},
						{
							'title': 'Notebook 2',
							'file': path.posix.join(path.posix.sep, 'sectionA', 'notebook2')
						}
					],
					'type': BookTreeItemType.section
				},
				sectionB: {
					'contentPath': path.posix.join(sourceBookFolderPath, 'sectionB', 'readme.md'),
					'sectionRoot': path.posix.join(sourceBookFolderPath, 'sectionB'),
					'sectionName': 'Section B',
					'uri': path.posix.join(path.posix.sep, 'sectionB', 'readme'),
					'notebook3': path.posix.join(sourceBookFolderPath, 'sectionB', 'notebook3.ipynb'),
					'notebook4': path.posix.join(sourceBookFolderPath, 'sectionB', 'notebook4.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 3',
							'file': path.posix.join(path.posix.sep, 'sectionB', 'notebook3')
						},
						{
							'title': 'Notebook 4',
							'file': path.posix.join(path.posix.sep, 'sectionB', 'notebook4')
						}
					],
					'type': BookTreeItemType.section
				},
				notebook5: {
					'contentPath': path.posix.join(sourceBookFolderPath, 'notebook5.ipynb'),
					'sectionFormat': {
						'title': 'Notebook 5',
						'file': path.posix.join(path.posix.sep, 'notebook5')
					},
					'type': BookTreeItemType.Notebook
				},
				duplicatedNotebook: {
					'contentPath': path.posix.join(duplicatedNotebookPath, 'notebook5.ipynb'),
					'sectionFormat': {
						'title': 'Notebook 5',
						'file': path.posix.join(path.posix.sep, 'notebook5')
					},
					'type': BookTreeItemType.Notebook
				},
				targetBook: {
					'rootBookFolderPath': targetBookFolderPath,
					'bookContentFolderPath': targetBookFolderPath,
					'tocPath': path.posix.join(targetBookFolderPath, '_toc.yml'),
					'readme': path.posix.join(targetBookFolderPath, 'readme.md'),
					'toc': [
						{
							'title': 'Welcome',
							'file': path.posix.join(path.posix.sep, 'readme'),
						},
						{
							'title': 'Section C',
							'file': path.posix.join(path.posix.sep, 'sectionC', 'readme'),
							'sections': [
								{
									'title': 'Notebook 6',
									'file': path.posix.join(path.posix.sep, 'sectionC', 'notebook6')
								}
							]
						}
					],
					'type': BookTreeItemType.Book
				},
				sectionC: {
					'contentPath': path.posix.join(targetBookFolderPath, 'sectionC', 'readme.md'),
					'sectionRoot': path.posix.join(targetBookFolderPath, 'sectionC'),
					'sectionName': 'Section C',
					'uri': path.posix.join(path.posix.sep, 'sectionC', 'readme'),
					'notebook6': path.posix.join(targetBookFolderPath, 'sectionC', 'notebook6.ipynb'),
					'sectionFormat': [
						{
							'title': 'Notebook 6',
							'file': path.posix.join(path.posix.sep, 'sectionC', 'notebook6')
						}
					],
					'type': BookTreeItemType.section
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
					const sectionCTreeItemFormat = createBookTreeItemFormat(run.sectionC, run.targetBook.rootBookFolderPath, run.version);
					const sectionATreeItemFormat = createBookTreeItemFormat(run.sectionA, run.sourceBook.rootBookFolderPath, run.version);
					const sectionBTreeItemFormat = createBookTreeItemFormat(run.sectionB, run.sourceBook.rootBookFolderPath, run.version);
					const notebookTreeItemFormat = createBookTreeItemFormat(run.notebook5, run.sourceBook.rootBookFolderPath, run.version);
					const duplicatedNbTreeItemFormat = createBookTreeItemFormat(run.duplicatedNotebook, duplicatedNotebookPath, undefined);

					targetBook = new BookTreeItem(targetBookTreeItemFormat, undefined);
					sectionC = new BookTreeItem(sectionCTreeItemFormat, undefined);
					sectionA = new BookTreeItem(sectionATreeItemFormat, undefined);
					sectionB = new BookTreeItem(sectionBTreeItemFormat, undefined);
					notebook = new BookTreeItem(notebookTreeItemFormat, undefined);
					duplicatedNotebook = new BookTreeItem(duplicatedNbTreeItemFormat, undefined);


					sectionC.uri = path.posix.join('sectionC', 'readme');
					sectionA.uri = path.posix.join('sectionA', 'readme');
					sectionB.uri = path.posix.join('sectionB', 'readme');

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
					duplicatedNotebook.tableOfContentsPath = undefined;

					sectionA.sections = run.sectionA.sectionFormat;
					sectionB.sections = run.sectionB.sectionFormat;
					sectionC.sections = run.sectionC.sectionFormat;
					notebook.sections = [run.notebook5.sectionFormat];
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
					await fs.writeFile(run.targetBook.tocPath, '- title: Welcome\n  file: /readme\n- title: Section C\n  file: /sectionC/readme\n  sections:\n  - title: Notebook 6\n    file: /sectionC/notebook6');
					// source book
					await fs.writeFile(run.sourceBook.tocPath, '- title: Notebook 5\n  file: /notebook5\n- title: Section A\n  file: /sectionA/readme\n  sections:\n  - title: Notebook1\n    file: /sectionA/notebook1\n  - title: Notebook2\n    file: /sectionA/notebook2\n- title: Section B\n  file: /sectionB/readme\n  sections:\n  - title: Notebook3\n    file: /sectionB/notebook3\n  - title: Notebook4\n    file: /sectionB/notebook4');

					const mockExtensionContext = new MockExtensionContext();

					sourceBookModel = BookModelStub(run.sourceBook.rootBookFolderPath, sectionA, mockExtensionContext);
					targetBookModel = BookModelStub(run.targetBook.rootBookFolderPath, targetBook, mockExtensionContext);
				});


				it('Add section to book', async () => {
					bookTocManager = new BookTocManager(sourceBookModel, targetBookModel);
					await bookTocManager.updateBook([sectionA], targetBook, undefined);
					const listFiles = await fs.promises.readdir(path.join(run.targetBook.bookContentFolderPath, 'sectionA'));
					const listSourceFiles = await fs.promises.readdir(path.join(run.sourceBook.bookContentFolderPath));
					should(JSON.stringify(listSourceFiles).includes('sectionA')).be.false('The source book files should not contain the section A files');
					should(JSON.stringify(listFiles)).be.equal(JSON.stringify(['notebook1.ipynb', 'notebook2.ipynb', 'readme.md']), 'The files of the section should be moved to the target book folder');
				});

				it('Add section to section', async () => {
					bookTocManager = new BookTocManager(sourceBookModel, targetBookModel);
					await bookTocManager.updateBook([sectionB], sectionC, {
						'title': 'Notebook 6',
						'file': path.posix.join(path.posix.sep, 'sectionC', 'notebook6')
					});
					const sectionCFiles = await fs.promises.readdir(path.join(run.targetBook.bookContentFolderPath, 'sectionC'));
					const sectionBFiles = await fs.promises.readdir(path.join(run.targetBook.bookContentFolderPath, 'sectionB'));
					should(JSON.stringify(sectionCFiles)).be.equal(JSON.stringify(['notebook6.ipynb', 'readme.md']), 'sectionB has been moved under target book content directory');
					should(JSON.stringify(sectionBFiles)).be.equal(JSON.stringify(['notebook3.ipynb', 'notebook4.ipynb', 'readme.md']), ' Verify that the files on sectionB had been moved to the targetBook');
				});

				it('Add notebook to book', async () => {
					bookTocManager = new BookTocManager(undefined, targetBookModel);
					await bookTocManager.updateBook([notebook], targetBook);
					const listFiles = await fs.promises.readdir(run.targetBook.bookContentFolderPath);
					should(JSON.stringify(listFiles).includes('notebook5.ipynb')).be.true('Notebook 5 should be under the target book content folder');
				});

				it('Remove notebook from book', async () => {
					let toc: JupyterBookSection[] = yaml.safeLoad((await fs.promises.readFile(notebook.tableOfContentsPath)).toString());
					let notebookInToc = toc.some(section => {
						if (section.title === 'Notebook 5' && section.file === path.posix.join(path.posix.sep, 'notebook5')) {
							return true;
						}
						return false;
					});
					should(notebookInToc).be.true('Verify the notebook is in toc before removing');

					bookTocManager = new BookTocManager(sourceBookModel);
					await bookTocManager.removeNotebook(notebook);

					const listFiles = await fs.promises.readdir(run.sourceBook.bookContentFolderPath);
					toc = yaml.safeLoad((await fs.promises.readFile(notebook.tableOfContentsPath)).toString());
					notebookInToc = toc.some(section => {
						if (section.title === 'Notebook 5' && section.file === path.posix.join(path.posix.sep, 'notebook5')) {
							return true;
						}
						return false;
					});
					should(JSON.stringify(listFiles).includes('notebook5.ipynb')).be.true('Notebook 5 should be still under the content folder');
					should(notebookInToc).be.false('The notebook has been removed from toc');
				});

				it('Add duplicated notebook to book', async () => {
					bookTocManager = new BookTocManager(undefined, targetBookModel);
					await bookTocManager.updateBook([notebook], targetBook);
					await bookTocManager.updateBook([duplicatedNotebook], targetBook);
					const listFiles = await fs.promises.readdir(run.targetBook.bookContentFolderPath);
					should(JSON.stringify(listFiles).includes('notebook5 - 2.ipynb')).be.true('Should rename the notebook to notebook5 - 2.ipynb');
					should(JSON.stringify(listFiles).includes('notebook5.ipynb')).be.true('Should keep notebook5.ipynb');
				});

				it('Recovery method is called after error', async () => {
					const mockExtensionContext = new MockExtensionContext();
					const recoverySpy = sinon.spy(BookTocManager.prototype, 'recovery');
					sinon.stub(BookTocManager.prototype, 'updateTOC').throws(new Error('Unexpected error.'));
					const bookTreeViewProvider = new BookTreeViewProvider([], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
					bookTocManager = new BookTocManager(targetBookModel);
					sinon.stub(bookTreeViewProvider, 'moveTreeItems').returns(Promise.resolve(bookTocManager.updateBook([notebook], targetBook)));
					try {
						await bookTreeViewProvider.moveTreeItems([notebook]);
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
