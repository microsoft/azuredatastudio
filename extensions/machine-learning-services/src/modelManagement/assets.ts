/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';
import * as Models from './interfaces';
import * as Mappers from './mappers';
import * as Parameters from './parameters';
import { AzureMachineLearningWorkspacesContext } from '@azure/arm-machinelearningservices';

export class Assets {
	private readonly client: AzureMachineLearningWorkspacesContext;

	constructor(client: AzureMachineLearningWorkspacesContext) {
		this.client = client;
	}

	queryById(
		subscriptionId: string,
		resourceGroup: string,
		workspace: string,
		id: string,
		options?: msRest.RequestOptionsBase
	): Promise<Models.AssetsQueryByIdResponse>;
	queryById(
		subscriptionId: string,
		resourceGroup: string,
		workspace: string,
		id: string,
		callback: msRest.ServiceCallback<Models.Asset>
	): void;
	queryById(
		subscriptionId: string,
		resourceGroup: string,
		workspace: string,
		id: string,
		options: msRest.RequestOptionsBase,
		callback: msRest.ServiceCallback<Models.Asset>
	): void;
	queryById(
		subscriptionId: string,
		resourceGroup: string,
		workspace: string,
		id: string,
		options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.Asset>,
		callback?: msRest.ServiceCallback<Models.Asset>
	): Promise<Models.AssetsQueryByIdResponse> {
		return this.client.sendOperationRequest(
			{
				subscriptionId,
				resourceGroup,
				workspace,
				id,
				options
			},
			queryByIdOperationSpec,
			callback
		) as Promise<Models.AssetsQueryByIdResponse>;
	}
}

const serializer = new msRest.Serializer(Mappers);
const queryByIdOperationSpec: msRest.OperationSpec = {
	httpMethod: 'GET',
	path:
		'modelmanagement/v1.0/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.MachineLearningServices/workspaces/{workspace}/assets/{id}',
	urlParameters: [Parameters.subscriptionId, Parameters.resourceGroup, Parameters.workspace, Parameters.id],
	responses: {
		200: {
			bodyMapper: Mappers.Asset
		},
		default: {
			bodyMapper: Mappers.ModelErrorResponse
		}
	},
	serializer
};
