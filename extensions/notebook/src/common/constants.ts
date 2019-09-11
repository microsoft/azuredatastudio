/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

// CONFIG VALUES ///////////////////////////////////////////////////////////
export const extensionOutputChannel = 'Notebooks';

// JUPYTER CONFIG //////////////////////////////////////////////////////////
export const pythonBundleVersion = '0.0.1';
export const pythonVersion = '3.6.6';
export const pythonPathConfigKey = 'pythonPath';
export const existingPythonConfigKey = 'useExistingPython';
export const notebookConfigKey = 'notebook';
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

export const pythonOfflinePipPackagesUrl = 'https://bundledpython.blob.core.windows.net/test/python-3.6.6-0.0.1-offlinePackages.zip';
export const pythonWindowsInstallUrl = 'https://bundledpython.blob.core.windows.net/test/python-3.6.6-win-x64-0.0.1-offline.zip';
export const pythonMacInstallUrl = 'https://bundledpython.blob.core.windows.net/test/python-3.6.6-osx-0.0.1.tar.gz';
export const pythonLinuxInstallUrl = 'https://bundledpython.blob.core.windows.net/test/python-3.6.6-linux-x64-0.0.1.tar.gz';
