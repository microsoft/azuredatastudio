/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import * as utils from './utils';
import * as constants from './constants';
import * as azureFunctionsContracts from '../contracts/azureFunctions/azureFunctionsContracts';
import { BindingType, IConnectionStringInfo, ObjectType } from 'sql-bindings';
import { ConnectionDetails, IConnectionInfo } from 'vscode-mssql';
// https://github.com/microsoft/vscode-azurefunctions/blob/main/src/vscode-azurefunctions.api.d.ts
import { AzureFunctionsExtensionApi } from '../../../types/vscode-azurefunctions.api';
// https://github.com/microsoft/vscode-azuretools/blob/main/ui/api.d.ts
import { AzureExtensionApiProvider } from '../../../types/vscode-azuretools.api';
/**
 * Represents the settings in an Azure function project's locawl.settings.json file
 */
export interface ILocalSettingsJson {
	IsEncrypted?: boolean;
	Values?: { [key: string]: string };
	Host?: { [key: string]: string };
	ConnectionStrings?: { [key: string]: string };
}

export interface IFileFunctionObject {
	filePromise: Promise<string>;
	watcherDisposable: vscode.Disposable;
}

/**
 * copied and modified from vscode-azurefunctions extension
 * https://github.com/microsoft/vscode-azurefunctions/blob/main/src/funcConfig/local.settings.ts
 * @param localSettingsPath full path to local.settings.json
 * @returns settings in local.settings.json. If no settings are found, returns default "empty" settings
 */
export async function getLocalSettingsJson(localSettingsPath: string): Promise<ILocalSettingsJson> {
	if (await utils.exists(localSettingsPath)) {
		const data: string = (fs.readFileSync(localSettingsPath)).toString();
		try {
			return JSON.parse(data);
		} catch (error) {
			console.log(error);
			throw new Error(constants.failedToParse(constants.azureFunctionLocalSettingsFileName, error));
		}
	}
	return {
		IsEncrypted: false // Include this by default otherwise the func cli assumes settings are encrypted and fails to run
	};
}

/**
 * Adds a new setting to a project's local.settings.json file
 * modified from setLocalAppSetting code from vscode-azurefunctions extension
 * @param projectFolder full path to project folder
 * @param key Key of the new setting
 * @param value Value of the new setting
 * @returns true if successful adding the new setting, false if unsuccessful
 */
export async function setLocalAppSetting(projectFolder: string, key: string, value: string): Promise<boolean> {
	const localSettingsPath: string = path.join(projectFolder, constants.azureFunctionLocalSettingsFileName);
	const settings: ILocalSettingsJson = await getLocalSettingsJson(localSettingsPath);

	settings.Values = settings.Values || {};
	if (settings.Values[key] === value) {
		// don't do anything if it's the same as the existing value
		return true;
	} else if (settings.Values[key]) {
		const result = await vscode.window.showWarningMessage(constants.settingAlreadyExists(key), { modal: true }, constants.yesString);
		if (result !== constants.yesString) {
			// key already exists and user doesn't want to overwrite it
			return false;
		}
	}

	settings.Values[key] = value;
	await fs.promises.writeFile(localSettingsPath, JSON.stringify(settings, undefined, 2));
	return true;
}

/**
 * Gets the Azure Functions extension API if it is installed
 * if it is not installed, prompt the user to install directly, learn more, or do not install
 * @returns the Azure Functions extension API if it is installed, prompt if it is not installed
 */
