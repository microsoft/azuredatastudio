/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as mssql from 'mssql';
import * as constants from '../common/constants';
import type * as azdata from 'azdata';
import { getSqlProjectsInWorkspace, getVscodeMssqlApi } from '../common/utils';
import { IConnectionInfo } from 'vscode-mssql';
import { Project } from '../models/project';
import { UpdateProjectDataModel, UpdateProjectAction } from '../models/api/updateProject';

/**
 * Create flow for update Project from existing database using only VS Code-native APIs such as QuickPick
 * @param connectionInfo Optional connection info to use instead of prompting the user for a connection
 * @param updateProjectFromDatabaseCallback Optional callback function to update the project from the user inputs
 */
export async function UpdateProjectFromDatabaseWithQuickpick(connectionInfo?: IConnectionInfo, updateProjectFromDatabaseCallback?: (model: UpdateProjectDataModel) => Promise<void>
): Promise<void> {
	const vscodeMssqlApi = await getVscodeMssqlApi();

	// Prompt 1a. Select connection (if not provided)
	let connectionProfile: IConnectionInfo | undefined = connectionInfo ?? await vscodeMssqlApi.promptForConnection(true);
	if (!connectionProfile) {
		// User cancelled
		return undefined;
	}
	let connectionUri: string = '';
	let dbs: string[] | undefined = undefined;

	// Prompt 1b. Select database (if not already specified in connection profile)
	let selectedDatabase: string;
	if (connectionProfile.database && connectionProfile.database !== constants.master) {
		selectedDatabase = connectionProfile.database;
	} else {
		// Need to get list of databases
		connectionUri = await vscodeMssqlApi.connect(connectionProfile);
		dbs = (await vscodeMssqlApi.listDatabases(connectionUri))
			.filter(db => !constants.systemDbs.includes(db));

		const dbSelection = await vscode.window.showQuickPick(
			dbs,
			{ title: constants.selectDatabase, ignoreFocusOut: true });
		if (!dbSelection) {
			// User cancelled
			return undefined;
		}
		selectedDatabase = dbSelection;
	}

	// Prompt 2. Browse and Select existing project file - first show workspace projects, then browse option
	let projectFilePath: string;

	// Get workspace projects
	const workspaceProjects = await getSqlProjectsInWorkspace();
	const projectOptions: string[] = [constants.browseEllipsisWithIcon];

	// Add workspace projects to the list
	workspaceProjects.forEach(projectUri => {
		projectOptions.push(projectUri.fsPath);
	});

	const projectSelection = await vscode.window.showQuickPick(
		projectOptions,
		{ title: constants.selectProjectFile, ignoreFocusOut: true });

	if (!projectSelection) {
		// User cancelled
		return undefined;
	}

	if (projectSelection === constants.browseEllipsisWithIcon) {
		// Show file browser
		const projectFileUri = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			openLabel: constants.selectString,
			title: constants.selectProjectFile,
			filters: {
				'SQL Projects': ['sqlproj']
			}
		});

		if (!projectFileUri || projectFileUri.length === 0) {
			// User cancelled
			return undefined;
		}

		projectFilePath = projectFileUri[0].fsPath;
	} else {
		// User selected a workspace project
		projectFilePath = projectSelection;
	}

	const project = await Project.openProject(projectFilePath);

	//Prompt 3: Select the action
	const actionSelection = await vscode.window.showQuickPick(
		[constants.compareActionRadioButtonLabel, constants.updateActionRadioButtonLabel],
		{
			title: constants.actionLabel,
			ignoreFocusOut: true
		});
	if (!actionSelection) {
		// User cancelled
		return undefined;
	}

	// Map the selected action to the enum
	const selectedAction = actionSelection === constants.compareActionRadioButtonLabel
		? UpdateProjectAction.Compare
		: UpdateProjectAction.Update;

	// let connection = (await getAzdataApi()!.connection.getConnections(true)).filter(con => con.connectionId === serverDropdownValue.connection.connectionId)[0];

	// 5. Create model using existing connection info
	const connectionDetails: azdata.IConnectionProfile = {
		id: connectionProfile.server + '_' + selectedDatabase,
		userName: connectionProfile.user,
		password: connectionProfile.password,
		serverName: connectionProfile.server,
		databaseName: selectedDatabase,
		connectionName: connectionProfile.server,
		providerName: 'MSSQL',
		groupId: '',
		groupFullName: '',
		authenticationType: connectionProfile.authenticationType || 'SqlLogin',
		savePassword: false,
		saveProfile: false,
		options: {},
	};

	const sourceEndpointInfo: mssql.SchemaCompareEndpointInfo = {
		endpointType: mssql.SchemaCompareEndpointType.Database,
		databaseName: selectedDatabase,
		serverDisplayName: connectionProfile.server,
		serverName: connectionProfile.server,
		connectionDetails: connectionDetails,
		ownerUri: connectionUri,
		projectFilePath: '',
		extractTarget: mssql.ExtractTarget.schemaObjectType,
		targetScripts: [],
		dataSchemaProvider: '',
		packageFilePath: '',
		connectionName: connectionProfile.server
	};

	const targetEndpointInfo: mssql.SchemaCompareEndpointInfo = {
		endpointType: mssql.SchemaCompareEndpointType.Project,
		projectFilePath: projectFilePath,
		extractTarget: mssql.ExtractTarget.schemaObjectType,
		targetScripts: [],
		dataSchemaProvider: project.getProjectTargetVersion(),
		connectionDetails: connectionDetails,
		databaseName: '',
		serverDisplayName: '',
		serverName: '',
		ownerUri: '',
		packageFilePath: '',
	};

	const model: UpdateProjectDataModel = {
		sourceEndpointInfo: sourceEndpointInfo,
		targetEndpointInfo: targetEndpointInfo,
		action: selectedAction
	};

	// Update the project using the callback
	if (updateProjectFromDatabaseCallback) {
		await updateProjectFromDatabaseCallback(model);
	}
}