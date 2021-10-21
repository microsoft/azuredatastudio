/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import { BookTreeItem } from './bookTreeItem';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import { JupyterBookSection } from '../contracts/content';
import { BookVersion, convertTo } from './bookVersionHandler';
import * as vscode from 'vscode';
import * as loc from '../common/localizedConstants';
import { BookModel } from './bookModel';
import { TocEntryPathHandler } from './tocEntryPathHandler';
import { FileExtension, BookTreeItemType } from '../common/utils';

export interface IBookTocManager {
	updateBook(sources: BookTreeItem[], target: BookTreeItem, targetSection?: JupyterBookSection): Promise<void>;
	removeNotebook(element: BookTreeItem): Promise<void>;
	createBook(bookContentPath: string, contentFolder: string): Promise<void>;
	addNewTocEntry(pathDetails: TocEntryPathHandler, bookItem: BookTreeItem, isSection?: boolean): Promise<void>;
	recovery(): Promise<void>;
	enableDnd: boolean;
}

export interface quickPickResults {
	quickPickSection?: vscode.QuickPickItem,
	book?: BookTreeItem
}

const allowedFileExtensions: string[] = [FileExtension.Markdown, FileExtension.Notebook];

export function hasSections(node: JupyterBookSection): boolean {
	return node.sections?.length > 0;
}

export class BookTocManager implements IBookTocManager {
	public tableofContents: JupyterBookSection[] = [];
	public newSection: JupyterBookSection = {};
	public movedFiles: Map<string, string> = new Map<string, string>();
	private _modifiedDirectory: Set<string> = new Set<string>();
	public tocFiles: Map<string, string> = new Map<string, string>();
	private sourceBookContentPath: string;
	private targetBookContentPath: string;
	private _enableDnd: boolean = false;

	constructor(private _sourceBook?: BookModel, private _targetBook?: BookModel) {
		this._targetBook?.unwatchTOC();
		this._sourceBook?.unwatchTOC();
		this.sourceBookContentPath = this._sourceBook?.bookItems[0].rootContentPath;
		this.targetBookContentPath = this._targetBook?.bookItems[0].rootContentPath;
	}

	/**
	 * Files in the table of contents are ordered alpha-numerically, if there's a file named
	 * 'index.md' then it's treated as the first file.
	 * @param files The files in the directory
	*/
	getInitFile(files: string[]): path.ParsedPath | undefined {
		let initFile = undefined;
		//
		const initFileIndex = files.findIndex(f => f === 'index.md');

		// If it doesnt find a file named as 'index.md' then use the first file we find.
		if (initFileIndex !== -1) {
			initFile = path.parse(files[initFileIndex]);
		} else {
			files.some((f) => {
				const parsedPath = path.parse(f);
				if (allowedFileExtensions.includes(parsedPath.ext)) {
					initFile = parsedPath;
					return true;
				}
				return false;
			});
		}
		return initFile;
	}

	/**
	 * Creates the table of contents of a book by reading the folder structure
	 * that the user provides.
	 * @param contents The contents of directory.
	 * @param directory The current directory.
	 * @param rootDirectory The root path of the book.
	 * Returns an array of Jupyter Sections.
	*/
	async createTocFromDir(contents: string[], directory: string, rootDirectory: string): Promise<JupyterBookSection[]> {
		let toc: JupyterBookSection[] = [];
		for (const content of contents) {
			try {
				const contentStat = (await fs.promises.stat(path.posix.join(directory, content)));
				const parsedFile = path.parse(content);
				if (contentStat.isFile() && allowedFileExtensions.includes(parsedFile.ext)) {
					let filePath = directory === rootDirectory ? path.posix.join(path.posix.sep, parsedFile.name) : path.posix.join(path.posix.sep, path.posix.relative(rootDirectory, directory), parsedFile.name);
					const section: JupyterBookSection = {
						title: parsedFile.name,
						file: filePath
					};
					toc.push(section);
				} else if (contentStat.isDirectory()) {
					let files = await fs.promises.readdir(path.posix.join(directory, content));
					let initFile = this.getInitFile(files);
					let filePath = directory === rootDirectory ? path.posix.join(path.posix.sep, parsedFile.name, initFile.name) : path.posix.join(path.posix.sep, path.posix.relative(rootDirectory, directory), parsedFile.name, initFile.name);
					let section: JupyterBookSection = {};
					section = {
						title: parsedFile.name,
						file: filePath,
						expand_sections: true,
						numbered: false,
						sections: await this.createTocFromDir(files, path.posix.join(directory, content), rootDirectory)
					};
					toc.push(section);
				}
			}
			catch (error) {
				void vscode.window.showWarningMessage(loc.msgCreateBookWarningMsg(content));
			}
		}
		return toc;
	}

