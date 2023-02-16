/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import { AppContext } from '../appContext';
import { ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';
import * as constants from '../constants';
import * as Utils from '../utils';
import * as azdata from 'azdata';
import * as contracts from '../contracts';

export class SqlProjectsService implements mssql.ISqlProjectsService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends SqlProjectsService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(capabilities, 'sqlProjects')!.sqlProjects = true;
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.SqlProjectsService, this);
	}


	public async openProject(projectUri: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectParams = { projectUri };
		try {
			const result = await this.client.sendRequest(contracts.OpenSqlProjectRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.OpenSqlProjectRequest.type, e);
			throw e;
		}
	}

	public async getCrossPlatformCompatiblityRequest(projectUri: string): Promise<mssql.GetCrossPlatformCompatiblityResult> {
		const params: contracts.SqlProjectParams = { projectUri };
		try {
			const result = await this.client.sendRequest(contracts.GetCrossPlatformCompatiblityRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.OpenSqlProjectRequest.type, e);
			throw e;
		}
	}
}
