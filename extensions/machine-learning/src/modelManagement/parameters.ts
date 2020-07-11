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
export const workspace: msRest.OperationURLParameter = {
	parameterPath: 'workspace',
	mapper: {
		required: true,
		serializedName: 'workspace',
		type: {
			name: 'String'
		}
	}
};
export const resourceGroup: msRest.OperationURLParameter = {
	parameterPath: 'resourceGroup',
	mapper: {
		required: true,
		serializedName: 'resourceGroup',
		type: {
			name: 'String'
		}
	}
};
export const id: msRest.OperationURLParameter = {
	parameterPath: 'id',
	mapper: {
		required: true,
		serializedName: 'id',
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
export const origin: msRest.OperationURLParameter = {
	parameterPath: 'origin',
	mapper: {
		required: true,
		serializedName: 'origin',
		type: {
			name: 'String'
		}
	}
};
export const container: msRest.OperationURLParameter = {
	parameterPath: 'container',
	mapper: {
		required: true,
		serializedName: 'container',
		type: {
			name: 'String'
		}
	}
};
export const projectName0: msRest.OperationQueryParameter = {
	parameterPath: [
		'options',
		'projectName'
	],
	mapper: {
		serializedName: 'projectName',
		type: {
			name: 'String'
		}
	}
};
export const path1: msRest.OperationQueryParameter = {
	parameterPath: [
		'options',
		'path'
	],
	mapper: {
		serializedName: 'path',
		type: {
			name: 'String'
		}
	}
};
export const accountName: msRest.OperationQueryParameter = {
	parameterPath: [
		'options',
		'accountName'
	],
	mapper: {
		serializedName: 'accountName',
		type: {
			name: 'String'
		}
	}
};
