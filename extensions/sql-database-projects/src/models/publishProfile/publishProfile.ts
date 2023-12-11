/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as xmldom from '@xmldom/xmldom';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';
import * as mssql from 'mssql';
import * as vscodeMssql from 'vscode-mssql';
import * as vscode from 'vscode';
import * as path from 'path';

import { promises as fs } from 'fs';
import { SqlConnectionDataSource } from '../dataSources/sqlConnectionStringSource';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../../common/telemetry';
import { Project } from '../project';
import { IPublishToDockerSettings, ISqlProjectPublishSettings } from '../deploy/publishSettings';
import { ISqlDbDeployProfile } from '../deploy/deployProfile';

// only reading db name, connection string, and SQLCMD vars from profile for now
export interface PublishProfile {
	databaseName: string;
	serverName: string;
	connectionId: string;
	connection: string;
	sqlCmdVariables: Map<string, string>;
	options?: mssql.DeploymentOptions | vscodeMssql.DeploymentOptions;
}

export async function readPublishProfile(profileUri: vscode.Uri): Promise<PublishProfile> {
	try {
		const dacFxService = await utils.getDacFxService();
		const profile = await load(profileUri, dacFxService);
		return profile;
	} catch (e) {
		void vscode.window.showErrorMessage(constants.profileReadError(e));
		throw e;
	}
}

/**
 * parses the specified file to load publish settings
 */
export async function load(profileUri: vscode.Uri, dacfxService: utils.IDacFxService): Promise<PublishProfile> {
	const profileText = await fs.readFile(profileUri.fsPath);
	const profileXmlDoc: Document = new xmldom.DOMParser().parseFromString(profileText.toString());

	// read target database name
	let targetDbName: string = '';
	let targetDatabaseNameCount = profileXmlDoc.documentElement.getElementsByTagName(constants.targetDatabaseName).length;
	if (targetDatabaseNameCount > 0) {
		// if there is more than one TargetDatabaseName nodes, SSDT uses the name in the last one so we'll do the same here
		targetDbName = profileXmlDoc.documentElement.getElementsByTagName(constants.targetDatabaseName)[targetDatabaseNameCount - 1].textContent!;
	}

	const connectionInfo = await readConnectionString(profileXmlDoc);
	const optionsResult = await dacfxService.getOptionsFromProfile(profileUri.fsPath);

	// get all SQLCMD variables to include from the profile
	const sqlCmdVariables = utils.readSqlCmdVariables(profileXmlDoc, true);

	TelemetryReporter.createActionEvent(TelemetryViews.SqlProjectPublishDialog, TelemetryActions.profileLoaded)
		.withAdditionalProperties({
			hasTargetDbName: (!!targetDbName).toString(),
			hasConnectionString: (!!connectionInfo?.connectionId).toString(),
			hasSqlCmdVariables: (sqlCmdVariables.size > 0).toString()
		}).send();

	return {
		databaseName: targetDbName,
		serverName: connectionInfo.server,
		connectionId: connectionInfo.connectionId,
		connection: connectionInfo.connection,
		sqlCmdVariables: sqlCmdVariables,
		options: optionsResult.deploymentOptions
	};
}

