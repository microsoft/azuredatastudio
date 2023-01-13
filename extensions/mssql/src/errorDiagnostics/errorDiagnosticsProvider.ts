/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { AppContext } from '../appContext';
import { azureResource } from 'azurecore';
import type * as mssql from 'mssql';

const typesClause = [
	azureResource.AzureResourceType.sqlDatabase,
	azureResource.AzureResourceType.sqlServer,
	azureResource.AzureResourceType.sqlSynapseWorkspace,
	azureResource.AzureResourceType.sqlSynapseSqlPool,
	azureResource.AzureResourceType.sqlManagedInstance,
	azureResource.AzureResourceType.postgresServer,
	azureResource.AzureResourceType.azureArcService,
	azureResource.AzureResourceType.azureArcSqlManagedInstance,
	azureResource.AzureResourceType.azureArcPostgresServer
].map(type => `type == "${type}"`).join(' or ');

export class AzureErrorDiagnosticsProvider implements azdata.Diagnostics {
	constructor(private _appContext: AppContext,
		private readonly authLibrary: string) { }

	public providerId = "";
	public title = "";

	async handleErrorCode(errorCode: number, errorMessage: string): Promise<mssql.ErrorDiagnosticsResponse> {
		return Promise.resolve({ errorAction: "" });
		// const params: contracts.ErrorDiagnosticsParameters = { errorCode, errorMessage };
		// return this.client.sendRequest(contracts.DiagnosticsRequest.type, params).then(
		// 	undefined,
		// 	e => {
		// 		this.client.logFailedRequest(contracts.DiagnosticsRequest.type, e);
		// 		return Promise.resolve(undefined);
		// 	}
		// )
	}
}
