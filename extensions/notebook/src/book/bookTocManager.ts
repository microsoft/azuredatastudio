/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
//import * as vscode from 'vscode';
//import * as constants from './../common/constants';
import { BookTreeItem } from './bookTreeItem';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { BookVersion } from './bookModel';
import { IJupyterBookSectionV2, IJupyterBookToc } from '../contracts/content';

export interface IBookTocManager {
	updateToc(operation: tocSectionOperation, section: BookTreeItem, updatedBook: BookTreeItem): boolean;
}
const allowedFileExtensions: string[] = ['.md', '.ipynb', '.ps'];

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
				toc[0].sections.push(jupyterSection);
				await this.getAllFiles(toc, path.join(directory, file), files);
			} else if (allowedFileExtensions.includes(path.extname(file))) {
				const addFile: IJupyterBookSectionV2 = {
					title: path.parse(file).name,
					file: path.join(path.basename(directory), path.parse(file).name)
				};
				if (toc[0].sections.length > 0) {
					let indexToc = toc[0].sections.findIndex(parent => parent.title === path.dirname(addFile.file));
					if (indexToc !== -1) {
						//TODO : Add other types such as Intro, Introduction, start Init etc etc
						if (file === 'readme.md') {
							toc[0].sections[indexToc].file = addFile.file;
						} else {
							toc[0].sections[indexToc].sections.push(addFile);
						}
					}
				} else if (path.parse(file).ext === '.md') {
					toc[0].file = path.parse(file).name;
					toc[0].title = 'Welcome';
				}
			}
		}));
		return toc;
	}

	async createToc(bookContentPath: string, contentFolder: string): Promise<void> {
		let filesinDir = await fs.promises.readdir(contentFolder);
		let toc: IJupyterBookSectionV2[] = await this.getAllFiles([{ sections: [] }], contentFolder, filesinDir);
		await fs.promises.writeFile(path.join(bookContentPath, '_toc.yml'), yaml.safeDump(toc, { lineWidth: Infinity }));
	}

	updateToc(operation: tocSectionOperation, section: BookTreeItem, updatedBook?: BookTreeItem): boolean {
		if (operation === tocSectionOperation.Add) {
			//create table of contents


		} else {
			// identify version of the updatedBook
			if (updatedBook.book.version === BookVersion.v1) {
				if (updatedBook.book.type === 'Book') {
					updatedBook.book.page.push(section.sections);
					updatedBook.sections.push(section.sections);


				}

			}
		}
		return true;
	}

	updateSection(sectionToAdd: IJupyterBookToc, page: IJupyterBookToc[]) {
		page.push(sectionToAdd);
	}
}
