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

export enum tocSectionOperation {
	Remove,
	Add
}

export class BookTocManager implements IBookTocManager {

	constructor() {
	}

	async getAllFiles(toc: IJupyterBookSectionV2[], directory: string, filesInDir: string[]): Promise<IJupyterBookSectionV2[]> {
		await Promise.all(filesInDir.map(async file => {
			let isDirectory = (await fs.promises.stat(path.join(directory, file))).isDirectory();
			if (isDirectory) {
				let jupyterSection: IJupyterBookSectionV2 = {
					title: file,
					file: file,
					expand_sections: true,
					numbered: false,
					sections: []
				};
				let files = await fs.promises.readdir(path.join(directory, file));
				toc.push(jupyterSection);
				await this.getAllFiles(toc, path.join(directory, file), files);
			} else if (allowedFileExtensions.includes(path.extname(file))) {
				const addFile: IJupyterBookSectionV2 = {
					title: path.parse(file).name,
					file: path.join(path.basename(directory), path.parse(file).name)
				};
				if (toc.length > 0) {
					let indexToc = toc.findIndex(parent => parent.title === path.dirname(addFile.file));
					if (indexToc !== -1) {
						if (path.parse(addFile.file).ext === '.md') {
							toc[indexToc].file = addFile.file;
						} else {
							toc[indexToc].sections.push(addFile);
						}
					}
				} else if (path.parse(file).ext === '.md') {
					//TODO : Add other types such as Intro, Introduction, Index etc etc
					// what about two files named as Intro and then other as readme ?
					let index: IJupyterBookSectionV2 = {
						title: path.parse(file).name,
						file: path.parse(file).name
					};
					toc.push(index);
				}
			}
		}));
		return toc;
	}

	hasSections(node: JupyterBookSection): boolean {
		return (typeof node === 'object') && node.sections.length > 0 && (typeof node.sections !== 'undefined');
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
		let filesinDir = await fs.readdir(contentFolder);
		let toc: IJupyterBookSectionV2[] = await this.getAllFiles([], contentFolder, filesinDir);
		//await fs.promises.mkdir(bookContentPath);
		await fs.outputFile(path.join(bookContentPath, '_config.yml'), yaml.safeDump({ title: path.basename(bookContentPath) }));
		await fs.outputFile(path.join(bookContentPath, '_toc.yml'), yaml.safeDump(toc, { lineWidth: Infinity }));
		vscode.commands.executeCommand('notebook.command.openBook', bookContentPath, false);
	}

	public async updateBook(element: BookTreeItem, updatedBook?: BookTreeItem): Promise<void> {
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
