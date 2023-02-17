/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import * as constants from '../constants';
import * as Utils from '../utils';
import * as azdata from 'azdata';
import * as contracts from '../contracts';
import { AppContext } from '../appContext';
import { ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';

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

	public addDacpacReference(projectUri: string, dacpacPath: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddDacpacReferenceParams = { projectUri: projectUri, dacpacPath: dacpacPath, databaseVariable: databaseVariable, serverVariable: serverVariable, suppressMissingDependencies: suppressMissingDependencies, databaseLiteral: databaseLiteral };
		return this.client.sendRequest(contracts.AddDacpacReferenceRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.AddDacpacReferenceRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public addSqlProjectReference(projectUri: string, projectPath: string, projectGuid: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSqlProjectReferenceParams = { projectUri: projectUri, projectPath: projectPath, projectGuid: projectGuid, databaseVariable: databaseVariable, serverVariable: serverVariable, suppressMissingDependencies: suppressMissingDependencies, databaseLiteral: databaseLiteral };
		return this.client.sendRequest(contracts.AddSqlProjectReferenceRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.AddSqlProjectReferenceRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public addSystemDatabaseReference(projectUri: string, systemDatabase: mssql.SystemDatabase, suppressMissingDependencies: boolean, databaseLiteral?: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSystemDatabaseReferenceParams = { projectUri: projectUri, systemDatabase: systemDatabase, suppressMissingDependencies: suppressMissingDependencies, databaseLiteral: databaseLiteral };
		return this.client.sendRequest(contracts.AddSystemDatabaseReferenceRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.AddSystemDatabaseReferenceRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public deleteDatabaseReference(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.DeleteDatabaseReferenceRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.DeleteDatabaseReferenceRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public addFolder(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.FolderParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.AddFolderRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.AddFolderRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public deleteFolder(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.FolderParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.DeleteFolderRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.DeleteFolderRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public addPostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.AddPostDeploymentScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.AddPostDeploymentScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public addPreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.AddPreDeploymentScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.AddPreDeploymentScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public deletePostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.DeletePostDeploymentScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.DeletePostDeploymentScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public deletePreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.DeletePreDeploymentScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.DeletePreDeploymentScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public excludePostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.ExcludePostDeploymentScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.ExcludePostDeploymentScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public excludePreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.ExcludePreDeploymentScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.ExcludePreDeploymentScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public movePostDeploymentScript(projectUri: string, destinationPath: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.MoveItemParams = { projectUri: projectUri, destinationPath: destinationPath, path: path };
		return this.client.sendRequest(contracts.MovePostDeploymentScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.MovePostDeploymentScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public movePreDeploymentScript(projectUri: string, destinationPath: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.MoveItemParams = { projectUri: projectUri, destinationPath: destinationPath, path: path };
		return this.client.sendRequest(contracts.MovePreDeploymentScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.MovePreDeploymentScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public closeProject(projectUri: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return this.client.sendRequest(contracts.CloseSqlProjectRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.CloseSqlProjectRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public getCrossPlatformCompatibility(projectUri: string): Promise<mssql.GetCrossPlatformCompatiblityResult> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return this.client.sendRequest(contracts.GetCrossPlatformCompatiblityRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.GetCrossPlatformCompatiblityRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public newProject(projectUri: string, sqlProjectType: mssql.ProjectType, databaseSchemaProvider?: string, buildSdkVersion?: string): Promise<azdata.ResultStatus> {
		const params: contracts.NewSqlProjectParams = { projectUri: projectUri, sqlProjectType: sqlProjectType, databaseSchemaProvider: databaseSchemaProvider, buildSdkVersion: buildSdkVersion };
		return this.client.sendRequest(contracts.NewSqlProjectRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.NewSqlProjectRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public openProject(projectUri: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return this.client.sendRequest(contracts.OpenSqlProjectRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.OpenSqlProjectRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public updateProjectForCrossPlatform(projectUri: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return this.client.sendRequest(contracts.UpdateProjectForCrossPlatformRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.UpdateProjectForCrossPlatformRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public addSqlCmdVariable(projectUri: string, name: string, defaultValue: string, value: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSqlCmdVariableParams = { projectUri: projectUri, name: name, defaultValue: defaultValue, value: value };
		return this.client.sendRequest(contracts.AddSqlCmdVariableRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.AddSqlCmdVariableRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public deleteSqlCmdVariable(projectUri: string, name?: string): Promise<azdata.ResultStatus> {
		const params: contracts.DeleteSqlCmdVariableParams = { projectUri: projectUri, name: name };
		return this.client.sendRequest(contracts.DeleteSqlCmdVariableRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.DeleteSqlCmdVariableRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public updateSqlCmdVariable(projectUri: string, name: string, defaultValue: string, value: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSqlCmdVariableParams = { projectUri: projectUri, name: name, defaultValue: defaultValue, value: value };
		return this.client.sendRequest(contracts.UpdateSqlCmdVariableRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.UpdateSqlCmdVariableRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public addSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.AddSqlObjectScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.AddSqlObjectScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public deleteSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.DeleteSqlObjectScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.DeleteSqlObjectScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public excludeSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return this.client.sendRequest(contracts.ExcludeSqlObjectScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.ExcludeSqlObjectScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public moveSqlObjectScript(projectUri: string, destinationPath: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.MoveItemParams = { projectUri: projectUri, destinationPath: destinationPath, path: path };
		return this.client.sendRequest(contracts.MoveSqlObjectScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.MoveSqlObjectScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
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
			this.client.logFailedRequest(contracts.GetCrossPlatformCompatiblityRequest.type, e);
			throw e;
		}
	}
}
