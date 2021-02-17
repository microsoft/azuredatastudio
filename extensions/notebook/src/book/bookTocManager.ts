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

export interface IBookTocManager {
	updateBook(element: BookTreeItem, book: BookTreeItem, targetSection?: JupyterBookSection): Promise<void>;
	createBook(bookContentPath: string, contentFolder: string): Promise<void>;
	recovery(): Promise<void>
}

export interface quickPickResults {
	quickPickSection?: vscode.QuickPickItem,
	book?: BookTreeItem
}

const allowedFileExtensions: string[] = ['.md', '.ipynb'];
const initMarkdown: string[] = ['index.md', 'introduction.md', 'intro.md', 'readme.md'];

export function hasSections(node: JupyterBookSection): boolean {
	return node.sections !== undefined && node.sections.length > 0;
}

export class BookTocManager implements IBookTocManager {
	public tableofContents: JupyterBookSection[];
	public newSection: JupyterBookSection;
	private _movedFiles: Map<string, string>;
	private _modifiedDirectory: Set<string>;
	private _tocFiles: Map<string, JupyterBookSection[]>;
	private sourceBookContentPath: string;
	private targetBookContentPath: string;
	private _sourceBook: BookModel;

	constructor(targetBook?: BookModel, sourceBook?: BookModel) {
		this._sourceBook = sourceBook;
		this.newSection = {};
		this.tableofContents = [];
		this._movedFiles = new Map<string, string>();
		this._modifiedDirectory = new Set<string>();
		this._tocFiles = new Map<string, JupyterBookSection[]>();
		this.sourceBookContentPath = sourceBook?.bookItems[0].rootContentPath;
		this.targetBookContentPath = targetBook?.bookItems[0].rootContentPath;
	}

