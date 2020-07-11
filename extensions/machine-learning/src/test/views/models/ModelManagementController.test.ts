/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import 'mocha';
import { createContext } from './utils';
import { ImportedModel, ModelParameters } from '../../../modelManagement/interfaces';
import { azureResource } from '../../../typings/azure-resource';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { WorkspaceModel } from '../../../modelManagement/interfaces';
import { ModelManagementController } from '../../../views/models/modelManagementController';
import { DatabaseTable, TableColumn } from '../../../prediction/interfaces';
import { DeleteModelEventName, UpdateModelEventName } from '../../../views/models/modelViewBase';
import { EditModelDialog } from '../../../views/models/manageModels/editModelDialog';

const accounts: azdata.Account[] = [
	{
		key: {
			accountId: '1',
			providerId: ''
		},
		displayInfo: {
			displayName: 'account',
			userId: '',
			accountType: '',
			contextualDisplayName: ''
		},
		isStale: false,
		properties: []
	}
];
const subscriptions: azureResource.AzureResourceSubscription[] = [
	{
		name: 'subscription',
		id: '2'
	}
];
const groups: azureResource.AzureResourceResourceGroup[] = [
	{
		name: 'group',
		id: '3'
	}
];
const workspaces: Workspace[] = [
	{
		name: 'workspace',
		id: '4'
	}
];
const models: WorkspaceModel[] = [
	{
		id: '5',
		name: 'model'
	}
];
const localModels: ImportedModel[] = [
	{
		id: 1,
		modelName: 'model',
		table: {
			databaseName: 'db',
			tableName: 'tb',
			schema: 'dbo'
		}
	}
];

