/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as should from 'should';
import * as path from 'path';
import { BookTocManager, hasSections } from '../../book/bookTocManager';
import { BookTreeItem, BookTreeItemFormat } from '../../book/bookTreeItem';
import * as sinon from 'sinon';
import { IJupyterBookSectionV1, IJupyterBookSectionV2, JupyterBookSection } from '../../contracts/content';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as uuid from 'uuid';
import * as rimraf from 'rimraf';
import { promisify } from 'util';
import { BookModel } from '../../book/bookModel';
import { MockExtensionContext } from '../common/stubs';
import { BookTreeViewProvider } from '../../book/bookTreeView';
import { NavigationProviders } from '../../common/constants';
import { BookVersion, getContentPath, getTocPath } from '../../book/bookVersionHandler';
import * as yaml from 'js-yaml';
import { TocEntryPathHandler } from '../../book/tocEntryPathHandler';
import { exists, BookTreeItemType, FileExtension, generateGuid } from '../../common/utils';

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

function createBookTreeItemFormat(item: any): BookTreeItemFormat {
	const pageFormat = item.type === BookTreeItemType.savedBook ? item.tocEntry : item.tocEntry[0];
	return {
		title: item.title,
		contentPath: item.contentPath,
		root: item.root,
		tableOfContents: {
			sections: item.tocEntry
		},
		isUntitled: undefined,
		treeItemCollapsibleState: undefined,
		type: item.type,
		version: item.version,
		page: pageFormat
	};
}

function createBookTreeItem(itemFormat: BookTreeItemFormat, tocPath?: string): BookTreeItem {
	let treeItem = new BookTreeItem(itemFormat, undefined);
	treeItem.contextValue = itemFormat.type;
	treeItem.tableOfContentsPath = tocPath;
	treeItem.book.version = itemFormat.version;
	return treeItem;
}

