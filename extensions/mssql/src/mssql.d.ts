/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'mssql' {
	import * as azdata from 'azdata';

	/**
	 * Covers defining what the mssql extension exports to other extensions.
	 *
	 * This file should only contain definitions which rely on STABLE azdata typings
	 * (from azdata.d.ts). Anything which relies on PROPOSED typings (from azdata.proposed.d.ts)
	 * should go in mssql.proposed.d.ts.
	 *
	 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
	 * (const enums get evaluated when typescript -> javascript so those are fine)
	 */


	export const enum extension {
		name = 'Microsoft.mssql'
	}

	/**
	* The APIs provided by Mssql extension
	*/
	export interface IExtension {
		/**
		 * Path to the root of the SQL Tools Service folder
		 */
		readonly sqlToolsServicePath: string;

		/**
		 * Get the Cms Service APIs to communicate with CMS connections supported by this extension
		 *
		 */
		readonly cmsService: ICmsService;

		readonly schemaCompare: ISchemaCompareService;

		readonly languageExtension: ILanguageExtensionService;

		readonly dacFx: IDacFxService;

		readonly sqlProjects: ISqlProjectsService;

		readonly azureBlob: IAzureBlobService;
	}

	/**
	 * A tree node in the object explorer tree
	 */
	export interface ITreeNode {
		getNodeInfo(): azdata.NodeInfo;
		getChildren(refreshChildren: boolean): ITreeNode[] | Thenable<ITreeNode[]>;
	}

	//#region --- Schema Compare
	export interface SchemaCompareResult extends azdata.ResultStatus {
		operationId: string;
		areEqual: boolean;
		differences: DiffEntry[];
	}

	export interface SchemaCompareIncludeExcludeResult extends azdata.ResultStatus {
		affectedDependencies: DiffEntry[];
		blockingDependencies: DiffEntry[];
	}

	export interface SchemaCompareCompletionResult extends azdata.ResultStatus {
		operationId: string;
		areEqual: boolean;
		differences: DiffEntry[];
	}

	export interface DiffEntry {
		updateAction: SchemaUpdateAction;
		differenceType: SchemaDifferenceType;
		name: string;
		sourceValue: string[];
		targetValue: string[];
		parent: DiffEntry;
		children: DiffEntry[];
		sourceScript: string;
		targetScript: string;
		included: boolean;
	}

	export const enum SchemaUpdateAction {
		Delete = 0,
		Change = 1,
		Add = 2
	}

	export const enum SchemaDifferenceType {
		Object = 0,
		Property = 1
	}

	export const enum SchemaCompareEndpointType {
		Database = 0,
		Dacpac = 1,
		Project = 2,
		// must be kept in-sync with SchemaCompareEndpointType in SQL Tools Service
		// located at \src\Microsoft.SqlTools.ServiceLayer\SchemaCompare\Contracts\SchemaCompareRequest.cs
	}

	export interface SchemaCompareEndpointInfo {
		endpointType: SchemaCompareEndpointType;
		packageFilePath: string;
		serverDisplayName: string;
		serverName: string;
		databaseName: string;
		ownerUri: string;
		connectionDetails: azdata.ConnectionInfo;
		connectionName?: string;
		projectFilePath: string;
		targetScripts: string[];
		extractTarget: ExtractTarget;
		dataSchemaProvider: string;
	}

	export interface SchemaCompareObjectId {
		nameParts: string[];
		sqlObjectType: string;
	}

	export interface SchemaCompareOptionsResult extends azdata.ResultStatus {
		defaultDeploymentOptions: DeploymentOptions;
	}

	/**
	* Interface containing deployment options of boolean type
	*/
	export interface DacDeployOptionPropertyBoolean {
		value: boolean;
		description: string;
		displayName: string;
	}

	/**
	* Interface containing deployment options of string[] type, value property holds enum names (nothing but option name) from <DacFx>\Product\Source\DeploymentApi\ObjectTypes.cs enum
	*/
	export interface DacDeployOptionPropertyObject {
		value: string[];
		description: string;
		displayName: string;
	}

	/*
	* Interface containing Deployment options from <DacFx>\Source\DeploymentApi\DacDeployOptions.cs
	* These property names should match with the properties defined in <sqltoolsservice>\src\Microsoft.SqlTools.ServiceLayer\DacFx\Contracts\DeploymentOptions.cs
	*/
	export interface DeploymentOptions {
		excludeObjectTypes: DacDeployOptionPropertyObject;
		// key will be the boolean option name
		booleanOptionsDictionary: { [key: string]: DacDeployOptionPropertyBoolean };
		// key will be the object type enum name (nothing but option name)
		objectTypesDictionary: { [key: string]: string };
	}

	/*
	* Interface containing option value and option name
	*/
	export interface IOptionWithValue {
		optionName: string;
		checked: boolean;
	}

	export interface SchemaCompareObjectId {
		nameParts: string[];
		sqlObjectType: string;
	}

	export interface ISchemaCompareService {
		schemaCompare(operationId: string, sourceEndpointInfo: SchemaCompareEndpointInfo, targetEndpointInfo: SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: DeploymentOptions): Thenable<SchemaCompareResult>;
		schemaCompareGenerateScript(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus>;
		schemaComparePublishDatabaseChanges(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus>;
		schemaComparePublishProjectChanges(operationId: string, targetProjectPath: string, targetFolderStructure: ExtractTarget, taskExecutionMode: azdata.TaskExecutionMode): Thenable<SchemaComparePublishProjectResult>;
		schemaCompareGetDefaultOptions(): Thenable<SchemaCompareOptionsResult>;
		schemaCompareIncludeExcludeNode(operationId: string, diffEntry: DiffEntry, IncludeRequest: boolean, taskExecutionMode: azdata.TaskExecutionMode): Thenable<SchemaCompareIncludeExcludeResult>;
		schemaCompareOpenScmp(filePath: string): Thenable<SchemaCompareOpenScmpResult>;
		schemaCompareSaveScmp(sourceEndpointInfo: SchemaCompareEndpointInfo, targetEndpointInfo: SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: DeploymentOptions, scmpFilePath: string, excludedSourceObjects: SchemaCompareObjectId[], excludedTargetObjects: SchemaCompareObjectId[]): Thenable<azdata.ResultStatus>;
		schemaCompareCancel(operationId: string): Thenable<azdata.ResultStatus>;
	}

	export interface SchemaCompareOpenScmpResult extends azdata.ResultStatus {
		sourceEndpointInfo: SchemaCompareEndpointInfo;
		targetEndpointInfo: SchemaCompareEndpointInfo;
		originalTargetName: string;
		originalConnectionString: string;
		deploymentOptions: DeploymentOptions;
		excludedSourceElements: SchemaCompareObjectId[];
		excludedTargetElements: SchemaCompareObjectId[];
	}

	export interface SchemaComparePublishProjectResult extends azdata.ResultStatus {
		changedFiles: string[];
		addedFiles: string[];
		deletedFiles: string[];
	}

	//#endregion

	//#region --- DacFx
	export const enum ExtractTarget {
		dacpac = 0,
		file = 1,
		flat = 2,
		objectType = 3,
		schema = 4,
		schemaObjectType = 5
	}

	export interface IDacFxService {
		exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<DacFxResult>;
		importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<DacFxResult>;
		extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<DacFxResult>;
		createProjectFromDatabase(databaseName: string, targetFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, extractTarget: ExtractTarget, taskExecutionMode: azdata.TaskExecutionMode, includePermissions?: boolean): Thenable<DacFxResult>;
		deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Map<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
		generateDeployScript(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Map<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
		generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<GenerateDeployPlanResult>;
		getOptionsFromProfile(profilePath: string): Thenable<DacFxOptionsResult>;
		validateStreamingJob(packageFilePath: string, createStreamingJobTsql: string): Thenable<ValidateStreamingJobResult>;
		parseTSqlScript(filePath: string, databaseSchemaProvider: string): Thenable<ParseTSqlScriptResult>;
		savePublishProfile(profilePath: string, databaseName: string, connectionString: string, sqlCommandVariableValues?: Map<string, string>, deploymentOptions?: DeploymentOptions): Thenable<azdata.ResultStatus>;
	}

	export interface DacFxResult extends azdata.ResultStatus {
		operationId: string;
	}

	export interface GenerateDeployPlanResult extends DacFxResult {
		report: string;
	}

	export interface DacFxOptionsResult extends azdata.ResultStatus {
		deploymentOptions: DeploymentOptions;
	}

	export interface ValidateStreamingJobResult extends azdata.ResultStatus {
	}

	export interface ParseTSqlScriptResult {
		containsCreateTableStatement: boolean;
	}

	export interface ExportParams {
		databaseName: string;
		packageFilePath: string;
		ownerUri: string;
		taskExecutionMode: azdata.TaskExecutionMode;
	}

	export interface ImportParams {
		packageFilePath: string;
		databaseName: string;
		ownerUri: string;
		taskExecutionMode: azdata.TaskExecutionMode;
	}

	export interface ExtractParams {
		databaseName: string;
		packageFilePath: string;
		applicationName: string;
		applicationVersion: string;
		ownerUri: string;
		extractTarget?: ExtractTarget;
		taskExecutionMode: azdata.TaskExecutionMode;
	}

	export interface DeployParams {
		packageFilePath: string;
		databaseName: string;
		upgradeExisting: boolean;
		ownerUri: string;
		taskExecutionMode: azdata.TaskExecutionMode;
	}

	export interface GenerateDeployScriptParams {
		packageFilePath: string;
		databaseName: string;
		ownerUri: string;
		taskExecutionMode: azdata.TaskExecutionMode;
	}

	export interface GenerateDeployPlan {
		packageFilePath: string;
		databaseName: string;
		ownerUri: string;
		taskExecutionMode: azdata.TaskExecutionMode;
	}

	//#endregion

	//#region --- SQL Projects

	/**
	 * Interface for working with .sqlproj files
	 */
	export interface ISqlProjectsService {
		/**
		 * Add a dacpac reference to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param dacpacPath Path to the .dacpac file
		 * @param suppressMissingDependencies Whether to suppress missing dependencies
		 * @param databaseVariable SQLCMD variable name for specifying the other database this reference is to, if different from that of the current project
		 * @param serverVariable SQLCMD variable name for specifying the other server this reference is to, if different from that of the current project.
			 If this is set, DatabaseVariable must also be set.
		 * @param databaseLiteral Literal name used to reference another database in the same server, if not using SQLCMD variables
		 */
		addDacpacReference(projectUri: string, dacpacPath: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<azdata.ResultStatus>;

		/**
		 * Add a SQL Project reference to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param projectPath Path to the referenced .sqlproj file
		 * @param projectGuid GUID for the referenced SQL project
		 * @param suppressMissingDependencies Whether to suppress missing dependencies
		 * @param databaseVariable SQLCMD variable name for specifying the other database this reference is to, if different from that of the current project
		 * @param serverVariable SQLCMD variable name for specifying the other server this reference is to, if different from that of the current project.
			 If this is set, DatabaseVariable must also be set.
		 * @param databaseLiteral Literal name used to reference another database in the same server, if not using SQLCMD variables
		 */
		addSqlProjectReference(projectUri: string, projectPath: string, projectGuid: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<azdata.ResultStatus>;

		/**
		 * Add a system database reference to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param systemDatabase Type of system database
		 * @param suppressMissingDependencies Whether to suppress missing dependencies
		 * @param referenceType Type of reference - ArtifactReference or PackageReference
		 * @param databaseLiteral Literal name used to reference another database in the same server, if not using SQLCMD variables
		 */
		addSystemDatabaseReference(projectUri: string, systemDatabase: SystemDatabase, suppressMissingDependencies: boolean, referenceType: SystemDbReferenceType, databaseLiteral?: string): Promise<azdata.ResultStatus>;

		/**
		 * Add a nuget package database reference to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param packageName Name of the referenced nuget package
		 * @param packageVersion Version of the referenced nuget package
		 * @param suppressMissingDependencies Whether to suppress missing dependencies
		 * @param databaseVariable SQLCMD variable name for specifying the other database this reference is to, if different from that of the current project
		 * @param serverVariable SQLCMD variable name for specifying the other server this reference is to, if different from that of the current project.
			 If this is set, DatabaseVariable must also be set.
		 * @param databaseLiteral Literal name used to reference another database in the same server, if not using SQLCMD variables
		 */
		addNugetPackageReference(projectUri: string, packageName: string, packageVersion: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<azdata.ResultStatus>;

		/**
		 * Delete a database reference from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param name Name of the reference to be deleted. Name of the System DB, path of the sqlproj, or path of the dacpac
		 */
		deleteDatabaseReference(projectUri: string, name: string): Promise<azdata.ResultStatus>;

		/**
		 * Add a folder to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the folder, typically relative to the .sqlproj file
		 */
		addFolder(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Delete a folder from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the folder, typically relative to the .sqlproj file
		 */
		deleteFolder(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Exclude a folder and its contents from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the folder, typically relative to the .sqlproj file
		 */
		excludeFolder(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Move a folder and its contents within a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param sourcePath Source path of the folder, typically relative to the .sqlproj file
		 * @param destinationPath Destination path of the folder, typically relative to the .sqlproj file
		 */
		moveFolder(projectUri: string, sourcePath: string, destinationPath: string): Promise<azdata.ResultStatus>;

		/**
		 * Add a post-deployment script to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		addPostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Add a pre-deployment script to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		addPreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Delete a post-deployment script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		deletePostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Delete a pre-deployment script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		deletePreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Exclude a post-deployment script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		excludePostDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Exclude a pre-deployment script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		excludePreDeploymentScript(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Move a post-deployment script in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
		 */
		movePostDeploymentScript(projectUri: string, path: string, destinationPath: string): Promise<azdata.ResultStatus>;

		/**
		 * Move a pre-deployment script in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
		 */
		movePreDeploymentScript(projectUri: string, path: string, destinationPath: string): Promise<azdata.ResultStatus>;

		/**
		 * Close a SQL project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		closeProject(projectUri: string): Promise<azdata.ResultStatus>;

		/**
		 * Create a new SQL project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param sqlProjectType Type of SQL Project: SDK-style or Legacy
		 * @param databaseSchemaProvider Database schema provider for the project, in the format
			 "Microsoft.Data.Tools.Schema.Sql.SqlXYZDatabaseSchemaProvider".
			 Case sensitive.
		 * @param buildSdkVersion Version of the Microsoft.Build.Sql SDK for the project, if overriding the default
		 */
		createProject(projectUri: string, sqlProjectType: ProjectType, databaseSchemaProvider?: string, buildSdkVersion?: string): Promise<azdata.ResultStatus>;

		/**
		 * Get the cross-platform compatibility status for a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		getCrossPlatformCompatibility(projectUri: string): Promise<GetCrossPlatformCompatibilityResult>;

		/**
		 * Open an existing SQL project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		openProject(projectUri: string): Promise<azdata.ResultStatus>;

		/**
		 * Update a SQL project to be cross-platform compatible
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		updateProjectForCrossPlatform(projectUri: string): Promise<azdata.ResultStatus>;

		/**
		 * Set the DatabaseSource property of a .sqlproj file
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param databaseSource Source of the database schema, used in telemetry
		 */
		setDatabaseSource(projectUri: string, databaseSource: string): Promise<azdata.ResultStatus>;

		/**
		 * Set the DatabaseSchemaProvider property of a SQL project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param databaseSchemaProvider New DatabaseSchemaProvider value, in the form "Microsoft.Data.Tools.Schema.Sql.SqlXYZDatabaseSchemaProvider"
		 */
		setDatabaseSchemaProvider(projectUri: string, databaseSchemaProvider: string): Promise<azdata.ResultStatus>;

		/**
		 * Get the cross-platform compatibility status for a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		getProjectProperties(projectUri: string): Promise<GetProjectPropertiesResult>;

		/**
		 * Add a SQLCMD variable to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param name Name of the SQLCMD variable
		 * @param defaultValue Default value of the SQLCMD variable
		 */
		addSqlCmdVariable(projectUri: string, name: string, defaultValue: string): Promise<azdata.ResultStatus>;

		/**
		 * Delete a SQLCMD variable from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param name Name of the SQLCMD variable to be deleted
		 */
		deleteSqlCmdVariable(projectUri: string, name?: string): Promise<azdata.ResultStatus>;

		/**
		 * Update an existing SQLCMD variable in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param name Name of the SQLCMD variable
		 * @param defaultValue Default value of the SQLCMD variable
		 */
		updateSqlCmdVariable(projectUri: string, name: string, defaultValue: string): Promise<azdata.ResultStatus>;

		/**
		 * Add a SQL object script to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		addSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Delete a SQL object script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		deleteSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Exclude a SQL object script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		excludeSqlObjectScript(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Move a SQL object script in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
		 */
		moveSqlObjectScript(projectUri: string, path: string, destinationPath: string): Promise<azdata.ResultStatus>;

		/**
		 * Get all the database references in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		getDatabaseReferences(projectUri: string): Promise<GetDatabaseReferencesResult>;

		/**
		 * Get all the folders in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		getFolders(projectUri: string): Promise<GetFoldersResult>;

		/**
		 * Get all the post-deployment scripts in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		getPostDeploymentScripts(projectUri: string): Promise<GetScriptsResult>;

		/**
		 * Get all the pre-deployment scripts in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		getPreDeploymentScripts(projectUri: string): Promise<GetScriptsResult>;

		/**
		 * Get all the SQLCMD variables in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		getSqlCmdVariables(projectUri: string): Promise<GetSqlCmdVariablesResult>;

		/**
		 * Get all the SQL object scripts in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		getSqlObjectScripts(projectUri: string): Promise<GetScriptsResult>;

		/**
		 * Add a None item to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the item, including extension, relative to the .sqlproj
		 */
		addNoneItem(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Delete a None item from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the item, including extension, relative to the .sqlproj
		 */
		deleteNoneItem(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Exclude a None item from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the item, including extension, relative to the .sqlproj
		 */
		excludeNoneItem(projectUri: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Get all the None items in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		getNoneItems(projectUri: string): Promise<GetScriptsResult>;

		/**
		 * Move a None item in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the item, including extension, relative to the .sqlproj
		 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
		 */
		moveNoneItem(projectUri: string, path: string, destinationPath: string): Promise<azdata.ResultStatus>;
	}

	//#region Results

	export interface GetDatabaseReferencesResult extends azdata.ResultStatus {
		/**
		 * Array of system database references contained in the project
		 */
		systemDatabaseReferences: SystemDatabaseReference[];
		/**
		 * Array of dacpac references contained in the project
		 */
		dacpacReferences: DacpacReference[];
		/**
		 * Array of SQL project references contained in the project
		 */
		sqlProjectReferences: SqlProjectReference[];
		/**
		 * Array of NuGet package references contained in the project
		 */
		nugetPackageReferences: NugetPackageReference[];
	}

	export interface GetFoldersResult extends azdata.ResultStatus {
		/**
		 * Array of folders contained in the project
		 */
		folders: string[];
	}

	export interface GetCrossPlatformCompatibilityResult extends azdata.ResultStatus {
		/**
		 * Whether the project is cross-platform compatible
		 */
		isCrossPlatformCompatible: boolean;
	}

	export interface GetSqlCmdVariablesResult extends azdata.ResultStatus {
		/**
		 * Array of SQLCMD variables contained in the project
		 */
		sqlCmdVariables: SqlCmdVariable[];
	}

	export interface GetScriptsResult extends azdata.ResultStatus {
		/**
		 * Array of scripts contained in the project
		 */
		scripts: string[];
	}

	export interface GetProjectPropertiesResult extends azdata.ResultStatus {
		/**
		 * GUID for the SQL project
		 */
		projectGuid: string;
		/**
		 * Build configuration, defaulted to Debug if not specified
		 */
		configuration: string;
		/**
		 * Build platform, defaulted to AnyCPU if not specified
		 */
		platform: string;
		/**
		 * Output path for build, defaulted to "bin/Debug" if not specified.
			 May be absolute or relative.
		 */
		outputPath: string;
		/**
		 * Default collation for the project, defaulted to SQL_Latin1_General_CP1_CI_AS if not specified
		 */
		defaultCollation: string;
		/**
		 * Source of the database schema, used in telemetry
		 */
		databaseSource?: string;
		/**
		 * Style of the .sqlproj file - SdkStyle or LegacyStyle
		 */
		projectStyle: ProjectType;
		/**
		 * Database Schema Provider, in the format "Microsoft.Data.Tools.Schema.Sql.SqlXYZDatabaseSchemaProvider"
		 */
		databaseSchemaProvider: string
	}

	//#endregion

	//#region Types

	export const enum ProjectType {
		SdkStyle = 0,
		LegacyStyle = 1
	}

	export interface DatabaseReference {
		suppressMissingDependencies: boolean;
		databaseVariableLiteralName?: string;
	}

	interface UserDatabaseReference extends DatabaseReference {
		databaseVariable?: SqlCmdVariable;
		serverVariable?: SqlCmdVariable;
	}

	export interface SystemDatabaseReference extends DatabaseReference {
		systemDb: SystemDatabase;
	}

	export interface SqlProjectReference extends UserDatabaseReference {
		projectPath: string;
		projectGuid?: string;
	}

	export interface DacpacReference extends UserDatabaseReference {
		dacpacPath: string;
	}

	export interface NugetPackageReference extends UserDatabaseReference {
		packageName: string;
		packageVersion: string;
	}

	export const enum SystemDatabase {
		Master = 0,
		MSDB = 1
	}

	export const enum SystemDbReferenceType {
		ArtifactReference = 0,
		PackageReference = 1
	}

	export interface SqlCmdVariable {
		varName: string;
		value: string;
		defaultValue: string
	}

	//#endregion

	//#endregion

	//#region --- Language Extensibility
	export interface ExternalLanguageContent {
		pathToExtension: string;
		extensionFileName: string;
		platform?: string;
		parameters?: string;
		environmentVariables?: string;
		isLocalFile: boolean;
	}

	export interface ExternalLanguage {
		name: string;
		owner?: string;
		contents: ExternalLanguageContent[];
		createdDate?: string;
	}

	export interface ILanguageExtensionService {
		listLanguages(ownerUri: string): Thenable<ExternalLanguage[]>;
		deleteLanguage(ownerUri: string, languageName: string): Thenable<void>;
		updateLanguage(ownerUri: string, language: ExternalLanguage): Thenable<void>;
	}
	//#endregion

	//#region --- cms
	/**
	 *
	 * Interface containing all CMS related operations
	 */
	export interface ICmsService {
		/**
		 * Connects to or creates a Central management Server
		 */
		createCmsServer(name: string, description: string, connectiondetails: azdata.ConnectionInfo, ownerUri: string): Thenable<ListRegisteredServersResult>;

		/**
		 * gets all Registered Servers inside a CMS on a particular level
		 */
		getRegisteredServers(ownerUri: string, relativePath: string): Thenable<ListRegisteredServersResult>;

		/**
		 * Adds a Registered Server inside a CMS on a particular level
		 */
		addRegisteredServer(ownerUri: string, relativePath: string, registeredServerName: string, registeredServerDescription: string, connectionDetails: azdata.ConnectionInfo): Thenable<boolean>;

		/**
		 * Removes a Registered Server inside a CMS on a particular level
		 */
		removeRegisteredServer(ownerUri: string, relativePath: string, registeredServerName: string): Thenable<boolean>;

		/**
		 * Adds a Server Group inside a CMS on a particular level
		 */
		addServerGroup(ownerUri: string, relativePath: string, groupName: string, groupDescription: string): Thenable<boolean>;

		/**
		 * Removes a Server Group inside a CMS on a particular level
		 */
		removeServerGroup(ownerUri: string, relativePath: string, groupName: string): Thenable<boolean>;
	}
	/**
	 * CMS Result interfaces as passed back to Extensions
	 */
	export interface RegisteredServerResult {
		name: string;
		serverName: string;
		description: string;
		connectionDetails: azdata.ConnectionInfo;
		relativePath: string;
	}

	export interface RegisteredServerGroup {
		name: string;
		description: string;
		relativePath: string;
	}

	export interface ListRegisteredServersResult {
		registeredServersList: Array<RegisteredServerResult>;
		registeredServerGroups: Array<RegisteredServerGroup>;
	}
	//#endregion

	//#region --- Blob storage

	export interface CreateSasResponse {
		sharedAccessSignature: string;
	}

	export interface IAzureBlobService {
		/**
		 * Create a shared access signature for the specified blob container URI and saves it to the server specified with the connectionUri
		 * @param connectionUri The connection URI of the server to save the SAS to
		 * @param blobContainerUri The blob container URI to create the SAS for
		 * @param blobStorageKey The key used to access the storage account
		 * @param storageAccountName The name of the storage account the SAS will be created for
		 * @param expirationDate The expiration date of the SAS
		 * @returns A created shared access signature token
		 */
		createSas(connectionUri: string, blobContainerUri: string, blobStorageKey: string, storageAccountName: string, expirationDate: string): Promise<CreateSasResponse>;
	}

	//#endregion

	//#region --- Object Management
	export namespace ObjectManagement {

		/**
		 * Object types.
		 */
		export const enum NodeType {
			ApplicationRole = "ApplicationRole",
			Column = "Column",
			Database = "Database",
			DatabaseRole = "DatabaseRole",
			ServerLevelLogin = "ServerLevelLogin",
			ServerLevelServerRole = "ServerLevelServerRole",
			Server = "Server",
			Table = "Table",
			User = "User",
			View = "View"
		}

		/**
		 * Base interface for all the objects.
		 */
		export interface SqlObject {
			/**
			 * Name of the object.
			 */
			name: string;
		}

		/**
		 * Base interface for the object view information.
		 */
		export interface ObjectViewInfo<T extends SqlObject> {
			/**
			 * The object information
			 */
			objectInfo: T;
		}

		/**
		 * Interface representing an item in the search result.
		 */
		export interface SearchResultItem {
			/**
			 * name of the object.
			 */
			name: string;
			/**
			 * type of the object.
			 */
			type: string;
			/**
			 * schema of the object.
			 */
			schema: string | undefined;
		}
	}

	export interface IObjectManagementService {
		/**
		 * Initialize the object view and return the information to render the view.
		 * @param contextId The context id of the view, generated by the extension and will be used in subsequent save/script/dispose operations.
		 * @param objectType The object type.
		 * @param connectionUri The original connection's URI.
		 * @param database The target database.
		 * @param isNewObject Whether the view is for creating a new object.
		 * @param parentUrn The parent object's URN.
		 * @param objectUrn The object's URN.
		 */
		initializeView(contextId: string, objectType: ObjectManagement.NodeType, connectionUri: string, database: string, isNewObject: boolean, parentUrn: string, objectUrn: string): Thenable<ObjectManagement.ObjectViewInfo<ObjectManagement.SqlObject>>;
		/**
		 * Save an object.
		 * @param contextId The object view's context id.
		 * @param object The object to be saved.
		 */
		save(contextId: string, object: ObjectManagement.SqlObject): Thenable<void>;
		/**
		 * Script an object.
		 * @param contextId The object view's context id.
		 * @param object The object to be scripted.
		 */
		script(contextId: string, object: ObjectManagement.SqlObject): Thenable<string>;
		/**
		 * Dispose a view.
		 * @param contextId The id of the view.
		 */
		disposeView(contextId: string): Thenable<void>;
		/**
		 * Rename an object.
		 * @param connectionUri The URI of the server connection.
		 * @param objectType The object type.
		 * @param objectUrn SMO Urn of the object to be renamed. More information: https://learn.microsoft.com/sql/relational-databases/server-management-objects-smo/overview-smo
		 * @param newName The new name of the object.
		 */
		rename(connectionUri: string, objectType: ObjectManagement.NodeType, objectUrn: string, newName: string): Thenable<void>;
		/**
		 * Drop an object.
		 * @param connectionUri The URI of the server connection.
		 * @param objectType The object type.
		 * @param objectUrn SMO Urn of the object to be dropped. More information: https://learn.microsoft.com/sql/relational-databases/server-management-objects-smo/overview-smo
		 */
		drop(connectionUri: string, objectType: ObjectManagement.NodeType, objectUrn: string): Thenable<void>;
		/**
		 * Search for objects.
		 * @param contextId The object view's context id.
		 * @param objectTypes The object types to search for.
		 * @param searchText Search text.
		 * @param schema Schema to search in.
		 */
		search(contextId: string, objectTypes: string[], searchText?: string, schema?: string): Thenable<ObjectManagement.SearchResultItem[]>;
		/**
		 * Detach a database.
		 * @param connectionUri The URI of the server connection.
		 * @param database The target database.
		 * @param dropConnections Whether to drop active connections to this database.
		 * @param updateStatistics Whether to update the optimization statistics related to this database.
		 * @param generateScript Whether to generate a TSQL script for the operation instead of detaching the database.
		 * @returns A string value representing the generated TSQL query if generateScript was set to true, and an empty string otherwise.
		 */
		detachDatabase(connectionUri: string, database: string, dropConnections: boolean, updateStatistics: boolean, generateScript: boolean): Thenable<string>;
		/**
		 * Attach one or more databases.
		 * @param connectionUri The URI of the server connection.
		 * @param databases The name, owner, and file paths for each database that will be attached.
		 * @param generateScript Whether to generate a TSQL script for the operation instead of detaching the database.
		 * @returns A string value representing the generated TSQL query if generateScript was set to true, and an empty string otherwise.
		 */
		attachDatabases(connectionUri: string, databases: DatabaseFileData[], generateScript: boolean): Thenable<string>;
		/**
		 * Backup a database.
		 * @param connectionUri The URI of the server connection.
		 * @param backupInfo Various settings for how to backup the database.
		 * @param taskMode Whether to run the backup operation, generate a script for it, or both.
		 * @returns A response indicating if the backup or scripting operation started successfully.
		 */
		backupDatabase(connectionUri: string, backupInfo: BackupInfo, taskMode: azdata.TaskExecutionMode): Thenable<azdata.BackupResponse>;
		/**
		 * Drop a database.
		 * @param connectionUri The URI of the server connection.
		 * @param database The target database.
		 * @param dropConnections Whether to drop active connections to this database.
		 * @param deleteBackupHistory Whether to delete backup and restore history information for this database.
		 * @param generateScript Whether to generate a TSQL script for the operation instead of detaching the database.
		 * @returns A string value representing the generated TSQL query if generateScript was set to true, and an empty string otherwise.
		 */
		dropDatabase(connectionUri: string, database: string, dropConnections: boolean, deleteBackupHistory: boolean, generateScript: boolean): Thenable<string>;
		/**
		 * Gets the file path for the default database file folder for a SQL Server instance.
		 * @param connectionUri The URI of the connection for the specific server.
		 * @returns The file path to the data folder.
		 */
		getDataFolder(connectionUri: string): Thenable<string>;
		/**
		 * Gets the file path for the default database backup file folder for a SQL Server instance.
		 * @param connectionUri The URI of the connection for the specific server.
		 * @returns The file path to the backup folder.
		 */
		getBackupFolder(connectionUri: string): Thenable<string>;
		/**
		 * Retrieves other database files associated with a specified primary file, such as Data, Log, and FileStream files.
		 * @param connectionUri The URI of the connection for the specific server.
		 * @param primaryFilePath The file path for the primary database file on the target server.
		 * @returns An array of file path strings for each of the associated files.
		 */
		getAssociatedFiles(connectionUri: string, primaryFilePath: string): Thenable<string[]>;
		/**
		 * Clears all query store data from the database
		 * @param connectionUri The URI of the server connection.
		 * @param database The target database.
		 */
		purgeQueryStoreData(connectionUri: string, database: string): Thenable<void>;
		/**
		 * Create a new credential
		 * @param connectionUri The URI of the server connection.
		 * @param credentialInfo
		 */
		createCredential(connectionUri: string, credentialInfo: azdata.CredentialInfo): Thenable<void>;
		/**
		 * Gets all the credentials that exist in the current server
		 * @param connectionUri The URI of the server connection.
		 */
		getCredentialNames(connectionUri: string): Thenable<string[]>;
	}

	/**
	 * Various settings options for performing a database backup.
	 */
	export interface BackupInfo {
		/**
		 * Name of the datbase to perfom backup
		 */
		databaseName: string;

		/**
		 * Component to backup - Database or Files
		 */
		backupComponent: number;

		/**
		 * Type of backup - Full/Differential/Log
		 */
		backupType: number;

		/**
		 * Backup device - Disk, Url, etc.
		 */
		backupDeviceType: number;

		/**
		 *  The text input of selected files
		 */
		selectedFiles: string;

		/**
		 * Backupset name
		 */
		backupsetName: string;

		/**
		 * List of {key: backup path, value: device type}
		 */
		selectedFileGroup: { [path: string]: string };

		/**
		 * List of {key: backup path, value: device type}
		 */
		backupPathDevices: { [path: string]: number };

		/**
		 * List of selected backup paths
		 */
		backupPathList: string[];


		/**
		 * Indicates if the backup should be copy-only
		 */
		isCopyOnly: boolean;

		/**
		 * Gets or sets a Boolean property value that determines whether a media is formatted as the first step of the backup operation.
		 */
		formatMedia: boolean;

		/**
		 * Gets or sets a Boolean property value that determines whether the devices associated with a backup operation are initialized as part of the backup operation.
		 */
		initialize: boolean;

		/**
		 * Gets or sets Boolean property that determines whether the tape header is read.
		 */
		skipTapeHeader: boolean;

		/**
		 * Gets or sets the name used to identify a particular media set.
		 */
		mediaName: string;

		/**
		 * Gets or sets a textual description of the medium that contains a backup set.
		 */
		mediaDescription: string;

		/**
		 * Gets or sets a Boolean property value that determines whether a checksum value is calculated during backup or restore operations.
		 */
		checksum: boolean;

		/**
		 * Gets or sets a Boolean property value that determines whether the backup or restore continues after a checksum error occurs.
		 */
		continueAfterError: boolean;

		/**
		 * Gets or sets a Boolean property value that determines whether to truncate the database log.
		 */
		logTruncation: boolean;

		/**
		 * Gets or sets a Boolean property value that determines whether to backup the tail of the log
		 */
		tailLogBackup: boolean;

		/**
		 * Gets or sets the number of days that must elapse before a backup set can be overwritten.
		 */
		retainDays: number;

		/**
		 * Gets or sets the backup compression option.
		 * This should be converted to BackupCompressionOptions when setting it to Backup object.
		 */
		compressionOption: number;

		/**
		 * Gets or sets a Boolean property that determines whether verify is required.
		 */
		verifyBackupRequired: boolean;

		/**
		 * Specifies the algorithm type used for backup encryption.
		 * This should be converted to BackupEncryptionAlgorithm when creating BackupEncryptionOptions object.
		 */
		encryptionAlgorithm: number;

		/**
		 * Specifies the encryptor type used to encrypt an encryption key.
		 * This should be converted to BackupEncryptorType when creating BackupEncryptionOptions object.
		 */
		encryptorType: number;

		/**
		 * Gets or sets the name of the encryptor.
		 */
		encryptorName: string;
	}

	export interface DatabaseFileData {
		databaseName: string;
		databaseFilePaths: string[];
		owner: string;
	}
	//#endregion

	//#region --- Query Store

	export interface IQueryStoreService {
		/**
		 * Gets the query for a Regressed Queries report
		 * @param connectionOwnerUri Connection URI for the database
		 * @param timeIntervalRecent Time interval during which to look for performance regressions for the report
		 * @param timeIntervalHistory Time interval during which to establish baseline performance for the report
		 * @param minExecutionCount Minimum number of executions for a query to be included
		 * @param selectedMetric Metric to summarize
		 * @param selectedStatistic Statistic to calculate on SelecticMetric
		 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
		 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
		 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
		 */
		getRegressedQueriesSummary(connectionOwnerUri: string, timeIntervalRecent: TimeInterval, timeIntervalHistory: TimeInterval, minExecutionCount: number, selectedMetric: Metric, selectedStatistic: Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<QueryStoreQueryResult>;

		/**
		 * Gets the query for a detailed Regressed Queries report
		 * @param connectionOwnerUri Connection URI for the database
		 * @param timeIntervalRecent Time interval during which to look for performance regressions for the report
		 * @param timeIntervalHistory Time interval during which to establish baseline performance for the report
		 * @param minExecutionCount Minimum number of executions for a query to be included
		 * @param selectedMetric Metric to summarize
		 * @param selectedStatistic Statistic to calculate on SelecticMetric
		 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
		 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
		 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
		 */
		getRegressedQueriesDetailedSummary(connectionOwnerUri: string, timeIntervalRecent: TimeInterval, timeIntervalHistory: TimeInterval, minExecutionCount: number, selectedMetric: Metric, selectedStatistic: Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<QueryStoreQueryResult>;

		/**
		 * Gets the query for a Tracked Queries report
		 * @param querySearchText Search text for a query
		 */
		getTrackedQueriesReport(querySearchText: string): Promise<QueryStoreQueryResult>;

		/**
		 * Gets the query for a High Variation Queries report
		 * @param connectionOwnerUri Connection URI for the database
		 * @param timeInterval Time interval for the report
		 * @param orderByColumnId Name of the column to order results by
		 * @param descending Direction of the result ordering
		 * @param selectedMetric Metric to summarize
		 * @param selectedStatistic Statistic to calculate on SelecticMetric
		 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
		 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
		 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
		 */
		getHighVariationQueriesSummary(connectionOwnerUri: string, timeInterval: TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: Metric, selectedStatistic: Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<QueryStoreQueryResult>;

		/**
		 * Gets the query for a detailed High Variation Queries report
		 * @param connectionOwnerUri Connection URI for the database
		 * @param timeInterval Time interval for the report
		 * @param orderByColumnId Name of the column to order results by
		 * @param descending Direction of the result ordering
		 * @param selectedMetric Metric to summarize
		 * @param selectedStatistic Statistic to calculate on SelecticMetric
		 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
		 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
		 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
		 */
		getHighVariationQueriesDetailedSummary(connectionOwnerUri: string, timeInterval: TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: Metric, selectedStatistic: Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<QueryStoreQueryResult>;

		/**
		 * Gets the query for a Top Resource Consumers report
		 * @param connectionOwnerUri Connection URI for the database
		 * @param timeInterval Time interval for the report
		 * @param orderByColumnId Name of the column to order results by
		 * @param descending Direction of the result ordering
		 * @param selectedMetric Metric to summarize
		 * @param selectedStatistic Statistic to calculate on SelecticMetric
		 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
		 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
		 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
		 */
		getTopResourceConsumersSummary(connectionOwnerUri: string, timeInterval: TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: Metric, selectedStatistic: Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<QueryStoreQueryResult>;

		/**
		 * Gets the query for a detailed Top Resource Consumers report
		 * @param connectionOwnerUri Connection URI for the database
		 * @param timeInterval Time interval for the report
		 * @param orderByColumnId Name of the column to order results by
		 * @param descending Direction of the result ordering
		 * @param selectedMetric Metric to summarize
		 * @param selectedStatistic Statistic to calculate on SelecticMetric
		 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
		 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
		 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
		 */
		getTopResourceConsumersDetailedSummary(connectionOwnerUri: string, timeInterval: TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: Metric, selectedStatistic: Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<QueryStoreQueryResult>;

		/**
		 * Gets the query for a Plan Summary chart view
		 * @param connectionOwnerUri Connection URI for the database
		 * @param queryId Query ID to view a summary of plans for
		 * @param timeIntervalMode Mode of the time interval search
		 * @param timeInterval Time interval for the report
		 * @param selectedMetric Metric to summarize
		 * @param selectedStatistic Statistic to calculate on SelecticMetric
		 */
		getPlanSummaryChartView(connectionOwnerUri: string, queryId: number, timeIntervalMode: PlanTimeIntervalMode, timeInterval: TimeInterval, selectedMetric: Metric, selectedStatistic: Statistic): Promise<QueryStoreQueryResult>;

		/**
		 * Gets the query for a Plan Summary grid view
		 * @param connectionOwnerUri Connection URI for the database
		 * @param orderByColumnId Name of the column to order results by
		 * @param descending Direction of the result ordering
		 * @param queryId Query ID to view a summary of plans for
		 * @param timeIntervalMode Mode of the time interval search
		 * @param timeInterval Time interval for the report
		 * @param selectedMetric Metric to summarize
		 * @param selectedStatistic Statistic to calculate on SelecticMetric
		 */
		getPlanSummaryGridView(connectionOwnerUri: string, orderByColumnId: string, descending: boolean, queryId: number, timeIntervalMode: PlanTimeIntervalMode, timeInterval: TimeInterval, selectedMetric: Metric, selectedStatistic: Statistic): Promise<QueryStoreQueryResult>;

		/**
		 * Gets the query to view a forced plan
		 * @param connectionOwnerUri Connection URI for the database
		 * @param queryId Query ID to view the plan for
		 * @param planId Plan ID to view
		 */
		getForcedPlan(connectionOwnerUri: string, queryId: number, planId: number): Promise<QueryStoreQueryResult>;

		/**
		 * Gets the query for a Forced Plan Queries report
		 * @param connectionOwnerUri Connection URI for the database
		 * @param timeInterval Time interval for the report
		 * @param orderByColumnId Name of the column to order results by
		 * @param descending Direction of the result ordering
		 * @param selectedMetric Metric to summarize
		 * @param selectedStatistic Statistic to calculate on SelecticMetric
		 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
		 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
		 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
		 */
		getForcedPlanQueriesReport(connectionOwnerUri: string, timeInterval: TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: Metric, selectedStatistic: Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<QueryStoreQueryResult>;

		/**
		 * Gets the query for an Overall Resource Consumption report
		 * @param connectionOwnerUri Connection URI for the database
		 * @param specifiedTimeInterval Time interval for the report
		 * @param specifiedBucketInterval Bucket interval for the report
		 * @param selectedMetric Metric to summarize
		 * @param selectedStatistic Statistic to calculate on SelecticMetric
		 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
		 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
		 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
		 */
		getOverallResourceConsumptionReport(connectionOwnerUri: string, specifiedTimeInterval: TimeInterval, specifiedBucketInterval: BucketInterval, selectedMetric: Metric, selectedStatistic: Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<QueryStoreQueryResult>;
	}

	//#region Results

	/**
	 * Result containing a finalized query for a report
	 */
	export interface QueryStoreQueryResult extends azdata.ResultStatus {
		/**
		 * Finalized query for a report
		 */
		query: string;
	}

	//#endregion

	//#region Types

	export const enum BucketInterval { // values from SSMS: $\Sql\ssms\core\QueryStoreModel\Common\BucketInterval.cs
		Minute = 0,
		Hour = 1,
		Day = 2,
		Week = 3,
		Month = 4,
		Automatic = 5
	}

	export const enum PlanTimeIntervalMode { // values from SSMS: $\Sql\ssms\core\QueryStoreModel\PlanSummary\PlanSummaryConfiguration.cs
		SpecifiedRange = 0,
		AllHistory = 1
	}

	export const enum Metric { // values from SSMS: $\Sql\ssms\core\QueryStoreModel\Common\Metric.cs
		CPUTime = 0,
		Duration = 1,
		LogicalWrites = 2,
		LogicalReads = 3,
		MemoryConsumption = 4,
		PhysicalReads = 5,
		ExecutionCount = 6,
		ClrTime = 7,
		Dop = 8,
		RowCount = 9,
		LogMemoryUsed = 10,
		TempDbMemoryUsed = 11,
		WaitTime = 12
	}

	export const enum Statistic { // values from SSMS: $\Sql\ssms\core\QueryStoreModel\Common\Statistic.cs
		Avg = 0,
		Min = 1,
		Max = 2,
		Stdev = 3,
		Last = 4,
		Total = 5,
		Variation = 6
	}

	export const enum TimeIntervalOptions // values from SSMS: $\Sql\ssms\core\QueryStoreModel\Common\TimeInterval.cs
	{
		Last5Minutes = 0,
		Last15Minutes = 1,
		Last30Minutes = 2,
		LastHour = 3,
		Last12Hours = 4,
		LastDay = 5,
		Last2Days = 6,
		LastWeek = 7,
		Last2Weeks = 8,
		LastMonth = 9,
		Last3Months = 10,
		Last6Months = 11,
		LastYear = 12,
		AllTime = 13,
		Custom = 14
	}

	export interface TimeInterval {
		startDateTimeInUtc?: string,
		endDateTimeInUtc?: string,
		timeIntervalOptions?: TimeIntervalOptions
	}

	//#endregion

	//#endregion
}
