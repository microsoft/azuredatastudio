/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureMachineLearningWorkspaces } from '@azure/arm-machinelearningservices';
import * as msRest from '@azure/ms-rest-js';
import { AzureMachineLearningWorkspacesOptions } from '@azure/arm-machinelearningservices/esm/models';

export class AzureMachineLearningModels extends AzureMachineLearningWorkspaces {


	/**
	 * Initializes a new instance of the AzureMachineLearningWorkspaces class.
	 * @param credentials Credentials needed for the client to connect to Azure.
	 * @param subscriptionId Azure subscription identifier.
	 * @param [options] The parameter options
	 */
	constructor(credentials: msRest.ServiceClientCredentials, subscriptionId: string, options?: AzureMachineLearningWorkspacesOptions) {
		super(credentials, subscriptionId, options);

	}
}