export async function getAzureFunctionsExtensionApi(): Promise<AzureFunctionsExtensionApi | undefined> {
	let apiProvider = await vscode.extensions.getExtension(constants.azureFunctionsExtensionName)?.activate() as AzureExtensionApiProvider;
	if (!apiProvider) {
		const response = await vscode.window.showInformationMessage(constants.azureFunctionsExtensionNotFound,
			constants.install, constants.learnMore, constants.doNotInstall);
		if (response === constants.install) {
			const extensionInstalled = new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(async () => {
					reject(new Error(constants.timeoutExtensionError));
					extensionChange.dispose();
				}, 10000);
				let extensionChange = vscode.extensions.onDidChange(async () => {
					if (vscode.extensions.getExtension(constants.azureFunctionsExtensionName)) {
						resolve();
						extensionChange.dispose();
						clearTimeout(timeout);
					}
				});
			});
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: constants.azureFunctionsExtensionName,
					cancellable: false
				}, async (_progress, _token) => {
					await vscode.commands.executeCommand('workbench.extensions.installExtension', constants.azureFunctionsExtensionName);
				}
			);
			// the extension has not been notified that the azure function extension is installed so wait till it is to then activate it
			await extensionInstalled;
			apiProvider = await vscode.extensions.getExtension(constants.azureFunctionsExtensionName)?.activate() as AzureExtensionApiProvider;
		} else if (response === constants.learnMore) {
			await vscode.env.openExternal(vscode.Uri.parse(constants.linkToAzureFunctionExtension));
			return undefined;
		} else {
			return undefined;
		}
	}
	const azureFunctionApi = apiProvider.getApi<AzureFunctionsExtensionApi>('^1.8.0');
	if (azureFunctionApi) {
		return azureFunctionApi;
	} else {
		void vscode.window.showErrorMessage(constants.azureFunctionsExtensionNotInstalled);
		return undefined;
	}
}

/**
 * Gets the azure function project for the user to choose from a list of projects files
 * If only one project is found that project is used to add the binding to
 * if no project is found, user is informed there needs to be a C# Azure Functions project
 * @returns the selected project file path
 */
export async function getAzureFunctionProject(): Promise<string | undefined> {
	let selectedProjectFile: string | undefined = '';
	if (vscode.workspace.workspaceFolders === undefined || vscode.workspace.workspaceFolders.length === 0) {
		return selectedProjectFile;
	} else {
		const projectFiles = await getAzureFunctionProjectFiles();
		if (projectFiles !== undefined) {
			if (projectFiles.length > 1) {
				// select project to add azure function to
				selectedProjectFile = (await vscode.window.showQuickPick(projectFiles, {
					canPickMany: false,
					title: constants.selectProject,
					ignoreFocusOut: true
				}));
				return selectedProjectFile;
			} else if (projectFiles.length === 1) {
				// only one azure function project found
				return projectFiles[0];
			}
		}
		return undefined;
	}
}

/**
 * Gets the azure function project files based on the host file found in the same folder
 * @returns the azure function project files paths
 */
export async function getAzureFunctionProjectFiles(): Promise<string[] | undefined> {
	let projFiles: string[] = [];
	const hostFiles = await getHostFiles();
	if (!hostFiles) {
		return undefined;
	}
	for (let host of hostFiles) {
		let projectFile = await vscode.workspace.findFiles(new vscode.RelativePattern(path.dirname(host), '*.csproj'));
		projectFile.filter(file => path.dirname(file.fsPath) === path.dirname(host) ? projFiles.push(file?.fsPath) : projFiles);
	}
	return projFiles.length > 0 ? projFiles : undefined;
}

/**
 * Gets the host files from the workspace
 * @returns the host file paths
 */
export async function getHostFiles(): Promise<string[] | undefined> {
	const hostUris = await vscode.workspace.findFiles('**/host.json');
	const hostFiles = hostUris.map(uri => uri.fsPath);
	return hostFiles.length > 0 ? hostFiles : undefined;
}

/**
 * Gets the local.settings.json file path
 * @param projectFolder The path to the project the setting should be added to
 * @returns the local.settings.json file path
 */
export async function getSettingsFile(projectFolder: string): Promise<string | undefined> {
	return path.join(projectFolder, 'local.settings.json');
}

/**
 * New azure function file watcher and watcher disposable to be used to watch for changes to the azure function project
 * @param projectFolder is the parent directory to the project file
 * @returns the function file path once created and the watcher disposable
 */
export function waitForNewFunctionFile(projectFolder: string): IFileFunctionObject {
	const watcher = vscode.workspace.createFileSystemWatcher((
		new vscode.RelativePattern(projectFolder, '**/*.cs')), false, true, true);
	const filePromise = new Promise<string>((resolve, _) => {
		watcher.onDidCreate((e) => {
			resolve(e.fsPath);
		});
	});
	return {
		filePromise,
		watcherDisposable: watcher
	};
}

