/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// General Constants ///////////////////////////////////////////////////////
export const msgYes = localize('msgYes', "Yes");
export const msgNo = localize('msgNo', "No");

// Jupyter Constants ///////////////////////////////////////////////////////
export const msgSampleCodeDataFrame = localize('msgSampleCodeDataFrame', "This sample code loads the file into a data frame and shows the first 10 results.");

//  Book view-let constants
export const allFiles = localize('allFiles', "All Files");
export const labelSelectFolder = localize('labelSelectFolder', "Select Folder");
export const labelBookFolder = localize('labelBookFolder', "Select Book");
export const confirmReplace = localize('confirmReplace', "Folder already exists. Are you sure you want to delete and replace this folder?");
export const openNotebookCommand = localize('openNotebookCommand', "Open Notebook");
export const openMarkdownCommand = localize('openMarkdownCommand', "Open Markdown");
export const openExternalLinkCommand = localize('openExternalLinkCommand', "Open External Link");
export const msgBookTrusted = localize('msgBookTrusted', "Book is now trusted in the workspace.");
export const msgBookAlreadyTrusted = localize('msgBookAlreadyTrusted', "Book is already trusted in this workspace.");
export const msgBookUntrusted = localize('msgBookUntrusted', "Book is no longer trusted in this workspace");
export const msgBookAlreadyUntrusted = localize('msgBookAlreadyUntrusted', "Book is already untrusted in this workspace.");
export const missingTocError = localize('bookInitializeFailed', "Failed to find a Table of Contents file in the specified book.");
export const noBooksSelectedError = localize('noBooksSelected', "No books are currently selected in the viewlet.");

export function missingFileError(title: string): string { return localize('missingFileError', "Missing file : {0}", title); }
export function invalidTocFileError(): string { return localize('InvalidError.tocFile', "Invalid toc file"); }
export function invalidTocError(title: string): string { return localize('Invalid toc.yml', "Error: {0} has an incorrect toc.yml file", title); }

export function openFileError(path: string, error: string): string { return localize('openBookError', "Open book {0} failed: {1}", path, error); }
export function readBookError(path: string, error: string): string { return localize('readBookError', "Failed to read book {0}: {1}", path, error); }
export function openNotebookError(resource: string, error: string): string { return localize('openNotebookError', "Open notebook {0} failed: {1}", resource, error); }
export function openMarkdownError(resource: string, error: string): string { return localize('openMarkdownError', "Open markdown {0} failed: {1}", resource, error); }
export function openUntitledNotebookError(resource: string, error: string): string { return localize('openUntitledNotebookError', "Open untitled notebook {0} as untitled failed: {1}", resource, error); }
export function openExternalLinkError(resource: string, error: string): string { return localize('openExternalLinkError', "Open link {0} failed: {1}", resource, error); }
export function closeBookError(resource: string, error: string): string { return localize('closeBookError', "Close book {0} failed: {1}", resource, error); }

// Remote Book dialog constants
export const url = localize('url', "URL");
export const repoUrl = localize('repoUrl', "Repository URL");
export const location = localize('location', "Location");
export const addRemoteBook = localize('addRemoteBook', "Add Remote Book");
export const onGitHub = localize('onGitHub', "GitHub");
export const onSharedFile = localize('onsharedFile', "Shared File");
export const releases = localize('releases', "Releases");
export const book = localize('book', "Book");
export const version = localize('version', "Version");
export const language = localize('language', "Language");
export const booksNotFound = localize('booksNotFound', "No books are currently available on the provided link");
export const urlGithubError = localize('urlGithubError', "The url provided is not a Github release url");
export const search = localize('search', "Search");
export const add = localize('add', "Add");
export const close = localize('close', "Close");
export const invalidTextPlaceholder = localize('invalidTextPlaceholder', "-");

// Remote Book Controller constants
export const msgRemoteBookDownloadProgress = localize('msgRemoteBookDownloadProgress', "Remote Book download is in progress");
export const msgRemoteBookDownloadComplete = localize('msgRemoteBookDownloadComplete', "Remote Book download is complete");
export const msgRemoteBookDownloadError = localize('msgRemoteBookDownloadError', "Error while downloading remote Book");
export const msgRemoteBookUnpackingError = localize('msgRemoteBookUnpackingError', "Error while decompressing remote Book");
export const msgRemoteBookDirectoryError = localize('msgRemoteBookDirectoryError', "Error while creating remote Book directory");
export const msgTaskName = localize('msgTaskName', "Downloading Remote Book");
export const msgResourceNotFound = localize('msgResourceNotFound', "Resource not Found");
export const msgBookNotFound = localize('msgBookNotFound', "Books not Found");
export const msgReleaseNotFound = localize('msgReleaseNotFound', "Releases not Found");
export const msgUndefinedAssetError = localize('msgUndefinedAssetError', "The selected book is not valid");
export function httpRequestError(code: number, message: string): string { return localize('httpRequestError', "Http Request failed with error: {0} {1}", code, message); }
export function msgDownloadLocation(downloadLocation: string): string { return localize('msgDownloadLocation', "Downloading to {0}", downloadLocation); }
