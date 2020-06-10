/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import 'mocha';
import { createContext } from './utils';
import {
	ListModelsEventName, ListAccountsEventName, ListSubscriptionsEventName, ListGroupsEventName, ListWorkspacesEventName,
	ListAzureModelsEventName, ListDatabaseNamesEventName, ListTableNamesEventName, ListColumnNamesEventName, LoadModelParametersEventName, DownloadAzureModelEventName, DownloadRegisteredModelEventName, ModelSourceType, VerifyImportTableEventName
}
	from '../../../views/models/modelViewBase';
import { ImportedModel, ModelParameters } from '../../../modelManagement/interfaces';
import { azureResource } from '../../../typings/azure-resource';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { ViewBase } from '../../../views/viewBase';
import { WorkspaceModel } from '../../../modelManagement/interfaces';
import { PredictWizard } from '../../../views/models/prediction/predictWizard';
import { DatabaseTable, TableColumn } from '../../../prediction/interfaces';

describe('Predict Wizard', () => {
	it('Should create view components successfully ', async function (): Promise<void> {
		let testContext = createContext();

		let view = new PredictWizard(testContext.apiWrapper.object, '');
		await view.open();
		should.notEqual(view.wizardView, undefined);
		should.notEqual(view.modelSourcePage, undefined);
	});

	it('Should load data successfully ', async function (): Promise<void> {
		let testContext = createContext();

		let view = new PredictWizard(testContext.apiWrapper.object, '');
		view.importTable = {
			databaseName: 'db',
			tableName: 'tb',
			schema: 'dbo'
		};
		await view.open();
		let accounts: azdata.Account[] = [
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
		let subscriptions: azureResource.AzureResourceSubscription[] = [
			{
				name: 'subscription',
				id: '2'
			}
		];
		let groups: azureResource.AzureResourceResourceGroup[] = [
			{
				name: 'group',
				id: '3'
			}
		];
		let workspaces: Workspace[] = [
			{
				name: 'workspace',
				id: '4'
			}
		];
		let models: WorkspaceModel[] = [
			{
				id: '5',
				name: 'model'
			}
		];
		let localModels: ImportedModel[] = [
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

		view.on(ListModelsEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListModelsEventName), { inputArgs: args,  data: localModels });
		});
		view.on(ListAccountsEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListAccountsEventName), { inputArgs: args,  data: accounts });
		});
		view.on(ListSubscriptionsEventName, (args) => {

			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListSubscriptionsEventName), { inputArgs: args,  data: subscriptions });
		});
		view.on(ListGroupsEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListGroupsEventName), { inputArgs: args,  data: groups });
		});
		view.on(ListWorkspacesEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListWorkspacesEventName), { inputArgs: args,  data: workspaces });
		});
		view.on(ListAzureModelsEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListAzureModelsEventName), { inputArgs: args,  data: models });
		});
		view.on(ListDatabaseNamesEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListDatabaseNamesEventName), { inputArgs: args,  data: dbNames });
		});
		view.on(ListTableNamesEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListTableNamesEventName), { inputArgs: args,  data: tableNames });
		});
		view.on(ListColumnNamesEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListColumnNamesEventName), { inputArgs: args,  data: columnNames });
		});
		view.on(LoadModelParametersEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(LoadModelParametersEventName), { inputArgs: args,  data: modelParameters });
		});
		view.on(DownloadAzureModelEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(DownloadAzureModelEventName), { inputArgs: args,  data: 'path' });
		});
		view.on(DownloadRegisteredModelEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(DownloadRegisteredModelEventName), { inputArgs: args,  data: 'path' });
		});
		view.on(VerifyImportTableEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(VerifyImportTableEventName), { inputArgs: args,  data: view.importTable });
		});
		if (view.modelBrowsePage) {
			view.modelBrowsePage.modelSourceType = ModelSourceType.Azure;
		}
		await view.refresh();
		should.notEqual(view.azureModelsComponent?.data, undefined);

		if (view.modelBrowsePage) {
			view.modelBrowsePage.modelSourceType = ModelSourceType.RegisteredModels;
		}
		await view.refresh();
		testContext.onClick.fire(undefined);

		should.equal(view.modelSourcePage?.data, ModelSourceType.RegisteredModels);
		should.notEqual(view.localModelsComponent?.data, undefined);
		should.notEqual(view.modelBrowsePage?.registeredModelsComponent?.data, undefined);
		if (view.modelBrowsePage?.registeredModelsComponent?.data) {
			should.equal(view.modelBrowsePage.registeredModelsComponent.data.length, 1);
		}


		should.notEqual(await view.getModelFileName(), undefined);
		await view.columnsSelectionPage?.onEnter();

		should.notEqual(view.columnsSelectionPage?.data, undefined);
		should.equal(view.columnsSelectionPage?.data?.inputColumns?.length, modelParameters.inputs.length, modelParameters.inputs[0].name);
		should.equal(view.columnsSelectionPage?.data?.outputColumns?.length, modelParameters.outputs.length);
	});
});
