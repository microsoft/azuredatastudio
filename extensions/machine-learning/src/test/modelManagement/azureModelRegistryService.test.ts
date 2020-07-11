/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ApiWrapper } from '../../common/apiWrapper';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { AzureModelRegistryService } from '../../modelManagement/azureModelRegistryService';
import { Config } from '../../configurations/config';
import { HttpClient } from '../../common/httpClient';
import { azureResource } from '../../typings/azure-resource';

import * as utils from '../utils';
import { Workspace, WorkspacesListByResourceGroupResponse } from '@azure/arm-machinelearningservices/esm/models';
import { WorkspaceModel, AssetsQueryByIdResponse, Asset, GetArtifactContentInformation2Response } from '../../modelManagement/interfaces';
import { AzureMachineLearningWorkspaces, Workspaces } from '@azure/arm-machinelearningservices';
import { WorkspaceModels } from '../../modelManagement/workspacesModels';
import { AzurecoreApiStub } from '../stubs';

interface TestContext {

	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	config: TypeMoq.IMock<Config>;
	httpClient: TypeMoq.IMock<HttpClient>;
	outputChannel: vscode.OutputChannel;
	op: azdata.BackgroundOperation;
	accounts: azdata.Account[];
	subscriptions: azureResource.AzureResourceSubscription[];
	groups: azureResource.AzureResourceResourceGroup[];
	workspaces: Workspace[];
	models: WorkspaceModel[];
	client: TypeMoq.IMock<AzureMachineLearningWorkspaces>;
	workspacesClient: TypeMoq.IMock<Workspaces>;
	modelClient: TypeMoq.IMock<WorkspaceModels>;
}

function createContext(): TestContext {
	const context = utils.createContext();
	const workspaces = TypeMoq.Mock.ofType(Workspaces);
	const credentials = {
		signRequest: () => {
			return Promise.resolve(undefined!!);
		}
	};
	const client = TypeMoq.Mock.ofInstance(new AzureMachineLearningWorkspaces(credentials, 'subscription'));
	client.setup(x => x.apiVersion).returns(() => '20180101');

	return {
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		config: TypeMoq.Mock.ofType(Config),
		httpClient: TypeMoq.Mock.ofType(HttpClient),
		outputChannel: context.outputChannel,
		op: context.op,
		accounts: [
			{
				key: {
					providerId: '',
					accountId: 'a1'
				},
				displayInfo: {
					contextualDisplayName: '',
					accountType: '',
					displayName: 'a1',
					userId: 'a1'
				},
				properties:
				{
					tenants: [
						{
							id: '1',
						}
					]
				}
				,
				isStale: true
			}
		],
		subscriptions: [
			{
				name: 's1',
				id: 's1'
			}
		],
		groups: [
			{
				name: 'g1',
				id: 'g1'
			}
		],
		workspaces: [{
			name: 'w1',
			id: 'w1'
		}
		],
		models: [
			{
				name: 'm1',
				id: 'm1',
				url: 'aml://asset/test.test'
			}
		],
		client: client,
		workspacesClient: workspaces,
		modelClient: TypeMoq.Mock.ofInstance(new WorkspaceModels(client.object))
	};
}