/**
 * Retrieves the new host project file once it has created and the watcher disposable
 * @returns the host file path once created and the watcher disposable
 */
export function waitForNewHostFile(): IFileFunctionObject {
	const watcher = vscode.workspace.createFileSystemWatcher('**/host.json', false, true, true);
	const filePromise = new Promise<string>((resolve, _) => {
		watcher.onDidCreate((e) => {
			resolve(e.fsPath);
		});
	});
	return {
		filePromise,
		watcherDisposable: watcher
	};
}

/**
 * Adds the required nuget package to the project
 * @param selectedProjectFile is the users selected project file path
 */
export async function addSqlNugetReferenceToProjectFile(selectedProjectFile: string): Promise<void> {
	await utils.executeCommand(`dotnet add "${selectedProjectFile}" package ${constants.sqlExtensionPackageName} --prerelease`);
}

/**
 * Adds the Sql Connection String to the local.settings.json
 * @param connectionString of the SQL Server connection that was chosen by the user
 * @param projectFolder The path to the project the setting should be added to
 * @param settingName The name of the setting to add to the local.settings.json
 */
export async function addConnectionStringToConfig(connectionString: string, projectFolder: string, settingName: string = constants.sqlConnectionStringSetting): Promise<void> {
	const settingsFile = await getSettingsFile(projectFolder);
	if (settingsFile) {
		await setLocalAppSetting(path.dirname(settingsFile), settingName, connectionString);
	}
}

/**
 * Gets the Azure Functions project that contains the given file if the project is open in one of the workspace folders
 * @param fileUri file that the containing project needs to be found for
 * @returns uri of project or undefined if project couldn't be found
 */
export async function getAFProjectContainingFile(fileUri: vscode.Uri): Promise<vscode.Uri | undefined> {
	// get functions csprojs in the workspace
	const projectPromises = vscode.workspace.workspaceFolders?.map(f => utils.getAllProjectsInFolder(f.uri, '.csproj')) ?? [];
	const functionsProjects = (await Promise.all(projectPromises)).reduce((prev, curr) => prev.concat(curr), []).filter(p => isFunctionProject(path.dirname(p.fsPath)));

	// look for project folder containing file if there's more than one
	if (functionsProjects.length > 1) {
		// TODO: figure out which project contains the file
		// the new style csproj doesn't list all the files in the project anymore, unless the file isn't in the same folder
		// so we can't rely on using that to check
		console.error('need to find which project contains the file ' + fileUri.fsPath);
		return undefined;
	} else if (functionsProjects.length === 0) {
		throw new Error(constants.noAzureFunctionsProjectsInWorkspace);
	} else {
		return functionsProjects[0];
	}
}

// Use 'host.json' as an indicator that this is a functions project
// copied from verifyIsproject.ts in vscode-azurefunctions extension
export async function isFunctionProject(folderPath: string): Promise<boolean> {
	return await utils.exists(path.join(folderPath, constants.hostFileName));
}

/**
 * Prompts the user to select type of binding and returns result
 * @param objectType (Optional) The type of object user choose to insert/upsert into
 * @param funcName (Optional) Name of the function to which we are adding the SQL Binding
 * @returns binding type or undefined if the user cancelled out of the prompt
 */
export async function promptForBindingType(objectType?: ObjectType, funcName?: string): Promise<BindingType | undefined> {
	// check to see if objectType is view
	let isView = (objectType === ObjectType.View);
	const inputOutputItems: (vscode.QuickPickItem & { type: BindingType })[] = [
		{
			label: constants.input,
			description: constants.inputDescription,
			type: BindingType.input
		},
		{
			label: constants.output,
			description: constants.outputDescription,
			type: BindingType.output
		}
	];

	// view can only be used with input binding
	const selectedBinding = isView ? { type: BindingType.input } : (await vscode.window.showQuickPick(inputOutputItems, {
		canPickMany: false,
		title: constants.selectBindingType(funcName),
		ignoreFocusOut: true
	}));

	return selectedBinding?.type;
}

