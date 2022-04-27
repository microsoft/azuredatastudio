/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import * as uiUtils from './utils';
import { AppSettingType, DockerImageInfo, IDeployAppIntegrationProfile, ISqlDbDeployProfile, ILocalDbDeployProfile, ILocalDbSetting } from '../models/deploy/deployProfile';
import { Project } from '../models/project';
import { getPublishDatabaseSettings } from './publishDatabaseQuickpick';
import * as path from 'path';
import * as fse from 'fs-extra';
import { AzureSqlClient } from '../models/deploy/azureSqlClient';
import { IDeploySettings } from '../models/IDeploySettings';
import { IAccount } from 'vscode-mssql';

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

async function launchEulaQuickPick(imageInfo: DockerImageInfo | undefined): Promise<boolean> {
	let eulaAccepted: boolean = false;
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

export async function launchCreateAzureServerQuickPick(project: Project, azureSqlClient: AzureSqlClient): Promise<ISqlDbDeployProfile | undefined> {

	const name = uiUtils.getPublishServerName(project.getProjectTargetVersion());
	const accounts = await azureSqlClient.getAccounts();
	const accountOptions = accounts.map(x => x.displayInfo?.displayName || '');
	accountOptions.unshift(constants.azureAddAccount);

	let account: IAccount | undefined;
	let accountOption = await vscode.window.showQuickPick(
		accountOptions,
		{ title: constants.azureAccounts, ignoreFocusOut: true });

	// Return when user hits escape
	if (!accountOption) {
		return undefined;
	}

	if (accountOption === constants.azureAddAccount) {
		account = await azureSqlClient.getAccount();
	} else {
		account = accounts.find(x => x.displayInfo.displayName === accountOption);
	}

	if (!account) {
		return;
	}

	const sessions = await azureSqlClient.getSessions(account);

	const subscriptionName = await vscode.window.showQuickPick(
		sessions.map(x => x.subscription.displayName || ''),
		{ title: constants.azureSubscription, ignoreFocusOut: true });

	// Return when user hits escape
	if (!subscriptionName) {
		return undefined;
	}

	const session = sessions.find(x => x.subscription.displayName === subscriptionName);

	if (!session?.subscription?.subscriptionId) {
		return undefined;
	}

	const resourceGroups = await azureSqlClient.getResourceGroups(session);
	const resourceGroupName = await vscode.window.showQuickPick(
		resourceGroups.map(x => x.name || ''),
		{ title: constants.resourceGroup, ignoreFocusOut: true });

	// Return when user hits escape
	if (!resourceGroupName) {
		return undefined;
	}

	const resourceGroup = resourceGroups.find(x => x.name === resourceGroupName);

	// Return when user hits escape
	if (!resourceGroup) {
		return undefined;
	}

	let locations = await azureSqlClient.getLocations(session);
	if (resourceGroup.location) {
		const defaultLocation = locations.find(x => x.name === resourceGroup.location);
		if (defaultLocation) {
			locations = locations.filter(x => x.name !== defaultLocation.name);
			locations.unshift(defaultLocation);
		}
	}

	let locationName = await vscode.window.showQuickPick(
		locations.map(x => x.name || ''),
		{ title: constants.azureLocation, ignoreFocusOut: true, placeHolder: resourceGroup?.location });

	// Return when user hits escape
	if (!locationName) {
		return undefined;
	}

	let serverName: string | undefined = '';
	serverName = await vscode.window.showInputBox({
		title: constants.azureServerName,
		ignoreFocusOut: true,
		value: serverName,
		password: false
	}
	);

	// Return when user hits escape
	if (!serverName) {
		return undefined;
	}

	let user: string | undefined = '';
	user = await vscode.window.showInputBox({
		title: constants.enterUser(name),
		ignoreFocusOut: true,
		value: user,
		password: false
	}
	);

	// Return when user hits escape
	if (!user) {
		return undefined;
	}

	let password: string | undefined = '';
	password = await vscode.window.showInputBox({
		title: constants.enterPassword(name),
		ignoreFocusOut: true,
		value: password,
		validateInput: input => !utils.isValidSQLPassword(input) ? constants.invalidSQLPasswordMessage(name) : undefined,
		password: true
	}
	);

	// Return when user hits escape
	if (!password) {
		return undefined;
	}

	let confirmPassword: string | undefined = '';
	confirmPassword = await vscode.window.showInputBox({
		title: constants.confirmPassword(name),
		ignoreFocusOut: true,
		value: confirmPassword,
		validateInput: input => input !== password ? constants.passwordNotMatch(name) : undefined,
		password: true
	}
	);

	// Return when user hits escape
	if (!confirmPassword) {
		return undefined;
	}

	let settings: IDeploySettings | undefined = await getPublishDatabaseSettings(project, false);

	return {
		// TODO add tenant
		deploySettings: settings, sqlDbSetting: {
			tenantId: session.tenantId,
			accountId: session.account.key.id,
			serverName: serverName,
			userName: user,
			password: password,
			port: 1433,
			dbName: '',
			session: session,
			resourceGroupName: resourceGroup.name || '',
			location: locationName
		}
	};
}

/**
 * Create flow for publishing a database to docker container using only VS Code-native APIs such as QuickPick
 */
export async function launchPublishToDockerContainerQuickpick(project: Project): Promise<ILocalDbDeployProfile | undefined> {
	const name = uiUtils.getPublishServerName(project.getProjectTargetVersion());
	let localDbSetting: ILocalDbSetting | undefined;
	// Deploy to docker selected
	let portNumber = await vscode.window.showInputBox({
		title: constants.enterPortNumber(name),
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
		title: constants.enterPassword(name),
		ignoreFocusOut: true,
		value: password,
		validateInput: input => !utils.isValidSQLPassword(input) ? constants.invalidSQLPasswordMessage(name) : undefined,
		password: true
	}
	);

	// Return when user hits escape
	if (!password) {
		return undefined;
	}

	let confirmPassword: string | undefined = '';
	confirmPassword = await vscode.window.showInputBox({
		title: constants.confirmPassword(name),
		ignoreFocusOut: true,
		value: confirmPassword,
		validateInput: input => input !== password ? constants.passwordNotMatch(name) : undefined,
		password: true
	}
	);

	// Return when user hits escape
	if (!confirmPassword) {
		return undefined;
	}

	const baseImages = uiUtils.getDockerBaseImages(project.getProjectTargetVersion());
	const baseImage = await vscode.window.showQuickPick(
		baseImages.map(x => x.displayName),
		{ title: constants.selectBaseImage(name), ignoreFocusOut: true });

	// Return when user hits escape
	if (!baseImage) {
		return undefined;
	}

	const imageInfo = baseImages.find(x => x.displayName === baseImage);
	const eulaAccepted = await launchEulaQuickPick(imageInfo);
	if (!eulaAccepted) {
		return undefined;
	}

	localDbSetting = {
		serverName: constants.defaultLocalServerName,
		userName: constants.defaultLocalServerAdminName,
		dbName: project.projectFileName,
		password: password,
		port: +portNumber,
		dockerBaseImage: imageInfo?.name || '',
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