describe('AzureModelRegistryService', () => {
	it('getAccounts should return the list of accounts successfully', async function (): Promise<void> {
		let testContext = createContext();
		const accounts = testContext.accounts;
		let service = new AzureModelRegistryService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.httpClient.object,
			testContext.outputChannel);
		testContext.apiWrapper.setup(x => x.getAllAccounts()).returns(() => Promise.resolve(accounts));
		let actual = await service.getAccounts();
		should.deepEqual(actual, testContext.accounts);
	});

	it('getSubscriptions should return the list of subscriptions successfully', async function (): Promise<void> {
		let testContext = createContext();
		const expected = testContext.subscriptions;
		let service = new AzureModelRegistryService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.httpClient.object,
			testContext.outputChannel);
		const azurecoreApi = TypeMoq.Mock.ofType(AzurecoreApiStub);
		azurecoreApi.setup(x => x.getSubscriptions(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ subscriptions: expected, errors: [] }));
		testContext.apiWrapper.setup(x => x.getAzurecoreApi()).returns(() => Promise.resolve(azurecoreApi.object));
		let actual = await service.getSubscriptions(testContext.accounts[0]);
		should.deepEqual(actual, expected);
	});

	it('getGroups should return the list of groups successfully', async function (): Promise<void> {
		let testContext = createContext();
		const expected = testContext.groups;
		let service = new AzureModelRegistryService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.httpClient.object,
			testContext.outputChannel);
		const azurecoreApi = TypeMoq.Mock.ofType(AzurecoreApiStub);
		azurecoreApi.setup(x => x.getResourceGroups(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ resourceGroups: expected, errors: [] }));
		testContext.apiWrapper.setup(x => x.getAzurecoreApi()).returns(() => Promise.resolve(azurecoreApi.object));
		let actual = await service.getGroups(testContext.accounts[0], testContext.subscriptions[0]);
		should.deepEqual(actual, expected);
	});

	it('getWorkspaces should return the list of workspaces successfully', async function (): Promise<void> {
		let testContext = createContext();
		const response: WorkspacesListByResourceGroupResponse = Object.assign(new Array<Workspace>(...testContext.workspaces), {
			_response: undefined!
		});
		const expected = testContext.workspaces;
		testContext.workspacesClient.setup(x => x.listByResourceGroup(TypeMoq.It.isAny())).returns(() => Promise.resolve(response));
		testContext.workspacesClient.setup(x => x.listBySubscription()).returns(() => Promise.resolve(response));
		testContext.client.setup(x => x.workspaces).returns(() => testContext.workspacesClient.object);
		let service = new AzureModelRegistryService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.httpClient.object,
			testContext.outputChannel);


		service.AzureMachineLearningClient = testContext.client.object;
		let actual = await service.getWorkspaces(testContext.accounts[0], testContext.subscriptions[0], testContext.groups[0]);
		should.deepEqual(actual, expected);
	});

	it('getModels should return the list of models successfully', async function (): Promise<void> {
		let testContext = createContext();
		testContext.config.setup(x => x.amlApiVersion).returns(() => '2018');
		testContext.config.setup(x => x.amlModelManagementUrl).returns(() => 'test.url');
		const expected = testContext.models;
		let service = new AzureModelRegistryService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.httpClient.object,
			testContext.outputChannel);
		service.AzureMachineLearningClient = testContext.client.object;
		service.ModelClient = testContext.modelClient.object;
		testContext.modelClient.setup(x => x.listModels(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(testContext.models));
		let actual = await service.getModels(testContext.accounts[0], testContext.subscriptions[0], testContext.groups[0], testContext.workspaces[0]);
		should.deepEqual(actual, expected);
	});

	it('downloadModel should download model artifact successfully', async function (): Promise<void> {
		let testContext = createContext();
		const asset: Asset =
		{
			id: '1',
			name: 'asset',
			artifacts: [
				{
					id: '/1/2/3/4/5/'
				}
			]
		};
		const assetResponse: AssetsQueryByIdResponse = Object.assign(asset, {
			_response: undefined!
		});
		const artifactResponse: GetArtifactContentInformation2Response = Object.assign({
			contentUri: 'downloadUrl'
		}, {
			_response: undefined!
		});

		testContext.config.setup(x => x.amlApiVersion).returns(() => '2018');
		testContext.config.setup(x => x.amlModelManagementUrl).returns(() => 'test.url');
		testContext.config.setup(x => x.amlExperienceUrl).returns(() => 'test.url');
		testContext.client.setup(x => x.sendOperationRequest(TypeMoq.It.isAny(),
			TypeMoq.It.is(p => p.path !== undefined && p.path.startsWith('modelmanagement')), TypeMoq.It.isAny())).returns(() => Promise.resolve(assetResponse));
		testContext.client.setup(x => x.sendOperationRequest(TypeMoq.It.isAny(),
			TypeMoq.It.is(p => p.path !== undefined && p.path.startsWith('artifact')), TypeMoq.It.isAny())).returns(() => Promise.resolve(artifactResponse));
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.httpClient.setup(x => x.download(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		let service = new AzureModelRegistryService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.httpClient.object,
			testContext.outputChannel);
		service.AzureMachineLearningClient = testContext.client.object;
		service.ModelClient = testContext.modelClient.object;
		testContext.modelClient.setup(x => x.listModels(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(testContext.models));
		let actual = await service.downloadModel(testContext.accounts[0], testContext.subscriptions[0], testContext.groups[0], testContext.workspaces[0], testContext.models[0]);
		should.notEqual(actual, undefined);
		testContext.httpClient.verify(x => x.download(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});
});
