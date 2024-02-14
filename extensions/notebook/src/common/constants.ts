/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

// CONFIG VALUES ///////////////////////////////////////////////////////////
export const extensionOutputChannelName = 'Notebooks';

export const notebookCommandNew = 'notebook.command.new';

// JUPYTER CONFIG //////////////////////////////////////////////////////////
export const pythonVersion = '3.8.10';
export const pythonPathConfigKey = 'pythonPath';
export const existingPythonConfigKey = 'useExistingPython';
export const dontPromptPythonUpdate = 'dontPromptPythonUpdate';
export const jupyterServerShutdownTimeoutConfigKey = 'jupyterServerShutdownTimeout';
export const notebookConfigKey = 'notebook';
export const trustedBooksConfigKey = 'trustedBooks';
export const pinnedBooksConfigKey = 'pinnedNotebooks';
export const maxBookSearchDepth = 'maxBookSearchDepth';
export const remoteBookDownloadTimeout = 'remoteBookDownloadTimeout';
export const collapseBookItems = 'collapseBookItems';
export const allowRoot = 'allowRoot';

export const winPlatform = 'win32';
export const macPlatform = 'darwin';
export const linuxPlatform = 'linux';

export const jupyterNotebookProviderId = 'jupyter';
export const jupyterConfigRootFolder = 'jupyter_config';
export const jupyterNewNotebookTask = 'jupyter.task.newNotebook';
export const jupyterOpenNotebookTask = 'jupyter.task.openNotebook';
export const jupyterNewNotebookCommand = 'jupyter.cmd.newNotebook';
export const jupyterReinstallDependenciesCommand = 'jupyter.reinstallDependencies';
export const jupyterManagePackages = 'jupyter.cmd.managePackages';
export const jupyterConfigurePython = 'jupyter.cmd.configurePython';
export const localhostName = 'localhost';
export const localhostTitle = localize('managePackages.localhost', "localhost");
export const PackageNotFoundError = localize('managePackages.packageNotFound', "Could not find the specified package");

export const ipykernelDisplayName = 'Python 3 (ipykernel)';
export const python3DisplayName = 'Python 3';
export const powershellDisplayName = 'PowerShell';
export const allKernelsName = 'All Kernels';

export const BOOKS_VIEWID = 'bookTreeView';
export const PINNED_BOOKS_VIEWID = 'pinnedBooksView';

export const visitedNotebooksMementoKey = 'notebooks.visited';
export const pinnedNotebooksMementoKey = 'notebooks.pinned';

export enum BuiltInCommands {
	SetContext = 'setContext'
}

export enum CommandContext {
	NotebookPythonInstalled = 'notebook:pythonInstalled'
}

export enum PythonPkgType {
	Pip = 'Pip',
	Anaconda = 'Anaconda'
}

export enum NavigationProviders {
	NotebooksNavigator = 'BookNavigator.Notebooks',
	ProvidedBooksNavigator = 'BookNavigator.ProvidedBooks',
	PinnedNotebooksNavigator = 'BookNavigator.PinnedNotebooks'
}

export const unsavedBooksContextKey = 'unsavedBooks';
export const showPinnedBooksContextKey = 'showPinnedbooks';

export const pythonWindowsInstallUrl = 'https://go.microsoft.com/fwlink/?linkid=2163338';
export const pythonMacInstallUrl = 'https://go.microsoft.com/fwlink/?linkid=2163337';
export const pythonLinuxInstallUrl = 'https://go.microsoft.com/fwlink/?linkid=2163336';

// The version of the notebook file format that we support
export const NBFORMAT = 4;
export const NBFORMAT_MINOR = 2;
