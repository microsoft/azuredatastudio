/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ApiWrapper } from '../../common/apiWrapper';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { Config } from '../../configurations/config';

import * as utils from '../utils';
import { ProcessService } from '../../common/processService';
import { PackageManager } from '../../packageManagement/packageManager';
import { ModelPythonClient } from '../../modelManagement/modelPythonClient';

interface TestContext {

	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	config: TypeMoq.IMock<Config>;
	outputChannel: vscode.OutputChannel;
	op: azdata.BackgroundOperation;
	processService: TypeMoq.IMock<ProcessService>;
	packageManager: TypeMoq.IMock<PackageManager>;
}

function createContext(): TestContext {
	const context = utils.createContext();

	return {
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		config: TypeMoq.Mock.ofType(Config),
		outputChannel: context.outputChannel,
		op: context.op,
		processService: TypeMoq.Mock.ofType(ProcessService),
		packageManager: TypeMoq.Mock.ofType(PackageManager)
	};
}

describe('ModelPythonClient', () => {
	it('deployModel should deploy the model successfully', async function (): Promise<void> {
		const testContext = createContext();
		const connection = new azdata.connection.ConnectionProfile();
		const modelPath = 'C:\\test';
		let service = new ModelPythonClient(
			testContext.outputChannel,
			testContext.apiWrapper.object,
			testContext.processService.object,
			testContext.config.object,
			testContext.packageManager.object);
		testContext.packageManager.setup(x => x.installRequiredPythonPackages(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.config.setup(x => x.getPythonExecutable(true)).returns(() => Promise.resolve('pythonPath'));
		testContext.processService.setup(x => x.execScripts(TypeMoq.It.isAny(), TypeMoq.It.isAny(),
			TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(''));

		await service.deployModel(connection, modelPath);
	});

	it('loadModelParameters should load model parameters successfully', async function (): Promise<void> {
		const testContext = createContext();
		const modelPath = 'C:\\test';
		const expected = {
			inputs: [
				{
					'name': 'p1',
					'type': 'int'
				},
				{
					'name': 'p2',
					'type': 'varchar'
				}
			],
			outputs: [
				{
					'name': 'o1',
					'type': 'int'
				},
			]
		};
		const parametersJson = `
		{
			"inputs": [
				{
					"name": "p1",
					"type": "int"
				},
				{
					"name": "p2",
					"type": "varchar"
				}
			],
			"outputs": [
				{
					"name": "o1",
					"type": "int"
				}
			]
		}
		`;
		let service = new ModelPythonClient(
			testContext.outputChannel,
			testContext.apiWrapper.object,
			testContext.processService.object,
			testContext.config.object,
			testContext.packageManager.object);
		testContext.packageManager.setup(x => x.installRequiredPythonPackages(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		testContext.config.setup(x => x.getPythonExecutable(true)).returns(() => Promise.resolve('pythonPath'));
		testContext.processService.setup(x => x.execScripts(TypeMoq.It.isAny(), TypeMoq.It.isAny(),
			TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(parametersJson));
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});

		const actual = await service.loadModelParameters(modelPath);
		should.deepEqual(actual, expected);
	});
});
