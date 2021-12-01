/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import * as uiUtils from './utils';
import { AppSettingType, IDeployAppIntegrationProfile, IDeployProfile, ILocalDbSetting } from '../models/deploy/deployProfile';
import { Project } from '../models/project';
import { getPublishDatabaseSettings } from './publishDatabaseQuickpick';
import * as path from 'path';
import * as fse from 'fs-extra';

/**
 * Create flow for Deploying a database using only VS Code-native APIs such as QuickPick
 */
export async function launchDeployAppIntegrationQuickpick(project: Project): Promise<IDeployAppIntegrationProfile | undefined> {
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
					validateInput: input => utils.isEmptyString(input) ? constants.valueCannotBeEmpty : undefined,
					placeHolder: constants.enterConnectionStringEnvNameDescription
				}
			);

			// Return when user hits escape
			if (!envVarName) {
				return undefined;
			}
		}
	}

	return {
		envVariableName: envVarName,
		appSettingFile: settingExist ? localSettings : undefined,
		appSettingType: settingExist ? AppSettingType.AzureFunction : AppSettingType.None
	};
}

async function launchEulaQuickPick(baseImage: string): Promise<boolean> {
	let eulaAccepted: boolean = false;
	const baseImages = uiUtils.getDockerBaseImages();
	const imageInfo = baseImages.find(x => x.name === baseImage);
	const agreementInfo = imageInfo?.agreementInfo;
	if (agreementInfo) {
		const openEulaButton: vscode.QuickInputButton = {
			iconPath: new vscode.ThemeIcon('link-external'),
			tooltip: constants.openEulaString
		};
		const quickPick = vscode.window.createQuickPick();
		quickPick.items = [{ label: constants.yesString },
		{ label: constants.noString }];
		quickPick.title = uiUtils.getAgreementDisplayText(agreementInfo);
		quickPick.ignoreFocusOut = true;
		quickPick.buttons = [openEulaButton];
		const disposables: vscode.Disposable[] = [];
		try {
			const eulaAcceptedPromise = new Promise<boolean>((resolve) => {
				disposables.push(
					quickPick.onDidHide(() => {
						resolve(false);
					}),
					quickPick.onDidTriggerButton(async () => {
						await vscode.env.openExternal(vscode.Uri.parse(agreementInfo.link.url));
					}),
					quickPick.onDidChangeSelection((item) => {
						resolve(item[0].label === constants.yesString);
					}));
			});

			quickPick.show();
			eulaAccepted = await eulaAcceptedPromise;
			quickPick.hide();
		}
		finally {
			disposables.forEach(d => d.dispose());
		}

		return eulaAccepted;
	}
	return false;
}

/**
 * Create flow for publishing a database to docker container using only VS Code-native APIs such as QuickPick
 */
export async function launchPublishToDockerContainerQuickpick(project: Project): Promise<IDeployProfile | undefined> {

	let localDbSetting: ILocalDbSetting | undefined;
	// Deploy to docker selected
	let portNumber = await vscode.window.showInputBox({
		title: constants.enterPortNumber,
		ignoreFocusOut: true,
		value: constants.defaultPortNumber,
		validateInput: input => !utils.validateSqlServerPortNumber(input) ? constants.portMustBeNumber : undefined
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
		validateInput: input => !utils.isValidSQLPassword(input) ? constants.invalidSQLPasswordMessage : undefined,
		password: true
	}
	);

	// Return when user hits escape
	if (!password) {
		return undefined;
	}

	let confirmPassword: string | undefined = '';
	confirmPassword = await vscode.window.showInputBox({
		title: constants.confirmPassword,
		ignoreFocusOut: true,
		value: confirmPassword,
		validateInput: input => input !== password ? constants.passwordNotMatch : undefined,
		password: true
	}
	);

	// Return when user hits escape
	if (!confirmPassword) {
		return undefined;
	}

	const baseImages = uiUtils.getDockerBaseImages();
	const baseImage = await vscode.window.showQuickPick(
		baseImages.map(x => x.name),
		{ title: constants.selectBaseImage, ignoreFocusOut: true });

	// Return when user hits escape
	if (!baseImage) {
		return undefined;
	}

	const eulaAccepted = await launchEulaQuickPick(baseImage);
	if (!eulaAccepted) {
		return undefined;
	}

	const imageInfo = baseImages.find(x => x.name === baseImage);

	localDbSetting = {
		serverName: constants.defaultLocalServerName,
		userName: constants.defaultLocalServerAdminName,
		dbName: project.projectFileName,
		password: password,
		port: +portNumber,
		dockerBaseImage: baseImage,
		dockerBaseImageEula: imageInfo?.agreementInfo?.link?.url || ''
	};

	let deploySettings = await getPublishDatabaseSettings(project, false);

	// Return when user hits escape
	if (!deploySettings) {
		return undefined;
	}

	// Server name should be set to localhost
	deploySettings.serverName = localDbSetting.serverName;

	// Get the database name from deploy settings
	localDbSetting.dbName = deploySettings.databaseName;


	return {
		localDbSetting: localDbSetting,
		deploySettings: deploySettings,
	};
}