/**
 * Prompts the user to select to use a table or view as the object to query/upsert into
 */
export async function promptForObjectType(): Promise<ObjectType | undefined> {
	const objectTypes: (vscode.QuickPickItem & { type: ObjectType })[] =
		[{ label: constants.table, type: ObjectType.Table }, { label: constants.view, type: ObjectType.View }];
	const selectedObjectType = (await vscode.window.showQuickPick(objectTypes, {
		canPickMany: false,
		title: constants.selectSqlTableOrViewPrompt,
		ignoreFocusOut: true
	}));

	return selectedObjectType?.type;
}

/**
 * Prompts the user to enter object name for the SQL query
 * @param bindingType Type of SQL Binding
 * @param connectionInfo (optional) connection info from the selected connection profile
 * if left undefined we prompt to manually enter the object name
 * @param objectType (optional) type of object to query/upsert into
 * @returns the object name from user's input or menu choice
 */
export async function promptForObjectName(bindingType: BindingType, connectionInfo?: IConnectionInfo, objectType?: ObjectType): Promise<string | undefined> {
	// show the connection string methods (user input and connection profile options)
	let connectionURI: string | undefined;
	let selectedDatabase: string | undefined;

	if (!connectionInfo) {
		// prompt is shown when user selects an existing connection string setting
		// or manually enters a connection string
		return promptToManuallyEnterObjectName(bindingType);
	}

	// Prompt user to select a table/view based on connection profile and selected database
	// get connectionURI and selectedDatabase to be used for listing tables/view query request
	connectionURI = await getConnectionURI(connectionInfo);
	if (!connectionURI) {
		// mssql connection error
		return undefined;
	}
	selectedDatabase = await promptSelectDatabase(connectionURI);
	if (!selectedDatabase) {
		// User cancelled
		return undefined;
	}

	connectionInfo.database = selectedDatabase;

	let selectedObjectName = await promptSelectObject(connectionURI, bindingType, selectedDatabase, objectType);

	return selectedObjectName;
}

/**
 * Prompts the user to enter connection setting and updates it from AF project
 * @param projectUri Azure Function project uri
 * @param connectionInfo (optional) connection info from the user to update the connection string,
 * if left undefined we prompt the user for the connection info
 * @returns connection string setting name to be used for the createFunction API
 */
