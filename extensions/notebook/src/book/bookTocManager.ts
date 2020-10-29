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

export enum tocSectionOperation {
	Remove,
	Add
}

export class BookTocManager implements IBookTocManager {
	public tableofContents: IJupyterBookSectionV2[];

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
		return node.sections.length > 0 && (typeof node.sections !== 'undefined');
	}

	updateToc(tableOfContents: JupyterBookSection[], newToc: JupyterBookSection, findSection: JupyterBookSection[]): boolean {
		if (tableOfContents === findSection) {
			if (newToc !== undefined) {
				tableOfContents.push(newToc);
			} else {
				//remove section
				tableOfContents = [];
			}
			return true;
		} else {
			tableOfContents.forEach(t => this.hasSections(t) ? this.updateToc(t.sections, newToc, findSection) : undefined);
		}
		return false;
	}

	public async createBook(bookContentPath: string, contentFolder: string): Promise<void> {
		await fs.promises.mkdir(bookContentPath);
		await fs.copy(contentFolder, bookContentPath);
		let filesinDir = await fs.readdir(bookContentPath);
		this.tableofContents = await this.getAllFiles([], bookContentPath, filesinDir, bookContentPath);
		await fs.outputFile(path.join(bookContentPath, '_config.yml'), yaml.safeDump({ title: path.basename(bookContentPath) }));
		await fs.outputFile(path.join(bookContentPath, '_toc.yml'), yaml.safeDump(this.tableofContents, { lineWidth: Infinity }));
		//await vscode.commands.executeCommand('notebook.command.openBook', bookContentPath, false);
	}

	public async updateBook(element: BookTreeItem, updatedBook: BookTreeItem): Promise<void> {
		if (updatedBook) {
			//  Adding a new section in book, they must be the same version
			let newTOC: JupyterBookSection = {};
			const rootContentPath = updatedBook.contextValue === 'section' ? path.dirname(updatedBook.book.contentPath) : updatedBook.rootContentPath;
			if (element.contextValue === 'section' && updatedBook.book.version === element.book.version) {
				newTOC.title = element.title;
				if (element.book.version === BookVersion.v1) {
					const files = element.sections as IJupyterBookSectionV1[];
					files.forEach(async elem => {
						await fs.promises.rename(path.join(element.rootContentPath, elem.url), path.join(rootContentPath, elem.url));
						newTOC.url = element.uri;
						newTOC.sections.push({ url: elem.url, title: elem.title });
					});
				} else if (element.book.version === BookVersion.v2) {
					const files = element.sections as IJupyterBookSectionV2[];
					files.forEach(async elem => {
						await fs.promises.rename(path.join(element.rootContentPath, elem.file), path.join(rootContentPath, elem.file));
						(newTOC as IJupyterBookSectionV2).file = element.uri;
						newTOC.sections.push({ file: elem.file, title: elem.title });
					});
				}
				this.updateToc(element.tableOfContents.sections, undefined, element.sections);
				await fs.outputFile(element.tableOfContentsPath, yaml.safeDump(element.tableOfContents, { lineWidth: Infinity }));
			}
			else if (element.contextValue === 'savedNotebook') {
				let notebookName = path.relative(element.book.root, element.book.contentPath);
				await fs.promises.rename(element.book.contentPath, path.join(rootContentPath, notebookName));
				newTOC.sections.push({ file: notebookName, title: notebookName });
			}
			const isUpdated: boolean = this.updateToc(updatedBook.tableOfContents.sections, newTOC, updatedBook.sections);
			if (!isUpdated) {
				updatedBook.tableOfContents.sections.push(newTOC);
			}
			await fs.outputFile(updatedBook.tableOfContentsPath, yaml.safeDump(updatedBook.tableOfContents, { lineWidth: Infinity }));
		}
	}
}
