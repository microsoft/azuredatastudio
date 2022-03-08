/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { BindingType, ConnectionDetails, IConnectionInfo } from 'vscode-mssql';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import * as azureFunctionsUtils from '../common/azureFunctionsUtils';
import { PackageHelper } from '../tools/packageHelper';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';

export async function launchAddSqlBindingQuickpick(uri: vscode.Uri | undefined, packageHelper: PackageHelper): Promise<void> {
	TelemetryReporter.sendActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.startAddSqlBinding);

	const vscodeMssqlApi = await utils.getVscodeMssqlApi();

	if (!uri) {
		// this command only shows in the command palette when the active editor is a .cs file, so we can safely assume that's the scenario
		// when this is called without a uri
		uri = vscode.window.activeTextEditor!.document.uri;

		if (vscode.window.activeTextEditor!.document.isDirty) {
			const result = await vscode.window.showWarningMessage(constants.saveChangesInFile, { modal: true }, constants.save);

			if (result !== constants.save) {
				return;
			}

			await vscode.window.activeTextEditor!.document.save();
		}
	}

	// get all the Azure functions in the file
	const azureFunctionsService = await utils.getAzureFunctionService();
	let getAzureFunctionsResult;
	try {
		getAzureFunctionsResult = await azureFunctionsService.getAzureFunctions(uri.fsPath);
	} catch (e) {
		void vscode.window.showErrorMessage(utils.getErrorMessage(e));
		return;
	}

	const azureFunctions = getAzureFunctionsResult.azureFunctions;

	if (azureFunctions.length === 0) {
		void vscode.window.showErrorMessage(constants.noAzureFunctionsInFile);
		return;
	}

	// 1. select Azure function from the current file
	const azureFunctionName = (await vscode.window.showQuickPick(azureFunctions, {
		canPickMany: false,
		title: constants.selectAzureFunction,
		ignoreFocusOut: true
	}));

	if (!azureFunctionName) {
		return;
	}

	// 2. select input or output binding
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

	if (!selectedBinding) {
		return;
	}

	// 3. ask for object name for the binding
	const objectName = await vscode.window.showInputBox({
		prompt: selectedBinding.type === BindingType.input ? constants.sqlTableOrViewToQuery : constants.sqlTableToUpsert,
		placeHolder: constants.placeHolderObject,
		validateInput: input => input ? undefined : constants.nameMustNotBeEmpty,
		ignoreFocusOut: true
	});

	if (!objectName) {
		return;
	}

	// 4. ask for connection string setting name
	let projectUri: vscode.Uri | undefined;
	try {
		projectUri = await azureFunctionsUtils.getAFProjectContainingFile(uri);
	} catch (e) {
		// continue even if there's no AF project found. The binding should still be able to be added as long as there was an azure function found in the file earlier
	}

	let connectionStringSettingName;

	// show the settings from project's local.settings.json if there's an AF functions project
	if (projectUri) {
		let settings;
		try {
			settings = await azureFunctionsUtils.getLocalSettingsJson(path.join(path.dirname(projectUri.fsPath!), constants.azureFunctionLocalSettingsFileName));
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
							const success = await azureFunctionsUtils.setLocalAppSetting(projectFolder, newConnectionStringSettingName, connectionString);
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
	} else {
		// if no AF project was found or there's more than one AF functions project in the workspace,
		// ask for the user to input the setting name
		connectionStringSettingName = await vscode.window.showInputBox({
			prompt: constants.connectionStringSetting,
			placeHolder: constants.connectionStringSettingPlaceholder,
			ignoreFocusOut: true
		});
	}

	if (!connectionStringSettingName) {
		return;
	}

	// 5. insert binding
	try {
		const result = await azureFunctionsService.addSqlBinding(selectedBinding.type, uri.fsPath, azureFunctionName, objectName, connectionStringSettingName);

		if (!result.success) {
			void vscode.window.showErrorMessage(result.errorMessage);
			TelemetryReporter.sendErrorEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.finishAddSqlBinding);
			return;
		}

		TelemetryReporter.createActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.finishAddSqlBinding)
			.withAdditionalProperties({ bindingType: selectedBinding.label })
			.send();
	} catch (e) {
		void vscode.window.showErrorMessage(utils.getErrorMessage(e));
		TelemetryReporter.sendErrorEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.finishAddSqlBinding);
		return;
	}

	// 6. Add sql extension package reference to project. If the reference is already there, it doesn't get added again
	await packageHelper.addPackageToAFProjectContainingFile(uri, constants.sqlExtensionPackageName);
}
