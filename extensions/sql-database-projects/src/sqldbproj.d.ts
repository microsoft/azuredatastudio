/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'sqldbproj' {
	import * as vscode from 'vscode';

	export const enum extension {
		name = 'Microsoft.sql-database-projects',
		vsCodeName = 'ms-mssql.sql-database-projects-vscode'
	}

	/**
	 * sql database projects extension
	 */
	export interface IExtension {
		/**
		 * Create a project
		 * @param name name of the project
		 * @param location the parent directory
		 * @param projectTypeId the ID of the project/template
		 * @param targetPlatform the target platform for the project. Default is SQL Server 2019
		 * @param sdkStyle whether the project is sdk-style. Default is false
		 * @returns Uri of the newly created project file
		 */
		createProject(name: string, location: vscode.Uri, projectTypeId: string, targetPlatform: SqlTargetPlatform, sdkStyle?: boolean, configureDefaultBuild?: boolean): Promise<vscode.Uri>;

		/**
		 * Opens and loads a .sqlproj file
		 */
		openProject(projectFilePath: string): Promise<ISqlProject>;

		/**
		 * Opens the data workspace new project dialog with only the sql database template
		 * @param allowedTargetPlatforms specific target platforms to allow. If not specified, all target platforms for sql will be listed
		 * @returns uri of the created the project or undefined if no project was created
		 */
		openSqlNewProjectDialog(allowedTargetPlatforms?: SqlTargetPlatform[]): Promise<vscode.Uri | undefined>;

		/**
		 * Gets the list of .sql scripts contained in a project
		 * @param projectFilePath
		 */
		getProjectScriptFiles(projectFilePath: string): Promise<string[]>;

		/**
		 * Gets the Database Schema Provider version for a SQL project
		 */
		getProjectDatabaseSchemaProvider(projectFilePath: string): Promise<string>;

		/**
		 * Generate project from OpenAPI specification file
		 * @param options Options to use when generating a project from an OpenAPI spec
		 * @returns the generated sql project
		 */
		generateProjectFromOpenApiSpec(options?: GenerateProjectFromOpenApiSpecOptions): Promise<ISqlProject | undefined>;

		/**
		 * Prompts the user to add a new item to the specified project
		 * @param project The project to add the item to
		 * @param relativeFilePath The relative path in the project where the item should be added
		 * @param options The additional options to use
		 */
		addItemPrompt(project: ISqlProject, relativeFilePath: string, options?: AddItemOptions): Promise<void>;

		/**
		 * Gets the information required to start a docker container for publishing to
		 * @param projectName The name of the project being published
		 * @param baseImage The base docker image being deployed
		 * @param imageUniqueId The unique ID to use in the name, default is a random GUID
		 */
		getDockerImageSpec(projectName: string, baseImage: string, imageUniqueId?: string): DockerImageSpec;

		/**
		 * Checks if any containers with the specified label already exist, and if they do prompt the user whether they want to clean them up
		 * @param imageLabel The label of the container to search for
		 */
		cleanDockerObjectsIfNeeded(imageLabel: string): Promise<void>;
	}

	export interface AddItemOptions {
		/**
		 * The type of item to add. If not specified the user will choose from a list of available types
		 */
		itemType?: string,
		/**
		 * The default name to display in the name prompt
		 */
		defaultName?: string
	}

	/**
	 * The type of an item in a SQL Project
	 */
	export const enum ItemType {
		script = 'script',
		table = 'table',
		view = 'view',
		storedProcedure = 'storedProcedure',
		dataSource = 'dataSource',
		fileFormat = 'fileFormat',
		externalStream = 'externalStream',
		externalStreamingJob = 'externalStreamingJob',
		folder = 'folder',
		preDeployScript = 'preDeployScript',
		postDeployScript = 'postDeployScript',
		publishProfile = 'publishProfile',
		tasks = 'tasks',
	}

	/**
	 * Options to use when generating a project from an OpenAPI spec
	 */
	export type GenerateProjectFromOpenApiSpecOptions = {
		/**
		 * The OpenAPI spec file to use instead of having the user select it
		 */
		openApiSpecFile?: vscode.Uri,
		/**
		 * The default name to give the generated project in the name input prompt
		 */
		defaultProjectName?: string,
		/**
		 * The default location to show when the user is selecting the output location of the project
		 */
		defaultOutputLocation?: vscode.Uri,
		/**
		 * If true then the project will not be opened in the workspace after being created
		 */
		doNotOpenInWorkspace?: boolean,

		/**
		 * Create SQL Project SDK style or non SDK style. The default is non SDK style.
		 */
		isSDKStyle?: boolean
	};

	export interface ISqlProject {
		/**
		 * Reads the project setting and contents from the file
		 */
		readProjFile(): Promise<void>;

		/**
		 * Adds a pre-deployment script
		 * @param relativePath
		 */
		addPreDeploymentScript(relativePath: string): Promise<void>;

		/**
		 * Adds a post-deployment script
		 * @param relativePath
		 */
		addPostDeploymentScript(relativePath: string): Promise<void>;

		/**
		 * Adds a none item that is not included in "Build"
		 * @param relativePath
		 */
		addNoneItem(relativePath: string): Promise<void>;

		/**
		 * Add a SQL object script that will be included in the schema
		 * @param relativePath
		 */
		addSqlObjectScript(relativePath: string): Promise<void>;

		/**
		 * Adds multiple SQL object scripts that will be included in the schema
		 * @param relativePaths Array of paths relative to the .sqlproj file
		 */
		addSqlObjectScripts(relativePaths: string[]): Promise<void>;

		/**
		 * Adds a folder to the project, and saves the project file
		 *
		 * @param relativeFolderPath Relative path of the folder
		 */
		addFolder(relativeFolderPath: string): Promise<void>;

		/**
		 * Writes a file to disk if contents are provided, adds that file to the project, and writes it to disk
		 *
		 * @param relativeFilePath Relative path of the file
		 * @param contents Contents to be written to the new file
		 * @param itemType Type of the project entry to add. This maps to the build action for the item.
		 */
		addScriptItem(relativeFilePath: string, contents?: string, itemType?: string): Promise<IFileProjectEntry>;

		/**
		 * Adds a SQLCMD variable to the project
		 * @param name name of the variable
		 * @param defaultValue
		 */
		addSqlCmdVariable(name: string, defaultValue: string): Promise<void>;

		/**
		 * Gets an array of all database sources specified in the project.
		 */
		getDatabaseSourceValues(): string[];

		/**
		 * Appends given database source to the DatabaseSource property element.
		 * If property element does not exist, then new one will be created.
		 *
		 * @param databaseSource Source of the database to add
		 */
		addDatabaseSource(databaseSource: string): Promise<void>;

		/**
		 * Removes database source from the DatabaseSource property element.
		 * If no sources remain, then property element will be removed from the project file.
		 *
		 * @param databaseSource Source of the database to remove
		 */
		removeDatabaseSource(databaseSource: string): Promise<void>;

		/**
		 * returns the sql version the project is targeting
		 */
		getProjectTargetVersion(): string;

		/**
		 * Gets the default database collation set in the project.
		 *
		 * @returns Default collation for the database set in the project.
		 */
		getDatabaseDefaultCollation(): string;

		/**
		 * Type of .sqlproj file, either "SdkStyle" or "LegacyStyle"
		 */
		readonly sqlProjStyleName: string;

		/**
		 * Path where dacpac is output to after a successful build
		 */
		readonly dacpacOutputPath: string;

		/**
		 * Path to folder containing the project file
		 */
		readonly projectFolderPath: string;

		/**
		 * Project file path
		 */
		readonly projectFilePath: string;

		/**
		 * Project file name
		 */
		readonly projectFileName: string;

		/**
		 * SQL object scripts in this project
		 */
		readonly sqlObjectScripts: IFileProjectEntry[];

		/**
		 * SqlCmd variables and their values
		 */
		readonly sqlCmdVariables: Map<string, string>;

		/**
		 * Pre-deployment scripts in this project
		 */
		readonly preDeployScripts: IFileProjectEntry[];

		/**
		 * Post-deployment scripts in this project
		 */
		readonly postDeployScripts: IFileProjectEntry[];

		/**
		 * "None" scripts in this project (scripts ignored by the build)
		 */
		readonly noneDeployScripts: IFileProjectEntry[];

		readonly databaseReferences: IDatabaseReferenceProjectEntry[];
	}

	export const enum EntryType {
		File,
		Folder,
		DatabaseReference,
		SqlCmdVariable
	}

	export interface IProjectEntry {
		type: EntryType;
	}

	/**
	 * Represents an entry in a project file
	 */
	export interface IFileProjectEntry extends IProjectEntry {
		fsUri: vscode.Uri;
		relativePath: string;
		pathForSqlProj(): string;
	}

	/**
	 * Represents a database reference entry in a project file
	 */
	export interface IDatabaseReferenceProjectEntry extends IFileProjectEntry {
		referenceName: string;
		databaseVariableLiteralValue?: string;
		suppressMissingDependenciesErrors: boolean;
	}

	/**
	 * Target platforms for a sql project
	 */
	export const enum SqlTargetPlatform {
		sqlServer2012 = 'SQL Server 2012',
		sqlServer2014 = 'SQL Server 2014',
		sqlServer2016 = 'SQL Server 2016',
		sqlServer2017 = 'SQL Server 2017',
		sqlServer2019 = 'SQL Server 2019',
		sqlServer2022 = 'SQL Server 2022',
		sqlServer2025 = 'SQL Server 2025',
		sqlAzure = 'Azure SQL Database',
		sqlDW = 'Azure Synapse SQL Pool',
		sqlEdge = 'Azure SQL Edge',
		sqlDwServerless = 'Azure Synapse Serverless SQL Pool',
		sqlDwUnified = 'Synapse Data Warehouse in Microsoft Fabric',
		sqlDbFabric = 'SQL database in Fabric (preview)'
	}

	export interface ISqlConnectionProperties {
		tenantId?: string,
		accountId?: string
		serverName: string,
		userName: string,
		password: string,
		port: number,
		dbName: string,
		profileName?: string,
		connectionRetryTimeout?: number
	}

	/**
	 * Information for deploying a new docker container
	 */
	interface DockerImageSpec {
		/**
		 * The label to apply to the container
		 */
		label: string;
		/**
		 * The full name to give the container
		 */
		containerName: string;
		/**
		 * The tag to apply to the container
		 */
		tag: string
	}
}
