/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { AppSettingType, IDeployProfile, ILocalDbSetting } from '../models/deploy/deployProfile';
import { Project } from '../models/project';
import { getPublishDatabaseSettings } from './publishDatabaseQuickpick';
import * as path from 'path';
import * as fse from 'fs-extra';

/**
 * Create flow for Deploying a database using only VS Code-native APIs such as QuickPick
 */
export async function launchDeployDatabaseQuickpick(project: Project): Promise<IDeployProfile | undefined> {

	// Show options to user for deploy to existing server or docker

	const deployOption = await vscode.window.showQuickPick(
		[constants.deployToExistingServer, constants.deployToDockerContainer],
		{ title: constants.selectDeployOption, ignoreFocusOut: true });

	// Return when user hits escape
	if (!deployOption) {
		return undefined;
	}

	let localDbSetting: ILocalDbSetting | undefined;
	// Deploy to docker selected
	if (deployOption === constants.deployToDockerContainer) {
		let portNumber = await vscode.window.showInputBox({
			title: constants.enterPortNumber,
			ignoreFocusOut: true,
			value: constants.defaultPortNumber,
			validateInput: input => isNaN(+input) ? constants.portMustBeNumber : undefined
		}
		);

		// Return when user hits escape
		if (!portNumber) {
			return undefined;
		}

		let password: string | undefined = '';
		password = await vscode.window.showInputBox({
			title: constants.enterPassword,
			ignoreFocusOut: true,
			value: password,
			password: true
		}
		);

		// Return when user hits escape
		if (!password) {
			return undefined;
		}

		localDbSetting = {
			serverName: 'localhost',
			userName: 'sa',
			dbName: project.projectFileName,
			password: password,
			port: +portNumber,
		};
	}
	let deploySettings = await getPublishDatabaseSettings(project, deployOption !== constants.deployToDockerContainer);

	// Return when user hits escape
	if (!deploySettings) {
		return undefined;
	}

	// TODO: Ask for SQL CMD Variables or profile

	let envVarName: string | undefined = '';
	const integrateWithAzureFunctions: boolean = true; //TODO: get value from settings or quickpick

	//TODO: find a better way to find if AF or local settings is in the project
	//
	const localSettings = path.join(project.projectFolderPath, constants.azureFunctionLocalSettingsFileName);
	const settingExist: boolean = await fse.pathExists(localSettings);
	if (integrateWithAzureFunctions && settingExist) {

		// Ask user to update app settings or not
		//
		let choices: { [id: string]: boolean } = {};
		let options = {
			placeHolder: constants.appSettingPrompt
		};
		choices[constants.yesString] = true;
		choices[constants.noString] = false;
		let result = await vscode.window.showQuickPick(Object.keys(choices).map(c => {
			return {
				label: c
			};
		}), options);

		// Return when user hits escape
		if (!result) {
			return undefined;
		}

		if (result !== undefined && choices[result.label] || false) {
			envVarName = await vscode.window.showInputBox(
				{
					title: constants.enterConnectionStringEnvName,
					ignoreFocusOut: true,
					value: constants.defaultConnectionStringEnvVarName,
					validateInput: input => input === '' ? constants.valueCannotBeEmpty : undefined,
					placeHolder: constants.enterConnectionStringEnvNameDescription
				}
			);

			// Return when user hits escape
			if (!envVarName) {
				return undefined;
			}
		}
	}

	if (localDbSetting && deploySettings) {
		deploySettings.serverName = localDbSetting.serverName;
	}

	return {
		localDbSetting: localDbSetting,
		envVariableName: envVarName,
		appSettingFile: settingExist ? localSettings : undefined,
		deploySettings: deploySettings,
		appSettingType: settingExist ? AppSettingType.AzureFunction : AppSettingType.None
	};
}
