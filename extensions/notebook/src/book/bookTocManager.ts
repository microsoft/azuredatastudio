/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import { BookTreeItem } from './bookTreeItem';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import { IJupyterBookSectionV1, IJupyterBookSectionV2, JupyterBookSection } from '../contracts/content';
import { BookVersion } from './bookModel';
import * as vscode from 'vscode';

export interface IBookTocManager {
	updateBook(element: BookTreeItem, book: BookTreeItem): Promise<void>;
	createBook(bookContentPath: string, contentFolder: string): Promise<void>
}
const allowedFileExtensions: string[] = ['.md', '.ipynb'];
const initMarkdown: string[] = ['index.md', 'introduction.md', 'intro.md', 'readme.md'];

export class BookTocManager implements IBookTocManager {
	public tableofContents: IJupyterBookSectionV2[];
	public newSection: JupyterBookSection = {};

	constructor() {
	}

	async getAllFiles(toc: IJupyterBookSectionV2[], directory: string, filesInDir: string[], rootDirectory: string): Promise<IJupyterBookSectionV2[]> {
		await Promise.all(filesInDir.map(async file => {
			let isDirectory = (await fs.promises.stat(path.join(directory, file))).isDirectory();
			if (isDirectory) {
				let files = await fs.promises.readdir(path.join(directory, file));
				let initFile: string = '';
				files.some((f, index) => {
					if (initMarkdown.includes(f)) {
						initFile = path.parse(f).name;
						files.splice(index, 1);
					}
				});
				let jupyterSection: IJupyterBookSectionV2 = {
					title: file,
					file: path.join(file, initFile),
					expand_sections: true,
					numbered: false,
					sections: []
				};
				toc.push(jupyterSection);
				await this.getAllFiles(toc, path.join(directory, file), files, rootDirectory);
			} else if (allowedFileExtensions.includes(path.extname(file))) {
				const filePath = directory === rootDirectory ? path.parse(file).name : path.join(path.basename(directory), path.parse(file).name);
				const addFile: IJupyterBookSectionV2 = {
					title: path.parse(file).name,
					file: filePath
				};
				let indexToc = toc.findIndex(parent => parent.title === path.basename(directory));
				if (indexToc !== -1) {
					if (toc[indexToc].file === '') {
						//if there are no markdown files then add the first notebook
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

	hasSections(node: JupyterBookSection): boolean {
		return node.sections !== undefined && node.sections.length > 0;
	}

	updateToc(tableOfContents: JupyterBookSection[], findSection: BookTreeItem, addSection: JupyterBookSection): JupyterBookSection[] {
		for (const section of tableOfContents) {
			if (path.dirname(section.url) === path.join(path.sep, path.dirname(findSection.uri)) || path.dirname((section as IJupyterBookSectionV2).file) === path.join(path.sep, path.dirname(findSection.uri))) {
				if (tableOfContents[tableOfContents.length - 1].sections) {
					tableOfContents[tableOfContents.length - 1].sections.push(addSection);
				} else {
					tableOfContents[tableOfContents.length - 1].sections = [addSection];
				}
				break;
			}
			else if (this.hasSections(section)) {
				return this.updateToc(section.sections, findSection, addSection);
			}
		}
		return tableOfContents;
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

	async addSection(section: BookTreeItem, book: BookTreeItem, isSection: boolean): Promise<void> {
		this.newSection.title = section.title;
		const rootPath = isSection ? path.dirname(book.book.contentPath) : book.rootContentPath;
		const uri = isSection ? path.join(path.basename(rootPath), section.uri) : section.uri;
		if (section.book.version === BookVersion.v1) {
			this.newSection.url = uri;
			let movedSections: IJupyterBookSectionV1[] = [];
			const files = section.sections as IJupyterBookSectionV1[];
			for (const elem of files) {
				await fs.promises.mkdir(path.join(rootPath, path.dirname(elem.url)), { recursive: true });
				await fs.move(path.join(path.dirname(section.book.contentPath), path.basename(elem.url)), path.join(rootPath, elem.url));
				movedSections.push({ url: isSection ? path.join(path.basename(rootPath), elem.url) : elem.url, title: elem.title });
			}
			this.newSection.sections = movedSections;
		} else if (section.book.version === BookVersion.v2) {
			(this.newSection as IJupyterBookSectionV2).file = uri;
			let movedSections: IJupyterBookSectionV2[] = [];
			const files = section.sections as IJupyterBookSectionV2[];
			for (const elem of files) {
				await fs.promises.mkdir(path.join(rootPath, path.dirname(elem.file)), { recursive: true });
				await fs.move(path.join(path.dirname(section.book.contentPath), path.basename(elem.file)), path.join(rootPath, elem.file));
				movedSections.push({ file: isSection ? path.join(path.basename(rootPath), elem.file) : elem.file, title: elem.title });
			}
			this.newSection.sections = movedSections;
		}
	}

	async addNotebook(notebook: BookTreeItem, book: BookTreeItem, isSection: boolean): Promise<void> {
		const rootPath = isSection ? path.dirname(book.book.contentPath) : book.rootContentPath;
		let notebookName = path.basename(notebook.book.contentPath);
		await fs.move(notebook.book.contentPath, path.join(rootPath, notebookName));
		if (book.book.version === BookVersion.v1) {
			this.newSection = { url: notebookName, title: notebookName };
		} else if (book.book.version === BookVersion.v2) {
			this.newSection = { file: notebookName, title: notebookName };
		}
	}

	/**
	 * Moves the element to the book's folder and adds it to the table of contents.
	 * @param element Notebook, Markdown File, or section that will be added to the book.
	 * @param book Book or a BookSection that will be modified.
	*/
	public async updateBook(element: BookTreeItem, book: BookTreeItem): Promise<void> {
		if (element.contextValue === 'section' && book.book.version === element.book.version) {
			if (book.contextValue === 'section') {
				await this.addSection(element, book, true);
				this.tableofContents = this.updateToc(book.tableOfContents.sections, book, this.newSection);
				await fs.writeFile(book.tableOfContentsPath, yaml.safeDump(this.tableofContents, { lineWidth: Infinity }));
			} else if (book.contextValue === 'savedBook') {
				await this.addSection(element, book, false);
				book.tableOfContents.sections.push(this.newSection);
				await fs.writeFile(book.tableOfContentsPath, yaml.safeDump(book.tableOfContents, { lineWidth: Infinity }));
			}
		}
		else if (element.contextValue === 'savedNotebook') {
			if (book.contextValue === 'savedBook') {
				await this.addNotebook(element, book, false);
				book.tableOfContents.sections.push(this.newSection);
				await fs.writeFile(book.tableOfContentsPath, yaml.safeDump(book.tableOfContents, { lineWidth: Infinity }));
			} else if (book.contextValue === 'section') {
				await this.addNotebook(element, book, true);
				this.tableofContents = this.updateToc(book.tableOfContents.sections, book, this.newSection);
				await fs.writeFile(book.tableOfContentsPath, yaml.safeDump(this.tableofContents, { lineWidth: Infinity }));
			}
		}
	}
}
