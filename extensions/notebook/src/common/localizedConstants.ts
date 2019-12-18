/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// General Constants ///////////////////////////////////////////////////////
export const msgYes = localize('msgYes', "Yes");
export const msgNo = localize('msgNo', "No");

// Jupyter Constants ///////////////////////////////////////////////////////
export const msgSampleCodeDataFrame = localize('msgSampleCodeDataFrame', "This sample code loads the file into a data frame and shows the first 10 results.");

//  Book view-let constants
export const allFiles = localize('allFiles', "All Files");
export const labelPickFolder = localize('labelPickFolder', "Pick Folder");
export const labelBookFolder = localize('labelBookFolder', "Select Book");
export const confirmReplace = localize('confirmReplace', "Folder already exists. Are you sure you want to delete and replace this folder?");
export const openNotebookCommand = localize('openNotebookCommand', "Open Notebook");
export const openMarkdownCommand = localize('openMarkdownCommand', "Open Markdown");
export const openExternalLinkCommand = localize('openExternalLinkCommand', "Open External Link");

export const errBookInitialize = localize('bookInitializeFailed', "Book initialize failed: Failed to recognize the structure.");
export function missingFileError(title: string): string { return localize('missingFileError', "Missing file : {0}", title); }
export function invalidTocFileError(error: string): string { return localize('InvalidError.tocFile', "{0}", error); }
export function invalidTocError(title: string): string { return localize('Invalid toc.yml', "Error: {0} has an incorrect toc.yml file", title); }

export function openFileError(path: string, error: string): string { return localize('openBookError', "Open book {0} failed: {1}", path, error); }
export function openNotebookError(resource: string, error: string): string { return localize('openNotebookError', "Open notebook {0} failed: {1}", resource, error); }
export function openMarkdownError(resource: string, error: string): string { return localize('openMarkdownError', "Open markdown {0} failed: {1}", resource, error); }
export function openUntitledNotebookError(resource: string, error: string): string { return localize('openUntitledNotebookError', "Open untitled notebook {0} as untitled failed: {1}", resource, error); }
export function openExternalLinkError(resource: string, error: string): string { return localize('openExternalLinkError', "Open link {0} failed: {1}", resource, error); }



