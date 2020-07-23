/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import 'mocha';
import * as TypeMoq from 'typemoq';
import * as path from 'path';
import { ApiWrapper } from '../common/apiWrapper';
import { QueryRunner } from '../common/queryRunner';
import { ProcessService } from '../common/processService';
import MainController from '../controllers/mainController';
import { PackageManager } from '../packageManagement/packageManager';
import * as nbExtensionApis from '../typings/notebookServices';

interface TestContext {
	notebookExtension: vscode.Extension<any>;
	jupyterInstallation: nbExtensionApis.IJupyterServerInstallation;
	jupyterController: nbExtensionApis.IJupyterController;
	nbExtensionApis: nbExtensionApis.IExtensionApi;
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	queryRunner: TypeMoq.IMock<QueryRunner>;
	processService: TypeMoq.IMock<ProcessService>;
	context: vscode.ExtensionContext;
	outputChannel: vscode.OutputChannel;
	extension: vscode.Extension<any>;
	packageManager: TypeMoq.IMock<PackageManager>;
	workspaceConfig: vscode.WorkspaceConfiguration;
}

function createContext(): TestContext {
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

	let extensionPath = path.join(__dirname, '..', '..');
	let extensionApi: nbExtensionApis.IExtensionApi = {
		getJupyterController: () => { return jupyterController; },
		registerPackageManager: (providerId: string, packageManagerProvider: nbExtensionApis.IPackageManageProvider) => {
			packages.set(providerId, packageManagerProvider);
		},
		getPackageManagers: () => { return packages; },
	};
	return {
		jupyterInstallation: jupyterInstallation,
		jupyterController: jupyterController,
		nbExtensionApis: extensionApi,
		notebookExtension: {
			id: '',
			extensionPath: '',
			isActive: true,
			packageJSON: '',
			extensionKind: vscode.ExtensionKind.UI,
			exports: extensionApi,
			activate: () => {return Promise.resolve();},
			extensionUri: vscode.Uri.parse('')
		},
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		queryRunner: TypeMoq.Mock.ofType(QueryRunner),
		processService: TypeMoq.Mock.ofType(ProcessService),
		packageManager: TypeMoq.Mock.ofType(PackageManager),
		context: {
			subscriptions: [],
			workspaceState: {
				get: () => {return undefined;},
				update: () => {return Promise.resolve();}
			},
			globalState: {
				get:  () => {return Promise.resolve();},
				update: () => {return Promise.resolve();}
			},
			extensionPath: extensionPath,
			asAbsolutePath: () => {return '';},
			storagePath: '',
			globalStoragePath: '',
			logPath: '',
			extensionUri: vscode.Uri.parse(''),
			environmentVariableCollection: { } as any,
			extensionMode: undefined as any
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
		extension: {
			id: '',
			extensionPath: '',
			isActive: true,
			packageJSON: {},
			extensionKind: vscode.ExtensionKind.UI,
			exports: {},
			activate: () => { return Promise.resolve(); },
			extensionUri: vscode.Uri.parse('')
		},
		workspaceConfig: {
			get: () => {return 'value';},
			has: () => {return true;},
			inspect: () => {return undefined;},
			update: () => {return Promise.reject();},
		}
	};
}

function createController(testContext: TestContext): MainController {
	let controller = new MainController(testContext.context, testContext.apiWrapper.object, testContext.queryRunner.object, testContext.processService.object, testContext.packageManager.object);
	return controller;
}

describe('Main Controller', () => {
	it('Should create new instance successfully', async function (): Promise<void> {
		let testContext = createContext();
		testContext.apiWrapper.setup(x => x.createOutputChannel(TypeMoq.It.isAny())).returns(() => testContext.outputChannel);
		should.doesNotThrow(() => createController(testContext));
	});

	it('initialize Should install dependencies successfully', async function (): Promise<void> {
		let testContext = createContext();

		testContext.apiWrapper.setup(x => x.getExtension(TypeMoq.It.isAny())).returns(() => testContext.notebookExtension);
		testContext.apiWrapper.setup(x => x.getConfiguration(TypeMoq.It.isAny())).returns(() => testContext.workspaceConfig);
		testContext.apiWrapper.setup(x => x.createOutputChannel(TypeMoq.It.isAny())).returns(() => testContext.outputChannel);
		testContext.apiWrapper.setup(x => x.getExtension(TypeMoq.It.isAny())).returns(() => testContext.extension);
		testContext.packageManager.setup(x => x.managePackages()).returns(() => Promise.resolve());
		testContext.packageManager.setup(x => x.installDependencies()).returns(() => Promise.resolve());
		testContext.apiWrapper.setup(x => x.registerCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()));
		let controller = createController(testContext);
		await controller.activate();

		should.notEqual(controller.config.requiredSqlPythonPackages.find(x => x.name ==='sqlmlutils'), undefined);
	});
});