describe('BookTocManagerTests', function () {
	describe('CreatingBooks', () => {
		let notebooks: string[];
		let bookFolderPath: string;
		let rootFolderPath: string;
		let root2FolderPath: string;
		const subfolder = 'Subfolder';
		const subfolder2 = 'Subfolder2';

		afterEach(function (): void {
			sinon.restore();
		});

		beforeEach(async () => {
			rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			bookFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			root2FolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
			notebooks = ['notebook1.ipynb', 'notebook2.ipynb', 'notebook3.ipynb', 'index.md', 'notebook4.ipynb', 'notebook5.ipynb'];

			await fs.mkdir(rootFolderPath);
			await fs.writeFile(path.join(rootFolderPath, notebooks[0]), '');
			await fs.writeFile(path.join(rootFolderPath, notebooks[1]), '');
			await fs.writeFile(path.join(rootFolderPath, notebooks[2]), '');
			await fs.writeFile(path.join(rootFolderPath, notebooks[3]), '');

			await fs.mkdir(root2FolderPath);
			await fs.mkdir(path.join(root2FolderPath, subfolder));
			await fs.mkdir(path.join(root2FolderPath, subfolder, subfolder2));

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

		it ('should create a table of contents with sections if folder contains subfolders', async () => {
			await fs.writeFile(path.join(root2FolderPath, subfolder, subfolder2, notebooks[4]), '');
			await fs.writeFile(path.join(root2FolderPath, subfolder, subfolder2, notebooks[5]), '');

			let bookTocManager: BookTocManager = new BookTocManager();
			await bookTocManager.createBook(bookFolderPath, root2FolderPath);
			let listFiles = await fs.promises.readdir(bookFolderPath);
			should(bookTocManager.tableofContents.length).be.equal(3);
			should(listFiles.length).be.equal(5);

			let expectedSubSections: IJupyterBookSectionV2[] = [{
				title: 'notebook4',
				file: path.posix.join(path.posix.sep, subfolder, subfolder2, 'notebook4')
			},
			{
				title: 'notebook5',
				file: path.posix.join(path.posix.sep, subfolder, subfolder2, 'notebook5')
			}];

			let expectedSection: IJupyterBookSectionV2[] = [{
				title: 'index',
				file: path.posix.join(path.posix.sep, subfolder, 'index')
			},
			{
				title: 'notebook2',
				file: path.posix.join(path.posix.sep, subfolder, 'notebook2')
			},
			{
				title: 'notebook3',
				file: path.posix.join(path.posix.sep, subfolder, 'notebook3')
			},
			{
				title: 'Subfolder2',
				file: path.posix.join(path.posix.sep, subfolder, subfolder2, 'notebook4'),
				sections : expectedSubSections
			}];

			const index = bookTocManager.tableofContents.findIndex(entry => entry.file === path.posix.join(path.posix.sep, subfolder, 'index'));
			should(index).not.be.equal(-1, 'Should find a section with the Subfolder entry');
			if (index !== -1) {
				let subsection = bookTocManager.tableofContents[index].sections.find(entry => entry.file === path.posix.join(path.posix.sep, subfolder, subfolder2, 'notebook4'));
				should(equalSections(subsection, expectedSection[3])).be.true('Should find a subsection with the subfolder2 inside the subfolder');
			}
		});
	});

	describe('EditingBooks', () => {
		let bookTocManager: BookTocManager;
		let sourceBookModel: BookModel;
		let targetBookModel: BookModel;
		let targetBook: BookTreeItem;
		let sourceBook: BookTreeItem;
		let sectionC: BookTreeItem;
		let sectionA: BookTreeItem;
		let sectionB: BookTreeItem;
		let notebook1: BookTreeItem;
		let notebook5: BookTreeItem;
		let duplicatedNotebook: BookTreeItem;
		let sourceBookFolderPath: string = path.join(os.tmpdir(), uuid.v4(), 'sourceBook');
		let targetBookFolderPath: string = path.join(os.tmpdir(), uuid.v4(), 'targetBook');
		let duplicatedNotebookPath: string = path.join(os.tmpdir(), uuid.v4(), 'duplicatedNotebook');
		let versions = [
			BookVersion.v1,
			BookVersion.v2
		];

		let testRuns = versions.map(v => {
			const sourceBookContentFolder = getContentPath(v, sourceBookFolderPath, '');
			const targetBookContentFolder = getContentPath(v, targetBookFolderPath, '');
			return {
				it: `using book version: ${v}`,
				version: v,
				sourceBook: {
					'title': 'Source Book',
					'root': sourceBookFolderPath,
					'contentFolder': sourceBookContentFolder,
					'tocPath': getTocPath(v, sourceBookFolderPath),
					'contentPath': path.posix.join(sourceBookContentFolder, 'readme.md'),
					'tocEntry': [
						{
							title: 'readme',
							file: path.posix.join(path.posix.sep, 'readme')
						},
						{
							title: 'Section A',
							file: path.posix.join(path.posix.sep, 'sectionA', 'readme'),
							sections: [
								{
									'title': 'Notebook 1',
									'file': path.posix.join(path.posix.sep, 'sectionA', 'notebook1')
								},
								{
									'title': 'Notebook 2',
									'file': path.posix.join(path.posix.sep, 'sectionA', 'notebook2')
								}
							]
						},
						{
							title: 'Section B',
							file: path.posix.join(path.posix.sep, 'sectionB', 'readme'),
							sections: [
								{
									'title': 'Notebook 3',
									'file': path.posix.join(path.posix.sep, 'sectionB', 'notebook3')
								},
								{
									'title': 'Notebook 4',
									'file': path.posix.join(path.posix.sep, 'sectionB', 'notebook4')
								}
							]
						}
					],
					'type': BookTreeItemType.savedBook,
					'version': v,
					'files': [
						path.posix.join(sourceBookContentFolder, 'readme.md'),
						path.posix.join(sourceBookContentFolder, 'sectionA', 'readme.md'),
						path.posix.join(sourceBookContentFolder, 'sectionA', 'notebook1.ipynb'),
						path.posix.join(sourceBookContentFolder, 'sectionA', 'notebook2.ipynb'),
						path.posix.join(sourceBookContentFolder, 'sectionB', 'readme.md'),
						path.posix.join(sourceBookContentFolder, 'sectionB', 'notebook3.ipynb'),
						path.posix.join(sourceBookContentFolder, 'sectionB', 'notebook4.ipynb'),
					]
				},
				sectionA: {
					'title': 'Section A',
					'root': sourceBookFolderPath,
					'contentFolder': getContentPath(v, sourceBookFolderPath, ''),
					'tocPath': getTocPath(v, sourceBookFolderPath),
					'contentPath': getContentPath(v, sourceBookFolderPath, path.posix.join('sectionA', 'readme.md')),
					'tocEntry': [
						{
							title: 'Section A',
							file: path.posix.join(path.posix.sep, 'sectionA', 'readme'),
							sections: [
								{
									'title': 'Notebook 1',
									'file': path.posix.join(path.posix.sep, 'sectionA', 'notebook1')
								},
								{
									'title': 'Notebook 2',
									'file': path.posix.join(path.posix.sep, 'sectionA', 'notebook2')
								}
							]

						}],
					'type': BookTreeItemType.section,
					'version': v
				},
				sectionB: {
					'title': 'Section B',
					'root': sourceBookFolderPath,
					'contentFolder': getContentPath(v, sourceBookFolderPath, ''),
					'tocPath': getTocPath(v, sourceBookFolderPath),
					'contentPath': getContentPath(v, sourceBookFolderPath, path.posix.join('sectionB', 'readme.md')),
					'tocEntry': [
						{
							title: 'Section B',
							file: path.posix.join(path.posix.sep, 'sectionB', 'readme'),
							sections: [
								{
									'title': 'Notebook 3',
									'file': path.posix.join(path.posix.sep, 'sectionB', 'notebook3')
								},
								{
									'title': 'Notebook 4',
									'file': path.posix.join(path.posix.sep, 'sectionB', 'notebook4')
								}
							]

						}],
					'type': BookTreeItemType.section,
					'version': v
				},
				targetBook: {
					'title': 'Target Book',
					'root': targetBookFolderPath,
					'contentFolder': getContentPath(v, targetBookFolderPath, ''),
					'tocPath': getTocPath(v, targetBookFolderPath),
					'contentPath': getContentPath(v, targetBookFolderPath, 'readme.md'),
					'tocEntry': [
						{
							title: 'readme',
							file: path.posix.join(path.posix.sep, 'readme')
						},
						{
							title: 'Section C',
							file: path.posix.join(path.posix.sep, 'sectionC', 'readme'),
							sections: [
								{
									'title': 'Notebook 6',
									'file': path.posix.join(path.posix.sep, 'sectionC', 'notebook6')
								}
							]
						}],
					'type': BookTreeItemType.savedBook,
					'version': v,
					'files': [
						path.posix.join(targetBookContentFolder, 'readme.md'),
						path.posix.join(targetBookContentFolder, 'sectionC', 'readme.md'),
						path.posix.join(targetBookContentFolder, 'sectionC', 'notebook6.ipynb'),
					]
				},
				sectionC: {
					'title': 'Section C',
					'root': targetBookFolderPath,
					'contentFolder': getContentPath(v, targetBookFolderPath, ''),
					'tocPath': getTocPath(v, targetBookFolderPath),
					'contentPath': getContentPath(v, targetBookFolderPath, path.posix.join('sectionC', 'readme.md')),
					'tocEntry': [
						{
							title: 'Section C',
							file: path.posix.join(path.posix.sep, 'sectionC', 'readme'),
							sections: [
								{
									'title': 'Notebook 6',
									'file': path.posix.join(path.posix.sep, 'sectionC', 'notebook6')
								}
							]
						}],
					'type': BookTreeItemType.section,
					'version': v
				},
				notebook1: {
					'title': 'Notebook 1',
					'root': sourceBookFolderPath,
					'contentFolder': sourceBookContentFolder,
					'tocPath': getTocPath(v, sourceBookFolderPath),
					'contentPath': path.posix.join(sourceBookContentFolder, 'sectionA', 'notebook1.ipynb'),
					'tocEntry': [
						{
							'title': 'Notebook 1',
							'file': path.posix.join(path.posix.sep, 'sectionA', 'notebook1')
						}],
					'type': BookTreeItemType.savedBookNotebook,
					'version': v
				},
				notebook5: {
					'title': 'Notebook 5',
					'root': sourceBookFolderPath,
					'contentFolder': sourceBookContentFolder,
					'tocPath': getTocPath(v, sourceBookFolderPath),
					'contentPath': path.posix.join(sourceBookContentFolder, 'notebook5.ipynb'),
					'tocEntry': [
						{
							'title': 'Notebook 5',
							'file': path.posix.join(path.posix.sep, 'notebook5')
						}
					],
					'type': BookTreeItemType.savedBookNotebook,
					'version': v
				},
				duplicatedNotebook: {
					'title': 'Duplicated Notebook',
					'root': duplicatedNotebookPath,
					'contentFolder': duplicatedNotebookPath,
					'tocPath': undefined,
					'contentPath': path.posix.join(duplicatedNotebookPath, 'notebook5.ipynb'),
					'tocEntry': [
						{
							'title': 'Notebook 5',
							'file': path.posix.join(path.posix.sep, 'notebook5')
						}
					],
					'type': BookTreeItemType.savedNotebook
				}
			};
		});

		testRuns.forEach(function (run) {
			describe('Editing Books ' + run.it, function (): void {
				beforeEach(async () => {
					const targetBookTreeItemFormat = createBookTreeItemFormat(run.targetBook);
					const sourceBookTreeItemFormat = createBookTreeItemFormat(run.sourceBook);
					const sectionCTreeItemFormat = createBookTreeItemFormat(run.sectionC);
					const sectionATreeItemFormat = createBookTreeItemFormat(run.sectionA);
					const sectionBTreeItemFormat = createBookTreeItemFormat(run.sectionB);
					const notebook5TreeItemFormat = createBookTreeItemFormat(run.notebook5);
					const notebook1TreeItemFormat = createBookTreeItemFormat(run.notebook1);
					const duplicatedNbTreeItemFormat = createBookTreeItemFormat(run.duplicatedNotebook);

					targetBook = createBookTreeItem(targetBookTreeItemFormat, run.targetBook.tocPath);
					sourceBook = createBookTreeItem(sourceBookTreeItemFormat, run.sourceBook.tocPath);
					sectionC = createBookTreeItem(sectionCTreeItemFormat, run.sectionC.tocPath);
					sectionA = createBookTreeItem(sectionATreeItemFormat, run.sectionA.tocPath);
					sectionB = createBookTreeItem(sectionBTreeItemFormat, run.sectionB.tocPath);
					notebook1 = createBookTreeItem(notebook1TreeItemFormat, run.notebook1.tocPath);
					notebook5 = createBookTreeItem(notebook5TreeItemFormat, run.notebook5.tocPath);
					duplicatedNotebook = createBookTreeItem(duplicatedNbTreeItemFormat, run.duplicatedNotebook.tocPath);

					sectionC.uri = path.posix.join('sectionC', 'readme');
					sectionA.uri = path.posix.join('sectionA', 'readme');
					sectionB.uri = path.posix.join('sectionB', 'readme');
					notebook1.parent = sectionA;

					await fs.promises.mkdir(run.targetBook.root, { recursive: true });
					await fs.promises.mkdir(path.dirname(run.sectionA.contentPath), { recursive: true });
					await fs.promises.mkdir(path.dirname(run.sectionB.contentPath), { recursive: true });
					await fs.promises.mkdir(path.dirname(run.sectionC.contentPath), { recursive: true });
					await fs.promises.mkdir(run.duplicatedNotebook.root, { recursive: true });

					for (let file of run.targetBook.files) {
						await fs.writeFile(file, '');
					}

					for (let file of run.sourceBook.files) {
						await fs.writeFile(file, '');
					}

					await fs.writeFile(run.notebook5.contentPath, '');
					await fs.writeFile(run.duplicatedNotebook.contentPath, '');
					await fs.writeFile(path.join(run.targetBook.root, '_config.yml'), 'title: Target Book');
					await fs.writeFile(path.join(run.sourceBook.root, '_config.yml'), 'title: Source Book');

					if (run.version === 'v1') {
						await fs.promises.mkdir(path.dirname(run.targetBook.tocPath), { recursive: true });
						await fs.promises.mkdir(path.dirname(run.sourceBook.tocPath), { recursive: true });
					}

					// target book
					await fs.writeFile(run.targetBook.tocPath, '- title: Welcome\n  file: /readme\n- title: Section C\n  file: /sectionC/readme\n  sections:\n  - title: Notebook 6\n    file: /sectionC/notebook6');
					// source book
					await fs.writeFile(run.sourceBook.tocPath, '- title: Notebook 5\n  file: /notebook5\n- title: Section A\n  file: /sectionA/readme\n  sections:\n  - title: Notebook1\n    file: /sectionA/notebook1\n  - title: Notebook2\n    file: /sectionA/notebook2\n- title: Section B\n  file: /sectionB/readme\n  sections:\n  - title: Notebook3\n    file: /sectionB/notebook3\n  - title: Notebook4\n    file: /sectionB/notebook4');

					const mockExtensionContext = new MockExtensionContext();

					sourceBookModel = BookModelStub(run.sourceBook.root, sourceBook, mockExtensionContext);
					targetBookModel = BookModelStub(run.targetBook.root, targetBook, mockExtensionContext);
				});

				it('Add section to book', async () => {
					bookTocManager = new BookTocManager(sourceBookModel, targetBookModel);
					await bookTocManager.updateBook([sectionA], targetBook, undefined);
					const listFiles = await fs.promises.readdir(path.join(run.targetBook.contentFolder, 'sectionA'));
					const listSourceFiles = await fs.promises.readdir(path.join(run.sourceBook.contentFolder));
					should(JSON.stringify(listSourceFiles).includes('sectionA')).be.false('The source book files should not contain the section A files');
					should(JSON.stringify(listFiles)).be.equal(JSON.stringify(['notebook1.ipynb', 'notebook2.ipynb', 'readme.md']), 'The files of the section should be moved to the target book folder');
				});

				it('Add section to section', async () => {
					bookTocManager = new BookTocManager(sourceBookModel, targetBookModel);
					await bookTocManager.updateBook([sectionB], sectionC, {
						'title': 'Notebook 6',
						'file': path.posix.join(path.posix.sep, 'sectionC', 'notebook6')
					});
					const sectionCFiles = await fs.promises.readdir(path.join(run.targetBook.contentFolder, 'sectionC'));
					const sectionBFiles = await fs.promises.readdir(path.join(run.targetBook.contentFolder, 'sectionB'));
					should(JSON.stringify(sectionCFiles)).be.equal(JSON.stringify(['notebook6.ipynb', 'readme.md']), 'sectionB has been moved under target book content directory');
					should(JSON.stringify(sectionBFiles)).be.equal(JSON.stringify(['notebook3.ipynb', 'notebook4.ipynb', 'readme.md']), ' Verify that the files on sectionB had been moved to the targetBook');
				});

				it('Add notebook to book', async () => {
					bookTocManager = new BookTocManager(undefined, targetBookModel);
					await bookTocManager.updateBook([notebook5], targetBook);
					const listFiles = await fs.promises.readdir(run.targetBook.contentFolder);
					should(JSON.stringify(listFiles).includes('notebook5.ipynb')).be.true('Notebook 5 should be under the target book content folder');
				});

				it('Remove notebook from book', async () => {
					let toc: JupyterBookSection[] = yaml.safeLoad((await fs.promises.readFile(notebook5.tableOfContentsPath)).toString());
					let notebookInToc = toc.some(section => {
						if (section.title === 'Notebook 5' && section.file === path.posix.join(path.posix.sep, 'notebook5')) {
							return true;
						}
						return false;
					});
					should(notebookInToc).be.true('Verify the notebook is in toc before removing');
					bookTocManager = new BookTocManager(sourceBookModel);
					await bookTocManager.removeNotebook(notebook5);
					const listFiles = await fs.promises.readdir(run.sourceBook.contentFolder);
					toc = yaml.safeLoad((await fs.promises.readFile(notebook5.tableOfContentsPath)).toString());
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
					bookTocManager = new BookTocManager(sourceBookModel, targetBookModel);
					await bookTocManager.updateBook([notebook5], targetBook);
					bookTocManager = new BookTocManager(undefined, targetBookModel);
					await bookTocManager.updateBook([duplicatedNotebook], targetBook);
					const listFiles = await fs.promises.readdir(run.targetBook.contentFolder);
					should(JSON.stringify(listFiles).includes('notebook5 - 2.ipynb')).be.true('Should rename the notebook to notebook5 - 2.ipynb');
					should(JSON.stringify(listFiles).includes('notebook5.ipynb')).be.true('Should keep notebook5.ipynb');
				});

				it('Recovery method is called after error', async () => {
					const mockExtensionContext = new MockExtensionContext();
					const recoverySpy = sinon.spy(BookTocManager.prototype, 'recovery');
					sinon.stub(BookTocManager.prototype, 'updateTOC').throws(new Error('Unexpected error.'));
					const bookTreeViewProvider = new BookTreeViewProvider([], mockExtensionContext, false, 'bookTreeView', NavigationProviders.NotebooksNavigator);
					bookTocManager = new BookTocManager(targetBookModel);
					sinon.stub(bookTreeViewProvider, 'moveTreeItems').returns(Promise.resolve(bookTocManager.updateBook([notebook5], targetBook)));
					try {
						await bookTreeViewProvider.moveTreeItems([notebook5]);
					} catch (error) {
						should(recoverySpy.calledOnce).be.true('If unexpected error then recovery method is called.');
					}
				});

				it('Clean up folder with files didnt move', async () => {
					bookTocManager = new BookTocManager(targetBookModel);
					bookTocManager.movedFiles.set(notebook5.book.contentPath, 'movedtest');
					await fs.writeFile(path.join(run.sourceBook.contentFolder, 'test.ipynb'), '');
					await bookTocManager.cleanUp(path.dirname(notebook5.book.contentPath));
					const listFiles = await fs.promises.readdir(path.dirname(notebook5.book.contentPath));
					should(JSON.stringify(listFiles).includes('test.ipynb')).be.true('Notebook test.ipynb should not be removed');
				});

				it('Clean up folder when there is an empty folder within the modified directory', async () => {
					await fs.promises.mkdir(path.join(run.sourceBook.contentFolder, 'test'));
					bookTocManager.modifiedDir.add(path.join(run.sourceBook.contentFolder, 'test'));
					bookTocManager.movedFiles.set(notebook5.book.contentPath, 'movedtest');
					await bookTocManager.cleanUp(path.dirname(notebook5.book.contentPath));
					const listFiles = await fs.promises.readdir(run.sourceBook.contentFolder);
					should(JSON.stringify(listFiles).includes('test')).be.true('Empty directories within the moving element directory are not deleted');
				});

				it('Add new section', async () => {
					bookTocManager = new BookTocManager(sourceBookModel);
					const fileBasename = `addSectionTest-${generateGuid()}`;
					const sectionTitle = 'Section Test';
					const testFilePath = path.join(run.sectionA.contentFolder, 'sectionA', fileBasename).concat(FileExtension.Markdown);
					await fs.writeFile(testFilePath, '');
					const pathDetails = new TocEntryPathHandler(testFilePath, run.sourceBook.root, sectionTitle);
					await bookTocManager.addNewTocEntry(pathDetails, sectionA, true);
					let toc: JupyterBookSection[] = yaml.safeLoad((await fs.promises.readFile(run.sourceBook.tocPath)).toString());
					const sectionAIndex = toc.findIndex(entry => entry.title === sectionA.title);
					let newSectionIndex = -1;
					let newSection = undefined;
					if (sectionAIndex) {
						newSectionIndex = toc[sectionAIndex].sections?.findIndex(entry => entry.title === sectionTitle);
						newSection = toc[sectionAIndex].sections[newSectionIndex];
					}
					should(newSectionIndex).not.be.equal(-1, 'The new section should exist in the toc file');
					should(newSection.sections).not.undefined();
				});

				it('Section A is parent of notebook1 using both sectionA and notebook1 book tree items', async () => {
					bookTocManager = new BookTocManager(sourceBookModel);
					let isParent = bookTocManager.isParent(notebook1, sectionA);
					should(isParent).be.true('Section A is parent of notebook1');
				});

				it('Section A is parent of notebook1 passing the JupyterBookSection', async () => {
					bookTocManager = new BookTocManager(sourceBookModel);
					const section: JupyterBookSection = {
						title: sectionA.title,
						file: sectionA.uri
					};
					let isParent = bookTocManager.isParent(notebook1, sourceBook, section);
					should(isParent).be.true('Section A is parent of notebook1');
				});

				it('Check notebook1 is descendant of Section C', async () => {
					bookTocManager = new BookTocManager(sourceBookModel);
					sectionA.book.hierarchyId = '0';
					notebook1.book.hierarchyId = '0/1';
					sectionA.rootContentPath = run.sectionA.contentFolder;
					notebook1.rootContentPath = run.sectionA.contentFolder;
					bookTocManager.enableDnd = true;
					let isDescendant = bookTocManager.isDescendant(sectionA, notebook1);
					should(isDescendant).be.true('Notebook 1 is descendant of Section A');
					isDescendant = bookTocManager.isDescendant(sectionB, notebook1);
					should(isDescendant).be.false('Notebook 1 is not descendant of Section B');
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
