/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import { BookTreeItem } from './bookTreeItem';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import { JupyterBookSection } from '../contracts/content';
import { BookVersionHandler } from './bookVersionHandler';
import * as vscode from 'vscode';
import { BookVersion } from './bookModel';

export interface IBookTocManager {
	updateBook(element: BookTreeItem, book: BookTreeItem, targetSection?: JupyterBookSection): Promise<void>;
	createBook(bookContentPath: string, contentFolder: string): Promise<void>
}
export enum tocOp {
	Add,
	Remove
}

const allowedFileExtensions: string[] = ['.md', '.ipynb'];
const initMarkdown: string[] = ['index.md', 'introduction.md', 'intro.md', 'readme.md'];

export function hasSections(node: JupyterBookSection): boolean {
	return node.sections !== undefined && node.sections.length > 0;
}

export class BookTocManager implements IBookTocManager {
	public tableofContents: JupyterBookSection[];
	public newSection: JupyterBookSection = {};
	private _versionHandler = new BookVersionHandler();

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
	 * Modifies a tableOfContents
	 * @param tableOfContents Current table of contents of a book.
	 * @param findSection The section that will be modified.
	 * @param addSection The section that'll be added to the target section. If it's undefined then the target section (findSection) is removed from the table of contents.
	*/
	async updateTOC(version: string, tocPath: string, findSection: JupyterBookSection, addSection?: JupyterBookSection): Promise<void> {
		const toc = yaml.safeLoad((await fs.readFile(tocPath, 'utf8')));
		let newToc = new Array<JupyterBookSection>(toc.length);
		for (const [index, section] of toc.entries()) {
			newToc[index] = this.buildTOC(version, section, findSection, addSection);
		}
		await fs.writeFile(tocPath, yaml.safeDump(newToc, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
	}

	private buildTOC(version: string, section: JupyterBookSection, findSection: JupyterBookSection, addSection: JupyterBookSection): JupyterBookSection {
		if (section.title === findSection.title && (section.file && section.file === findSection.file || section.url && section.url === findSection.file)) {
			if (addSection) {
				section.sections !== undefined && section.sections.length > 0 ? section.sections.push(addSection) : section.sections = [addSection];
				return section;
			}
			return addSection;
		} else {
			let newSection = this._versionHandler.convertTo(version, section);
			if (section.sections && section.sections.length > 0) {
				newSection.sections = [] as JupyterBookSection[];
				for (let s of section.sections) {
					const child = this.buildTOC(version, s, findSection, addSection);
					if (child) {
						newSection.sections.push(this._versionHandler.convertTo(version, child));
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

	async addSection(section: BookTreeItem, book: BookTreeItem, targetSection?: JupyterBookSection): Promise<void> {
		this.newSection.title = section.title;
		const rootPath = targetSection ? path.join(book.rootContentPath, path.dirname(targetSection.file)) : book.rootContentPath;
		const uri = path.sep.concat(path.relative(section.rootContentPath, section.book.contentPath));
		this.newSection.file = targetSection ? path.join(path.dirname(targetSection.file), path.parse(uri).dir, path.parse(uri).name) : path.join(path.parse(uri).dir, path.parse(uri).name);
		let movedSections: JupyterBookSection[] = [];
		let files = section.sections as JupyterBookSection[];
		await fs.move(path.dirname(section.book.contentPath), path.join(rootPath, path.parse(uri).dir));
		for (const elem of files) {
			movedSections.push({ file: targetSection ? path.join(path.dirname(targetSection.file), elem.file) : elem.file, title: elem.title });
		}
		this.newSection.sections = movedSections;
		if (book.version === BookVersion.v1) {
			// here we only convert if is v1 because we are already using the v2 notation for every book that we read.
			this.newSection = this._versionHandler.convertTo(book.version, this.newSection);
		}
	}

	async addNotebook(notebook: BookTreeItem, book: BookTreeItem, targetSection?: JupyterBookSection): Promise<void> {
		//the book's contentPath contains the first file of the section, we get the dirname to identify the section's root path
		const rootPath = targetSection ? path.join(book.rootContentPath, path.dirname(targetSection.file)) : book.rootContentPath;
		const notebookPath = path.parse(notebook.book.contentPath);
		await fs.move(notebook.book.contentPath, path.join(rootPath, notebookPath.base));
		this.newSection = { file: targetSection ? path.join(path.dirname(targetSection.file), notebookPath.name) : path.sep.concat(notebookPath.name), title: notebookPath.name };
		if (book.version === BookVersion.v1) {
			// here we only convert if is v1 because we are already using the v2 notation for every book that we read.
			this.newSection = this._versionHandler.convertTo(book.version, this.newSection);
		}
	}

	/**
	 * Moves the element to the book's folder and adds it to the table of contents.
	 * @param element Notebook, Markdown File, or section that will be added to the book.
	 * @param targetBook Book that will be modified.
	 * @param targetSection Book section that'll be modified.
	*/
	public async updateBook(element: BookTreeItem, targetBook: BookTreeItem, targetSection?: JupyterBookSection): Promise<void> {
		if (element.contextValue === 'section') {
			// if the element that we want to move is a section, then we need to modify the sourceBook toc and remove the section before moving the files.
			const findSection: JupyterBookSection = { file: element.book.page.file, title: element.book.page.title };
			await this.updateTOC(element.book.version, element.tableOfContentsPath, findSection, undefined);

			if (targetSection) {
				// moving section files to target book directory
				await this.addSection(element, targetBook, targetSection);
				// adding new section to the target book toc file
				await this.updateTOC(targetBook.book.version, targetBook.tableOfContentsPath, targetSection, this.newSection);
			}
			else {
				//since there's not a target section, we just append the section at the end of the file
				await this.addSection(element, targetBook, undefined);
				this.tableofContents = targetBook.sections.map(section => this._versionHandler.convertTo(targetBook.version, section));
				this.tableofContents.push(this.newSection);
				await fs.writeFile(targetBook.tableOfContentsPath, yaml.safeDump(this.tableofContents, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
			}
		}
		else if (element.contextValue === 'savedNotebook') {
			if (element.book.tableOfContents.sections) {
				// the notebook is part of a book so we need to modify its toc as well
				const findSection = { file: element.book.page.file, title: element.book.page.title };
				await this.updateTOC(element.book.version, element.tableOfContentsPath, findSection, undefined);
			} else {
				// close the standalone notebook, so it doesn't throw an error when we move the notebook to new location.
				await vscode.commands.executeCommand('notebook.command.closeNotebook', element);
			}
			if (!targetSection) {
				await this.addNotebook(element, targetBook, undefined);
				this.tableofContents = targetBook.sections.map(section => this._versionHandler.convertTo(targetBook.version, section));
				this.tableofContents.push(this.newSection);
				await fs.writeFile(targetBook.tableOfContentsPath, yaml.safeDump(this.tableofContents, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
			} else {
				await this.addNotebook(element, targetBook, targetSection);
				await this.updateTOC(targetBook.book.version, targetBook.tableOfContentsPath, targetSection, this.newSection);
			}
		}
	}
}
