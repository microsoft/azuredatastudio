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

	public async addDacpacReference(projectUri: string, dacpacPath: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddDacpacReferenceParams = { projectUri: projectUri, dacpacPath: dacpacPath, databaseVariable: databaseVariable, serverVariable: serverVariable, suppressMissingDependencies: suppressMissingDependencies, databaseLiteral: databaseLiteral };
		try {
			const result = await this.client.sendRequest(contracts.AddDacpacReferenceRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.AddDacpacReferenceRequest.type, e);
			throw e;
		}
	}

	public async addSqlProjectReference(projectUri: string, projectPath: string, projectGuid: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSqlProjectReferenceParams = { projectUri: projectUri, projectPath: projectPath, projectGuid: projectGuid, databaseVariable: databaseVariable, serverVariable: serverVariable, suppressMissingDependencies: suppressMissingDependencies, databaseLiteral: databaseLiteral };
		try {
			const result = await this.client.sendRequest(contracts.AddSqlProjectReferenceRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.AddSqlProjectReferenceRequest.type, e);
			throw e;
		}
	}

	public async addSystemDatabaseReference(projectUri: string, systemDatabase: mssql.SystemDatabase, suppressMissingDependencies: boolean, databaseLiteral?: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSystemDatabaseReferenceParams = { projectUri: projectUri, systemDatabase: systemDatabase, suppressMissingDependencies: suppressMissingDependencies, databaseLiteral: databaseLiteral };
		try {
			const result = await this.client.sendRequest(contracts.AddSystemDatabaseReferenceRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.AddSystemDatabaseReferenceRequest.type, e);
			throw e;
		}
	}

	public async deleteDatabaseReference(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.DeleteDatabaseReferenceRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.DeleteDatabaseReferenceRequest.type, e);
			throw e;
		}
	}

	public async addFolder(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.FolderParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.AddFolderRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.AddFolderRequest.type, e);
			throw e;
		}
	}

	public async deleteFolder(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.FolderParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.DeleteFolderRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.DeleteFolderRequest.type, e);
			throw e;
		}
	}

	public async addPostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.AddPostDeploymentScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.AddPostDeploymentScriptRequest.type, e);
			throw e;
		}
	}

	public async addPreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.AddPreDeploymentScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.AddPreDeploymentScriptRequest.type, e);
			throw e;
		}
	}

	public async deletePostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.DeletePostDeploymentScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.DeletePostDeploymentScriptRequest.type, e);
			throw e;
		}
	}

	public async deletePreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.DeletePreDeploymentScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.DeletePreDeploymentScriptRequest.type, e);
			throw e;
		}
	}

	public async excludePostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.ExcludePostDeploymentScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.ExcludePostDeploymentScriptRequest.type, e);
			throw e;
		}
	}

	public async excludePreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.ExcludePreDeploymentScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.ExcludePreDeploymentScriptRequest.type, e);
			throw e;
		}
	}

	public async movePostDeploymentScript(projectUri: string, destinationPath: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.MoveItemParams = { projectUri: projectUri, destinationPath: destinationPath, path: path };
		try {
			const result = await this.client.sendRequest(contracts.MovePostDeploymentScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.MovePostDeploymentScriptRequest.type, e);
			throw e;
		}
	}

	public async movePreDeploymentScript(projectUri: string, destinationPath: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.MoveItemParams = { projectUri: projectUri, destinationPath: destinationPath, path: path };
		try {
			const result = await this.client.sendRequest(contracts.MovePreDeploymentScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.MovePreDeploymentScriptRequest.type, e);
			throw e;
		}
	}

	public async closeProject(projectUri: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		try {
			const result = await this.client.sendRequest(contracts.CloseSqlProjectRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.CloseSqlProjectRequest.type, e);
			throw e;
		}
	}

	public async getCrossPlatformCompatibility(projectUri: string): Promise<mssql.GetCrossPlatformCompatiblityResult> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		try {
			const result = await this.client.sendRequest(contracts.GetCrossPlatformCompatiblityRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.GetCrossPlatformCompatiblityRequest.type, e);
			throw e;
		}
	}

	public async newProject(projectUri: string, sqlProjectType: mssql.ProjectType, databaseSchemaProvider?: string, buildSdkVersion?: string): Promise<azdata.ResultStatus> {
		const params: contracts.NewSqlProjectParams = { projectUri: projectUri, sqlProjectType: sqlProjectType, databaseSchemaProvider: databaseSchemaProvider, buildSdkVersion: buildSdkVersion };
		try {
			const result = await this.client.sendRequest(contracts.NewSqlProjectRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.NewSqlProjectRequest.type, e);
			throw e;
		}
	}

	public async openProject(projectUri: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		try {
			const result = await this.client.sendRequest(contracts.OpenSqlProjectRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.OpenSqlProjectRequest.type, e);
			throw e;
		}
	}

	public async updateProjectForCrossPlatform(projectUri: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		try {
			const result = await this.client.sendRequest(contracts.UpdateProjectForCrossPlatformRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.UpdateProjectForCrossPlatformRequest.type, e);
			throw e;
		}
	}

	public async addSqlCmdVariable(projectUri: string, name: string, defaultValue: string, value: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSqlCmdVariableParams = { projectUri: projectUri, name: name, defaultValue: defaultValue, value: value };
		try {
			const result = await this.client.sendRequest(contracts.AddSqlCmdVariableRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.AddSqlCmdVariableRequest.type, e);
			throw e;
		}
	}

	public async deleteSqlCmdVariable(projectUri: string, name?: string): Promise<azdata.ResultStatus> {
		const params: contracts.DeleteSqlCmdVariableParams = { projectUri: projectUri, name: name };
		try {
			const result = await this.client.sendRequest(contracts.DeleteSqlCmdVariableRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.DeleteSqlCmdVariableRequest.type, e);
			throw e;
		}
	}

	public async updateSqlCmdVariable(projectUri: string, name: string, defaultValue: string, value: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSqlCmdVariableParams = { projectUri: projectUri, name: name, defaultValue: defaultValue, value: value };
		try {
			const result = await this.client.sendRequest(contracts.UpdateSqlCmdVariableRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.UpdateSqlCmdVariableRequest.type, e);
			throw e;
		}
	}

	public async addSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.AddSqlObjectScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.AddSqlObjectScriptRequest.type, e);
			throw e;
		}
	}

	public async deleteSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.DeleteSqlObjectScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.DeleteSqlObjectScriptRequest.type, e);
			throw e;
		}
	}

	public async excludeSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		try {
			const result = await this.client.sendRequest(contracts.ExcludeSqlObjectScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.ExcludeSqlObjectScriptRequest.type, e);
			throw e;
		}
	}

	public async moveSqlObjectScript(projectUri: string, destinationPath: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.MoveItemParams = { projectUri: projectUri, destinationPath: destinationPath, path: path };
		try {
			const result = await this.client.sendRequest(contracts.MoveSqlObjectScriptRequest.type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(contracts.MoveSqlObjectScriptRequest.type, e);
			throw e;
		}
	}
}
