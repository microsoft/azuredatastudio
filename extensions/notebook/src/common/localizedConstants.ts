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
export const noBDCConnectionError = localize('noBDCConnectionError', "Spark kernels require a connection to a SQL Server Big Data Cluster master instance.");
export const providerNotValidError = localize('providerNotValidError', "Non-MSSQL providers are not supported for spark kernels.");

//  Book view-let constants
export const allFiles = localize('allFiles', "All Files");
export const labelSelectFolder = localize('labelSelectFolder', "Select Folder");
export const labelBookFolder = localize('labelBookFolder', "Select Jupyter Book");
export const confirmReplace = localize('confirmReplace', "Folder already exists. Are you sure you want to delete and replace this folder?");
export const openNotebookCommand = localize('openNotebookCommand', "Open Notebook");
export const openMarkdownCommand = localize('openMarkdownCommand', "Open Markdown");
export const openExternalLinkCommand = localize('openExternalLinkCommand', "Open External Link");
export const msgBookTrusted = localize('msgBookTrusted', "Jupyter Book is now trusted in the workspace.");
export const msgBookAlreadyTrusted = localize('msgBookAlreadyTrusted', "Jupyter Book is already trusted in this workspace.");
export const msgBookUntrusted = localize('msgBookUntrusted', "Jupyter Book is no longer trusted in this workspace");
export const msgBookAlreadyUntrusted = localize('msgBookAlreadyUntrusted', "Jupyter Book is already untrusted in this workspace.");
export function msgBookPinned(book: string): string { return localize('msgBookPinned', "Jupyter Book {0} is now pinned in the workspace.", book); }
export function msgBookUnpinned(book: string): string { return localize('msgBookUnpinned', "Jupyter Book {0} is no longer pinned in this workspace", book); }
export const missingTocError = localize('bookInitializeFailed', "Failed to find a Table of Contents file in the specified Jupyter Book.");
export const noBooksSelectedError = localize('noBooksSelected', "No Jupyter Books are currently selected in the viewlet.");
export const labelBookSection = localize('labelBookSection', "Select Jupyter Book Section");
export const labelAddToLevel = localize('labelAddToLevel', "Add to this level");

export function missingFileError(title: string, path: string): string { return localize('missingFileError', "Missing file : {0} from {1}", title, path); }
export function invalidTocFileError(): string { return localize('InvalidError.tocFile', "Invalid toc file"); }
export function invalidTocError(title: string): string { return localize('Invalid toc.yml', "Error: {0} has an incorrect toc.yml file", title); }
export function configFileError(): string { return localize('configFileError', "Configuration file missing"); }

export function openFileError(path: string, error: string): string { return localize('openBookError', "Open Jupyter Book {0} failed: {1}", path, error); }
export function readBookError(path: string, error: string): string { return localize('readBookError', "Failed to read Jupyter Book {0}: {1}", path, error); }
export function openNotebookError(resource: string, error: string): string { return localize('openNotebookError', "Open notebook {0} failed: {1}", resource, error); }
export function openMarkdownError(resource: string, error: string): string { return localize('openMarkdownError', "Open markdown {0} failed: {1}", resource, error); }
export function openUntitledNotebookError(resource: string, error: string): string { return localize('openUntitledNotebookError', "Open untitled notebook {0} as untitled failed: {1}", resource, error); }
export function openExternalLinkError(resource: string, error: string): string { return localize('openExternalLinkError', "Open link {0} failed: {1}", resource, error); }
export function closeBookError(resource: string, error: string): string { return localize('closeBookError', "Close Jupyter Book {0} failed: {1}", resource, error); }
export function duplicateFileError(title: string, path: string, newPath: string): string { return localize('duplicateFileError', "File {0} already exists in the destination folder {1} \n The file has been renamed to {2} to prevent data loss.", title, path, newPath); }
export function editBookError(path: string, error: string): string { return localize('editBookError', "Error while editing Jupyter Book {0}: {1}", path, error); }
export function selectBookError(error: string): string { return localize('selectBookError', "Error while selecting a Jupyter Book or a section to edit: {0}", error); }
export function sectionNotFound(section: string, tocPath: string): string { return localize('sectionNotFound', "Failed to find section {0} in {1}.", section, tocPath); }