const dbNames: string[] = [
	'db1',
	'db2'
];
const tableNames: DatabaseTable[] = [
	{
		databaseName: 'db1',
		schema: 'dbo',
		tableName: 'tb1'
	},
	{
		databaseName: 'db1',
		tableName: 'tb2',
		schema: 'dbo'
	}
];
const columnNames: TableColumn[] = [
	{
		columnName: 'c1',
		dataType: 'int'
	},
	{
		columnName: 'c2',
		dataType: 'varchar'
	}
];
const modelParameters: ModelParameters = {
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
		}
	]
};
describe('Model Controller', () => {


	it('Should open import model wizard successfully ', async function (): Promise<void> {
		let testContext = createContext();


		let controller = new ModelManagementController(testContext.apiWrapper.object, '', testContext.azureModelService.object, testContext.deployModelService.object, testContext.predictService.object);
		testContext.deployModelService.setup(x => x.getRecentImportTable()).returns(() => Promise.resolve({
			databaseName: 'db',
			tableName: 'table',
			schema: 'dbo'
		}));
		testContext.deployModelService.setup(x => x.storeRecentImportTable(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		testContext.deployModelService.setup(x => x.getDeployedModels(TypeMoq.It.isAny())).returns(() => Promise.resolve(localModels));
		testContext.deployModelService.setup(x => x.verifyConfigTable(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
		testContext.deployModelService.setup(x => x.deployLocalModel(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		testContext.deployModelService.setup(x => x.updateModel(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		testContext.deployModelService.setup(x => x.deleteModel(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		testContext.deployModelService.setup(x => x.downloadModel(TypeMoq.It.isAny())).returns(() => Promise.resolve('path'));
		testContext.predictService.setup(x => x.getDatabaseList()).returns(() => Promise.resolve(dbNames));
		testContext.predictService.setup(x => x.getTableList(TypeMoq.It.isAny())).returns(() => Promise.resolve(tableNames));
		testContext.azureModelService.setup(x => x.getAccounts()).returns(() => Promise.resolve(accounts));
		testContext.azureModelService.setup(x => x.signInToAzure()).returns(() => Promise.resolve());
		testContext.azureModelService.setup(x => x.getSubscriptions(TypeMoq.It.isAny())).returns(() => Promise.resolve(subscriptions));
		testContext.azureModelService.setup(x => x.getGroups(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(groups));
		testContext.azureModelService.setup(x => x.getWorkspaces(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(workspaces));
		testContext.azureModelService.setup(x => x.getModels(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(models));
		testContext.azureModelService.setup(x => x.downloadModel(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('path'));

		const view = await controller.importModel(undefined);
		should.notEqual(view, undefined);
	});

	it('Should open predict wizard successfully ', async function (): Promise<void> {
		let testContext = createContext();


		let controller = new ModelManagementController(testContext.apiWrapper.object, '', testContext.azureModelService.object, testContext.deployModelService.object, testContext.predictService.object);
		testContext.deployModelService.setup(x => x.getRecentImportTable()).returns(() => Promise.resolve({
			databaseName: 'db',
			tableName: 'table',
			schema: 'dbo'
		}));
		testContext.deployModelService.setup(x => x.getDeployedModels(TypeMoq.It.isAny())).returns(() => Promise.resolve(localModels));
		testContext.predictService.setup(x => x.getDatabaseList()).returns(() => Promise.resolve([
			'db', 'db1'
		]));
		testContext.predictService.setup(x => x.getTableList(TypeMoq.It.isAny())).returns(() => Promise.resolve([
			{ tableName: 'tb', databaseName: 'db', schema: 'dbo' }
		]));
		testContext.azureModelService.setup(x => x.getAccounts()).returns(() => Promise.resolve(accounts));
		testContext.azureModelService.setup(x => x.getSubscriptions(TypeMoq.It.isAny())).returns(() => Promise.resolve(subscriptions));
		testContext.azureModelService.setup(x => x.getGroups(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(groups));
		testContext.azureModelService.setup(x => x.getWorkspaces(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(workspaces));
		testContext.azureModelService.setup(x => x.getModels(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(models));
		testContext.predictService.setup(x => x.getTableColumnsList(TypeMoq.It.isAny())).returns(() => Promise.resolve(columnNames));
		testContext.predictService.setup(x => x.serverSupportOnnxModel()).returns(() => Promise.resolve(true));
		testContext.deployModelService.setup(x => x.loadModelParameters(TypeMoq.It.isAny())).returns(() => Promise.resolve(modelParameters));
		testContext.deployModelService.setup(x => x.verifyConfigTable(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
		testContext.deployModelService.setup(x => x.installDependencies()).returns(() => Promise.resolve());
		testContext.azureModelService.setup(x => x.downloadModel(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('file'));
		testContext.deployModelService.setup(x => x.downloadModel(TypeMoq.It.isAny())).returns(() => Promise.resolve('file'));

		const view = await controller.predictModel();
		should.notEqual(view, undefined);
	});


	it('Should show error message if onnx is not supported ', async function (): Promise<void> {
		let testContext = createContext();
		let controller = new ModelManagementController(testContext.apiWrapper.object, '', testContext.azureModelService.object, testContext.deployModelService.object, testContext.predictService.object);
		testContext.predictService.setup(x => x.serverSupportOnnxModel()).returns(() => Promise.resolve(false));
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
		const view = await controller.predictModel();
		should.equal(view, undefined);
		testContext.apiWrapper.verify(x => x.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('Should open edit model dialog successfully ', async function (): Promise<void> {
		let testContext = createContext();
		testContext.deployModelService.setup(x => x.updateModel(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		testContext.deployModelService.setup(x => x.deleteModel(TypeMoq.It.isAny())).returns(() => Promise.resolve());

		let controller = new ModelManagementController(testContext.apiWrapper.object, '', testContext.azureModelService.object, testContext.deployModelService.object, testContext.predictService.object);
		const model: ImportedModel =
		{
			id: 1,
			modelName: 'name1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1',
			table: {
				databaseName: 'db',
				tableName: 'tb',
				schema: 'dbo'
			}
		};
		const view = <EditModelDialog>await controller.editModel(model);
		should.notEqual(view?.editModelPage, undefined);
		if (view.editModelPage) {
			view.editModelPage.sendRequest(UpdateModelEventName, model);
			view.editModelPage.sendRequest(DeleteModelEventName, model);
		}
		testContext.deployModelService.verify(x => x.updateModel(model), TypeMoq.Times.atLeastOnce());
		testContext.deployModelService.verify(x => x.deleteModel(model), TypeMoq.Times.atLeastOnce());

		should.notEqual(view, undefined);
	});

});