export async function promptAndUpdateConnectionStringSetting(projectUri: vscode.Uri | undefined, connectionInfo?: IConnectionInfo): Promise<IConnectionStringInfo | undefined> {
	let connectionStringSettingName: string | undefined;

	// show the settings from project's local.settings.json if there's an AF functions project
	if (projectUri) {
		// get existing connection string settings from project's local.settings.json file
		// if an error occurs getLocalSettingsJson will throw an error
		let existingSettings = await getLocalSettingsJson(path.join(path.dirname(projectUri.fsPath!), constants.azureFunctionLocalSettingsFileName));

		// setup connection string setting quickpick
		let connectionStringSettings: (vscode.QuickPickItem)[] = [];
		let hasNonFilteredSettings: boolean = false;
		if (existingSettings?.Values && Object.keys(existingSettings?.Values!).length > 0) {
			// add settings found in local.settings.json to quickpick list
			connectionStringSettings = Object.keys(existingSettings.Values).filter(setting => !constants.knownSettings.includes(setting)).map(setting => { return { label: setting }; });
			// set boolean to true if there are non-filtered settings
			hasNonFilteredSettings = connectionStringSettings.length > 0;
		}

		// add create new setting option to quickpick list
		connectionStringSettings.unshift({ label: constants.createNewLocalAppSettingWithIcon });

		while (!connectionStringSettingName) {
			let selectedSetting: vscode.QuickPickItem | undefined;
			// prompt user to select a setting from the list or create a new one
			// only if there are existing setting values are found and has non-filtered settings
			if (hasNonFilteredSettings) {
				selectedSetting = await vscode.window.showQuickPick(connectionStringSettings, {
					canPickMany: false,
					title: constants.selectSetting,
					ignoreFocusOut: true
				});
				if (!selectedSetting) {
					// User cancelled
					return;
				}
			}

			// prompt user to enter connection string setting name if user selects create new setting or there is no existing settings in local.settings.json
			if (selectedSetting?.label === constants.createNewLocalAppSettingWithIcon || !hasNonFilteredSettings) {
				let sqlConnectionStringSettingExists = connectionStringSettings.find(s => s.label === constants.sqlConnectionStringSetting);
				// prompt user to enter connection string setting name manually
				const newConnectionStringSettingName = await vscode.window.showInputBox(
					{
						title: constants.enterConnectionStringSettingName,
						ignoreFocusOut: true,
						value: sqlConnectionStringSettingExists ? '' : constants.sqlConnectionStringSetting,
						validateInput: input => input ? undefined : constants.nameMustNotBeEmpty
					}
				) ?? '';

				if (!newConnectionStringSettingName && hasNonFilteredSettings) {
					// go back to select setting quickpick if user escapes from entering in the connection string setting name
					// only go back if there are existing settings in local.settings.json
					continue;
				} else if (!newConnectionStringSettingName && !hasNonFilteredSettings) {
					// User cancelled out of the manually enter connection string prompt
					return;
				}

				let selectedConnectionStringMethod: string | undefined;
				let connectionString: string | undefined = '';
				while (true) {
					try {
						const projectFolder: string = path.dirname(projectUri.fsPath);
						const localSettingsPath: string = path.join(projectFolder, constants.azureFunctionLocalSettingsFileName);

						if (!connectionInfo) {
							const listOfConnectionStringMethods = [constants.connectionProfile, constants.userConnectionString];
							// show the connection string methods (user input and connection profile options)
							selectedConnectionStringMethod = await vscode.window.showQuickPick(listOfConnectionStringMethods, {
								canPickMany: false,
								title: constants.selectConnectionString,
								ignoreFocusOut: true
							});
							if (!selectedConnectionStringMethod) {
								// User cancelled
								return;
							}
							if (selectedConnectionStringMethod === constants.userConnectionString) {
								// prompt user to enter connection string manually
								connectionString = await vscode.window.showInputBox(
									{
										title: constants.enterConnectionString,
										ignoreFocusOut: true,
										value: 'Server=localhost;Initial Catalog={db_name};User ID=sa;Password={your_password};Persist Security Info=False',
										validateInput: input => input ? undefined : constants.valueMustNotBeEmpty
									}
								) ?? '';
								if (!connectionString) {
									// User cancelled
									// we can prompt for connection string methods again
									continue;
								}
							} else {
								// Let user choose from existing connections to create connection string from
								const vscodeMssqlApi = await utils.getVscodeMssqlApi();
								connectionInfo = await vscodeMssqlApi.promptForConnection(true);
							}
						}
						if (selectedConnectionStringMethod !== constants.userConnectionString) {
							if (!connectionInfo) {
								// User cancelled return to selectedConnectionStringMethod prompt
								continue;
							}
							// get the connection string including prompts for password if needed
							connectionString = await promptConnectionStringPasswordAndUpdateConnectionString(connectionInfo, localSettingsPath);
						}
						if (!connectionString) {
							// user cancelled the prompts
							return;
						}
						const success = await setLocalAppSetting(projectFolder, newConnectionStringSettingName, connectionString);
						if (success) {
							// exit both loops and insert binding
							connectionStringSettingName = newConnectionStringSettingName;
							break;
						} else {
							void vscode.window.showErrorMessage(constants.failedToSetSetting());
						}

					} catch (e) {
						// display error message and show select setting quickpick again
						void vscode.window.showErrorMessage(constants.failedToSetSetting(e));
						continue;
					}
				}
			} else {
				// If user cancels out of this or doesn't want to overwrite an existing setting
				// just return them to the select setting quickpick in case they changed their mind
				connectionStringSettingName = selectedSetting?.label;
			}
		}
		// Add sql extension package reference to project. If the reference is already there, it doesn't get added again
		await addSqlNugetReferenceToProjectFile(projectUri.fsPath);
	} else {
		// if no AF project was found or there's more than one AF functions project in the workspace,
		// ask for the user to input the setting name
		connectionStringSettingName = await vscode.window.showInputBox({
			prompt: constants.connectionStringSetting,
			placeHolder: constants.connectionStringSettingPlaceholder,
			ignoreFocusOut: true
		});
	}
	return { connectionStringSettingName: connectionStringSettingName!, connectionInfo: connectionInfo };
}