// Remote Book dialog constants
export const url = localize('url', "URL");
export const repoUrl = localize('repoUrl', "Repository URL");
export const location = localize('location', "Location");
export const addRemoteBook = localize('addRemoteBook', "Add Remote Jupyter Book");
export const onGitHub = localize('onGitHub', "GitHub");
export const onSharedFile = localize('onsharedFile', "Shared File");
export const releases = localize('releases', "Releases");
export const book = localize('book', "Jupyter Book");
export const version = localize('version', "Version");
export const language = localize('language', "Language");
export const booksNotFound = localize('booksNotFound', "No Jupyter Books are currently available on the provided link");
export const urlGithubError = localize('urlGithubError', "The url provided is not a Github release url");
export const search = localize('search', "Search");
export const add = localize('add', "Add");
export const close = localize('close', "Close");
export const invalidTextPlaceholder = localize('invalidTextPlaceholder', "-");

// Remote Book Controller constants
export const msgRemoteBookDownloadProgress = localize('msgRemoteBookDownloadProgress', "Remote Jupyter Book download is in progress");
export const msgRemoteBookDownloadComplete = localize('msgRemoteBookDownloadComplete', "Remote Jupyter Book download is complete");
export const msgRemoteBookDownloadError = localize('msgRemoteBookDownloadError', "Error while downloading remote Jupyter Book");
export const msgRemoteBookUnpackingError = localize('msgRemoteBookUnpackingError', "Error while decompressing remote Jupyter Book");
export const msgRemoteBookDirectoryError = localize('msgRemoteBookDirectoryError', "Error while creating remote Jupyter Book directory");
export const msgTaskName = localize('msgTaskName', "Downloading Remote Jupyter Book");
export const msgResourceNotFound = localize('msgResourceNotFound', "Resource not Found");
export const msgBookNotFound = localize('msgBookNotFound', "Jupyter Books not Found");
export const msgReleaseNotFound = localize('msgReleaseNotFound', "Releases not Found");
export const msgUndefinedAssetError = localize('msgUndefinedAssetError', "The selected Jupyter Book is not valid");
export function httpRequestError(code: number, message: string): string { return localize('httpRequestError', "Http Request failed with error: {0} {1}", code, message); }
export function msgDownloadLocation(downloadLocation: string): string { return localize('msgDownloadLocation', "Downloading to {0}", downloadLocation); }

// Create Book dialog constants
export const newBook = localize('newBook', "New Jupyter Book (Preview)");
export const bookDescription = localize('bookDescription', "Jupyter Books are used to organize Notebooks.");
export const learnMore = localize('learnMore', "Learn more.");
export const contentFolder = localize('contentFolder', "Content folder");
export const browse = localize('browse', "Browse");
export const create = localize('create', "Create");
export const name = localize('name', "Name");
export const saveLocation = localize('saveLocation', "Save location");
export const contentFolderOptional = localize('contentFolderOptional', "Content folder (Optional)");
export const msgContentFolderError = localize('msgContentFolderError', "Content folder path does not exist");
export const msgSaveFolderError = localize('msgSaveFolderError', "Save location path does not exist.");
export function msgCreateBookWarningMsg(file: string): string { return localize('msgCreateBookWarningMsg', "Error while trying to access: {0}", file); }

// Add a notebook dialog constants
export const newNotebook = localize('newNotebook', "New Notebook (Preview)");
export const newMarkdown = localize('newMarkdown', "New Markdown (Preview)");
export const fileExtension = localize('fileExtension', "File Extension");
export const confirmOverwrite = localize('confirmOverwrite', "File already exists. Are you sure you want to overwrite this file?");
export const title = localize('title', "Title");
export const fileName = localize('fileName', "File Name");
export const msgInvalidSaveFolder = localize('msgInvalidSaveFolder', "Save location path is not valid.");
export function msgDuplicateFileName(file: string): string { return localize('msgDuplicateFileName', "File {0} already exists in the destination folder", file); }
