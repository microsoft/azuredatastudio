/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { IDeployProfile } from '../models/deploy/deployProfile';
import { Project } from '../models/project';
import * as generator from 'generate-password';
let path = require('path');
let fse = require('fs-extra');

/**
 * Create flow for Deploying a database using only VS Code-native APIs such as QuickPick
 */
export async function launchDeployDatabaseQuickpick(project: Project): Promise<IDeployProfile | undefined> {

	// Show options to user for deploy to existing server or docker
	const deployOption = constants.deployToDockerContainer;

	/*
	const deployOption =  await vscode.window.showQuickPick(
		[constants.deployToExistingServer, constants.deployToDockerContainer],
		{ title: constants.selectDeployOption, ignoreFocusOut: true });
	if (!deployOption) {
		return undefined;
	}
	*/

	// Deploy to docker selected
	if (deployOption === constants.deployToDockerContainer) {
		let databaseName = project.projectFileName;
		let portNumber = await vscode.window.showInputBox(
			{
				title: constants.enterPortNumber,
				ignoreFocusOut: true,
				value: constants.defaultPortNumber,
				validateInput: input => isNaN(+input) ? constants.portMustNotBeNumber : undefined,
				placeHolder: constants.enterPortNumberDescription
			}
		) ?? '';

		let password = await vscode.window.showInputBox(
			{
				title: constants.enterPassword,
				ignoreFocusOut: true,
				password: true,
				placeHolder: constants.enterPasswordDescription
			}
		) ?? '';

		// Using default values
		if (!portNumber) {
			portNumber = constants.defaultPortNumber;
		}

		if (!password) {
			password = generator.generate({
				length: 10,
				numbers: true,
				symbols: true,
				lowercase: true,
				uppercase: true,
				exclude: '`' // Exclude the chars that cannot be included in the password. Some chars can make the command fail in the terminal
			});
		}

		if (!databaseName) {
			// TODO : what to use for db name?
		}

		// TODO: Ask for SQL CMD Variables or profile

		let envVarName = '';
		let connectionStringTemplate = '';
		const integrateWithAzureFunctions: boolean = true; //TODO: get value from settings or quickpick

		//TODO: find a better way to find if AF or local settings is in the project
		//
		const localSettings = path.join(project.projectFolderPath, constants.azureFunctionLocalSettingsFileName);
		const settingExist: boolean = fse.existsSync(localSettings);
		if (integrateWithAzureFunctions && settingExist) {

			// Ask user to update app settings or not
			//
			let choices: { [id: string]: boolean } = {};
			let options = {
				placeHolder: constants.appSettingPrompt
			};
			choices[constants.msgYes] = true;
			choices[constants.msgNo] = false;
			let result = await vscode.window.showQuickPick(Object.keys(choices).map(c => {
				return {
					label: c
				};
			}), options);

			if (result !== undefined && choices[result.label] || false) {
				envVarName = await vscode.window.showInputBox(
					{
						title: constants.enterConnectionStringEnvName,
						ignoreFocusOut: true,
						value: constants.defaultConnectionStringEnvVarName,
						validateInput: input => input === '' ? constants.valueCannotBeEmpty : undefined,
						placeHolder: constants.enterConnectionStringEnvNameDescription
					}
				) ?? '';

				// TODO: find a default connection string template based on language "FUNCTIONS_WORKER_RUNTIME":"dotnet"?
				//
				connectionStringTemplate = await vscode.window.showInputBox(
					{
						title: constants.enterConnectionStringTemplate,
						ignoreFocusOut: true,
						value: constants.defaultConnectionStringTemplate,
						validateInput: input => input === '' ? constants.valueCannotBeEmpty : undefined,
						placeHolder: constants.enterConnStringTemplateDescription
					}
				) ?? '';
			}
		}

		return {
			serverName: 'localhost',
			userName: 'sa',
			dbName: databaseName,
			password: password,
			port: +portNumber,
			connectionStringTemplate: connectionStringTemplate,
			envVariableName: envVarName,
			appSettingFile: settingExist ? localSettings : undefined
		};
	} else {
		return undefined;
	}
}
