/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

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

interface TestContext {

	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	queryRunner: TypeMoq.IMock<QueryRunner>;
	processService: TypeMoq.IMock<ProcessService>;
	context: vscode.ExtensionContext;
	outputChannel: vscode.OutputChannel;
	extension: vscode.Extension<any>;
	packageManager: TypeMoq.IMock<PackageManager>;
}

function createContext(): TestContext {
	let extensionPath = path.join(__dirname, '..', '..');
	return {
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
			logPath: ''
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
			activate: () => { return Promise.resolve(); }
		}
	};
}

function createController(testContext: TestContext): MainController {
	let controller = new MainController(testContext.context, testContext.apiWrapper.object, testContext.queryRunner.object, testContext.processService.object);
	controller.packageManager = testContext.packageManager.object;
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
		testContext.apiWrapper.setup(x => x.createOutputChannel(TypeMoq.It.isAny())).returns(() => testContext.outputChannel);
		testContext.apiWrapper.setup(x => x.getExtension(TypeMoq.It.isAny())).returns(() => testContext.extension);
		testContext.packageManager.setup(x => x.managePackages()).returns(() => Promise.resolve());
		testContext.packageManager.setup(x => x.installDependencies()).returns(() => Promise.resolve());
		testContext.apiWrapper.setup(x => x.registerCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()));
		let controller = createController(testContext);
		await controller.activate();
		should.deepEqual(controller.config.requiredPythonPackages, [
			{ name: 'pymssql', version: '2.1.4' },
			{ name: 'sqlmlutils', version: '' }
		]);
	});

	it('initialize Should show and error in output channel if installing dependencies fails', async function (): Promise<void> {
		let errorReported = false;
		let testContext = createContext();
		testContext.apiWrapper.setup(x => x.createOutputChannel(TypeMoq.It.isAny())).returns(() => testContext.outputChannel);
		testContext.apiWrapper.setup(x => x.getExtension(TypeMoq.It.isAny())).returns(() => testContext.extension);
		testContext.packageManager.setup(x => x.managePackages()).returns(() => Promise.resolve());
		testContext.packageManager.setup(x => x.installDependencies()).returns(() => Promise.reject());
		testContext.apiWrapper.setup(x => x.registerCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()));
		testContext.outputChannel.appendLine = () => {
			errorReported = true;
		};
		let controller = createController(testContext);
		await controller.activate();
		should.equal(errorReported, true);
	});
});
