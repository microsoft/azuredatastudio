/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

// CONFIG VALUES ///////////////////////////////////////////////////////////
export const extensionOutputChannel = 'Notebooks';

// JUPYTER CONFIG //////////////////////////////////////////////////////////
export const pythonBundleVersion = '0.0.1';
export const pythonVersion = '3.6.6';
export const pythonPathConfigKey = 'pythonPath';
export const existingPythonConfigKey = 'useExistingPython';
export const notebookConfigKey = 'notebook';
export const trustedBooksConfigKey = 'trustedBooks';
export const maxBookSearchDepth = 'maxBookSearchDepth';

export const winPlatform = 'win32';

export const jupyterNotebookProviderId = 'jupyter';
export const jupyterConfigRootFolder = 'jupyter_config';
export const jupyterNewNotebookTask = 'jupyter.task.newNotebook';
export const jupyterOpenNotebookTask = 'jupyter.task.openNotebook';
export const jupyterNewNotebookCommand = 'jupyter.cmd.newNotebook';
export const jupyterReinstallDependenciesCommand = 'jupyter.reinstallDependencies';
export const jupyterAnalyzeCommand = 'jupyter.cmd.analyzeNotebook';
export const jupyterManagePackages = 'jupyter.cmd.managePackages';
export const jupyterConfigurePython = 'jupyter.cmd.configurePython';
export const localhostName = 'localhost';
export const localhostTitle = localize('managePackages.localhost', "localhost");
export const PackageNotFoundError = localize('managePackages.packageNotFound', "Could not find the specified package");

export const visitedNotebooksMementoKey = 'notebooks.visited';

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

export const pythonWindowsInstallUrl = 'https://go.microsoft.com/fwlink/?linkid=2110625';
export const pythonMacInstallUrl = 'https://go.microsoft.com/fwlink/?linkid=2110525';
export const pythonLinuxInstallUrl = 'https://go.microsoft.com/fwlink/?linkid=2110524';
