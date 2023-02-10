/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for extensions to expose APIs.
declare module 'mssql' {
	import * as azdata from 'azdata';

	/**
	 * Covers defining what the mssql extension exports to other extensions
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

		readonly sqlAssessment: ISqlAssessmentService;

		readonly azureBlob: IAzureBlobService;
	}

	/**
	 * A browser supporting actions over the object explorer connections provided by this extension.
	 * Currently this is the
	 */
	export interface MssqlObjectExplorerBrowser {
		/**
		 * Gets the matching node given a context object, e.g. one from a right-click on a node in Object Explorer
		 */
		getNode<T extends ITreeNode>(objectExplorerContext: azdata.ObjectExplorerContext): Thenable<T>;
	}

	/**
	 * A tree node in the object explorer tree
	 */
	export interface ITreeNode {
		getNodeInfo(): azdata.NodeInfo;
		getChildren(refreshChildren: boolean): ITreeNode[] | Thenable<ITreeNode[]>;
	}

	/**
	 * A HDFS file node. This is a leaf node in the object explorer tree, and its contents
	 * can be queried
	 */
	export interface IFileNode extends ITreeNode {
		getFileContentsAsString(maxBytes?: number): Thenable<string>;
	}

	//#region --- schema compare
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
		folderStructure: ExtractTarget;
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

