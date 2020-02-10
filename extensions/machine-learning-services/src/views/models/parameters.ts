/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';

export const subscriptionId: msRest.OperationURLParameter = {
	parameterPath: 'subscriptionId',
	mapper: {
		required: true,
		serializedName: 'subscriptionId',
		type: {
			name: 'String'
		}
	}
};

export const resourceGroupName: msRest.OperationURLParameter = {
	parameterPath: 'resourceGroupName',
	mapper: {
		required: true,
		serializedName: 'resourceGroupName',
		type: {
			name: 'String'
		}
	}
};

export const workspaceName: msRest.OperationURLParameter = {
	parameterPath: 'workspaceName',
	mapper: {
		required: true,
		serializedName: 'workspaceName',
		type: {
			name: 'String'
		}
	}
};
export const acceptLanguage: msRest.OperationParameter = {
	parameterPath: 'acceptLanguage',
	mapper: {
		serializedName: 'accept-language',
		defaultValue: 'en-US',
		type: {
			name: 'String'
		}
	}
};
export const apiVersion: msRest.OperationQueryParameter = {
	parameterPath: 'apiVersion',
	mapper: {
		required: true,
		serializedName: 'api-version',
		type: {
			name: 'String'
		}
	}
};
