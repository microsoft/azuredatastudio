/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


declare module 'vscode-mssql' {

	import * as vscode from 'vscode';
	import { RequestType } from 'vscode-languageclient';

	/**
	 * Covers defining what the vscode-mssql extension exports to other extensions
	 *
	 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
	 * (const enums get evaluated when typescript -> javascript so those are fine)
	 */


	export const enum extension {
		name = 'ms-mssql.mssql'
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
		 * Service for accessing DacFx functionality
		 */
		readonly dacFx: IDacFxService;

		/**
		 * Service for accessing SchemaCompare functionality
		 */
		readonly schemaCompare: ISchemaCompareService;

		/**
		 * Service for accessing SQL Projects file functionality
		 */
		readonly sqlProjects: ISqlProjectsService;

		/**
		 * Service for accessing Azure Account functionality
		 */
		readonly azureAccountService: IAzureAccountService;

		/**
		 * Service for accessing Azure Resources functionality
		 */
		readonly azureResourceService: IAzureResourceService;

		/**
		 * Prompts the user to select an existing connection or create a new one, and then returns the result
		 * @param ignoreFocusOut Whether the quickpick prompt ignores focus out (default false)
		 */
		promptForConnection(ignoreFocusOut?: boolean): Promise<IConnectionInfo | undefined>;

		/**
		 * Attempts to create a new connection for the given connection info. An error is thrown and displayed
		 * to the user if an error occurs while connecting.
		 * Warning: setting the saveConnection to true will save a new connection profile each time this is called.
		 * Make sure to use that parameter only when you want to actually save a new profile.
		 * @param connectionInfo The connection info
		 * @param saveConnection Save the connection profile if sets to true
		 * @returns The URI associated with this connection
		 */
		connect(connectionInfo: IConnectionInfo, saveConnection?: boolean): Promise<string>;

		/**
		 * Prompts the user to add firewall rule if connection failed with a firewall error.
		 * @param connectionUri The URI of the connection to add firewall rule to.
		 * @param connectionInfo The connection info
		 * @returns True if firewall rule added
		 */
		promptForFirewallRule(connectionUri: string, connectionInfo: IConnectionInfo): Promise<boolean>;

		/**
		 * Lists the databases for a given connection. Must be given an already-opened connection to succeed.
		 * @param connectionUri The URI of the connection to list the databases for.
		 * @returns The list of database names
		 */
		listDatabases(connectionUri: string): Promise<string[]>;

		/**
		 * Gets the database name for the node - which is the database name of the connection for a server node, the database name
		 * for nodes at or under a database node or a default value if it's neither of those.
		 * @param node The node to get the database name of
		 * @returns The database name
		 */
		getDatabaseNameFromTreeNode(node: ITreeNodeInfo): string;

		/**
		 * Get the connection string for the provided connection Uri or connection details.
		 * @param connectionUriOrDetails Either the connection Uri for the connection or the connection details for the connection is required.
		 * @param includePassword (optional) if password should be included in connection string.
		 * @param includeApplicationName (optional) if application name should be included in connection string.
		 * @returns connection string for the connection
		 */
		getConnectionString(connectionUriOrDetails: string | ConnectionDetails, includePassword?: boolean, includeApplicationName?: boolean): Promise<string>;

		/**
		 * Set connection details for the provided connection info
		 * Able to use this for getConnectionString requests to STS that require ConnectionDetails type
		 * @param connectionInfo connection info of the connection
		 * @returns connection details credentials for the connection
		 */
		createConnectionDetails(connectionInfo: IConnectionInfo): ConnectionDetails;

		/**
		 * Send a request to the SQL Tools Server client
		 * @param requestType The type of the request
		 * @param params The params to pass with the request
		 * @returns A promise object for when the request receives a response
		 */
		sendRequest<P, R, E, R0>(requestType: RequestType<P, R, E, R0>, params?: P): Promise<R>;

		/**
		 * Get the server info for a connection
		 * @param connectionInfo connection info of the connection
		 * @returns server information
		 */
		getServerInfo(connectionInfo: IConnectionInfo): IServerInfo
	}

	/**
	 * Information about a SQL Server instance.
	 */
	export interface IServerInfo {
		/**
		 * The major version of the SQL Server instance.
		 */
		serverMajorVersion: number;

		/**
		 * The minor version of the SQL Server instance.
		 */
		serverMinorVersion: number;

		/**
		 * The build of the SQL Server instance.
		 */
		serverReleaseVersion: number;

		/**
		 * The ID of the engine edition of the SQL Server instance.
		 */
		engineEditionId: number;

		/**
		 * String containing the full server version text.
		 */
		serverVersion: string;

		/**
		 * String describing the product level of the server.
		 */
		serverLevel: string;

		/**
		 * The edition of the SQL Server instance.
		 */
		serverEdition: string;

		/**
		 * Whether the SQL Server instance is running in the cloud (Azure) or not.
		 */
		isCloud: boolean;

		/**
		 * The version of Azure that the SQL Server instance is running on, if applicable.
		 */
		azureVersion: number;

		/**
		 * The Operating System version string of the machine running the SQL Server instance.
		 */
		osVersion: string;
	}

	/**
	 * Well-known Authentication types.
	 */
	export const enum AuthenticationType {
		/**
		 * Username and password
		 */
		SqlLogin = 'SqlLogin',
		/**
		 * Windows Authentication
		 */
		Integrated = 'Integrated',
		/**
		 * Azure Active Directory - Universal with MFA support
		 */
		AzureMFA = 'AzureMFA',
		/**
		 * Azure Active Directory - Password
		 */
		AzureMFAAndUser = 'AzureMFAAndUser',
		/**
		 * Datacenter Security Token Service Authentication
		 */
		DSTSAuth = 'dstsAuth',
		/**
		 * No authentication required
		 */
		None = 'None'
	}