async function readConnectionString(xmlDoc: any): Promise<{ connectionId: string, connection: string, server: string }> {
	let targetConnection: string = '';
	let connId: string = '';
	let server: string = '';

	if (xmlDoc.documentElement.getElementsByTagName(constants.targetConnectionString).length > 0) {
		const targetConnectionString = xmlDoc.documentElement.getElementsByTagName(constants.TargetConnectionString)[0].textContent;
		const dataSource = new SqlConnectionDataSource('', targetConnectionString);
		let username: string = '';
		const connectionProfile = dataSource.getConnectionProfile();

		try {
			const azdataApi = utils.getAzdataApi();
			if (dataSource.integratedSecurity) {
				if (azdataApi) {
					const connectionResult = await utils.getAzdataApi()!.connection.connect(connectionProfile, false, false);
					if (!connectionResult.connected) {
						const connection = await utils.getAzdataApi()!.connection.openConnectionDialog(undefined, connectionProfile, {
							saveConnection: false,
							showDashboard: false,
							showConnectionDialogOnError: true,
							showFirewallRuleOnError: true
						});
						connId = connection.connectionId;
					} else {
						connId = connectionResult.connectionId!;
					}
				} else {
					// TODO@chgagnon - hook up VS Code MSSQL
				}
				server = dataSource.server;
				username = constants.defaultUser;
			}
			else {
				if (azdataApi) {
					const connection = await utils.getAzdataApi()!.connection.openConnectionDialog(undefined, connectionProfile, {
						saveConnection: false,
						showDashboard: false,
						showConnectionDialogOnError: true,
						showFirewallRuleOnError: true
					});
					connId = connection.connectionId;
					server = connection.options['server'];
					username = connection.options['user'];
				} else {
					// TODO@chgagnon - hook up VS Code MSSQL
				}
			}

			targetConnection = `${server} (${username})`;
		} catch (err) {
			throw new Error(constants.unableToCreatePublishConnection(utils.getErrorMessage(err)));
		}
	}


	return {
		connectionId: connId,
		connection: targetConnection,
		server: server
	};
}

/**
 * saves publish settings to the specified profile file
 */
export async function savePublishProfile(profilePath: string, databaseName: string, connectionString: string, sqlCommandVariableValues?: Map<string, string>, deploymentOptions?: mssql.DeploymentOptions | vscodeMssql.DeploymentOptions): Promise<void> {
	const dacFxService = await utils.getDacFxService();
	if (utils.getAzdataApi()) {
		await (dacFxService as mssql.IDacFxService).savePublishProfile(profilePath, databaseName, connectionString, sqlCommandVariableValues, deploymentOptions as mssql.DeploymentOptions);
	} else {
		await (dacFxService as vscodeMssql.IDacFxService).savePublishProfile(profilePath, databaseName, connectionString, sqlCommandVariableValues, deploymentOptions as vscodeMssql.DeploymentOptions);
	}
}

export function promptToSaveProfile(project: Project, publishProfileUri?: vscode.Uri) {
	return vscode.window.showSaveDialog(
		{
			defaultUri: publishProfileUri ?? vscode.Uri.file(path.join(project.projectFolderPath, `${project.projectFileName}_1.publish.xml`)),
			saveLabel: constants.save,
			filters: {
				'Publish files': ['publish.xml'],
			}
		}
	);
}

/**
 * Prompt to save publish profile and add to the tree
 * @param project
 * @param settings Publish settings
 * @returns
 */
export async function promptForSavingProfile(project: Project, settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined) {
	const result = await vscode.window.showInformationMessage(constants.saveProfile, constants.yesString, constants.noString);
	if (result === constants.yesString) {
		let publishProfileUri: vscode.Uri | undefined;
		if (settings) {
			if (isISqlProjectPublishSettings(settings)) {
				publishProfileUri = settings.publishProfileUri;
			} else if (isISqlDbDeployProfile(settings)) {
				publishProfileUri = settings.deploySettings?.publishProfileUri;
			} else if (isIPublishToDockerSettings(settings)) {
				publishProfileUri = settings.sqlProjectPublishSettings.publishProfileUri;
			}
		}
		const filePath = await promptToSaveProfile(project, publishProfileUri);

		if (!filePath) {
			return;
		}

		const targetConnectionString = await getConnectionString(settings);
		const targetDatabaseName = getDatabaseName(settings, project.projectFileName);
		const deploymentOptions = await getDeploymentOptions(settings, project);
		const sqlCmdVariables = getSqlCmdVariables(settings);
		await savePublishProfile(filePath.fsPath, targetDatabaseName, targetConnectionString, sqlCmdVariables, deploymentOptions);

		setProfileParameters(settings, filePath);

		await project.addNoneItem(path.relative(project.projectFolderPath, filePath.fsPath));
		void vscode.commands.executeCommand(constants.refreshDataWorkspaceCommand);		//refresh data workspace to load the newly added profile to the tree
	}
}

