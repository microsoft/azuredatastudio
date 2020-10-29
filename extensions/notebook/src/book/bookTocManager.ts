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
	updateBook(section: BookTreeItem, updatedBook: BookTreeItem): Promise<void>;
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

	public async createBook(bookContentPath: string, contentFolder: string): Promise<void> {
		await fs.promises.mkdir(bookContentPath);
		await fs.copy(contentFolder, bookContentPath);
		let filesinDir = await fs.readdir(bookContentPath);
		this.tableofContents = await this.getAllFiles([], bookContentPath, filesinDir, bookContentPath);
		await fs.outputFile(path.join(bookContentPath, '_config.yml'), yaml.safeDump({ title: path.basename(bookContentPath) }));
		await fs.outputFile(path.join(bookContentPath, '_toc.yml'), yaml.safeDump(this.tableofContents, { lineWidth: Infinity }));
		await vscode.commands.executeCommand('notebook.command.openBook', bookContentPath, false);
	}

	async addSectionToBook(section: BookTreeItem, book: BookTreeItem): Promise<void> {
		this.newSection.title = section.title;
		if (section.book.version === BookVersion.v1) {
			this.newSection.url = section.uri;
			let movedSections: IJupyterBookSectionV1[] = [];
			const files = section.sections as IJupyterBookSectionV1[];
			for (const elem of files) {
				await fs.promises.mkdir(path.join(book.rootContentPath, path.dirname(elem.url)), { recursive: true });
				await fs.move(path.join(path.dirname(section.book.contentPath), path.basename(elem.url)), path.join(book.rootContentPath, elem.url));
				movedSections.push({ url: elem.url, title: elem.title });
			}
			this.newSection.sections = movedSections;
		} else if (section.book.version === BookVersion.v2) {
			const files = section.sections as IJupyterBookSectionV2[];
			files.forEach(async elem => {
				await fs.promises.mkdir(path.join(book.rootContentPath, path.dirname(elem.file)), { recursive: true });
				await fs.move(path.join(path.dirname(section.book.contentPath), path.basename(elem.file)), path.join(book.rootContentPath, elem.file));
				(this.newSection as IJupyterBookSectionV2).file = section.uri;
				this.newSection.sections.push({ file: elem.file, title: elem.title });
			});
		}
		book.tableOfContents.sections.push(this.newSection);
		await fs.outputFile(book.tableOfContentsPath, yaml.safeDump(book.tableOfContents, { lineWidth: Infinity }));
	}

	async addNotebookToBook(notebook: BookTreeItem, book: BookTreeItem): Promise<void> {
		let notebookName = path.relative(notebook.book.root, notebook.book.contentPath);
		await fs.move(notebook.book.contentPath, path.join(book.rootContentPath, notebookName));
		if (book.book.version === BookVersion.v1) {
			this.newSection = { url: notebookName, title: notebookName };
		} else if (book.book.version === BookVersion.v2) {
			this.newSection = { file: notebookName, title: notebookName };
		}
		book.tableOfContents.sections.push(this.newSection);
		await fs.outputFile(book.tableOfContentsPath, yaml.safeDump(book.tableOfContents, { lineWidth: Infinity }));
	}

	public async updateBook(element: BookTreeItem, updatedBook: BookTreeItem): Promise<void> {
		if (element.contextValue === 'section' && updatedBook.book.version === element.book.version) {
			await this.addSectionToBook(element, updatedBook);
		}
		else if (element.contextValue === 'savedNotebook') {
			await this.addNotebookToBook(element, updatedBook);
		}
	}
}