	async getAllFiles(toc: JupyterBookSection[], directory: string, filesInDir: string[], rootDirectory: string): Promise<JupyterBookSection[]> {
		await Promise.all(filesInDir.map(async file => {
			let isDirectory = (await fs.promises.stat(path.join(directory, file))).isDirectory();
			if (isDirectory) {
				let files = await fs.promises.readdir(path.join(directory, file));
				let initFile: string = '';
				//Add files named as readme or index within the directory as the first file of the section.
				files.some((f, index) => {
					if (initMarkdown.includes(f)) {
						initFile = path.parse(f).name;
						files.splice(index, 1);
					}
				});
				let jupyterSection: JupyterBookSection = {
					title: file,
					file: path.join(file, initFile),
					expand_sections: true,
					numbered: false,
					sections: []
				};
				toc.push(jupyterSection);
				await this.getAllFiles(toc, path.join(directory, file), files, rootDirectory);
			} else if (allowedFileExtensions.includes(path.extname(file))) {
				// if the file is in the book root we don't include the directory.
				const filePath = directory === rootDirectory ? path.parse(file).name : path.join(path.basename(directory), path.parse(file).name);
				const addFile: JupyterBookSection = {
					title: path.parse(file).name,
					file: filePath
				};
				//find if the directory (section) of the file exists else just add the file at the end of the table of contents
				let indexToc = toc.findIndex(parent => parent.title === path.basename(directory));
				//if there is not init markdown file then add the first notebook or markdown file that is found
				if (indexToc !== -1) {
					if (toc[indexToc].file === '') {
						toc[indexToc].file = addFile.file;
					} else {
						toc[indexToc].sections.push(addFile);
					}
				} else {
					toc.push(addFile);
				}
			}
		}));
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
		await fs.move(src, path.join(newFileName.concat(' - ', counter.toString())).concat(path.parse(dest).ext), { overwrite: true });
		this._movedFiles.set(src, path.join(newFileName.concat(' - ', counter.toString())).concat(path.parse(dest).ext));
		vscode.window.showInformationMessage(loc.duplicateFileError(path.parse(dest).base, src, newFileName.concat(' - ', counter.toString())));
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
		this._movedFiles.forEach(async (value, key) => {
			await fs.move(value, key);
		});

		this._tocFiles.forEach(async (value, key) => {
			await fs.writeFile(key, yaml.safeDump(value, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
		});
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
					let newPath = this._movedFiles.get(filePath);
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
	 * Reads and modifies the table of contents file of the target book.
	 * @param version the version of the target book
	 * @param tocPath Path to the table of contents
	 * @param findSection The section that will be modified.
	 * @param addSection The section that'll be added to the target section. If it's undefined then the target section (findSection) is removed from the table of contents.
	*/
	async updateTOC(version: BookVersion, tocPath: string, findSection: JupyterBookSection, addSection?: JupyterBookSection): Promise<void> {
		const toc = yaml.safeLoad((await fs.readFile(tocPath, 'utf8')));
		this._tocFiles.set(tocPath, toc);
		let newToc = new Array<JupyterBookSection>(toc.length);
		for (const [index, section] of toc.entries()) {
			let newSection = this.buildTOC(version, section, findSection, addSection);
			if (newSection) {
				newToc[index] = newSection;
			}
		}
		await fs.writeFile(tocPath, yaml.safeDump(newToc, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
		this.tableofContents = newToc;
	}

	/**
	 * Creates a new table of contents structure containing the added section. This method is only called when we move a section to another section.
	 * Since the sections can be arranged in a tree structure we need to look for the section that will be modified in a recursively.
	 * @param version Version of the book
	 * @param section The current section that we are iterating
	 * @param findSection The section that will be modified.
	 * @param addSection The section that'll be added to the target section. If it's undefined then the target section (findSection) is removed from the table of contents.
	*/
	private buildTOC(version: BookVersion, section: JupyterBookSection, findSection: JupyterBookSection, addSection: JupyterBookSection): JupyterBookSection {
		// condition to find the section to be modified
		if (section.title === findSection.title && (section.file && section.file === findSection.file || section.url && section.url === findSection.file)) {
			if (addSection) {
				//if addSection is not undefined, then we added to the table of contents.
				section.sections !== undefined && section.sections.length > 0 ? section.sections.push(addSection) : section.sections = [addSection];
				return section;
			}
			// if addSection is undefined then we remove the whole section from the table of contents.
			return addSection;
		} else {
			let newSection = convertTo(version, section);
			if (section.sections && section.sections.length > 0) {
				newSection.sections = [] as JupyterBookSection[];
				for (let s of section.sections) {
					const child = this.buildTOC(version, s, findSection, addSection);
					if (child) {
						newSection.sections.push(convertTo(version, child));
					}
				}
			}
			if (newSection.sections?.length === 0) {
				// if sections is an empty array then assign it to undefined, so it's converted into a markdown file.
				newSection.sections = undefined;
			}
			return newSection;
		}
	}

	/**
	 * Follows the same logic as the JupyterBooksCreate.ipynb. It receives a path that contains a notebooks and
	 * a path where it creates the book. It copies the contents from one folder to another and creates a table of contents.
	 * @param bookContentPath The path to the book folder, the basename of the path is the name of the book
	 * @param contentFolder The path to the folder that contains the notebooks and markdown files to be added to the created book.
	*/
	public async createBook(bookContentPath: string, contentFolder: string): Promise<void> {
		await fs.promises.mkdir(bookContentPath);
		await fs.copy(contentFolder, bookContentPath);
		let filesinDir = await fs.readdir(bookContentPath);
		this.tableofContents = await this.getAllFiles([], bookContentPath, filesinDir, bookContentPath);
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
				try {
					await fs.move(path.join(this.sourceBookContentPath, elem.file).concat('.ipynb'), path.join(this.targetBookContentPath, elem.file).concat('.ipynb'), { overwrite: false });
					this._movedFiles.set(path.join(this.sourceBookContentPath, elem.file).concat('.ipynb'), path.join(this.targetBookContentPath, elem.file).concat('.ipynb'));
				} catch (error) {
					if (error.code === 'EEXIST') {
						fileName = await this.renameFile(path.join(this.sourceBookContentPath, elem.file).concat('.ipynb'), path.join(this.targetBookContentPath, elem.file).concat('.ipynb'));
					}
					else if (error.code !== 'ENOENT') {
						throw (error);
					}
				}
				try {
					await fs.move(path.join(this.sourceBookContentPath, elem.file).concat('.md'), path.join(this.targetBookContentPath, elem.file).concat('.md'), { overwrite: false });
					this._movedFiles.set(path.join(this.sourceBookContentPath, elem.file).concat('.md'), path.join(this.targetBookContentPath, elem.file).concat('.md'));
				} catch (error) {
					if (error.code === 'EEXIST') {
						fileName = await this.renameFile(path.join(this.sourceBookContentPath, elem.file).concat('.md'), path.join(this.targetBookContentPath, elem.file).concat('.md'));
					}
					else if (error.code !== 'ENOENT') {
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
	async addSection(section: BookTreeItem, book: BookTreeItem): Promise<void> {
		const uri = path.sep.concat(path.relative(section.rootContentPath, section.book.contentPath));
		let moveFile = path.join(path.parse(uri).dir, path.parse(uri).name);
		let fileName = undefined;
		try {
			await fs.move(section.book.contentPath, path.join(this.targetBookContentPath, moveFile).concat(path.parse(uri).ext), { overwrite: false });
			this._movedFiles.set(section.book.contentPath, path.join(this.targetBookContentPath, moveFile).concat(path.parse(uri).ext));
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
		this.newSection.title = section.title;
		this.newSection.file = path.join(path.parse(uri).dir, fileName)?.replace(/\\/g, '/');
		if (section.sections) {
			const files = section.sections as JupyterBookSection[];
			const movedSections = await this.traverseSections(files);
			this.newSection.sections = movedSections;
			this._modifiedDirectory.add(path.dirname(section.book.contentPath));
			this.cleanUp(path.dirname(section.book.contentPath));
		}

		if (book.version === BookVersion.v1) {
			// here we only convert if is v1 because we are already using the v2 notation for every book that we read.
			this.newSection = convertTo(book.version, this.newSection);
		}
	}

	/**
	 * Moves a notebook to a book top level or a book's section. If there's a target section we add the the targetSection directory if it has one and append it to the
	 * notebook's path. The overwrite option is set to false to prevent any issues with duplicated file names.
	 * @param element Notebook, Markdown File, or section that will be added to the book.
	 * @param targetBook Book that will be modified.
	*/
	async addNotebook(notebook: BookTreeItem, book: BookTreeItem): Promise<void> {
		const rootPath = book.rootContentPath;
		const notebookPath = path.parse(notebook.book.contentPath);
		let fileName = undefined;
		try {
			await fs.move(notebook.book.contentPath, path.join(rootPath, notebookPath.base), { overwrite: false });
		} catch (error) {
			if (error.code === 'EEXIST') {
				fileName = await this.renameFile(notebook.book.contentPath, path.join(rootPath, notebookPath.base));
			}
			else {
				throw (error);
			}
		}

		if (this._sourceBook) {
			const sectionTOC = this._sourceBook.bookItems[0].findChildSection(notebook.uri);
			if (sectionTOC) {
				this.newSection = sectionTOC;
			}
		}
		fileName = fileName === undefined ? notebookPath.name : path.parse(fileName).name;
		this.newSection.file = path.sep.concat(fileName).replace(/\\/g, '/');
		this.newSection.title = notebook.book.title;
		if (book.version === BookVersion.v1) {
			// here we only convert if is v1 because we are already using the v2 notation for every book that we read.
			this.newSection = convertTo(book.version, this.newSection);
		}
	}

	/**
	 * Moves the element to the target book's folder and adds it to the table of contents.
	 * @param element Notebook, Markdown File, or section that will be added to the book.
	 * @param targetBook Book that will be modified.
	 * @param targetSection Book section that'll be modified.
	*/
	public async updateBook(element: BookTreeItem, targetBook: BookTreeItem, targetSection?: JupyterBookSection): Promise<void> {
		const targetBookVersion = targetBook.book.version as BookVersion;
		if (element.contextValue === 'section') {
			// modify the sourceBook toc and remove the section
			const findSection: JupyterBookSection = { file: element.book.page.file?.replace(/\\/g, '/'), title: element.book.page.title };
			await this.addSection(element, targetBook);
			const elementVersion = element.book.version as BookVersion;
			await this.updateTOC(elementVersion, element.tableOfContentsPath, findSection, undefined);
			if (targetSection) {
				// adding new section to the target book toc file
				await this.updateTOC(targetBookVersion, targetBook.tableOfContentsPath, targetSection, this.newSection);
			}
			else {
				//since there's not a target section, we just append the section at the end of the file
				if (this.targetBookContentPath !== this.sourceBookContentPath) {
					this.tableofContents = targetBook.sections.map(section => convertTo(targetBook.version, section));
				}
				this.tableofContents.push(this.newSection);
				await fs.writeFile(targetBook.tableOfContentsPath, yaml.safeDump(this.tableofContents, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
			}
		}
		else if (element.contextValue === 'savedNotebook') {
			// the notebook is part of a book so we need to modify its toc as well
			const findSection = { file: element.book.page?.file?.replace(/\\/g, '/'), title: element.book.page?.title };
			await this.addNotebook(element, targetBook);
			if (element.tableOfContentsPath) {
				const elementVersion = element.book.version as BookVersion;
				await this.updateTOC(elementVersion, element.tableOfContentsPath, findSection, undefined);
			} else {
				// close the standalone notebook, so it doesn't throw an error when we move the notebook to new location.
				await vscode.commands.executeCommand('notebook.command.closeNotebook', element);
			}
			if (!targetSection) {
				if (this.targetBookContentPath !== this.sourceBookContentPath) {
					this.tableofContents = targetBook.sections.map(section => convertTo(targetBook.version, section));
				}
				this.tableofContents.push(this.newSection);
				await fs.writeFile(targetBook.tableOfContentsPath, yaml.safeDump(this.tableofContents, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
			} else {
				await this.updateTOC(targetBookVersion, targetBook.tableOfContentsPath, targetSection, this.newSection);
			}
		}
	}

	public get movedFiles(): Map<string, string> {
		return this._movedFiles;
	}

	public get originalToc(): Map<string, JupyterBookSection[]> {
		return this._tocFiles;
	}

	public get modifiedDir(): Set<string> {
		return this._modifiedDirectory;
	}

	public set movedFiles(files: Map<string, string>) {
		this._movedFiles = files;
	}

	public set originalToc(files: Map<string, JupyterBookSection[]>) {
		this._tocFiles = files;
	}

	public set modifiedDir(files: Set<string>) {
		this._modifiedDirectory = files;
	}
}
