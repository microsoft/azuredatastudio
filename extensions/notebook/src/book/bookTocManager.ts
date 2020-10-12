/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
//import * as path from 'path';
//import * as vscode from 'vscode';
//import * as constants from './../common/constants';
import { BookTreeItem } from './bookTreeItem';
//import * as yaml from 'js-yaml';
import { BookVersion, BookModel } from './bookModel';
import { IJupyterBookToc } from '../contracts/content';

export interface IBookTocManager {
	createToc(section: BookTreeItem): boolean;
	updateToc(operation: tocBookOperation, section: BookTreeItem, updatedBook: BookTreeItem): boolean;
}

export enum tocBookOperation {
	Create,
	Edit
}

export class BookTocManager implements IBookTocManager {

	constructor() {
	}

	createToc(notebook: BookTreeItem): boolean {
		return this.updateToc(tocBookOperation.Create, notebook);
	}

	updateToc(operation: tocBookOperation, section: BookTreeItem, updatedBook?: BookTreeItem): boolean {
		if (operation === tocBookOperation.Create) {
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
