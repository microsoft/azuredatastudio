/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nbExtensionApis from '../../typings/notebookServices';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../common/apiWrapper';
import { QueryRunner } from '../../common/queryRunner';
import { ProcessService } from '../../common/processService';

export interface TestContext {
	jupyterInstallation: nbExtensionApis.IJupyterServerInstallation;
	jupyterController: nbExtensionApis.IJupyterController;
	nbExtensionApis: nbExtensionApis.IExtensionApi;
	outputChannel: vscode.OutputChannel;
	processService: TypeMoq.IMock<ProcessService>;
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	queryRunner: TypeMoq.IMock<QueryRunner>;
	op: azdata.BackgroundOperation;
	getOpStatus: () => azdata.TaskStatus;
}

export function createContext(): TestContext {
	let opStatus: azdata.TaskStatus;
	let packages = new Map<string, nbExtensionApis.IPackageManageProvider>();
	let jupyterInstallation: nbExtensionApis.IJupyterServerInstallation = {
		installCondaPackages: (packages: nbExtensionApis.IPackageDetails[], useMinVersion: boolean) => { return Promise.resolve(); },
		getInstalledPipPackages: () => { return Promise.resolve([]); },
		installPipPackages: (packages: nbExtensionApis.IPackageDetails[], useMinVersion: boolean) => { return Promise.resolve(); },
		uninstallPipPackages: (packages: nbExtensionApis.IPackageDetails[]) => { return Promise.resolve(); },
		uninstallCondaPackages: (packages: nbExtensionApis.IPackageDetails[]) => { return Promise.resolve(); },
		executeBufferedCommand: (command: string) => { return Promise.resolve(''); },
		executeStreamedCommand: (command: string) => { return Promise.resolve(); },
		pythonExecutable: '',
		pythonInstallationPath: '',
		installPythonPackage: (backgroundOperation: azdata.BackgroundOperation, usingExistingPython: boolean, pythonInstallationPath: string, outputChannel: vscode.OutputChannel) => { return Promise.resolve(); }
	};

	let jupyterController = {
		jupyterInstallation: jupyterInstallation
	};
	return {
		jupyterInstallation: jupyterInstallation,
		jupyterController: jupyterController,
		nbExtensionApis: {
			getJupyterController: () => { return jupyterController; },
			registerPackageManager: (providerId: string, packageManagerProvider: nbExtensionApis.IPackageManageProvider) => {
				packages.set(providerId, packageManagerProvider);
			},
			getPackageManagers: () => { return packages; },
		},
		outputChannel: {
			name: '',
			append: (value: string) => { },
			appendLine: (value: string) => { },
			clear: () => { },
			show: () => { },
			hide: () => { },
			dispose: () => { }
		},
		processService: TypeMoq.Mock.ofType(ProcessService),
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		queryRunner: TypeMoq.Mock.ofType(QueryRunner),
		op: {
			updateStatus: (status: azdata.TaskStatus, message?: string) => {
				opStatus = status;
			},
			id: '',
			onCanceled: undefined,
		},
		getOpStatus: () => { return opStatus; }
	};
}
