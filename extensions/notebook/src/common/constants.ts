'use strict';

// CONFIG VALUES ///////////////////////////////////////////////////////////
export const extensionConfigSectionName = 'dataManagement';
export const extensionOutputChannel = 'SQL Server 2019 Preview';
export const configLogDebugInfo = 'logDebugInfo';

// JUPYTER CONFIG //////////////////////////////////////////////////////////
export const pythonBundleVersion = '0.0.1';
export const pythonVersion = '3.6.6';
export const sparkMagicVersion = '0.12.6.1';
export const python3 = 'python3';
export const pysparkkernel = 'pysparkkernel';
export const sparkkernel = 'sparkkernel';
export const pyspark3kernel = 'pyspark3kernel';
export const python3DisplayName = 'Python 3';
export const defaultSparkKernel = 'pyspark3kernel';
export const pythonPathConfigKey = 'pythonPath';
export const notebookConfigKey = 'notebook';

export const outputChannelName = 'dataManagement';
export const hdfsHost = 'host';
export const hdfsUser = 'user';

export const winPlatform = 'win32';

export const jupyterNotebookProviderId = 'jupyter';
export const jupyterConfigRootFolder = 'jupyter_config';
export const jupyterKernelsMasterFolder = 'kernels_master';
export const jupyterNotebookLanguageId = 'jupyter-notebook';
export const jupyterNotebookViewType = 'jupyter-notebook';
export const jupyterNewNotebookTask = 'jupyter.task.newNotebook';
export const jupyterOpenNotebookTask = 'jupyter.task.openNotebook';
export const jupyterNewNotebookCommand = 'jupyter.cmd.newNotebook';
export const jupyterCommandSetContext = 'jupyter.setContext';
export const jupyterCommandSetKernel = 'jupyter.setKernel';
export const jupyterReinstallDependenciesCommand = 'jupyter.reinstallDependencies';
export const jupyterAnalyzeCommand = 'jupyter.cmd.analyzeNotebook';
export const jupyterInstallPackages = 'jupyter.cmd.installPackages';
export const jupyterConfigurePython = 'jupyter.cmd.configurePython';

export enum BuiltInCommands {
	SetContext = 'setContext'
}

export enum CommandContext {
	WizardServiceEnabled = 'wizardservice:enabled'
}
