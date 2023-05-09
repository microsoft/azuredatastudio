/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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
import { promptToSaveProfile } from '../../dialogs/publishDatabaseDialog';

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
						const connection = await utils.getAzdataApi()!.connection.openConnectionDialog(undefined, connectionProfile);
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
					const connection = await utils.getAzdataApi()!.connection.openConnectionDialog(undefined, connectionProfile);
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

export async function promptForSavingProfile(project: Project, settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined) {
	const result = await vscode.window.showInformationMessage(constants.saveProfile, constants.yesString, constants.noString);
	if (result === constants.yesString) {
		let publishProfileUri: vscode.Uri | undefined;
		if (settings) {
			if (ifIsISqlProjectPublishSettings(settings)) {
				publishProfileUri = settings.publishProfileUri;
			} else if (ifIsISqlDbDeployProfile(settings)) {
				publishProfileUri = settings.deploySettings?.publishProfileUri;
			} else if (ifIsIPublishToDockerSettings(settings)) {
				publishProfileUri = settings.sqlProjectPublishSettings.publishProfileUri;
			}
		}
		const filePath = await promptToSaveProfile(project, publishProfileUri);

		if (!filePath) {
			return;
		}

		const targetConnectionString = await getConnectionString(settings);
		const targetDatabaseName = getDatabaseName(settings);
		const deploymentOptions = getDeploymentOptions(settings);
		const sqlCmdVariables = getSqlCmdVariables(settings);
		await savePublishProfile(filePath.fsPath, targetDatabaseName, targetConnectionString, sqlCmdVariables, deploymentOptions);

		setProfileParameters(settings, filePath);

		await project.addNoneItem(path.relative(project.projectFolderPath, filePath.fsPath));
		void vscode.commands.executeCommand(constants.refreshDataWorkspaceCommand);		//refresh data workspace to load the newly added profile to the tree
	}
}

export function ifIsISqlProjectPublishSettings(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): settings is ISqlProjectPublishSettings {
	if ((settings as ISqlProjectPublishSettings).connectionUri) {
		return true
	}
	return false
}

export function ifIsISqlDbDeployProfile(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): settings is ISqlDbDeployProfile {
	if ((settings as ISqlDbDeployProfile).deploySettings) {
		return true
	}
	return false
}

export function ifIsIPublishToDockerSettings(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): settings is IPublishToDockerSettings {
	if ((settings as IPublishToDockerSettings).dockerSettings) {
		return true
	}
	return false
}

export async function getConnectionString(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): Promise<string> {
	let connectionUri: string = '';
	let connectionString;

	if (settings) {
		if (ifIsISqlProjectPublishSettings(settings)) {
			connectionUri = settings.connectionUri;
		} else if (ifIsISqlDbDeployProfile(settings)) {
			connectionUri = settings.deploySettings?.connectionUri ?? '';
		} else if (ifIsIPublishToDockerSettings(settings)) {
			connectionUri = settings.sqlProjectPublishSettings.connectionUri;
		}
	}

	connectionString = (await utils.getVscodeMssqlApi()).getConnectionString(connectionUri, false);
	return connectionString;
}

export function getDatabaseName(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): string {
	let databaseName: string = '';

	if (settings) {
		if (ifIsISqlProjectPublishSettings(settings)) {
			databaseName = settings.databaseName;
		} else if (ifIsISqlDbDeployProfile(settings)) {
			databaseName = settings.deploySettings?.databaseName ?? '';
		} else if (ifIsIPublishToDockerSettings(settings)) {
			databaseName = settings.sqlProjectPublishSettings.databaseName;
		}
	}

	return databaseName;
}

export function getDeploymentOptions(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): vscodeMssql.DeploymentOptions | undefined {
	let deploymentOptions: vscodeMssql.DeploymentOptions | undefined;

	if (settings) {
		if (ifIsISqlProjectPublishSettings(settings)) {
			deploymentOptions = settings.deploymentOptions;
		} else if (ifIsISqlDbDeployProfile(settings)) {
			deploymentOptions = settings.deploySettings?.deploymentOptions;
		} else if (ifIsIPublishToDockerSettings(settings)) {
			deploymentOptions = settings.sqlProjectPublishSettings.deploymentOptions;
		}
	}

	return deploymentOptions;
}

export function getSqlCmdVariables(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined): Map<string, string> | undefined {
	let sqlCmdVariables: Map<string, string> | undefined;

	if (settings) {
		if (ifIsISqlProjectPublishSettings(settings)) {
			sqlCmdVariables = settings.sqlCmdVariables;
		} else if (ifIsISqlDbDeployProfile(settings)) {
			sqlCmdVariables = settings.deploySettings?.sqlCmdVariables;
		} else if (ifIsIPublishToDockerSettings(settings)) {
			sqlCmdVariables = settings.sqlProjectPublishSettings.sqlCmdVariables;
		}
	}

	return sqlCmdVariables;
}

export function setProfileParameters(settings: ISqlProjectPublishSettings | ISqlDbDeployProfile | IPublishToDockerSettings | undefined, profilePath: vscode.Uri) {
	if (settings) {
		if (ifIsISqlProjectPublishSettings(settings)) {
			settings.profileUsed = true;
			settings.publishProfileUri = profilePath;
		} else if (ifIsISqlDbDeployProfile(settings)) {
			if (settings.deploySettings) {
				settings.deploySettings.profileUsed = true;
				settings.deploySettings.publishProfileUri = profilePath;
			}
		} else if (ifIsIPublishToDockerSettings(settings)) {
			settings.sqlProjectPublishSettings.profileUsed = true;
			settings.sqlProjectPublishSettings.publishProfileUri = profilePath;
		}
	}
}