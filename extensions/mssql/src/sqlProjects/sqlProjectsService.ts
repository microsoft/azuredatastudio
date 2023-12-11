/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import * as constants from '../constants';
import * as Utils from '../utils';
import * as azdata from 'azdata';
import * as contracts from '../contracts';

import { AppContext } from '../appContext';
import { BaseService, ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';

export class SqlProjectsService extends BaseService implements mssql.ISqlProjectsService {
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

	private constructor(context: AppContext, client: SqlOpsDataClient) {
		super(client);
		context.registerService(constants.SqlProjectsService, this);
	}

	/**
	 * Add a dacpac reference to a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param dacpacPath Path to the .dacpac file
	 * @param suppressMissingDependencies Whether to suppress missing dependencies
	 * @param databaseVariable SQLCMD variable name for specifying the other database this reference is to, if different from that of the current project
	 * @param serverVariable SQLCMD variable name for specifying the other server this reference is to, if different from that of the current project.
	 * If this is set, DatabaseVariable must also be set.
	 * @param databaseLiteral Literal name used to reference another database in the same server, if not using SQLCMD variables
	 */
	public async addDacpacReference(projectUri: string, dacpacPath: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddDacpacReferenceParams = { projectUri: projectUri, dacpacPath: dacpacPath, suppressMissingDependencies: suppressMissingDependencies, databaseVariable: databaseVariable, serverVariable: serverVariable, databaseLiteral: databaseLiteral };
		return await this.runWithErrorHandling(contracts.AddDacpacReferenceRequest.type, params);
	}

	/**
	 * Add a SQL Project reference to a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param projectPath Path to the referenced .sqlproj file
	 * @param projectGuid GUID for the referenced SQL project
	 * @param suppressMissingDependencies Whether to suppress missing dependencies
	 * @param databaseVariable SQLCMD variable name for specifying the other database this reference is to, if different from that of the current project
	 * @param serverVariable SQLCMD variable name for specifying the other server this reference is to, if different from that of the current project.
	 * If this is set, DatabaseVariable must also be set.
	 * @param databaseLiteral Literal name used to reference another database in the same server, if not using SQLCMD variables
	 */
	public async addSqlProjectReference(projectUri: string, projectPath: string, projectGuid: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSqlProjectReferenceParams = { projectUri: projectUri, projectPath: projectPath, projectGuid: projectGuid, suppressMissingDependencies: suppressMissingDependencies, databaseVariable: databaseVariable, serverVariable: serverVariable, databaseLiteral: databaseLiteral };
		return await this.runWithErrorHandling(contracts.AddSqlProjectReferenceRequest.type, params);
	}

	/**
	 * Add a system database reference to a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param systemDatabase Type of system database
	 * @param suppressMissingDependencies Whether to suppress missing dependencies
	 * @param SystemDbReferenceType Type of reference - ArtifactReference or PackageReference
	 * @param databaseLiteral Literal name used to reference another database in the same server, if not using SQLCMD variables
	 */
	public async addSystemDatabaseReference(projectUri: string, systemDatabase: mssql.SystemDatabase, suppressMissingDependencies: boolean, SystemDbReferenceType: mssql.SystemDbReferenceType, databaseLiteral?: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSystemDatabaseReferenceParams = { projectUri: projectUri, systemDatabase: systemDatabase, suppressMissingDependencies: suppressMissingDependencies, referenceType: SystemDbReferenceType, databaseLiteral: databaseLiteral };
		return await this.runWithErrorHandling(contracts.AddSystemDatabaseReferenceRequest.type, params);
	}

	/**
	 * Add a nuget package database reference to a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param packageName Name of the referenced nuget package
	 * @param packageVersion Version of the referenced nuget package
	 * @param suppressMissingDependencies Whether to suppress missing dependencies
	 * @param databaseVariable SQLCMD variable name for specifying the other database this reference is to, if different from that of the current project
	 * @param serverVariable SQLCMD variable name for specifying the other server this reference is to, if different from that of the current project. If this is set, DatabaseVariable must also be set.
	 * @param databaseLiteral Literal name used to reference another database in the same server, if not using SQLCMD variables
	 */
	public async addNugetPackageReference(projectUri: string, packageName: string, packageVersion: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddNugetPackageReferenceParams = { projectUri: projectUri, packageName: packageName, packageVersion: packageVersion, suppressMissingDependencies: suppressMissingDependencies, databaseVariable: databaseVariable, serverVariable: serverVariable, databaseLiteral: databaseLiteral };
		return await this.runWithErrorHandling(contracts.AddNugetPackageReferenceRequest.type, params);
	}

	/**
	 * Delete a database reference from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param name Name of the reference to be deleted. Name of the System DB, path of the sqlproj, or path of the dacpac
	 */
	public async deleteDatabaseReference(projectUri: string, name: string): Promise<azdata.ResultStatus> {
		const params: contracts.DeleteDatabaseReferenceParams = { projectUri: projectUri, name: name };
		return await this.runWithErrorHandling(contracts.DeleteDatabaseReferenceRequest.type, params);
	}

	/**
	 * Add a folder to a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the folder, typically relative to the .sqlproj file
	 */
	public async addFolder(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.FolderParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.AddFolderRequest.type, params);
	}

	/**
	 * Delete a folder from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the folder, typically relative to the .sqlproj file
	 */
	public async deleteFolder(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.FolderParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.DeleteFolderRequest.type, params);
	}

	/**
	 * Add a post-deployment script to a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 */
	public async addPostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.AddPostDeploymentScriptRequest.type, params);
	}

	/**
	 * Add a pre-deployment script to a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 */
	public async addPreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.AddPreDeploymentScriptRequest.type, params);
	}

	/**
	 * Delete a post-deployment script from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 */
	public async deletePostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.DeletePostDeploymentScriptRequest.type, params);
	}

	/**
	 * Delete a pre-deployment script from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 */
	public async deletePreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.DeletePreDeploymentScriptRequest.type, params);
	}

	/**
	 * Exclude a post-deployment script from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 */
	public async excludePostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.ExcludePostDeploymentScriptRequest.type, params);
	}

	/**
	 * Exclude a pre-deployment script from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 */
	public async excludePreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.ExcludePreDeploymentScriptRequest.type, params);
	}

	/**
	 * Move a post-deployment script in a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
	 */
	public async movePostDeploymentScript(projectUri: string, path: string, destinationPath: string): Promise<azdata.ResultStatus> {
		const params: contracts.MoveItemParams = { projectUri: projectUri, destinationPath: destinationPath, path: path };
		return await this.runWithErrorHandling(contracts.MovePostDeploymentScriptRequest.type, params);
	}

	/**
	 * Move a pre-deployment script in a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
	 */
	public async movePreDeploymentScript(projectUri: string, path: string, destinationPath: string): Promise<azdata.ResultStatus> {
		const params: contracts.MoveItemParams = { projectUri: projectUri, destinationPath: destinationPath, path: path };
		return await this.runWithErrorHandling(contracts.MovePreDeploymentScriptRequest.type, params);
	}

	/**
	 * Close a SQL project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async closeProject(projectUri: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.CloseSqlProjectRequest.type, params);
	}

	/**
	 * Create a new SQL project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param sqlProjectType Type of SQL Project: SDK-style or Legacy
	 * @param databaseSchemaProvider Database schema provider for the project, in the format
	 * "Microsoft.Data.Tools.Schema.Sql.SqlXYZDatabaseSchemaProvider".
	 * Case sensitive.
	 * @param buildSdkVersion Version of the Microsoft.Build.Sql SDK for the project, if overriding the default
	 */
	public async createProject(projectUri: string, sqlProjectType: mssql.ProjectType, databaseSchemaProvider?: string, buildSdkVersion?: string): Promise<azdata.ResultStatus> {
		const params: contracts.CreateSqlProjectParams = { projectUri: projectUri, sqlProjectType: sqlProjectType, databaseSchemaProvider: databaseSchemaProvider, buildSdkVersion: buildSdkVersion };
		return await this.runWithErrorHandling(contracts.CreateSqlProjectRequest.type, params);
	}

	/**
	 * Get the cross-platform compatibility status for a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async getCrossPlatformCompatibility(projectUri: string): Promise<mssql.GetCrossPlatformCompatibilityResult> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.GetCrossPlatformCompatibilityRequest.type, params);
	}

	/**
	 * Open an existing SQL project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async openProject(projectUri: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.OpenSqlProjectRequest.type, params);
	}

	/**
	 * Update a SQL project to be cross-platform compatible
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async updateProjectForCrossPlatform(projectUri: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.UpdateProjectForCrossPlatformRequest.type, params);
	}

	/**
	 * Get the cross-platform compatibility status for a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async getProjectProperties(projectUri: string): Promise<mssql.GetProjectPropertiesResult> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.GetProjectPropertiesRequest.type, params);
	}

	/**
	 * Set the DatabaseSource property of a .sqlproj file
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param databaseSource Source of the database schema, used in telemetry
	 */
	public async setDatabaseSource(projectUri: string, databaseSource: string): Promise<azdata.ResultStatus> {
		const params: contracts.SetDatabaseSourceParams = { projectUri: projectUri, databaseSource: databaseSource };
		return await this.runWithErrorHandling(contracts.SetDatabaseSourceRequest.type, params);
	}

	/**
	 * Set the DatabaseSchemaProvider property of a SQL project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param databaseSchemaProvider New DatabaseSchemaProvider value, in the form "Microsoft.Data.Tools.Schema.Sql.SqlXYZDatabaseSchemaProvider"
	 */
	public async setDatabaseSchemaProvider(projectUri: string, databaseSchemaProvider: string): Promise<azdata.ResultStatus> {
		const params: contracts.SetDatabaseSchemaProviderParams = { projectUri: projectUri, databaseSchemaProvider: databaseSchemaProvider };
		return await this.runWithErrorHandling(contracts.SetDatabaseSchemaProviderRequest.type, params);
	}

	/**
	 * Add a SQLCMD variable to a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param name Name of the SQLCMD variable
	 * @param defaultValue Default value of the SQLCMD variable
	 */
	public async addSqlCmdVariable(projectUri: string, name: string, defaultValue: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSqlCmdVariableParams = { projectUri: projectUri, name: name, defaultValue: defaultValue };
		return await this.runWithErrorHandling(contracts.AddSqlCmdVariableRequest.type, params);
	}

	/**
	 * Delete a SQLCMD variable from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param name Name of the SQLCMD variable to be deleted
	 */
	public async deleteSqlCmdVariable(projectUri: string, name?: string): Promise<azdata.ResultStatus> {
		const params: contracts.DeleteSqlCmdVariableParams = { projectUri: projectUri, name: name };
		return await this.runWithErrorHandling(contracts.DeleteSqlCmdVariableRequest.type, params);
	}

	/**
	 * Update an existing SQLCMD variable in a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param name Name of the SQLCMD variable
	 * @param defaultValue Default value of the SQLCMD variable
	 */
	public async updateSqlCmdVariable(projectUri: string, name: string, defaultValue: string): Promise<azdata.ResultStatus> {
		const params: contracts.AddSqlCmdVariableParams = { projectUri: projectUri, name: name, defaultValue: defaultValue };
		return await this.runWithErrorHandling(contracts.UpdateSqlCmdVariableRequest.type, params);
	}

	/**
	 * Add a SQL object script to a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 */
	public async addSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.AddSqlObjectScriptRequest.type, params);
	}

	/**
	 * Delete a SQL object script from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 */
	public async deleteSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.DeleteSqlObjectScriptRequest.type, params);
	}

	/**
	 * Exclude a SQL object script from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 */
	public async excludeSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.ExcludeSqlObjectScriptRequest.type, params);
	}

	/**
	 * Move a SQL object script in a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
	 */
	public async moveSqlObjectScript(projectUri: string, path: string, destinationPath: string): Promise<azdata.ResultStatus> {
		const params: contracts.MoveItemParams = { projectUri: projectUri, destinationPath: destinationPath, path: path };
		return await this.runWithErrorHandling(contracts.MoveSqlObjectScriptRequest.type, params);
	}

	/**
	 * getDatabaseReferences
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async getDatabaseReferences(projectUri: string): Promise<mssql.GetDatabaseReferencesResult> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.GetDatabaseReferencesRequest.type, params);
	}

	/**
	 * getFolders
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async getFolders(projectUri: string): Promise<mssql.GetFoldersResult> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.GetFoldersRequest.type, params);
	}

	/**
	 * getPostDeploymentScripts
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async getPostDeploymentScripts(projectUri: string): Promise<mssql.GetScriptsResult> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.GetPostDeploymentScriptsRequest.type, params);
	}

	/**
	 * getPreDeploymentScripts
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async getPreDeploymentScripts(projectUri: string): Promise<mssql.GetScriptsResult> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.GetPreDeploymentScriptsRequest.type, params);
	}

	/**
	 * getSqlCmdVariables
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async getSqlCmdVariables(projectUri: string): Promise<mssql.GetSqlCmdVariablesResult> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.GetSqlCmdVariablesRequest.type, params);
	}

	/**
	 * getSqlObjectScripts
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async getSqlObjectScripts(projectUri: string): Promise<mssql.GetScriptsResult> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.GetSqlObjectScriptsRequest.type, params);
	}

	/**
	 * Add a SQL object script to a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the file, including extension, relative to the .sqlproj
	 */
	public async addNoneItem(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.AddNoneItemRequest.type, params);
	}

	/**
	 * Delete a SQL object script from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the file, including extension, relative to the .sqlproj
	 */
	public async deleteNoneItem(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.DeleteNoneItemRequest.type, params);
	}

	/**
	 * Exclude a SQL object script from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the file, including extension, relative to the .sqlproj
	 */
	public async excludeNoneItem(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.SqlProjectScriptParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.ExcludeNoneItemRequest.type, params);
	}

	/**
	 * getNoneScripts
	 * @param projectUri Absolute path of the project, including .sqlproj
	 */
	public async getNoneItems(projectUri: string): Promise<mssql.GetScriptsResult> {
		const params: contracts.SqlProjectParams = { projectUri: projectUri };
		return await this.runWithErrorHandling(contracts.GetNoneItemsRequest.type, params);
	}

	/**
	 * Move a SQL object script in a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the script, including .sql, relative to the .sqlproj
	 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
	 */
	public async moveNoneItem(projectUri: string, path: string, destinationPath: string): Promise<azdata.ResultStatus> {
		const params: contracts.MoveItemParams = { projectUri: projectUri, destinationPath: destinationPath, path: path };
		return await this.runWithErrorHandling(contracts.MoveNoneItemRequest.type, params);
	}

	/**
	 * Exclude a folder and its contents from a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param path Path of the folder, typically relative to the .sqlproj file
	 */
	public async excludeFolder(projectUri: string, path: string): Promise<azdata.ResultStatus> {
		const params: contracts.FolderParams = { projectUri: projectUri, path: path };
		return await this.runWithErrorHandling(contracts.ExcludeFolderRequest.type, params);
	}

	/**
	 * Move a folder and its contents within a project
	 * @param projectUri Absolute path of the project, including .sqlproj
	 * @param sourcePath Source path of the folder, typically relative to the .sqlproj file
	 * @param destinationPath Destination path of the folder, typically relative to the .sqlproj file
	 */
	public async moveFolder(projectUri: string, sourcePath: string, destinationPath: string): Promise<azdata.ResultStatus> {
		const params: contracts.MoveFolderParams = { projectUri: projectUri, path: sourcePath, destinationPath: destinationPath };
		return await this.runWithErrorHandling(contracts.MoveFolderRequest.type, params);
	}
}