	//#region --- dacfx
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
		deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
		generateDeployScript(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
		generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<GenerateDeployPlanResult>;
		getOptionsFromProfile(profilePath: string): Thenable<DacFxOptionsResult>;
		validateStreamingJob(packageFilePath: string, createStreamingJobTsql: string): Thenable<ValidateStreamingJobResult>;
		parseTSqlScript(filePath: string, databaseSchemaProvider: string): Thenable<ParseTSqlScriptResult>;
		savePublishProfile(profilePath: string, databaseName: string, connectionString: string, sqlCommandVariableValues?: Record<string, string>, deploymentOptions?: DeploymentOptions): Thenable<SavePublishProfileResult>;
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

	export interface SavePublishProfileResult extends azdata.ResultStatus {
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

	//#region --- Sql Projects

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
		 * @param databaseLiteral Literal name used to reference another database in the same server, if not using SQLCMD variables
		 */
		addSystemDatabaseReference(projectUri: string, systemDatabase: SystemDatabase, suppressMissingDependencies: boolean, databaseLiteral?: string): Promise<azdata.ResultStatus>;

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
		 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		movePostDeploymentScript(projectUri: string, destinationPath: string, path: string): Promise<azdata.ResultStatus>;

		/**
		 * Move a pre-deployment script in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		movePreDeploymentScript(projectUri: string, destinationPath: string, path: string): Promise<azdata.ResultStatus>;

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
		 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		moveSqlObjectScript(projectUri: string, destinationPath: string, path: string): Promise<azdata.ResultStatus>;

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
		 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
		 * @param path Path of the item, including extension, relative to the .sqlproj
		 */
		moveNoneItem(projectUri: string, destinationPath: string, path: string): Promise<azdata.ResultStatus>;
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

	export const enum SystemDatabase {
		Master = 0,
		MSDB = 1
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

	/**
	 * Sql Assessment
	 */

	// SqlAssessment interfaces  -----------------------------------------------------------------------

	export interface ISqlAssessmentService {
		assessmentInvoke(ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult>;
		getAssessmentItems(ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult>;
		generateAssessmentScript(items: azdata.SqlAssessmentResultItem[], targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<azdata.ResultStatus>;
	}

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

	// Object Management - Begin.
	export namespace ObjectManagement {
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
		 * Base interface for the object view information
		 */
		export interface ObjectViewInfo<T extends SqlObject> {
			/**
			 * The object information
			 */
			objectInfo: T;
		}

		/**
		 * Server level login.
		 */
		export interface Login extends SqlObject {
			/**
			 * Authentication type.
			 */
			authenticationType: AuthenticationType;
			/**
			 * Password for the login.
			 * Only applicable when the authentication type is 'Sql'.
			 */
			password: string | undefined;
			/**
			 * Old password of the login.
			 * Only applicable when the authentication type is 'Sql'.
			 * The old password is required when updating the login's own password and it doesn't have the 'ALTER ANY LOGIN' permission.
			 */
			oldPassword: string | undefined;
			/**
			 * Whether the password complexity policy is enforced.
			 * Only applicable when the authentication type is 'Sql'.
			 */
			enforcePasswordPolicy: boolean | undefined;
			/**
			 * Whether the password expiration policy is enforced.
			 * Only applicable when the authentication type is 'Sql'.
			 */
			enforcePasswordExpiration: boolean | undefined;
			/**
			 * Whether SQL Server should prompt for an updated password when the next the login is used.
			 * Only applicable when the authentication type is 'Sql'.
			 */
			mustChangePassword: boolean | undefined;
			/**
			 * Whether the login is locked out due to password policy violation.
			 * Only applicable when the authentication type is 'Sql'.
			 */
			isLockedOut: boolean;
			/**
			 * The default database for the login.
			 */
			defaultDatabase: string;
			/**
			 * The default language for the login.
			 */
			defaultLanguage: string;
			/**
			 * The server roles of the login.
			 */
			serverRoles: string[];
			/**
			 * The database users the login is mapped to.
			 */
			userMapping: ServerLoginUserInfo[];
			/**
			 * Whether the login is enabled.
			 */
			isEnabled: boolean;
			/**
			 * Whether the connect permission is granted to the login.
			 */
			connectPermission: boolean;
		}

		/**
		 * The authentication types.
		 */
		export enum AuthenticationType {
			Windows = 'Windows',
			Sql = 'Sql',
			AzureActiveDirectory = 'AAD'
		}

		/**
		 * The user mapping information for login.
		 */
		export interface ServerLoginUserInfo {
			/**
			 * Target database name.
			 */
			database: string;
			/**
			 * User name.
			 */
			user: string;
			/**
			 * Default schema of the user.
			 */
			defaultSchema: string;
			/**
			 * Databases roles of the user.
			 */
			databaseRoles: string[];
		}

		/**
		 * The information required to render the login view.
		 */
		export interface LoginViewInfo extends ObjectViewInfo<Login> {
			/**
			 * Whether Windows Authentication is supported.
			 */
			supportWindowsAuthentication: boolean;
			/**
			 * Whether Azure Active Directory Authentication is supported.
			 */
			supportAADAuthentication: boolean;
			/**
			 * Whether SQL Authentication is supported.
			 */
			supportSQLAuthentication: boolean;
			/**
			 * Whether the locked out state can be changed.
			 */
			canEditLockedOutState: boolean;
			/**
			 * Name of the databases in the server.
			 */
			databases: string[];
			/**
			 * Available languages in the server.
			 */
			languages: string[];
			/**
			 * All server roles in the server.
			 */
			serverRoles: string[];
			/**
			 * Whether advanced password options are supported.
			 * Advanced password options: check policy, check expiration, must change, unlock.
			 * Notes: 2 options to control the advanced options because Analytics Platform supports advanced options but does not support advanced options.
			 */
			supportAdvancedPasswordOptions: boolean;
			/**
			 * Whether advanced options are supported.
			 * Advanced options: default database, default language and connect permission.
			 */
			supportAdvancedOptions: boolean;
		}

		/**
		 * The permission information a principal has on a securable.
		 */
		export interface Permission {
			/**
			 * Name of the permission.
			 */
			name: string;
			/**
			 * Whether the permission is granted or denied.
			 */
			grant: boolean;
			/**
			 * Whether the pincipal can grant this permission to other principals.
			 * The value will be ignored if the grant property is set to false.
			 */
			withGrant: boolean;
		}

		/**
		 * The permissions a principal has over a securable.
		 */
		export interface SecurablePermissions {
			/**
			 * The securable.
			 */
			securable: SqlObject;
			/**
			 * The Permissions.
			 */
			permissions: Permission[];
		}

		/**
		 * Extend property for objects.
		 */
		export interface ExtendedProperty {
			/**
			 * Name of the property.
			 */
			name: string;
			/**
			 * Value of the property.
			 */
			value: string;
		}

		/**
		 * User types.
		 */
		export enum UserType {
			/**
			 * User with a server level login.
			 */
			WithLogin = 'WithLogin',
			/**
			 * User based on a Windows user/group that has no login, but can connect to the Database Engine through membership in a Windows group.
			 */
			WithWindowsGroupLogin = 'WithWindowsGroupLogin',
			/**
			 * Contained user, authentication is done within the database.
			 */
			Contained = 'Contained',
			/**
			 * User that cannot authenticate.
			 */
			NoConnectAccess = 'NoConnectAccess'
		}

		/**
		 * Database user.
		 */
		export interface User extends SqlObject {
			/**
			 * Type of the user.
			 */
			type: UserType;
			/**
			 * Default schema of the user.
			 */
			defaultSchema: string | undefined;
			/**
			 * Schemas owned by the user.
			 */
			ownedSchemas: string[];
			/**
			 * Database roles that the user belongs to.
			 */
			databaseRoles: string[];
			/**
			 * The name of the server login associated with the user.
			 * Only applicable when the user type is 'WithLogin'.
			 */
			loginName: string | undefined;
			/**
			 * The default language of the user.
			 * Only applicable when the user type is 'Contained'.
			 */
			defaultLanguage: string | undefined;
			/**
			 * Authentication type.
			 * Only applicable when user type is 'Contained'.
			 */
			authenticationType: AuthenticationType | undefined;
			/**
			 * Password of the user.
			 * Only applicable when the user type is 'Contained' and the authentication type is 'Sql'.
			 */
			password: string | undefined;
		}

		/**
		 * The information required to render the user view.
		 */
		export interface UserViewInfo extends ObjectViewInfo<User> {
			/**
			 * Whether contained user is supported.
			 */
			supportContainedUser: boolean;
			/**
			 * Whether Windows authentication is supported.
			 */
			supportWindowsAuthentication: boolean;
			/**
			 * Whether Azure Active Directory authentication is supported.
			 */
			supportAADAuthentication: boolean;
			/**
			 * Whether SQL Authentication is supported.
			 */
			supportSQLAuthentication: boolean;
			/**
			 * All languages supported by the database.
			 */
			languages: string[];
			/**
			 * All schemas in the database.
			 */
			schemas: string[];
			/**
			 * Name of all the logins in the server.
			 */
			logins: string[];
			/**
			 * Name of all the database roles.
			 */
			databaseRoles: string[];
		}
	}

	export interface IObjectManagementService {
		/**
		 * Initialize the login view and return the information to render the view.
		 * @param connectionUri The original connection's URI.
		 * @param contextId The context id of the view, generated by the extension and will be used in subsequent create/update/dispose operations.
		 * @param isNewObject Whether the view is for creating a new login object.
		 * @param name Name of the login. Only applicable when isNewObject is false.
		 */
		initializeLoginView(connectionUri: string, contextId: string, isNewObject: boolean, name: string | undefined): Thenable<ObjectManagement.LoginViewInfo>;
		/**
		 * Create a login.
		 * @param contextId The login view's context id.
		 * @param login The login information.
		 */
		createLogin(contextId: string, login: ObjectManagement.Login): Thenable<void>;
		/**
		 * Update a login.
		 * @param contextId The login view's context id.
		 * @param login The login information.
		 */
		updateLogin(contextId: string, login: ObjectManagement.Login): Thenable<void>;
		/**
		 * Dispose the login view.
		 * @param contextId The id of the view.
		 */
		disposeLoginView(contextId: string): Thenable<void>;
		/**
		 * Initialize the user view and return the information to render the view.
		 * @param connectionUri The original connection's URI.
		 * @param database Name of the database.
		 * @param contextId The id of the view, generated by the extension and will be used in subsequent create/update/dispose operations.
		 * @param isNewObject Whether the view is for creating a new user object.
		 * @param name Name of the user. Only applicable when isNewObject is false.
		 */
		initializeUserView(connectionUri: string, database: string, contextId: string, isNewObject: boolean, name: string | undefined): Thenable<ObjectManagement.UserViewInfo>;
		/**
		 * Create a user.
		 * @param contextId Id of the view.
		 * @param user The user information.
		 */
		createUser(contextId: string, user: ObjectManagement.User): Thenable<void>;
		/**
		 * Update a user.
		 * @param contextId Id of the view.
		 * @param user The user information.
		 */
		updateUser(contextId: string, user: ObjectManagement.User): Thenable<void>;
		/**
		 * Dispose the user view.
		 * @param contextId The id of the view.
		 */
		disposeUserView(contextId: string): Thenable<void>;
		/**
		 * Rename an object.
		 * @param connectionUri The URI of the server connection.
		 * @param objectUrn SMO Urn of the object to be renamed. More information: https://learn.microsoft.com/sql/relational-databases/server-management-objects-smo/overview-smo
		 * @param newName The new name of the object.
		 */
		rename(connectionUri: string, objectUrn: string, newName: string): Thenable<void>;
		/**
		 * Drop an object.
		 * @param connectionUri The URI of the server connection.
		 * @param objectUrn SMO Urn of the object to be dropped. More information: https://learn.microsoft.com/sql/relational-databases/server-management-objects-smo/overview-smo
		 */
		drop(connectionUri: string, objectUrn: string): Thenable<void>;
	}
	// Object Management - End.
}