	/**
	 * Renames files if it already exists in the target book
	 * @param src The source file that will be moved.
	 * @param dest The destination path of the file, that it's been moved.
	 * Returns a new file name that does not exist in destination folder.
	*/
	async renameFile(src: string, dest: string): Promise<string> {
		let newFileName = path.join(path.parse(dest).dir, path.parse(dest).name);
		let counter = 2;
		while (await fs.pathExists(path.join(newFileName.concat(' - ', counter.toString())).concat(path.parse(dest).ext))) {
			counter++;
		}
		this.movedFiles.set(src, path.join(newFileName.concat(' - ', counter.toString())).concat(path.parse(dest).ext));
		await fs.move(src, path.join(newFileName.concat(' - ', counter.toString())).concat(path.parse(dest).ext), { overwrite: true });
		void vscode.window.showInformationMessage(loc.duplicateFileError(path.parse(dest).base, src, newFileName.concat(' - ', counter.toString())));
		return newFileName.concat(' - ', counter.toString());
	}

	/**
	 * Restore user's original state in case of error, when trying to move files.
	 * We keep track of all the moved files in the _movedFiles. The value of the map contains the current path of the file,
	 * while the key contains the original path.
	 *
	 * Rewrite the original table of contents of the book, in case of error as well.
	*/
	async recovery(): Promise<void> {
		for (const [key, value] of this.movedFiles.entries()) {
			await fs.move(value, key);
		}

		for (const [key, value] of this.tocFiles.entries()) {
			const yamlFile = await yaml.safeLoad(value);
			await fs.writeFile(key, yaml.safeDump(yamlFile, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
		}
	}

	async cleanUp(directory: string): Promise<void> {
		let contents = await fs.readdir(directory);
		if (contents.length === 0 && this._modifiedDirectory.has(directory)) {
			// remove empty folders
			await fs.rmdir(directory);
		} else {
			contents.forEach(async (content) => {
				let filePath = path.join(directory, content);
				let fileStat = await fs.stat(filePath);
				if (fileStat.isFile) {
					//check if the file is in the moved files
					let newPath = this.movedFiles.get(filePath);
					if (newPath) {
						let exists = await fs.pathExists(newPath);
						// if the file exists in the new path and if the the new path and old path are different
						// then we can remove it
						if (exists && newPath !== filePath) {
							// the file could not be renamed, so a copy was created.
							await fs.unlink(filePath);
						}
					}
				} else if (fileStat.isDirectory) {
					await this.cleanUp(filePath);
				}
			});
		}
	}

	/**
	 * Reads and modifies the table of contents file of book.
	 * @param version the version of book.
	 * @param tocPath Path to the table of contents
	 * @param findSection The section that will be modified. If findSection is undefined then the added section is added at the end of the toc file.
	 * @param addSection The section that'll be added to the target section. If it's undefined then the target section (findSection) is removed from the table of contents.
	*/
	async updateTOC(version: BookVersion, tocPath: string, findSection?: JupyterBookSection, addSection?: JupyterBookSection): Promise<void> {
		const tocFile = await fs.readFile(tocPath, 'utf8');
		this.tableofContents = yaml.safeLoad(tocFile);
		if (!this.tocFiles.has(tocPath)) {
			this.tocFiles.set(tocPath, tocFile);
		}
		let isModified = false;
		if (findSection) {
			isModified = this.modifyToc(version, this.tableofContents, findSection, addSection);
		} else if (addSection) {
			this.tableofContents.push(addSection);
			isModified = true;
		}
		if (isModified) {
			await fs.writeFile(tocPath, yaml.safeDump(this.tableofContents, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
		} else {
			throw (new Error(loc.sectionNotFound(findSection.title, tocPath)));
		}
	}

	/**
	 * Modify the table of contents read from file to add or remove a section.
	 *
	 * Returns true if the table of contents is modified successfully. If it does not find the section that will be modified then that means that the toc and book tree view are not showing the same information,
	 * in that case return false.
	 *
	 * @param version Version of the book
	 * @param toc The table of contents that will be modified
	 * @param findSection The section that will be modified.
	 * @param addSection The section that'll be added to the target section. If it's undefined then the target section (findSection) is removed from the table of contents.
	*/
	private modifyToc(version: BookVersion, toc: JupyterBookSection[], findSection: JupyterBookSection, addSection: JupyterBookSection): boolean {
		for (const [index, section] of toc.entries()) {
			if (section.title === findSection.title && (section.file && section.file === findSection.file || section.url && section.url === findSection.file)) {
				if (addSection) {
					//if addSection is not undefined, then we added to the table of contents.
					section.sections !== undefined && section.sections.length > 0 ? section.sections.push(addSection) : section.sections = [addSection];
					toc[index] = section;
				} else {
					// if addSection is undefined then we remove the whole section from the table of contents.
					toc[index] = addSection;
				}
				return true;
			} else if (hasSections(section)) {
				const found = this.modifyToc(version, section.sections, findSection, addSection);
				if (found) {
					// we only want to return true if it finds the section and modifies the toc
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Follows the same logic as the JupyterBooksCreate.ipynb. It receives a path that contains a notebooks and
	 * a path where it creates the book. It copies the contents from one folder to another and creates a table of contents.
	 * @param bookContentPath - The path to the book folder, the basename of the path is the name of the book
	 * @param contentFolder - (Optional) The path to the folder that contains the notebooks and markdown files to be added to the created book.
	 * If it's undefined then a blank notebook is attached to the book.
	*/
	public async createBook(bookContentPath: string, contentFolder?: string): Promise<void> {
		await fs.promises.mkdir(bookContentPath, { recursive: true });
		if (contentFolder) {
			await fs.copy(contentFolder, bookContentPath);
		} else {
			await fs.writeFile(path.join(bookContentPath, 'README.md'), '');
		}
		let contents = await fs.promises.readdir(bookContentPath);
		const initFile = this.getInitFile(contents);
		if (initFile) {
			contents.splice(contents.indexOf(initFile.base), 1);
			contents.unshift(initFile.base);
		}
		this.tableofContents = await this.createTocFromDir(contents, bookContentPath, bookContentPath);
		await fs.writeFile(path.join(bookContentPath, '_config.yml'), yaml.safeDump({ title: path.basename(bookContentPath) }));
		await fs.writeFile(path.join(bookContentPath, '_toc.yml'), yaml.safeDump(this.tableofContents, { lineWidth: Infinity }));
		await vscode.commands.executeCommand('notebook.command.openNotebookFolder', bookContentPath, undefined, true);
	}

	/**
	 * When moving a section, we need to modify every file path that it's within the section. Since sections is a tree like structure, we need to modify each of the file paths
	 * and move the files individually. The overwrite option is set to false to prevent any issues with duplicated file names.
	 * @param files Files in the section.
	*/
	async traverseSections(files: JupyterBookSection[]): Promise<JupyterBookSection[]> {
		let movedSections: JupyterBookSection[] = [];
		for (const elem of files) {
			if (elem.file) {
				let fileName = undefined;
				// the toc does not provide the extension of the file, so we need to try for notebooks and markdown
				try {
					this.movedFiles.set(path.join(this.sourceBookContentPath, elem.file).concat('.ipynb'), path.join(this.targetBookContentPath, elem.file).concat('.ipynb'));
					await fs.move(path.join(this.sourceBookContentPath, elem.file).concat('.ipynb'), path.join(this.targetBookContentPath, elem.file).concat('.ipynb'), { overwrite: false });
				} catch (error) {
					if (error.code === 'EEXIST') {
						// if the file already exists in destination, then rename it before moving it.
						fileName = await this.renameFile(path.join(this.sourceBookContentPath, elem.file).concat('.ipynb'), path.join(this.targetBookContentPath, elem.file).concat('.ipynb'));
					} else if (error.code === 'ENOENT') {
						// if it doesnt exist then remove it from movedFiles
						this.movedFiles.delete(path.join(this.sourceBookContentPath, elem.file).concat('.ipynb'));
					}
					else {
						throw (error);
					}
				}
				try {
					this.movedFiles.set(path.join(this.sourceBookContentPath, elem.file).concat('.md'), path.join(this.targetBookContentPath, elem.file).concat('.md'));
					await fs.move(path.join(this.sourceBookContentPath, elem.file).concat('.md'), path.join(this.targetBookContentPath, elem.file).concat('.md'), { overwrite: false });
				} catch (error) {
					if (error.code === 'EEXIST') {
						// if the file already exists in destination, then rename it before moving it.
						fileName = await this.renameFile(path.join(this.sourceBookContentPath, elem.file).concat('.md'), path.join(this.targetBookContentPath, elem.file).concat('.md'));
					} else if (error.code === 'ENOENT') {
						// if it doesnt exist then remove it from movedFiles
						this.movedFiles.delete(path.join(this.sourceBookContentPath, elem.file).concat('.md'));
					}
					else {
						throw (error);
					}
				}
				elem.file = fileName === undefined ? elem.file : path.join(path.dirname(elem.file), path.parse(fileName).name);
				elem.sections = elem.sections ? await this.traverseSections(elem.sections) : undefined;
			}

			movedSections.push(elem);
		}
		return movedSections;
	}

	/**
	 * Moves a section to a book top level or another book's section. If there's a target section we add the the targetSection directory if it has one and append it to the
	 * notebook's path. The overwrite option is set to false to prevent any issues with duplicated file names.
	 * @param section The section that's been moved.
	 * @param book The target book.
	*/
	async moveSectionFiles(section: BookTreeItem, bookItem: BookTreeItem): Promise<void> {
		const uri = path.posix.join(path.posix.sep, path.relative(section.rootContentPath, section.book.contentPath));
		let moveFile = path.join(path.parse(uri).dir, path.parse(uri).name);
		let fileName = undefined;
		try {
			this.movedFiles.set(section.book.contentPath, path.join(this.targetBookContentPath, moveFile).concat(path.parse(uri).ext));
			await fs.move(section.book.contentPath, path.join(this.targetBookContentPath, moveFile).concat(path.parse(uri).ext), { overwrite: false });
		} catch (error) {
			if (error.code === 'EEXIST') {
				fileName = await this.renameFile(section.book.contentPath, path.join(this.targetBookContentPath, moveFile).concat(path.parse(uri).ext));
			}
			else if (error.code !== 'ENOENT') {
				throw (error);
			}
		}
		fileName = fileName === undefined ? path.parse(uri).name : path.parse(fileName).name;

		if (this._sourceBook) {
			const sectionTOC = this._sourceBook.bookItems[0].findChildSection(section.uri);
			if (sectionTOC) {
				this.newSection = sectionTOC;
			}
		}
		this.newSection.title = section.book.title;
		this.newSection.file = path.posix.join(path.parse(uri).dir, fileName);
		if (section.sections) {
			const files = section.sections as JupyterBookSection[];
			const movedSections = await this.traverseSections(files);
			this.newSection.sections = movedSections;
			this._modifiedDirectory.add(path.dirname(section.book.contentPath));
			await this.cleanUp(path.dirname(section.book.contentPath));
		}

		if (bookItem.book.version === BookVersion.v1) {
			// here we only convert if is v1 because we are already using the v2 notation for every book that we read.
			this.newSection = convertTo(bookItem.book.version, this.newSection);
		}
	}

	/**
	 * Moves a file to a book top level or a book's section. If there's a target section we add the the targetSection directory if it has one and append it to the
	 * files's path. The overwrite option is set to false to prevent any issues with duplicated file names.
	 * @param element Notebook, Markdown File, or book's notebook that will be added to the book.
	 * @param targetBook Book that will be modified.
	*/
	async moveFile(file: BookTreeItem, book: BookTreeItem): Promise<void> {
		const rootPath = book.rootContentPath;
		const filePath = path.parse(file.book.contentPath);
		let fileName = undefined;
		try {
			// no op if the notebook is already in the dest location
			this.movedFiles.set(file.book.contentPath, path.join(rootPath, filePath.base));
			if (file.book.contentPath !== path.join(rootPath, filePath.base)) {
				await fs.move(file.book.contentPath, path.join(rootPath, filePath.base), { overwrite: false });
			}
		} catch (error) {
			if (error.code === 'EEXIST') {
				fileName = await this.renameFile(file.book.contentPath, path.join(rootPath, filePath.base));
			}
			else {
				throw (error);
			}
		}

		if (this._sourceBook) {
			const sectionTOC = this._sourceBook.bookItems[0].findChildSection(file.uri);
			if (sectionTOC) {
				this.newSection = sectionTOC;
			}
		}
		fileName = fileName === undefined ? filePath.name : path.parse(fileName).name;
		this.newSection.file = path.posix.join(path.posix.sep, fileName);
		this.newSection.title = file.book.title;
		if (book.book.version === BookVersion.v1) {
			// here we only convert if is v1 because we are already using the v2 notation for every book that we read.
			this.newSection = convertTo(book.book.version, this.newSection);
		}
	}

	/**
	 * Moves the element to the target book's folder and adds it to the table of contents.
	 * @param sources The tree items that are been moved.
	 * @param target Target tree item on which the sources will be added
	 * @param section (Optional) book section that'll be modified. Not required when using drag and drop.
	*/
	public async updateBook(sources: BookTreeItem[], target: BookTreeItem, section?: JupyterBookSection): Promise<void> {
		for (let element of sources) {
			if (element.contextValue === BookTreeItemType.savedBook || this.isParent(element, target, section) || this.isDescendant(element, target)) {
				// no op if the moving element is a book, the target dest is descendant of the moving element, the target dest is already the moving element parent
				return;
			}
			try {
				const targetSection = section ? section : (target.contextValue === BookTreeItemType.section ? { file: target.book.page.file, title: target.book.page.title } : undefined);
				if (element.contextValue === BookTreeItemType.section) {
					// modify the sourceBook toc and remove the section
					const findSection: JupyterBookSection = { file: element.book.page.file, title: element.book.page.title };
					await this.moveSectionFiles(element, target);
					// remove section from book
					await this.updateTOC(element.book.version, element.tableOfContentsPath, findSection, undefined);
					// add section to book
					await this.updateTOC(target.book.version, target.tableOfContentsPath, targetSection, this.newSection);
				}
				else {
					// the notebook is part of a book so we need to modify its toc as well
					const findSection = { file: element.book.page.file, title: element.book.page.title };
					await this.moveFile(element, target);
					if (element.contextValue === BookTreeItemType.savedBookNotebook || element.contextValue === BookTreeItemType.Markdown) {
						// remove notebook entry from book toc
						await this.updateTOC(element.book.version, element.tableOfContentsPath, findSection, undefined);
					} else {
						// close the standalone notebook, so it doesn't throw an error when we move the notebook to new location.
						await vscode.commands.executeCommand('notebook.command.closeNotebook', element);
					}
					await this.updateTOC(target.book.version, target.tableOfContentsPath, targetSection, this.newSection);
				}
			} catch (e) {
				await this.recovery();
				void vscode.window.showErrorMessage(loc.editBookError(element.book.contentPath, e instanceof Error ? e.message : e));
			} finally {
				try {
					await this._targetBook.reinitializeContents();
				} finally {
					if (this._sourceBook && this._sourceBook.bookPath !== this._targetBook.bookPath) {
						// refresh source book model to pick up latest changes
						await this._sourceBook.reinitializeContents();
					}
				}
			}
		}
	}

	public async addNewTocEntry(pathDetails: TocEntryPathHandler, bookItem: BookTreeItem, isSection?: boolean): Promise<void> {
		let findSection: JupyterBookSection | undefined = undefined;
		await fs.writeFile(pathDetails.filePath, '');
		if (bookItem.contextValue === BookTreeItemType.section) {
			findSection = { file: bookItem.book.page.file, title: bookItem.book.page.title };
		}
		let fileEntryInToc: JupyterBookSection = {
			title: pathDetails.titleInTocEntry,
			file: pathDetails.fileInTocEntry
		};

		if (isSection) {
			fileEntryInToc.sections = [];
		}

		if (bookItem.book.version === BookVersion.v1) {
			fileEntryInToc = convertTo(BookVersion.v1, fileEntryInToc);
		}
		// book is already opened in notebooks view, so modifying the toc will add the new file automatically
		await this.updateTOC(bookItem.book.version, bookItem.tableOfContentsPath, findSection, fileEntryInToc);
		await this._sourceBook.reinitializeContents();
		await this.openResource(pathDetails);
	}

	public async openResource(pathDetails: TocEntryPathHandler): Promise<void> {
		if (pathDetails.fileExtension === FileExtension.Notebook) {
			await vscode.commands.executeCommand('bookTreeView.openNotebook', pathDetails.filePath);
		} else {
			await vscode.commands.executeCommand('bookTreeView.openMarkdown', pathDetails.filePath);
		}
	}

	public async removeNotebook(element: BookTreeItem): Promise<void> {
		const findSection = { file: element.book.page.file, title: element.book.page.title };
		await this.updateTOC(element.book.version, element.tableOfContentsPath, findSection, undefined);
		await this._sourceBook.reinitializeContents();
	}

	/**
	 * Checks that the targetTreeItem is descendant of the tree item used by the onDrop method.
	 * @param treeItem The moving element when using dnd.
	 * @param targetTreeItem The target element where the moving element is dropped.
	*/
	isDescendant(treeItem: BookTreeItem, targetTreeItem: BookTreeItem): boolean {
		return this._enableDnd && treeItem.rootContentPath === targetTreeItem.rootContentPath && targetTreeItem.book.hierarchyId?.includes(treeItem.book.hierarchyId);
	}

	/**
	 * Checks that the book tree item is the parent of the passed element used by the onDrop and the moveTo method.
	 * @param treeItem The child of the parent tree item.
	 * @param parentTreeItem The parent of the passed element or the Saved Book tree item.
	 * @param section (Optional) In case the parentTreeItem is the saved book, verify that the passed Jupyter Book Section is the parent of the treeItem.
	*/
	isParent(treeItem: BookTreeItem, parentTreeItem: BookTreeItem, section?: JupyterBookSection): boolean {
		if (section) {
			return section.file === treeItem.book.parent?.uri;
		}

		return treeItem.book.parent?.uri === parentTreeItem.uri &&
			treeItem.book.parent?.rootContentPath === parentTreeItem.rootContentPath &&
			treeItem.book.parent?.contextValue === parentTreeItem.contextValue &&
			treeItem.book.parent?.sections.length === parentTreeItem.sections.length &&
			treeItem.book.parent?.book.contentPath === parentTreeItem.book.contentPath;
	}

	public set enableDnd(useDnd: boolean) {
		this._enableDnd = useDnd;
	}

	public get modifiedDir(): Set<string> {
		return this._modifiedDirectory;
	}

	public set modifiedDir(files: Set<string>) {
		this._modifiedDirectory = files;
	}
}
