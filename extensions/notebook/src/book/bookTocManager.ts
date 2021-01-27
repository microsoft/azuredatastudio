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

export interface IBookTocManager {
	updateBook(element: BookTreeItem, book: BookTreeItem, targetSection?: JupyterBookSection): Promise<void>;
	createBook(bookContentPath: string, contentFolder: string): Promise<void>;
}

const allowedFileExtensions: string[] = ['.md', '.ipynb'];
const initMarkdown: string[] = ['index.md', 'introduction.md', 'intro.md', 'readme.md'];

export function hasSections(node: JupyterBookSection): boolean {
	return node.sections !== undefined && node.sections.length > 0;
}

export class BookTocManager implements IBookTocManager {
	public tableofContents: JupyterBookSection[];
	public newSection: JupyterBookSection = {};
	private sourceBookContentPath: string;
	private targetBookContentPath: string;

	constructor() {
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
		vscode.window.showInformationMessage(loc.duplicateFileError(path.parse(dest).base, src, newFileName.concat(' - ', counter.toString())));
		return newFileName.concat(' - ', counter.toString());
	}

	/**
	 * Reads and modifies the table of contents file of the target book.
	 * @param version the version of the target book
	 * @param tocPath Path to the table of contents
	 * @param findSection The section that will be modified.
	 * @param addSection The section that'll be added to the target section. If it's undefined then the target section (findSection) is removed from the table of contents.
	*/
	async updateTOC(version: string, tocPath: string, findSection: JupyterBookSection, addSection?: JupyterBookSection): Promise<void> {
		const toc = yaml.safeLoad((await fs.readFile(tocPath, 'utf8')));
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
	private buildTOC(version: string, section: JupyterBookSection, findSection: JupyterBookSection, addSection: JupyterBookSection): JupyterBookSection {
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
	 * When moving a section, we need to modify every file path that it's within the section. Since sections is a tree like structure, we need to recursively and modify each of the file paths
	 * and move the files individually. The overwrite option is set to false to prevent any issues with duplicated file names.
	 * @param files Files in the section.
	 * @param dirName The directory path of the target section that will be appended to the target book's root.
	*/
	async traverseSections(files: JupyterBookSection[], dirName: string): Promise<JupyterBookSection[]> {
		let movedSections: JupyterBookSection[] = [];
		for (const elem of files) {
			let fileName = undefined;
			try {
				await fs.move(path.join(this.sourceBookContentPath, elem.file).concat('.ipynb'), path.join(this.targetBookContentPath, dirName, elem.file).concat('.ipynb'), { overwrite: false });
			} catch (error) {
				if (error.code === 'EEXIST') {
					fileName = await this.renameFile(path.join(this.sourceBookContentPath, elem.file).concat('.ipynb'), path.join(this.targetBookContentPath, dirName, elem.file).concat('.ipynb'));
				}
				else if (error.code !== 'ENOENT') {
					throw (error);
				}
			}
			try {
				await fs.move(path.join(this.sourceBookContentPath, elem.file).concat('.md'), path.join(this.targetBookContentPath, dirName, elem.file).concat('.md'), { overwrite: false });
			} catch (error) {
				if (error.code === 'EEXIST') {
					fileName = await this.renameFile(path.join(this.sourceBookContentPath, elem.file).concat('.md'), path.join(this.targetBookContentPath, dirName, elem.file).concat('.md'));
				}
				else if (error.code !== 'ENOENT') {
					throw (error);
				}
			}
			movedSections.push({ file: fileName === undefined ? path.join(dirName, elem.file) : path.join(dirName, path.parse(fileName).name), title: elem.title, sections: elem.sections ? await this.traverseSections(elem.sections, dirName) : undefined });
		}
		return movedSections;
	}

	/**
	 * Moves a section to a book top level or another book's section. If there's a target section we add the the targetSection directory if it has one and append it to the
	 * notebook's path. The overwrite option is set to false to prevent any issues with duplicated file names.
	 * @param section The section that's been moved.
	 * @param book The target book.
	 * @param targetSection The target book's section that'll be modified.
	*/
	async addSection(section: BookTreeItem, book: BookTreeItem, targetSection?: JupyterBookSection): Promise<void> {
		this.sourceBookContentPath = section.rootContentPath;
		this.targetBookContentPath = book.rootContentPath;
		this.newSection.title = section.title;
		const uri = path.sep.concat(path.relative(section.rootContentPath, section.book.contentPath));
		const dirName = targetSection ? path.dirname(targetSection.file) : '';
		let moveFile = targetSection ? path.join(path.dirname(targetSection.file), path.parse(uri).dir, path.parse(uri).name) : path.join(path.parse(uri).dir, path.parse(uri).name);
		let fileName = undefined;
		try {
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
		this.newSection.file = targetSection ? path.join(path.dirname(targetSection.file), path.parse(uri).dir, fileName) : path.join(path.parse(uri).dir, fileName);
		if (section.sections) {
			const files = section.sections as JupyterBookSection[];
			const movedSections = await this.traverseSections(files, dirName);
			this.newSection.sections = movedSections;
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
	 * @param targetSection Book section that'll be modified.
	*/
	async addNotebook(notebook: BookTreeItem, book: BookTreeItem, targetSection?: JupyterBookSection): Promise<void> {
		//the book's contentPath contains the first file of the section, we get the dirname to identify the section's root path
		const rootPath = targetSection ? path.join(book.rootContentPath, path.dirname(targetSection.file)) : book.rootContentPath;
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
		fileName = fileName === undefined ? notebookPath.name : fileName;
		this.newSection = { file: targetSection ? path.join(path.dirname(targetSection.file), fileName) : path.sep.concat(fileName), title: notebook.book.title };
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
		if (element.contextValue === 'section') {
			await this.addSection(element, targetBook, targetSection);
			// modify the sourceBook toc and remove the section
			const findSection: JupyterBookSection = { file: element.book.page.file, title: element.book.page.title };
			await this.updateTOC(element.book.version, element.tableOfContentsPath, findSection, undefined);
			if (targetSection) {
				// adding new section to the target book toc file
				await this.updateTOC(targetBook.book.version, targetBook.tableOfContentsPath, targetSection, this.newSection);
			}
			else {
				//since there's not a target section, we just append the section at the end of the file
				if (element.rootContentPath !== targetBook.rootContentPath) {
					this.tableofContents = targetBook.sections.map(section => convertTo(targetBook.version, section));
				}
				this.tableofContents.push(this.newSection);
				await fs.writeFile(targetBook.tableOfContentsPath, yaml.safeDump(this.tableofContents, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
			}
		}
		else if (element.contextValue === 'savedNotebook') {
			await this.addNotebook(element, targetBook, targetSection);
			if (element.book.tableOfContents.sections) {
				// the notebook is part of a book so we need to modify its toc as well
				const findSection = { file: element.book.page.file, title: element.book.page.title };
				await this.updateTOC(element.book.version, element.tableOfContentsPath, findSection, undefined);
			} else {
				// close the standalone notebook, so it doesn't throw an error when we move the notebook to new location.
				await vscode.commands.executeCommand('notebook.command.closeNotebook', element);
			}
			if (!targetSection) {
				this.tableofContents = targetBook.sections.map(section => convertTo(targetBook.version, section));
				this.tableofContents.push(this.newSection);
				await fs.writeFile(targetBook.tableOfContentsPath, yaml.safeDump(this.tableofContents, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
			} else {
				await this.updateTOC(targetBook.book.version, targetBook.tableOfContentsPath, targetSection, this.newSection);
			}
		}
		this.newSection = {};
	}
}

