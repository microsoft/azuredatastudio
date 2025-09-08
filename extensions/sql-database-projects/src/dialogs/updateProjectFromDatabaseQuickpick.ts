/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as mssqlVscode from 'vscode-mssql';
import * as constants from '../common/constants';
import { getSqlProjectsInWorkspace, getVscodeMssqlApi } from '../common/utils';
import { IConnectionInfo } from 'vscode-mssql';
import { Project } from '../models/project';
import { UpdateProjectDataModel, UpdateProjectAction } from '../models/api/updateProject';

/**
 * Create flow for update Project from existing database using only VS Code-native APIs such as QuickPick
 *
 * This helper drives a small, synchronous UX flow that:
 *  1) Prompts (or reuses) a connection
 *  2) Prompts for a database (if needed)
 *  3) Lets the user select an existing .sqlproj in the workspace (or browse to one) if needed
 *  4) Asks whether the user wants to Compare or Update the project
 *  5) Constructs an UpdateProjectDataModel and passes it to the optional callback
 *
 * @param connectionInfo Optional connection info to use instead of prompting the user for a connection
 * @param projectFilePath Optional project file path to use instead of prompting the user to select one
 * @param updateProjectFromDatabaseCallback Optional callback function to update the project from the user inputs
 */
export async function UpdateProjectFromDatabaseWithQuickpick(connectionInfo?: IConnectionInfo, projectFilePath?: string, updateProjectFromDatabaseCallback?: (model: UpdateProjectDataModel) => Promise<void>
): Promise<void> {
	const vscodeMssqlApi = await getVscodeMssqlApi();

	// Prompt 1a. Select connection (if not provided)
	// If connectionInfo was passed in, reuse it; otherwise show the native mssql connection picker.
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
		connectionUri = await vscodeMssqlApi.connect(connectionProfile);
	} else {
		// Need to get list of databases from the server and prompt the user
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

	// Prompt 2. Browse and Select existing project file, when projectFilePath is not available
	if (!projectFilePath) {
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

	// Build the connectionDetails object expected by the schema-compare endpoints.
	// This is a lightweight mapping that mirrors the shape used by the mssql/vscode-mssql APIs.
	const connectionDetails = {
		id: (connectionProfile as any).id,
		userName: connectionProfile.user,
		password: connectionProfile.password,
		serverName: connectionProfile.server,
		databaseName: selectedDatabase,
		connectionName: connectionProfile.server,
		providerName: 'MSSQL',
		authenticationType: connectionProfile.authenticationType,
		options: {}
	};

	// Construct the source endpoint (the database)
	const sourceEndpointInfo: mssqlVscode.SchemaCompareEndpointInfo = {
		endpointType: mssqlVscode.SchemaCompareEndpointType.Database,
		databaseName: selectedDatabase,
		serverDisplayName: connectionProfile.server,
		serverName: connectionProfile.server,
		connectionDetails: connectionDetails,
		ownerUri: connectionUri,
		projectFilePath: '',
		extractTarget: mssqlVscode.ExtractTarget.schemaObjectType,
		targetScripts: [],
		dataSchemaProvider: '',
		packageFilePath: '',
		connectionName: connectionProfile.server
	};

	// Construct the target endpoint (the selected project)
	const targetEndpointInfo: mssqlVscode.SchemaCompareEndpointInfo = {
		endpointType: mssqlVscode.SchemaCompareEndpointType.Project,
		projectFilePath: projectFilePath,
		extractTarget: mssqlVscode.ExtractTarget.schemaObjectType,
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
	// Invoke the caller-provided callback with the collected model. The callback is responsible
	//  for running the compare or update operation; this function only collects and returns inputs.
	if (updateProjectFromDatabaseCallback) {
		await updateProjectFromDatabaseCallback(model);
	}
}