/**
 * Function to confirm the Publish to existing server workflow
 * @param settings
 * @returns true if the settings is of type ISqlProjectPublishSettings
 */
function isISqlProjectPublishSettings(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): settings is ISqlProjectPublishSettings {
	if ((settings as ISqlProjectPublishSettings).connectionUri) {
		return true
	}
	return false
}

/**
 * Function to confirm the Publish to New Azure server workflow
 * @param settings
 * @returns true if the settings is of type ISqlDbDeployProfile
 */
function isISqlDbDeployProfile(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): settings is ISqlDbDeployProfile {
	if ((settings as ISqlDbDeployProfile).deploySettings) {
		return true
	}
	return false
}

/**
 * Function to confirm the Publish to Docker workflow
 * @param settings
 * @returns true if the settings is of type IPublishToDockerSettings
 */
function isIPublishToDockerSettings(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): settings is IPublishToDockerSettings {
	if ((settings as IPublishToDockerSettings).dockerSettings) {
		return true
	}
	return false
}

async function getConnectionString(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): Promise<string> {
	let connectionUri: string = '';
	let connectionString: string = '';

	if (settings) {
		if (isISqlProjectPublishSettings(settings)) {
			connectionUri = settings.connectionUri;
		} else if (isISqlDbDeployProfile(settings)) {
			connectionUri = settings.deploySettings?.connectionUri ?? '';
		} else if (isIPublishToDockerSettings(settings)) {
			connectionUri = settings.sqlProjectPublishSettings.connectionUri;
		}
	}

	if (connectionUri) {
		connectionString = await (await utils.getVscodeMssqlApi()).getConnectionString(connectionUri, false);
	}
	return connectionString;
}

function getDatabaseName(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined, projectName: string): string {
	let databaseName: string = projectName;

	if (settings) {
		if (isISqlProjectPublishSettings(settings)) {
			databaseName = settings.databaseName;
		} else if (isISqlDbDeployProfile(settings)) {
			databaseName = settings.deploySettings?.databaseName ?? '';
		} else if (isIPublishToDockerSettings(settings)) {
			databaseName = settings.sqlProjectPublishSettings.databaseName;
		}
	}

	return databaseName;
}

async function getDeploymentOptions(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined, project: Project): Promise<vscodeMssql.DeploymentOptions | undefined> {
	let deploymentOptions: vscodeMssql.DeploymentOptions | undefined;

	if (settings) {
		if (isISqlProjectPublishSettings(settings)) {
			deploymentOptions = settings.deploymentOptions;
		} else if (isISqlDbDeployProfile(settings)) {
			deploymentOptions = settings.deploySettings?.deploymentOptions;
		} else if (isIPublishToDockerSettings(settings)) {
			deploymentOptions = settings.sqlProjectPublishSettings.deploymentOptions;
		}
	} else {
		deploymentOptions = await utils.getDefaultPublishDeploymentOptions(project);
	}

	return deploymentOptions;
}

function getSqlCmdVariables(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): Map<string, string> | undefined {
	let sqlCmdVariables: Map<string, string> | undefined;

	if (settings) {
		if (isISqlProjectPublishSettings(settings)) {
			sqlCmdVariables = settings.sqlCmdVariables;
		} else if (isISqlDbDeployProfile(settings)) {
			sqlCmdVariables = settings.deploySettings?.sqlCmdVariables;
		} else if (isIPublishToDockerSettings(settings)) {
			sqlCmdVariables = settings.sqlProjectPublishSettings.sqlCmdVariables;
		}
	}

	return sqlCmdVariables;
}

function setProfileParameters(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined, profilePath: vscode.Uri) {
	if (settings) {
		if (isISqlProjectPublishSettings(settings)) {
			settings.publishProfileUri = profilePath;
		} else if (isISqlDbDeployProfile(settings)) {
			if (settings.deploySettings) {
				settings.deploySettings.publishProfileUri = profilePath;
			}
		} else if (isIPublishToDockerSettings(settings)) {
			settings.sqlProjectPublishSettings.publishProfileUri = profilePath;
		}
	}
}