/**
 * Prompts the user to include password in the connection string and updates the connection string based on user input
 * @param connectionInfo connection info from the connection profile user selected
 * @param localSettingsPath path to the local.settings.json file
 * @returns the updated connection string based on password prompts
 */
export async function promptConnectionStringPasswordAndUpdateConnectionString(connectionInfo: IConnectionInfo, localSettingsPath: string): Promise<string | undefined> {
	let includePassword: string | undefined;
	let connectionString: string = '';
	let connectionDetails: ConnectionDetails;
	let userPassword: string | undefined;
	const vscodeMssqlApi = await utils.getVscodeMssqlApi();
	connectionDetails = { options: connectionInfo };

	try {
		if (connectionInfo.authenticationType === 'SqlLogin' && connectionInfo.password) {
			// Prompt to include password in connection string if authentication type is SqlLogin and connection has password saved
			includePassword = await vscode.window.showQuickPick([constants.yesString, constants.noString], {
				title: constants.includePassword,
				canPickMany: false,
				ignoreFocusOut: true
			});
			if (includePassword === constants.yesString) {
				// get connection string to include password
				connectionString = await vscodeMssqlApi.getConnectionString(connectionDetails, true, false);
			}
		}

		if (includePassword !== constants.yesString || !connectionInfo.password || connectionInfo.authenticationType !== 'SqlLogin') {
			// get connection string to not include the password if connection info does not include password,
			// or user chooses to not include password (or if user cancels out of include password prompt), or authentication type is not SQL login
			connectionString = await vscodeMssqlApi.getConnectionString(connectionDetails, false, false);

			if (connectionInfo.authenticationType !== 'SqlLogin') {
				// temporarily fix until STS is fix to not include the placeholder: https://github.com/microsoft/sqltoolsservice/issues/1508
				// if authentication type is not SQL login, remove password in connection string
				connectionString = connectionString.replace(`Password=${constants.passwordPlaceholder};`, '');
			}

			if (!connectionInfo.password && connectionInfo.authenticationType === 'SqlLogin') {
				// if a connection exists but does not have password saved we ask user if they would like to enter it and save it in local.settings.json
				userPassword = await vscode.window.showInputBox({
					prompt: constants.enterPasswordPrompt,
					ignoreFocusOut: true,
					password: true,
					validateInput: input => input ? undefined : constants.valueMustNotBeEmpty
				});
				if (userPassword) {
					// if user enters password replace password placeholder with user entered password
					connectionString = connectionString.replace(constants.passwordPlaceholder, userPassword);
				}
			}

			if (!userPassword && connectionInfo.authenticationType === 'SqlLogin') {
				// show warning message that user will have to enter password manually later in local.settings.json
				// if they choose to not to include password, if connection info does not include password
				void vscode.window.showWarningMessage(constants.userPasswordLater, constants.openFile, constants.closeButton).then(async (result) => {
					if (result === constants.openFile) {
						// open local.settings.json file (if it exists)
						void vscode.commands.executeCommand(constants.vscodeOpenCommand, vscode.Uri.file(localSettingsPath));
					}
				});
			}
		}

		return connectionString;
	} catch (e) {
		// failed to get connection string for selected connection and will go back to prompt for connection string methods
		console.warn(e);
		void vscode.window.showErrorMessage(constants.failedToGetConnectionString);
		return undefined;
	}
}

