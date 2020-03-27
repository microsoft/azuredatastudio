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
	ListAzureModelsEventName, ListDatabaseNamesEventName, ListTableNamesEventName, ListColumnNamesEventName, LoadModelParametersEventName, DownloadAzureModelEventName, DownloadRegisteredModelEventName
}
	from '../../../views/models/modelViewBase';
import { RegisteredModel, ModelParameters } from '../../../modelManagement/interfaces';
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
		let localModels: RegisteredModel[] = [
			{
				id: 1,
				artifactName: 'model',
				title: 'model'
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

		view.on(ListModelsEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListModelsEventName), { data: localModels });
		});
		view.on(ListAccountsEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListAccountsEventName), { data: accounts });
		});
		view.on(ListSubscriptionsEventName, () => {

			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListSubscriptionsEventName), { data: subscriptions });
		});
		view.on(ListGroupsEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListGroupsEventName), { data: groups });
		});
		view.on(ListWorkspacesEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListWorkspacesEventName), { data: workspaces });
		});
		view.on(ListAzureModelsEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListAzureModelsEventName), { data: models });
		});
		view.on(ListDatabaseNamesEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListDatabaseNamesEventName), { data: dbNames });
		});
		view.on(ListTableNamesEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListTableNamesEventName), { data: tableNames });
		});
		view.on(ListColumnNamesEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListColumnNamesEventName), { data: columnNames });
		});
		view.on(LoadModelParametersEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(LoadModelParametersEventName), { data: modelParameters });
		});
		view.on(DownloadAzureModelEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(DownloadAzureModelEventName), { data: 'path' });
		});
		view.on(DownloadRegisteredModelEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(DownloadRegisteredModelEventName), { data: 'path' });
		});
		await view.refresh();
		should.notEqual(view.azureModelsComponent?.data, undefined);
		should.notEqual(view.localModelsComponent?.data, undefined);

		should.notEqual(await view.getModelFileName(), undefined);
		await view.columnsSelectionPage?.onEnter();

		should.notEqual(view.columnsSelectionPage?.data, undefined);
		should.equal(view.columnsSelectionPage?.data?.inputColumns?.length, modelParameters.inputs.length, modelParameters.inputs[0].name);
		should.equal(view.columnsSelectionPage?.data?.outputColumns?.length, modelParameters.outputs.length);
	});
});
