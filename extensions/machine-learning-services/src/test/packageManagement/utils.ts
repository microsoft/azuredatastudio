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
import { Config } from '../../common/config';

export interface TestContext {
	jupyterInstallation: nbExtensionApis.IJupyterServerInstallation;
	jupyterController: nbExtensionApis.IJupyterController;
	nbExtensionApis: nbExtensionApis.IExtensionApi;
	outputChannel: vscode.OutputChannel;
	processService: TypeMoq.IMock<ProcessService>;
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	queryRunner: TypeMoq.IMock<QueryRunner>;
	config: TypeMoq.IMock<Config>;
	op: azdata.BackgroundOperation;
	getOpStatus: () => azdata.TaskStatus;
}

export function createContext(): TestContext {
	let opStatus: azdata.TaskStatus;
	let packages = new Map<string, nbExtensionApis.IPackageManageProvider>();
	let jupyterInstallation: nbExtensionApis.IJupyterServerInstallation = {
		installCondaPackages: () => { return Promise.resolve(); },
		getInstalledPipPackages: () => { return Promise.resolve([]); },
		installPipPackages: () => { return Promise.resolve(); },
		uninstallPipPackages: () => { return Promise.resolve(); },
		uninstallCondaPackages: () => { return Promise.resolve(); },
		executeBufferedCommand: () => { return Promise.resolve(''); },
		executeStreamedCommand: () => { return Promise.resolve(); },
		pythonExecutable: '',
		pythonInstallationPath: '',
		installPythonPackage: () => { return Promise.resolve(); }
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
			append: () => { },
			appendLine: () => { },
			clear: () => { },
			show: () => { },
			hide: () => { },
			dispose: () => { }
		},
		processService: TypeMoq.Mock.ofType(ProcessService),
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		queryRunner: TypeMoq.Mock.ofType(QueryRunner),
		config: TypeMoq.Mock.ofType(Config),
		op: {
			updateStatus: (status: azdata.TaskStatus) => {
				opStatus = status;
			},
			id: '',
			onCanceled: new vscode.EventEmitter<void>().event,
		},
		getOpStatus: () => { return opStatus; }
	};
}