export async function promptSelectDatabase(connectionURI: string): Promise<string | undefined> {
	const vscodeMssqlApi = await utils.getVscodeMssqlApi();

	let listDatabases = await vscodeMssqlApi.listDatabases(connectionURI);
	const selectedDatabase = (await vscode.window.showQuickPick(listDatabases, {
		canPickMany: false,
		title: constants.selectDatabase,
		ignoreFocusOut: true
	}));

	if (!selectedDatabase) {
		// User cancelled
		return undefined;
	}
	return selectedDatabase;
}

export async function getConnectionURI(connectionInfo: IConnectionInfo): Promise<string | undefined> {
	const vscodeMssqlApi = await utils.getVscodeMssqlApi();
	let connectionURI: string = '';
	try {
		connectionURI = await vscodeMssqlApi.connect(connectionInfo);
	} catch (e) {
		// mssql connection error will be shown to the user
		return undefined;
	}

	return connectionURI;
}

export async function promptSelectObject(connectionURI: string, bindingType: BindingType, selectedDatabase: string, objectType?: string): Promise<string | undefined> {
	const vscodeMssqlApi = await utils.getVscodeMssqlApi();
	let isView = (objectType === ObjectType.View);

	const userObjectName = isView ? constants.enterViewName : bindingType === BindingType.input ? constants.enterTableName : constants.enterTableNameToUpsert;

	// Create query to get list of tables or views from selected database
	let listQuery = isView ? viewsQuery(selectedDatabase) : tablesQuery(selectedDatabase);
	const params = { ownerUri: connectionURI, queryString: listQuery };
	let queryResult: azureFunctionsContracts.SimpleExecuteResult | undefined;

	// send SimpleExecuteRequest query to STS to get list of schema and tables based on the connection profile and database of the user
	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: isView ? constants.viewListProgressTitle : constants.tableListProgressTitle,
			cancellable: false
		}, async (_progress, _token) => {
			queryResult = await vscodeMssqlApi.sendRequest(azureFunctionsContracts.SimpleExecuteRequest.type, params);
		}
	);

	// Get schema and table/view names from query result rows
	const objectNames = queryResult!.rows.map(r => r[0].displayValue);
	// add manual entry option to object names list for user to choose from as well (with pencil icon)
	let manuallyEnterObjectName = constants.manuallyEnterObjectName(userObjectName);
	objectNames.unshift(manuallyEnterObjectName);
	// prompt user to select object from list of objects
	while (true) {
		let selectedObject = await vscode.window.showQuickPick(objectNames, {
			canPickMany: false,
			title: isView ? constants.selectView : constants.selectTable,
			ignoreFocusOut: true
		});

		if (selectedObject === manuallyEnterObjectName) {
			selectedObject = await promptToManuallyEnterObjectName(bindingType);
			if (!selectedObject) {
				// user cancelled so we will show the tables prompt again
				continue;
			}
		}

		return selectedObject;
	}
}

export function tablesQuery(selectedDatabase: string): string {
	let quotedDatabase = '[' + utils.escapeClosingBrackets(selectedDatabase) + ']';
	return `SELECT CONCAT(QUOTENAME(table_schema),'.',QUOTENAME(table_name)) from ${quotedDatabase}.INFORMATION_SCHEMA.TABLES where TABLE_TYPE = 'BASE TABLE'`;
}

export function viewsQuery(selectedDatabase: string): string {
	let quotedDatabase = '[' + utils.escapeClosingBrackets(selectedDatabase) + ']';
	return `SELECT CONCAT(QUOTENAME(table_schema),'.',QUOTENAME(table_name)) from ${quotedDatabase}.INFORMATION_SCHEMA.VIEWS;`;
}

export async function promptToManuallyEnterObjectName(bindingType: BindingType): Promise<string | undefined> {
	// user manually enters table or view to query or upsert into
	let selectedObject = await vscode.window.showInputBox({
		prompt: bindingType === BindingType.input ? constants.sqlObjectToQuery : constants.sqlTableToUpsert,
		placeHolder: constants.placeHolderObject,
		validateInput: input => input ? undefined : constants.nameMustNotBeEmpty,
		ignoreFocusOut: true
	});
	return selectedObject;
}