	/**
	 * The possible values of the server engine edition
	 * EngineEdition under https://docs.microsoft.com/sql/t-sql/functions/serverproperty-transact-sql is associated with these values
	 */
	export const enum DatabaseEngineEdition {
		Unknown = 0,
		Personal = 1,
		Standard = 2,
		Enterprise = 3,
		Express = 4,
		SqlDatabase = 5,
		SqlDataWarehouse = 6,
		SqlStretchDatabase = 7,
		SqlManagedInstance = 8,
		SqlOnDemand = 11,
		SqlDbFabric = 12
	}

	/**
	 * Information about a database connection
	 */
	export interface IConnectionInfo {
		/**
		 * server name
		 */
		server: string;

		/**
		 * database name
		 */
		database: string;

		/**
		 * user name
		 */
		user: string;

		/**
		 * password
		 */
		password: string;

		/**
		 * email
		 */
		email: string | undefined;

		/**
		 * accountId
		 */
		accountId: string | undefined;

		/**
		 * tenantId
		 */
		tenantId: string | undefined;

		/**
		 * The port number to connect to.
		 */
		port: number;

		/**
		 * Gets or sets the authentication to use.
		 */
		authenticationType: string;

		/**
		 * Gets or sets the azure account token to use.
		 */
		azureAccountToken: string | undefined;

		/**
		 * Access token expiry timestamp
		 */
		expiresOn: number | undefined;

		/**
		 * Gets or sets a string value that indicates whether SQL Server uses SSL encryption for all data sent between the client and server if
		 * the server has a certificate installed. Accepted values are: Optional, Mandatory (default)
		 */
		encrypt: string | boolean;

		/**
		 * Gets or sets a value that indicates whether the channel will be encrypted while bypassing walking the certificate chain to validate trust.
		 */
		trustServerCertificate: boolean | undefined;

		/**
		 * Gets or sets a string value that provides the host name specified in the certificate chain to be used for trust validation.
		 */
		hostNameInCertificate: string | undefined;

		/**
		 * Gets or sets a Boolean value that indicates if security-sensitive information, such as the password, is not returned as part of the connection
		 * if the connection is open or has ever been in an open state.
		 */
		persistSecurityInfo: boolean | undefined;

		/**
		 * Gets or sets the length of time (in seconds) to wait for a connection to the server before terminating the attempt and generating an error.
		 */
		connectTimeout: number | undefined;

		/**
		 * Gets or sets the length of time (in seconds) to wait for a command to execute before terminating the attempt and generating an error.
		 */
		commandTimeout: number | undefined;

		/**
		 * The number of reconnections attempted after identifying that there was an idle connection failure.
		 */
		connectRetryCount: number | undefined;

		/**
		 * Amount of time (in seconds) between each reconnection attempt after identifying that there was an idle connection failure.
		 */
		connectRetryInterval: number | undefined;

		/**
		 * Gets or sets the name of the application associated with the connection string.
		 */
		applicationName: string | undefined;

		/**
		 * Gets or sets the name of the workstation connecting to SQL Server.
		 */
		workstationId: string | undefined;

		/**
		 * Declares the application workload type when connecting to a database in an SQL Server Availability Group.
		 */
		applicationIntent: string | undefined;

		/**
		 * Gets or sets the SQL Server Language record name.
		 */
		currentLanguage: string | undefined;

		/**
		 * Gets or sets a Boolean value that indicates whether the connection will be pooled or explicitly opened every time that the connection is requested.
		 */
		pooling: boolean | undefined;

		/**
		 * Gets or sets the maximum number of connections allowed in the connection pool for this specific connection string.
		 */
		maxPoolSize: number | undefined;

		/**
		 * Gets or sets the minimum number of connections allowed in the connection pool for this specific connection string.
		 */
		minPoolSize: number | undefined;

		/**
		 * Gets or sets the minimum time, in seconds, for the connection to live in the connection pool before being destroyed.
		 */
		loadBalanceTimeout: number | undefined;

		/**
		 * Gets or sets a Boolean value that indicates whether replication is supported using the connection.
		 */
		replication: boolean | undefined;

		/**
		 * Gets or sets a string that contains the name of the primary data file. This includes the full path name of an attachable database.
		 */
		attachDbFilename: string | undefined;

		/**
		 * Gets or sets the name or address of the partner server to connect to if the primary server is down.
		 */
		failoverPartner: string | undefined;

		/**
		 * If your application is connecting to an AlwaysOn availability group (AG) on different subnets, setting MultiSubnetFailover=true
		 * provides faster detection of and connection to the (currently) active server.
		 */
		multiSubnetFailover: boolean | undefined;

		/**
		 * When true, an application can maintain multiple active result sets (MARS).
		 */
		multipleActiveResultSets: boolean | undefined;

		/**
		 * Gets or sets the size in bytes of the network packets used to communicate with an instance of SQL Server.
		 */
		packetSize: number | undefined;

		/**
		 * Gets or sets a string value that indicates the type system the application expects.
		 */
		typeSystemVersion: string | undefined;

		/**
		 * Gets or sets the connection string to use for this connection.
		 */
		connectionString: string | undefined;
	}

	export const enum ExtractTarget {
		dacpac = 0,
		file = 1,
		flat = 2,
		objectType = 3,
		schema = 4,
		schemaObjectType = 5
	}

	export interface ISchemaCompareService {
		compare(operationId: string, sourceEndpointInfo: SchemaCompareEndpointInfo, targetEndpointInfo: SchemaCompareEndpointInfo, taskExecutionMode: TaskExecutionMode, deploymentOptions: DeploymentOptions): Thenable<SchemaCompareResult>;
		schemaCompareGetDefaultOptions(): Thenable<SchemaCompareOptionsResult>;
		publishProjectChanges(operationId: string, targetProjectPath: string, targetFolderStructure: ExtractTarget, taskExecutionMode: TaskExecutionMode): Thenable<SchemaComparePublishProjectResult>;
	}

