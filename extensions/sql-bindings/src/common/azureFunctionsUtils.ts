/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import * as utils from './utils';
import * as constants from './constants';
import { BindingType } from 'sql-bindings';
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
	if (fs.existsSync(localSettingsPath)) {
		const data: string = (fs.readFileSync(localSettingsPath)).toString();
		try {
			return JSON.parse(data);
		} catch (error) {
			console.log(error);
			throw new Error(utils.formatString(constants.failedToParse(error.message), constants.azureFunctionLocalSettingsFileName, error.message));
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
	void fs.promises.writeFile(localSettingsPath, JSON.stringify(settings, undefined, 2));

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
	const azureFunctionApi = apiProvider.getApi<AzureFunctionsExtensionApi>('*');
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
 * @param projectFile path of the azure function project
 * @returns the local.settings.json file path
 */
export async function getSettingsFile(projectFile: string): Promise<string | undefined> {
	return path.join(path.dirname(projectFile), 'local.settings.json');
}

/**
 * Retrieves the new function file once the file is created and the watcher disposable
 * @param projectFile is the path to the project file
 * @returns the function file path once created and the watcher disposable
 */
export function waitForNewFunctionFile(projectFile: string): IFileFunctionObject {
	const watcher = vscode.workspace.createFileSystemWatcher((
		path.dirname(projectFile), '**/*.cs'), false, true, true);
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
export async function addNugetReferenceToProjectFile(selectedProjectFile: string): Promise<void> {
	await utils.executeCommand(`dotnet add ${selectedProjectFile} package ${constants.sqlExtensionPackageName} --prerelease`);
}

/**
 * Adds the Sql Connection String to the local.settings.json
 * @param connectionString of the SQL Server connection that was chosen by the user
 */
export async function addConnectionStringToConfig(connectionString: string, projectFile: string): Promise<void> {
	const settingsFile = await getSettingsFile(projectFile);
	if (settingsFile) {
		await setLocalAppSetting(path.dirname(settingsFile), constants.sqlConnectionStringSetting, connectionString);
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
	return fs.existsSync(path.join(folderPath, constants.hostFileName));
}

/**
 * Prompts the user to select type of binding and returns result
 */
export async function promptForBindingType(): Promise<(vscode.QuickPickItem & { type: BindingType }) | undefined> {
	const inputOutputItems: (vscode.QuickPickItem & { type: BindingType })[] = [
		{
			label: constants.input,
			type: BindingType.input
		},
		{
			label: constants.output,
			type: BindingType.output
		}
	];

	const selectedBinding = (await vscode.window.showQuickPick(inputOutputItems, {
		canPickMany: false,
		title: constants.selectBindingType,
		ignoreFocusOut: true
	}));

	return selectedBinding;
}

/**
 * Prompts the user to enter object name for the SQL query
 * @param bindingType Type of SQL Binding
 */
export async function promptForObjectName(bindingType: BindingType): Promise<string | undefined> {
	return vscode.window.showInputBox({
		prompt: bindingType === BindingType.input ? constants.sqlTableOrViewToQuery : constants.sqlTableToUpsert,
		placeHolder: constants.placeHolderObject,
		validateInput: input => input ? undefined : constants.nameMustNotBeEmpty,
		ignoreFocusOut: true
	});
}

/**
 * Prompts the user to enter connection setting and updates it from AF project
 * @param projectUri Azure Function project uri
 */
export async function promptAndUpdateConnectionStringSetting(projectUri: vscode.Uri | undefined): Promise<string | undefined> {
	let connectionStringSettingName: string | undefined;
	const vscodeMssqlApi = await utils.getVscodeMssqlApi();

	// show the settings from project's local.settings.json if there's an AF functions project
	if (projectUri) {
		let settings;
		try {
			settings = await getLocalSettingsJson(path.join(path.dirname(projectUri.fsPath!), constants.azureFunctionLocalSettingsFileName));
		} catch (e) {
			void vscode.window.showErrorMessage(utils.getErrorMessage(e));
			return;
		}

		let existingSettings: (vscode.QuickPickItem)[] = [];
		if (settings?.Values) {
			existingSettings = Object.keys(settings.Values).map(setting => {
				return {
					label: setting
				} as vscode.QuickPickItem;
			});
		}

		existingSettings.unshift({ label: constants.createNewLocalAppSettingWithIcon });
		let sqlConnectionStringSettingExists = existingSettings.find(s => s.label === constants.sqlConnectionStringSetting);

		while (!connectionStringSettingName) {
			const selectedSetting = await vscode.window.showQuickPick(existingSettings, {
				canPickMany: false,
				title: constants.selectSetting,
				ignoreFocusOut: true
			});
			if (!selectedSetting) {
				// User cancelled
				return;
			}

			if (selectedSetting.label === constants.createNewLocalAppSettingWithIcon) {
				const newConnectionStringSettingName = await vscode.window.showInputBox(
					{
						title: constants.enterConnectionStringSettingName,
						ignoreFocusOut: true,
						value: sqlConnectionStringSettingExists ? '' : constants.sqlConnectionStringSetting,
						validateInput: input => input ? undefined : constants.nameMustNotBeEmpty
					}
				) ?? '';

				if (!newConnectionStringSettingName) {
					// go back to select setting quickpick if user escapes from inputting the setting name in case they changed their mind
					continue;
				}

				// show the connection string methods (user input and connection profile options)
				const listOfConnectionStringMethods = [constants.connectionProfile, constants.userConnectionString];
				while (true) {
					const selectedConnectionStringMethod = await vscode.window.showQuickPick(listOfConnectionStringMethods, {
						canPickMany: false,
						title: constants.selectConnectionString,
						ignoreFocusOut: true
					});
					if (!selectedConnectionStringMethod) {
						// User cancelled
						return;
					}

					let connectionString: string = '';
					let includePassword: string | undefined;
					let connectionInfo: IConnectionInfo | undefined;
					let connectionDetails: ConnectionDetails;
					if (selectedConnectionStringMethod === constants.userConnectionString) {
						// User chooses to enter connection string manually
						connectionString = await vscode.window.showInputBox(
							{
								title: constants.enterConnectionString,
								ignoreFocusOut: true,
								value: 'Server=localhost;Initial Catalog={db_name};User ID=sa;Password={your_password};Persist Security Info=False',
								validateInput: input => input ? undefined : constants.valueMustNotBeEmpty
							}
						) ?? '';
					} else {
						// Let user choose from existing connections to create connection string from
						connectionInfo = await vscodeMssqlApi.promptForConnection(true);
						if (!connectionInfo) {
							// User cancelled return to selectedConnectionStringMethod prompt
							continue;
						}
						connectionDetails = { options: connectionInfo };
						try {
							// Prompt to include password in connection string if authentication type is SqlLogin and connection has password saved
							if (connectionInfo.authenticationType === 'SqlLogin' && connectionInfo.password) {
								includePassword = await vscode.window.showQuickPick([constants.yesString, constants.noString], {
									title: constants.includePassword,
									canPickMany: false,
									ignoreFocusOut: true
								});
								if (includePassword === constants.yesString) {
									// set connection string to include password
									connectionString = await vscodeMssqlApi.getConnectionString(connectionDetails, true, false);
								}
							}
							// set connection string to not include the password if connection info does not include password, or user chooses to not include password, or authentication type is not sql login
							if (includePassword !== constants.yesString) {
								connectionString = await vscodeMssqlApi.getConnectionString(connectionDetails, false, false);
							}
						} catch (e) {
							// failed to get connection string for selected connection and will go back to prompt for connection string methods
							console.warn(e);
							void vscode.window.showErrorMessage(constants.failedToGetConnectionString);
							continue;
						}
					}
					if (connectionString) {
						try {
							const projectFolder: string = path.dirname(projectUri.fsPath);
							const localSettingsPath: string = path.join(projectFolder, constants.azureFunctionLocalSettingsFileName);
							let userPassword: string | undefined;
							// Ask user to enter password if auth type is sql login and password is not saved
							if (connectionInfo?.authenticationType === 'SqlLogin' && !connectionInfo?.password) {
								userPassword = await vscode.window.showInputBox({
									prompt: constants.enterPasswordPrompt,
									placeHolder: constants.enterPasswordManually,
									ignoreFocusOut: true,
									password: true,
									validateInput: input => input ? undefined : constants.valueMustNotBeEmpty
								});
								if (userPassword) {
									// if user enters password replace password placeholder with user entered password
									connectionString = connectionString.replace(constants.passwordPlaceholder, userPassword);
								}
							}
							if (includePassword !== constants.yesString && !userPassword && connectionInfo?.authenticationType === 'SqlLogin') {
								// if user does not want to include password or user does not enter password, show warning message that they will have to enter it manually later in local.settings.json
								void vscode.window.showWarningMessage(constants.userPasswordLater, constants.openFile, constants.closeButton).then(async (result) => {
									if (result === constants.openFile) {
										// open local.settings.json file
										void vscode.commands.executeCommand(constants.vscodeOpenCommand, vscode.Uri.file(localSettingsPath));
									}
								});
							}
							const success = await setLocalAppSetting(projectFolder, newConnectionStringSettingName, connectionString);
							if (success) {
								// exit both loops and insert binding
								connectionStringSettingName = newConnectionStringSettingName;
								break;
							} else {
								void vscode.window.showErrorMessage(constants.selectConnectionError());
							}
						} catch (e) {
							// display error message and show select setting quickpick again
							void vscode.window.showErrorMessage(constants.selectConnectionError(e));
							continue;
						}
					}
				}
			} else {
				// If user cancels out of this or doesn't want to overwrite an existing setting
				// just return them to the select setting quickpick in case they changed their mind
				connectionStringSettingName = selectedSetting.label;
			}
		}
		// Add sql extension package reference to project. If the reference is already there, it doesn't get added again
		await addNugetReferenceToProjectFile(projectUri.fsPath);
	} else {
		// if no AF project was found or there's more than one AF functions project in the workspace,
		// ask for the user to input the setting name
		connectionStringSettingName = await vscode.window.showInputBox({
			prompt: constants.connectionStringSetting,
			placeHolder: constants.connectionStringSettingPlaceholder,
			ignoreFocusOut: true
		});
	}
	return connectionStringSettingName;
}
