/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path = require('path');
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { getSqlProjectsInWorkspace, isValidSqlCmdVariableName, removeSqlCmdVariableFormatting } from '../common/utils';
import { AddDatabaseReferenceSettings } from '../controllers/projectController';
import { IDacpacReferenceSettings, IProjectReferenceSettings, ISystemDatabaseReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { Project } from '../models/project';
import { getSystemDatabase, getSystemDbOptions, promptDacpacLocation } from './addDatabaseReferenceDialog';

interface DbServerValues {
	dbName?: string,
	dbVariable?: string,
	serverName?: string,
	serverVariable?: string
}

/**
 * Create flow for adding a database reference using only VS Code-native APIs such as QuickPick
 * @param connectionInfo Optional connection info to use instead of prompting the user for a connection
 */
export async function addDatabaseReferenceQuickpick(project: Project): Promise<AddDatabaseReferenceSettings | undefined> {

	const otherProjectsInWorkspace = (await getSqlProjectsInWorkspace()).filter(p => p.fsPath !== project.projectFilePath);

	// 1. Prompt for reference type
	// Only show project option if we have at least one other project in the workspace
	const referenceTypes = otherProjectsInWorkspace.length > 0 ?
		[constants.projectLabel, constants.systemDatabase, constants.dacpacText] :
		[constants.systemDatabase, constants.dacpacText];

	const referenceType = await vscode.window.showQuickPick(
		referenceTypes,
		{ title: constants.referenceType, ignoreFocusOut: true });
	if (!referenceType) {
		// User cancelled
		return undefined;
	}

	switch (referenceType) {
		case constants.projectLabel:
			return addProjectReference(otherProjectsInWorkspace);
		case constants.systemDatabase:
			return addSystemDatabaseReference(project);
		case constants.dacpacText:
			return addDacpacReference();
		default:
			console.log(`Unknown reference type ${referenceType}`);
			return undefined;
	}
}

async function addProjectReference(otherProjectsInWorkspace: vscode.Uri[]): Promise<IProjectReferenceSettings | undefined> {
	// (steps continued from addDatabaseReferenceQuickpick)
	// 2. Prompt database project
	const otherProjectQuickpickItems: (vscode.QuickPickItem & { uri: vscode.Uri })[] = otherProjectsInWorkspace.map(p => {
		return {
			label: path.parse(p.fsPath).name,
			uri: p
		};
	});

	const selectedProject = await vscode.window.showQuickPick(
		otherProjectQuickpickItems,
		{ title: constants.databaseProject, ignoreFocusOut: true, });
	if (!selectedProject) {
		return;
	}

	// 3. Prompt location
	const location = await promptLocation();
	if (!location) {
		// User cancelled
		return;
	}

	const referenceSettings: IProjectReferenceSettings = {
		projectName: selectedProject.label,
		projectGuid: '',
		projectRelativePath: undefined,
		databaseName: undefined,
		databaseVariable: undefined,
		serverName: undefined,
		serverVariable: undefined,
		suppressMissingDependenciesErrors: false
	};

	const dbServerValues = await promptDbServerValues(location, selectedProject.label);
	if (!dbServerValues) {
		// User cancelled
		return;
	}
	referenceSettings.databaseName = dbServerValues.dbName;
	referenceSettings.databaseVariable = dbServerValues.dbVariable;
	referenceSettings.serverName = dbServerValues.serverName;
	referenceSettings.serverVariable = dbServerValues.serverVariable;

	// 7. Prompt suppress unresolved ref errors
	const suppressErrors = await promptSuppressUnresolvedRefErrors();
	referenceSettings.suppressMissingDependenciesErrors = suppressErrors;

	return referenceSettings;
}

async function addSystemDatabaseReference(project: Project): Promise<ISystemDatabaseReferenceSettings | undefined> {
	// (steps continued from addDatabaseReferenceQuickpick)
	// 2. Prompt System DB

	const selectedSystemDb = await vscode.window.showQuickPick(
		getSystemDbOptions(project),
		{ title: constants.systemDatabase, ignoreFocusOut: true, });
	if (!selectedSystemDb) {
		// User cancelled
		return undefined;
	}

	// 3. Prompt DB name
	const dbName = await promptDbName(selectedSystemDb);

	// 4. Prompt suppress unresolved ref errors
	const suppressErrors = await promptSuppressUnresolvedRefErrors();

	return {
		databaseName: dbName,
		systemDb: getSystemDatabase(selectedSystemDb),
		suppressMissingDependenciesErrors: suppressErrors
	};
}

async function addDacpacReference(): Promise<IDacpacReferenceSettings | undefined> {
	// (steps continued from addDatabaseReferenceQuickpick)
	// 2. Prompt for location
	const location = await promptLocation();
	if (!location) {
		// User cancelled
		return undefined;
	}

	// 3. Prompt for dacpac location
	// Show quick pick with just browse option to give user context about what the file dialog is for (since that doesn't always have a title)
	const browseSelected = await vscode.window.showQuickPick(
		[constants.browseEllipsisWithIcon],
		{ title: constants.selectDacpac, ignoreFocusOut: true });
	if (!browseSelected) {
		return undefined;
	}

	const dacPacLocation = (await promptDacpacLocation())?.[0];
	if (!dacPacLocation) {
		// User cancelled
		return undefined;
	}

	// 4. Prompt for db/server values
	const dbServerValues = await promptDbServerValues(location, path.parse(dacPacLocation.fsPath).name);
	if (!dbServerValues) {
		// User cancelled
		return;
	}

	// 5. Prompt suppress unresolved ref errors
	const suppressErrors = await promptSuppressUnresolvedRefErrors();

	return {
		databaseName: dbServerValues.dbName,
		dacpacFileLocation: dacPacLocation,
		databaseVariable: removeSqlCmdVariableFormatting(dbServerValues.dbVariable),
		serverName: dbServerValues.serverName,
		serverVariable: removeSqlCmdVariableFormatting(dbServerValues.serverVariable),
		suppressMissingDependenciesErrors: suppressErrors
	};
}

async function promptLocation(): Promise<string | undefined> {
	return vscode.window.showQuickPick(
		constants.locationDropdownValues,
		{ title: constants.location, ignoreFocusOut: true, });
}

async function promptDbName(defaultValue: string): Promise<string | undefined> {
	return vscode.window.showInputBox(
		{
			title: constants.databaseName,
			value: defaultValue,
			validateInput: (value) => {
				return value ? undefined : constants.nameMustNotBeEmpty;
			},
			ignoreFocusOut: true
		});
}

async function promptDbVar(defaultValue: string): Promise<string> {
	return await vscode.window.showInputBox(
		{
			title: constants.databaseVariable,
			value: defaultValue,
			validateInput: (value: string) => {
				return isValidSqlCmdVariableName(value) ? '' : constants.notValidVariableName(value);
			},
			ignoreFocusOut: true
		}) ?? '';
}

async function promptServerName(): Promise<string | undefined> {
	return vscode.window.showInputBox(
		{
			title: constants.serverName,
			value: constants.otherServer,
			validateInput: (value) => {
				return value ? undefined : constants.nameMustNotBeEmpty;
			},
			ignoreFocusOut: true
		});
}

async function promptServerVar(): Promise<string> {
	return await vscode.window.showInputBox(
		{
			title: constants.serverVariable,
			value: constants.otherSeverVariable,
			validateInput: (value: string) => {
				return isValidSqlCmdVariableName(value) ? '' : constants.notValidVariableName(value);
			},
			ignoreFocusOut: true
		}) ?? '';
}

async function promptSuppressUnresolvedRefErrors(): Promise<boolean> {
	const selectedOption = await vscode.window.showQuickPick(
		[constants.noStringDefault, constants.yesString],
		{ title: constants.suppressMissingDependenciesErrors, ignoreFocusOut: true, });
	return selectedOption === constants.yesString ? true : false;
}

async function promptDbServerValues(location: string, defaultDbName: string): Promise<DbServerValues | undefined> {
	const ret: DbServerValues = {};

	// Only prompt db values if the location is on a different db/server
	if (location !== constants.sameDatabase) {
		// 4. Prompt database name
		const dbName = await promptDbName(defaultDbName);
		if (!dbName) {
			// User cancelled
			return undefined;
		}
		ret.dbName = dbName;

		// 5. Prompt db var
		const dbVar = await promptDbVar(dbName);
		// DB Variable is optional so treat escape as skipping it (not cancel in this case)
		ret.dbVariable = dbVar;
	}

	// Only prompt server values if location is different server
	if (location === constants.differentDbDifferentServer) {
		// 5. Prompt server name
		const serverName = await promptServerName();
		if (!serverName) {
			// User cancelled
			return undefined;
		}
		ret.serverName = serverName;

		// 6. Prompt server var
		const serverVar = await promptServerVar();
		if (!serverVar) {
			// User cancelled
			return undefined;
		}
		ret.serverVariable = serverVar;
	}
	return ret;
}