	export interface IDacFxService {
		exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
		importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
		extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<DacFxResult>;
		createProjectFromDatabase(databaseName: string, targetFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, extractTarget: ExtractTarget, taskExecutionMode: TaskExecutionMode, includePermissions?: boolean): Thenable<DacFxResult>;
		deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: TaskExecutionMode, sqlCommandVariableValues?: Map<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
		generateDeployScript(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: TaskExecutionMode, sqlCommandVariableValues?: Map<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
		generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: TaskExecutionMode): Thenable<GenerateDeployPlanResult>;
		getOptionsFromProfile(profilePath: string): Thenable<DacFxOptionsResult>;
		validateStreamingJob(packageFilePath: string, createStreamingJobTsql: string): Thenable<ValidateStreamingJobResult>;
		savePublishProfile(profilePath: string, databaseName: string, connectionString: string, sqlCommandVariableValues?: Map<string, string>, deploymentOptions?: DeploymentOptions): Thenable<ResultStatus>;
	}

	/**
	 * Error that connect method throws if connection fails because of a fire wall rule error.
	 */
	export interface IFireWallRuleError extends Error {
		connectionUri: string;
	}

	//////////////////// Azure Types ////////////////////
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
		addDacpacReference(projectUri: string, dacpacPath: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<ResultStatus>;

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
		addSqlProjectReference(projectUri: string, projectPath: string, projectGuid: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<ResultStatus>;

		/**
		 * Add a system database reference to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param systemDatabase Type of system database
		 * @param suppressMissingDependencies Whether to suppress missing dependencies
		 * @param referenceType Type of reference - ArtifactReference or PackageReference
		 * @param databaseLiteral Literal name used to reference another database in the same server, if not using SQLCMD variables
		 */
		addSystemDatabaseReference(projectUri: string, systemDatabase: SystemDatabase, suppressMissingDependencies: boolean, referenceType: SystemDbReferenceType, databaseLiteral?: string): Promise<ResultStatus>;

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
		addNugetPackageReference(projectUri: string, packageName: string, packageVersion: string, suppressMissingDependencies: boolean, databaseVariable?: string, serverVariable?: string, databaseLiteral?: string): Promise<ResultStatus>;

		/**
		 * Delete a database reference from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param name Name of the reference to be deleted. Name of the System DB, path of the sqlproj, or path of the dacpac
		 */
		deleteDatabaseReference(projectUri: string, name: string): Promise<ResultStatus>;

		/**
		 * Add a folder to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the folder, typically relative to the .sqlproj file
		 */
		addFolder(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Delete a folder from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the folder, typically relative to the .sqlproj file
		 */
		deleteFolder(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Exclude a folder and its contents from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the folder, typically relative to the .sqlproj file
		 */
		excludeFolder(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Move a folder and its contents within a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param sourcePath Source path of the folder, typically relative to the .sqlproj file
		 * @param destinationPath Destination path of the folder, typically relative to the .sqlproj file
		 */
		moveFolder(projectUri: string, sourcePath: string, destinationPath: string): Promise<ResultStatus>;

		/**
		 * Add a post-deployment script to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		addPostDeploymentScript(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Add a pre-deployment script to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		addPreDeploymentScript(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Delete a post-deployment script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		deletePostDeploymentScript(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Delete a pre-deployment script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		deletePreDeploymentScript(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Exclude a post-deployment script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		excludePostDeploymentScript(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Exclude a pre-deployment script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		excludePreDeploymentScript(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Move a post-deployment script in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
		 */
		movePostDeploymentScript(projectUri: string, path: string, destinationPath: string): Promise<ResultStatus>;

		/**
		 * Move a pre-deployment script in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
		 */
		movePreDeploymentScript(projectUri: string, path: string, destinationPath: string): Promise<ResultStatus>;

		/**
		 * Close a SQL project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		closeProject(projectUri: string): Promise<ResultStatus>;

		/**
		 * Create a new SQL project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param sqlProjectType Type of SQL Project: SDK-style or Legacy
		 * @param databaseSchemaProvider Database schema provider for the project, in the format
			 "Microsoft.Data.Tools.Schema.Sql.SqlXYZDatabaseSchemaProvider".
			 Case sensitive.
		 * @param buildSdkVersion Version of the Microsoft.Build.Sql SDK for the project, if overriding the default
		 */
		createProject(projectUri: string, sqlProjectType: ProjectType, databaseSchemaProvider?: string, buildSdkVersion?: string): Promise<ResultStatus>;

		/**
		 * Get the cross-platform compatibility status for a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		getCrossPlatformCompatibility(projectUri: string): Promise<GetCrossPlatformCompatibilityResult>;

		/**
		 * Open an existing SQL project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		openProject(projectUri: string): Promise<ResultStatus>;

		/**
		 * Update a SQL project to be cross-platform compatible
		 * @param projectUri Absolute path of the project, including .sqlproj
		 */
		updateProjectForCrossPlatform(projectUri: string): Promise<ResultStatus>;

		/**
		 * Set the DatabaseSource property of a .sqlproj file
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param databaseSource Source of the database schema, used in telemetry
		 */
		setDatabaseSource(projectUri: string, databaseSource: string): Promise<ResultStatus>;

		/**
		 * Set the DatabaseSchemaProvider property of a SQL project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param databaseSchemaProvider New DatabaseSchemaProvider value, in the form "Microsoft.Data.Tools.Schema.Sql.SqlXYZDatabaseSchemaProvider"
		 */
		setDatabaseSchemaProvider(projectUri: string, databaseSchemaProvider: string): Promise<ResultStatus>;

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
		addSqlCmdVariable(projectUri: string, name: string, defaultValue: string): Promise<ResultStatus>;

		/**
		 * Delete a SQLCMD variable from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param name Name of the SQLCMD variable to be deleted
		 */
		deleteSqlCmdVariable(projectUri: string, name?: string): Promise<ResultStatus>;

		/**
		 * Update an existing SQLCMD variable in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param name Name of the SQLCMD variable
		 * @param defaultValue Default value of the SQLCMD variable
		 */
		updateSqlCmdVariable(projectUri: string, name: string, defaultValue: string): Promise<ResultStatus>;

		/**
		 * Add a SQL object script to a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		addSqlObjectScript(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Delete a SQL object script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		deleteSqlObjectScript(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Exclude a SQL object script from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 */
		excludeSqlObjectScript(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Move a SQL object script in a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the script, including .sql, relative to the .sqlproj
		 * @param destinationPath Destination path of the file or folder, relative to the .sqlproj
		 */
		moveSqlObjectScript(projectUri: string, path: string, destinationPath: string): Promise<ResultStatus>;

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
		addNoneItem(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Delete a None item from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the item, including extension, relative to the .sqlproj
		 */
		deleteNoneItem(projectUri: string, path: string): Promise<ResultStatus>;

		/**
		 * Exclude a None item from a project
		 * @param projectUri Absolute path of the project, including .sqlproj
		 * @param path Path of the item, including extension, relative to the .sqlproj
		 */
		excludeNoneItem(projectUri: string, path: string): Promise<ResultStatus>;

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
		moveNoneItem(projectUri: string, path: string, destinationPath: string): Promise<ResultStatus>;
	}

	/**
	 * Represents a tenant information for an account.
	 */
	export interface ITenant {
		id: string;
		displayName: string;
		userId?: string;
		tenantCategory?: string;
	}

	/**
	 * Represents a key that identifies an account.
	 */
	export interface IAccountKey {
		/**
		 * Identifier for the account, unique to the provider
		 */
		id: string;
		/**
		 * Identifier of the provider
		 */
		providerId: string;
		/**
		 * Version of the account
		 */
		accountVersion?: any;
	}

	export enum AzureAuthType {
		AuthCodeGrant = 0,
		DeviceCode = 1
	}

	export enum AccountType {
		Microsoft = 'microsoft',
		WorkSchool = 'work_school'
	}

	/**
	 * Represents display information for an account.
	 */
	export interface IAccountDisplayInfo {
		/**
		 * account provider (eg, Work/School vs Microsoft Account)
		 */
		accountType: AccountType;
		/**
		 * User id that identifies the account, such as "user@contoso.com".
		 */
		userId: string;
		/**
		 * A display name that identifies the account, such as "User Name".
		 */
		displayName: string;
		/**
		 * email for AAD
		 */
		email?: string;
		/**
		 * name of account
		 */
		name: string;
	}

	export interface IAccount {
		/**
		 * The key that identifies the account
		 */
		key: IAccountKey;
		/**
		 * Display information for the account
		 */
		displayInfo: IAccountDisplayInfo;
		/**
		 * Custom properties stored with the account
		 */
		properties: IAzureAccountProperties;
		/**
		 * Indicates if the account needs refreshing
		 */
		isStale: boolean;
		/**
		 * Indicates if the account is signed in
		 */
		isSignedIn?: boolean;
	}

	export interface IAzureAccountProperties {
		/**
		 * Auth type of azure used to authenticate this account.
		 */
		azureAuthType: AzureAuthType;

		providerSettings: IProviderSettings;
		/**
		 * Whether or not the account is a Microsoft account
		 */
		isMsAccount: boolean;
		/**
		 * Represents the tenant that the user would be signing in to. For work and school accounts, the GUID is the immutable tenant ID of the organization that the user is signing in to.
		 * For sign-ins to the personal Microsoft account tenant (services like Xbox, Teams for Life, or Outlook), the value is 9188040d-6c67-4c5b-b112-36a304b66dad.
		 */
		owningTenant: ITenant;
		/**
		 * A list of tenants (aka directories) that the account belongs to
		 */
		tenants: ITenant[];
	}

	export interface IProviderSettings {
		scopes: string[];
		displayName: string;
		id: string;
		clientId: string;
		loginEndpoint: string;
		portalEndpoint: string;
		redirectUri: string;
		resources: IProviderResources;
	}

	export interface IProviderResources {
		windowsManagementResource: IAADResource;
		azureManagementResource: IAADResource;
		graphResource?: IAADResource;
		databaseResource?: IAADResource;
		ossRdbmsResource?: IAADResource;
		azureKeyVaultResource?: IAADResource;
		azureDevopsResource?: IAADResource;
	}

	export interface IAADResource {
		id: string;
		resource: string;
		endpoint: string;
	}

	export interface ITokenKey {
		/**
		 * Account Key - uniquely identifies an account
		 */
		key: string;
	}
	export interface IAccessToken extends ITokenKey {
		/**
		 * Access Token
		 */
		token: string;
		/**
		 * Access token expiry timestamp
		 */
		expiresOn?: number;
	}

	export interface IToken extends IAccessToken {
		/**
		 * TokenType
		 */
		tokenType: string;
	}

	export interface IRefreshToken extends ITokenKey {
		/**
		 * Refresh Token
		 */
		token: string;
	}

	export interface ITokenClaims {
		aud: string;
		iss: string;
		iat: number;
		idp: string;
		nbf: number;
		exp: number;
		home_oid?: string;
		c_hash: string;
		at_hash: string;
		aio: string;
		preferred_username: string;
		email: string;
		name: string;
		nonce: string;
		oid?: string;
		roles: string[];
		rh: string;
		sub: string;
		tid: string;
		unique_name: string;
		uti: string;
		ver: string;
	}

	export interface IAzureAccountSession {
		subscription: azure.subscription.Subscription,
		tenantId: string,
		account: IAccount,
		token: IToken | undefined
	}

	export interface IAzureAccountService {
		/**
		 * Prompts user to login to Azure and returns the account
		 */
		addAccount(): Promise<IAccount>;

		/**
		 * Returns current Azure accounts
		 */
		getAccounts(): Promise<IAccount[]>;

		/**
		 * Returns an access token for given user and tenant
		 */
		getAccountSecurityToken(account: IAccount, tenantId: string | undefined): Promise<IToken>;

		/**
		 * Returns Azure subscriptions with tenant and token for each given account
		 */
		getAccountSessions(account: IAccount): Promise<IAzureAccountSession[]>;
	}

	export interface IAzureResourceService {

		/**
		 * Returns Azure resource groups for given subscription
		 * @param session Azure session
		 * @returns List of resource groups
		 */
		getResourceGroups(session: IAzureAccountSession): Promise<azure.resources.ResourceGroup[]>;

		/**
		 * Creates or updates a Azure SQL server for given subscription, resource group and location
		 * @param session Azure session
		 * @param resourceGroupName resource group name
		 * @param serverName SQL server name
		 * @param parameters parameters for the SQL server
		 * @returns name of the SQL server
		 */
		createOrUpdateServer(session: IAzureAccountSession, resourceGroupName: string, serverName: string, parameters: azure.sql.Server): Promise<string | undefined>;

		/**
		 * Returns Azure locations for given session
		 * @param session Azure session
		 * @returns List of locations
		 */
		getLocations(session: IAzureAccountSession): Promise<azure.subscription.Location[]>;
	}

	export const enum TaskExecutionMode {
		execute = 0,
		script = 1,
		executeAndScript = 2
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

	/**
	 * ResultStatus from d.ts
	 */
	export interface ResultStatus {
		success: boolean;
		errorMessage: string;
	}

	export interface DacFxResult extends ResultStatus {
		operationId: string;
	}

	export interface GenerateDeployPlanResult extends DacFxResult {
		report: string;
	}

	export interface DacFxOptionsResult extends ResultStatus {
		deploymentOptions: DeploymentOptions;
	}

	export interface ValidateStreamingJobResult extends ResultStatus { }

	export interface ExportParams {
		databaseName: string;
		packageFilePath: string;
		ownerUri: string;
		taskExecutionMode: TaskExecutionMode;
	}

	export interface ImportParams {
		packageFilePath: string;
		databaseName: string;
		ownerUri: string;
		taskExecutionMode: TaskExecutionMode;
	}

	export interface ExtractParams {
		databaseName: string;
		packageFilePath: string;
		applicationName: string;
		applicationVersion: string;
		ownerUri: string;
		extractTarget?: ExtractTarget;
		taskExecutionMode: TaskExecutionMode;
		includePermissions?: boolean;
	}

	export interface DeployParams {
		packageFilePath: string;
		databaseName: string;
		upgradeExisting: boolean;
		sqlCommandVariableValues?: Record<string, string>;
		deploymentOptions?: DeploymentOptions;
		ownerUri: string;
		taskExecutionMode: TaskExecutionMode;
	}

	export interface GenerateDeployScriptParams {
		packageFilePath: string;
		databaseName: string;
		sqlCommandVariableValues?: Record<string, string>;
		deploymentOptions?: DeploymentOptions;
		ownerUri: string;
		taskExecutionMode: TaskExecutionMode;
	}

	export interface GenerateDeployPlanParams {
		packageFilePath: string;
		databaseName: string;
		ownerUri: string;
		taskExecutionMode: TaskExecutionMode;
	}

	export interface GetOptionsFromProfileParams {
		profilePath: string;
	}

	export interface ValidateStreamingJobParams {
		packageFilePath: string;
		createStreamingJobTsql: string;
	}

	export interface SchemaCompareGetOptionsParams { }

	export interface SchemaCompareOptionsResult extends ResultStatus {
		defaultDeploymentOptions: DeploymentOptions;
	}

	export interface SchemaCompareResult extends ResultStatus {
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
		connectionDetails: ConnectionDetails;
		connectionName?: string;
		projectFilePath: string;
		targetScripts: string[];
		extractTarget: ExtractTarget;
		dataSchemaProvider: string;
	}

	export interface SchemaComparePublishProjectResult extends ResultStatus {
		changedFiles: string[];
		addedFiles: string[];
		deletedFiles: string[];
	}

	export interface SavePublishProfileParams {
		profilePath: string;
		databaseName: string;
		connectionString: string;
		sqlCommandVariableValues?: Record<string, string>;
		deploymentOptions?: DeploymentOptions;
	}

	//#region ISqlProjectsService

	//#region Parameters

	export interface SqlProjectParams {
		/**
		 * Absolute path of the project, including .sqlproj
		 */
		projectUri: string;
	}

	export interface SqlProjectScriptParams extends SqlProjectParams {
		/**
		 * Path of the script, including .sql, relative to the .sqlproj
		 */
		path: string;
	}

	export interface AddDacpacReferenceParams extends AddUserDatabaseReferenceParams {
		/**
		 * Path to the .dacpac file
		 */
		dacpacPath: string;
	}

	export interface AddDatabaseReferenceParams extends SqlProjectParams {
		/**
		 * Whether to suppress missing dependencies
		 */
		suppressMissingDependencies: boolean;
		/**
		 * Literal name used to reference another database in the same server, if not using SQLCMD variables
		 */
		databaseLiteral?: string;
	}

	export interface AddSqlProjectReferenceParams extends AddUserDatabaseReferenceParams {
		/**
		 * Path to the referenced .sqlproj file
		 */
		projectPath: string;
		/**
		 * GUID for the referenced SQL project
		 */
		projectGuid: string;
	}

	export interface AddSystemDatabaseReferenceParams extends AddDatabaseReferenceParams {
		/**
		 * Type of system database
		 */
		systemDatabase: SystemDatabase;

		/**
	 * Type of reference - ArtifactReference or PackageReference
	 */
		referenceType: SystemDbReferenceType;
	}

	export interface AddNugetPackageReferenceParams extends AddUserDatabaseReferenceParams {
		/**
		 * NuGet package name
		 */
		packageName: string;

		/**
		 * NuGet package version
		 */
		packageVersion: string;
	}

	export interface AddUserDatabaseReferenceParams extends AddDatabaseReferenceParams {
		/**
		 * SQLCMD variable name for specifying the other database this reference is to, if different from that of the current project
		 */
		databaseVariable?: string;
		/**
		 * SQLCMD variable name for specifying the other server this reference is to, if different from that of the current project.
		 * If this is set, DatabaseVariable must also be set.
		 */
		serverVariable?: string;
	}

	export interface DeleteDatabaseReferenceParams extends SqlProjectParams {
		/**
		 * Name of the reference to be deleted.  Name of the System DB, path of the sqlproj, or path of the dacpac
		 */
		name: string;
	}

	export interface FolderParams extends SqlProjectParams {
		/**
		 * Path of the folder, typically relative to the .sqlproj file
		 */
		path: string;
	}

	export interface MoveFolderParams extends FolderParams {
		/**
		 * Path of the folder, typically relative to the .sqlproj file
		 */
		destinationPath: string;
	}

	export interface CreateSqlProjectParams extends SqlProjectParams {
		/**
		 * Type of SQL Project: SDK-style or Legacy
		 */
		sqlProjectType: ProjectType;
		/**
		 * Database schema provider for the project, in the format
		 * "Microsoft.Data.Tools.Schema.Sql.SqlXYZDatabaseSchemaProvider".
		 * Case sensitive.
		 */
		databaseSchemaProvider?: string;
		/**
		 * Version of the Microsoft.Build.Sql SDK for the project, if overriding the default
		 */
		buildSdkVersion?: string;
	}

	export interface AddSqlCmdVariableParams extends SqlProjectParams {
		/**
		 * Name of the SQLCMD variable
		 */
		name: string;
		/**
		 * Default value of the SQLCMD variable
		 */
		defaultValue: string;
	}

	export interface DeleteSqlCmdVariableParams extends SqlProjectParams {
		/**
		 * Name of the SQLCMD variable to be deleted
		 */
		name?: string;
	}

	export interface MoveItemParams extends SqlProjectScriptParams {
		/**
		 * Destination path of the file or folder, relative to the .sqlproj
		 */
		destinationPath: string;
	}

	export interface SetDatabaseSourceParams extends SqlProjectParams {
		/**
		 * Source of the database schema, used in telemetry
		 */
		databaseSource: string;
	}

	export interface SetDatabaseSchemaProviderParams extends SqlProjectParams {
		/**
		 * New DatabaseSchemaProvider value, in the form "Microsoft.Data.Tools.Schema.Sql.SqlXYZDatabaseSchemaProvider"
		 */
		databaseSchemaProvider: string;
	}

	//#endregion

	//#region Results

	export interface GetCrossPlatformCompatibilityResult extends ResultStatus {
		/**
		 * Whether the project is cross-platform compatible
		 */
		isCrossPlatformCompatible: boolean;
	}

	export interface GetProjectPropertiesResult extends ResultStatus {
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

	export interface GetDatabaseReferencesResult extends ResultStatus {
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

	export interface GetFoldersResult extends ResultStatus {
		/**
		 * Array of folders contained in the project
		 */
		folders: string[];
	}

	export interface GetSqlCmdVariablesResult extends ResultStatus {
		/**
		 * Array of SQLCMD variables contained in the project
		 */
		sqlCmdVariables: SqlCmdVariable[];
	}

	export interface GetScriptsResult extends ResultStatus {
		/**
		 * Array of scripts contained in the project
		 */
		scripts: string[];
	}

	//#endregion

	//#region Types

	export const enum ProjectType {
		SdkStyle = 0,
		LegacyStyle = 1
	}

	export const enum SystemDatabase {
		Master = 0,
		MSDB = 1
	}

	export const enum SystemDbReferenceType {
		ArtifactReference = 0,
		PackageReference = 1
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

	export interface SqlCmdVariable {
		varName: string;
		value: string;
		defaultValue: string
	}

	//#endregion

	//#endregion

	export interface ITreeNodeInfo extends vscode.TreeItem {
		readonly connectionInfo: IConnectionInfo;
		nodeType: string;
		metadata: ObjectMetadata;
		parentNode: ITreeNodeInfo;
	}

	export const enum MetadataType {
		Table = 0,
		View = 1,
		SProc = 2,
		Function = 3
	}

	export interface ObjectMetadata {
		metadataType: MetadataType;

		metadataTypeName: string;

		urn: string;

		name: string;

		schema: string;

		parentName?: string;

		parentTypeName?: string;
	}

	/**
	 * Parameters to initialize a connection to a database
	 */
	export interface ConnectionDetails {

		options: { [name: string]: any };
	}

	/**
	 * Namespace for Azure APIs
	 */
	export namespace azure {

		/**
		 * Namespace for Azure Subscriptions. Types from @azure/arm-subscriptions module
		 */
		export namespace subscription {
			/** Location information. */
			interface Location {
				/**
				 * The fully qualified ID of the location. For example, /subscriptions/00000000-0000-0000-0000-000000000000/locations/westus.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly id?: string;
				/**
				 * The subscription ID.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly subscriptionId?: string;
				/**
				 * The location name.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly name?: string;
				/**
				 * The display name of the location.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly displayName?: string;
				/**
				 * The latitude of the location.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly latitude?: string;
				/**
				 * The longitude of the location.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly longitude?: string;
			}

			/** Subscription information. */
			export interface Subscription {
				/**
				 * The fully qualified ID for the subscription. For example, /subscriptions/00000000-0000-0000-0000-000000000000.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly id?: string;
				/**
				 * The subscription ID.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly subscriptionId?: string;
				/**
				 * The subscription display name.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly displayName?: string;
				/**
				 * The subscription state. Possible values are Enabled, Warned, PastDue, Disabled, and Deleted.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly state?: SubscriptionState;
				/** The subscription policies. */
				subscriptionPolicies?: SubscriptionPolicies;
				/** The authorization source of the request. Valid values are one or more combinations of Legacy, RoleBased, Bypassed, Direct and Management. For example, 'Legacy, RoleBased'. */
				authorizationSource?: string;
			}

			/** Defines values for SubscriptionState. */
			export type SubscriptionState = 'Enabled' | 'Warned' | 'PastDue' | 'Disabled' | 'Deleted';


			/** Subscription policies. */
			export interface SubscriptionPolicies {
				/**
				 * The subscription location placement ID. The ID indicates which regions are visible for a subscription. For example, a subscription with a location placement Id of Public_2014-09-01 has access to Azure public regions.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly locationPlacementId?: string;
				/**
				 * The subscription quota ID.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly quotaId?: string;
				/**
				 * The subscription spending limit.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly spendingLimit?: SpendingLimit;
			}

			/** Defines values for SpendingLimit. */
			export type SpendingLimit = 'On' | 'Off' | 'CurrentPeriodOff';
		}

		/**
		 * Namespace for Azure resources. Types from @azure/arm-resources module
		 */
		export namespace resources {
			export interface ResourceGroup {
				/**
				 * The ID of the resource group.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly id?: string;
				/**
				 * The name of the resource group.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly name?: string;
				/**
				 * The type of the resource group.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly type?: string;
				/** The resource group properties. */
				properties?: ResourceGroupProperties;
				/** The location of the resource group. It cannot be changed after the resource group has been created. It must be one of the supported Azure locations. */
				location: string;
				/** The ID of the resource that manages this resource group. */
				managedBy?: string;
				/** The tags attached to the resource group. */
				tags?: {
					[propertyName: string]: string;
				};
			}

			/** The resource group properties. */
			export interface ResourceGroupProperties {
				/**
				 * The provisioning state.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly provisioningState?: string;
			}

			export interface ResourceGroup {
				/**
				 * The ID of the resource group.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly id?: string;
				/**
				 * The name of the resource group.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly name?: string;
				/**
				 * The type of the resource group.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly type?: string;
				/** The resource group properties. */
				properties?: ResourceGroupProperties;
				/** The location of the resource group. It cannot be changed after the resource group has been created. It must be one of the supported Azure locations. */
				location: string;
				/** The ID of the resource that manages this resource group. */
				managedBy?: string;
				/** The tags attached to the resource group. */
				tags?: {
					[propertyName: string]: string;
				};
			}

			/** The resource group properties. */
			export interface ResourceGroupProperties {
				/**
				 * The provisioning state.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly provisioningState?: string;
			}
		}

		/**
		 * Namespace for Azure SQL APIs. Types from @azure/arm-sql module
		 */
		export namespace sql {

			/** ARM resource. */
			export interface Resource {
				/**
				 * Resource ID.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly id?: string;
				/**
				 * Resource name.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly name?: string;
				/**
				 * Resource type.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly type?: string;
			}

			/** Azure Active Directory identity configuration for a resource. */
			export interface UserIdentity {
				/**
				 * The Azure Active Directory principal id.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly principalId?: string;
				/**
				 * The Azure Active Directory client id.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly clientId?: string;
			}

			/**
			 * Defines values for IdentityType. \
			 * {@link KnownIdentityType} can be used interchangeably with IdentityType,
			 *  this enum contains the known values that the service supports.
			 * ### Known values supported by the service
			 * **None** \
			 * **SystemAssigned** \
			 * **UserAssigned** \
			 * **SystemAssigned,UserAssigned**
			 */
			export type IdentityType = string;

			/** Azure Active Directory identity configuration for a resource. */
			export interface ResourceIdentity {
				/** The resource ids of the user assigned identities to use */
				userAssignedIdentities?: {
					[propertyName: string]: UserIdentity;
				};
				/**
				 * The Azure Active Directory principal id.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly principalId?: string;
				/** The identity type. Set this to 'SystemAssigned' in order to automatically create and assign an Azure Active Directory principal for the resource. */
				type?: IdentityType;
				/**
				 * The Azure Active Directory tenant id.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly tenantId?: string;
			}

			/** ARM tracked top level resource. */
			export type TrackedResource = Resource & {
				/** Resource location. */
				location: string;
				/** Resource tags. */
				tags?: {
					[propertyName: string]: string;
				};
			};

			/** An Azure SQL Database server. */
			export type Server = TrackedResource & {
				/** The Azure Active Directory identity of the server. */
				identity?: ResourceIdentity;
				/**
				 * Kind of sql server. This is metadata used for the Azure portal experience.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly kind?: string;
				/** Administrator username for the server. Once created it cannot be changed. */
				administratorLogin?: string;
				/** The administrator login password (required for server creation). */
				administratorLoginPassword?: string;
				/** The version of the server. */
				version?: string;
				/**
				 * The state of the server.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly state?: string;
				/**
				 * The fully qualified domain name of the server.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly fullyQualifiedDomainName?: string;
				/**
				 * List of private endpoint connections on a server
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly privateEndpointConnections?: ServerPrivateEndpointConnection[];
				/** Minimal TLS version. Allowed values: '1.0', '1.1', '1.2' */
				minimalTlsVersion?: string;
				/** Whether or not public endpoint access is allowed for this server.  Value is optional but if passed in, must be 'Enabled' or 'Disabled' */
				publicNetworkAccess?: ServerNetworkAccessFlag;
				/**
				 * Whether or not existing server has a workspace created and if it allows connection from workspace
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly workspaceFeature?: ServerWorkspaceFeature;
				/** The resource id of a user assigned identity to be used by default. */
				primaryUserAssignedIdentityId?: string;
				/** The Client id used for cross tenant CMK scenario */
				federatedClientId?: string;
				/** A CMK URI of the key to use for encryption. */
				keyId?: string;
				/** The Azure Active Directory identity of the server. */
				administrators?: ServerExternalAdministrator;
				/** Whether or not to restrict outbound network access for this server.  Value is optional but if passed in, must be 'Enabled' or 'Disabled' */
				restrictOutboundNetworkAccess?: ServerNetworkAccessFlag;
			};

			/** A private endpoint connection under a server */
			export interface ServerPrivateEndpointConnection {
				/**
				 * Resource ID.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly id?: string;
				/**
				 * Private endpoint connection properties
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly properties?: PrivateEndpointConnectionProperties;
			}

			/**
			 * Defines values for ServerNetworkAccessFlag. \
			 * {@link KnownServerNetworkAccessFlag} can be used interchangeably with ServerNetworkAccessFlag,
			 *  this enum contains the known values that the service supports.
			 * ### Known values supported by the service
			 * **Enabled** \
			 * **Disabled**
			 */
			export type ServerNetworkAccessFlag = string;

			/**
			* Defines values for ServerWorkspaceFeature. \
			* {@link KnownServerWorkspaceFeature} can be used interchangeably with ServerWorkspaceFeature,
			*  this enum contains the known values that the service supports.
			* ### Known values supported by the service
			* **Connected** \
			* **Disconnected**
			*/
			export type ServerWorkspaceFeature = string;

			/** Properties of a active directory administrator. */
			export interface ServerExternalAdministrator {
				/** Type of the sever administrator. */
				administratorType?: AdministratorType;
				/** Principal Type of the sever administrator. */
				principalType?: PrincipalType;
				/** Login name of the server administrator. */
				login?: string;
				/** SID (object ID) of the server administrator. */
				sid?: string;
				/** Tenant ID of the administrator. */
				tenantId?: string;
				/** Azure Active Directory only Authentication enabled. */
				azureADOnlyAuthentication?: boolean;
			}


			/** Properties of a private endpoint connection. */
			export interface PrivateEndpointConnectionProperties {
				/** Private endpoint which the connection belongs to. */
				privateEndpoint?: PrivateEndpointProperty;
				/** Connection state of the private endpoint connection. */
				privateLinkServiceConnectionState?: PrivateLinkServiceConnectionStateProperty;
				/**
				 * State of the private endpoint connection.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly provisioningState?: PrivateEndpointProvisioningState;
			}

			/**
			 * Defines values for AdministratorType. \
			 * {@link KnownAdministratorType} can be used interchangeably with AdministratorType,
			 *  this enum contains the known values that the service supports.
			 * ### Known values supported by the service
			 * **ActiveDirectory**
			 */
			export type AdministratorType = string;

			/**
			* Defines values for PrincipalType. \
			* {@link KnownPrincipalType} can be used interchangeably with PrincipalType,
			*  this enum contains the known values that the service supports.
			* ### Known values supported by the service
			* **User** \
			* **Group** \
			* **Application**
			*/
			export type PrincipalType = string;

			export interface PrivateEndpointProperty {
				/** Resource id of the private endpoint. */
				id?: string;
			}

			export interface PrivateLinkServiceConnectionStateProperty {
				/** The private link service connection status. */
				status: PrivateLinkServiceConnectionStateStatus;
				/** The private link service connection description. */
				description: string;
				/**
				 * The actions required for private link service connection.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */
				readonly actionsRequired?: PrivateLinkServiceConnectionStateActionsRequire;
			}

			/**
			 * Defines values for PrivateEndpointProvisioningState. \
			 * {@link KnownPrivateEndpointProvisioningState} can be used interchangeably with PrivateEndpointProvisioningState,
			 *  this enum contains the known values that the service supports.
			 * ### Known values supported by the service
			 * **Approving** \
			 * **Ready** \
			 * **Dropping** \
			 * **Failed** \
			 * **Rejecting**
			 */
			export type PrivateEndpointProvisioningState = string;

			/**
			* Defines values for PrivateLinkServiceConnectionStateStatus. \
			* {@link KnownPrivateLinkServiceConnectionStateStatus} can be used interchangeably with PrivateLinkServiceConnectionStateStatus,
			*  this enum contains the known values that the service supports.
			* ### Known values supported by the service
			* **Approved** \
			* **Pending** \
			* **Rejected** \
			* **Disconnected**
			*/
			export type PrivateLinkServiceConnectionStateStatus = string;

			/**
			 * Defines values for PrivateLinkServiceConnectionStateActionsRequire. \
			 * {@link KnownPrivateLinkServiceConnectionStateActionsRequire} can be used interchangeably with PrivateLinkServiceConnectionStateActionsRequire,
			 *  this enum contains the known values that the service supports.
			 * ### Known values supported by the service
			 * **None**
			 */
			export type PrivateLinkServiceConnectionStateActionsRequire = string;

			export interface PrivateLinkServiceConnectionStateProperty {
				/** The private link service connection status. */
				status: PrivateLinkServiceConnectionStateStatus;
				/** The private link service connection description. */
				description: string;
				/**
				 * The actions required for private link service connection.
				 * NOTE: This property will not be serialized. It can only be populated by the server.
				 */

				readonly actionsRequired?: PrivateLinkServiceConnectionStateActionsRequire;
			}
		}
	}
}
