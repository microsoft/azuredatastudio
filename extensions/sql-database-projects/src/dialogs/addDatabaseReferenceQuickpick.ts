/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path = require('path');
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { getSqlProjectsInWorkspace, getSystemDatabase, validateSqlCmdVariableName } from '../common/utils';
import { DbServerValues, populateResultWithVars } from './utils';
import { AddDatabaseReferenceSettings } from '../controllers/projectController';
import { IDacpacReferenceSettings, INugetPackageReferenceSettings, IProjectReferenceSettings, ISystemDatabaseReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { Project } from '../models/project';
import { getSystemDbOptions, promptDacpacLocation } from './addDatabaseReferenceDialog';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { ProjectType, SystemDbReferenceType } from 'vscode-mssql';

/**
 * Create flow for adding a database reference using only VS Code-native APIs such as QuickPick
 */
export async function addDatabaseReferenceQuickpick(project: Project): Promise<AddDatabaseReferenceSettings | undefined> {

	const otherProjectsInWorkspace = (await getSqlProjectsInWorkspace()).filter(p => p.fsPath !== project.projectFilePath);

	// 1. Prompt for reference type
	// Only show project option if we have at least one other project in the workspace
	const referencedDatabaseTypes = otherProjectsInWorkspace.length > 0 ?
		[constants.projectLabel, constants.systemDatabase, constants.dacpacText] :
		[constants.systemDatabase, constants.dacpacText];

	// only add nupkg database reference option if project is SDK-style
	if (project.sqlProjStyle === ProjectType.SdkStyle) {
		referencedDatabaseTypes.push(constants.nupkgText);
	}

	const referencedDatabaseType = await vscode.window.showQuickPick(
		referencedDatabaseTypes,
		{ title: constants.referencedDatabaseType, ignoreFocusOut: true });
	if (!referencedDatabaseType) {
		// User cancelled
		return undefined;
	}

	switch (referencedDatabaseType) {
		case constants.projectLabel:
			return addProjectReference(otherProjectsInWorkspace);
		case constants.systemDatabase:
			return addSystemDatabaseReference(project);
		case constants.dacpacText:
			return addDacpacReference(project);
		case constants.nupkgText:
			return addNupkgReference();
		default:
			console.log(`Unknown referenced database type ${referencedDatabaseType}`);
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

	populateResultWithVars(referenceSettings, dbServerValues);

	// 7. Prompt suppress unresolved ref errors
	const suppressErrors = await promptSuppressUnresolvedRefErrors();
	referenceSettings.suppressMissingDependenciesErrors = suppressErrors;

	TelemetryReporter.createActionEvent(TelemetryViews.ProjectTree, TelemetryActions.addDatabaseReference)
		.withAdditionalProperties({ referencedDatabaseType: constants.projectLabel })
		.send();

	return referenceSettings;
}

async function addSystemDatabaseReference(project: Project): Promise<ISystemDatabaseReferenceSettings | undefined> {
	// (steps continued from addDatabaseReferenceQuickpick)
	// 2. Prompt System DB

	const selectedSystemDb = await vscode.window.showQuickPick(
		getSystemDbOptions(project),
		{ title: constants.systemDatabase, ignoreFocusOut: true });
	if (!selectedSystemDb) {
		// User cancelled
		return undefined;
	}

	// 3 Prompt for Reference Type if it's an SDK-style project
	const referenceType = await promptReferenceType(project);
	if (referenceType === undefined) { // need to check for specifically undefined here because the enum SystemDbReferenceType.ArtifactReference evaluates to 0
		// User cancelled
		return undefined;
	}

	// 4. Prompt DB name
	const dbName = await promptDbName(selectedSystemDb);
	if (!dbName) {
		// User cancelled
		return undefined;
	}

	// 5. Prompt suppress unresolved ref errors
	const suppressErrors = await promptSuppressUnresolvedRefErrors();

	TelemetryReporter.createActionEvent(TelemetryViews.ProjectTree, TelemetryActions.addDatabaseReference)
		.withAdditionalProperties({ referencedDatabaseType: constants.systemDatabase })
		.send();

	return {
		databaseVariableLiteralValue: dbName,
		systemDb: getSystemDatabase(selectedSystemDb),
		suppressMissingDependenciesErrors: suppressErrors,
		systemDbReferenceType: referenceType
	};
}

async function addDacpacReference(project: Project): Promise<IDacpacReferenceSettings | undefined> {
	// (steps continued from addDatabaseReferenceQuickpick)
	// 2. Prompt for location
	const location = await promptLocation();
	if (!location) {
		// User cancelled
		return undefined;
	}

	// 3. Prompt for dacpac location
	// Show quick pick with just browse option to give user context about what the file dialog is for (since that doesn't always have a title)
	let dacPacLocation;
	while (!dacPacLocation) {
		const browseSelected = await vscode.window.showQuickPick(
			[constants.browseEllipsisWithIcon],
			{
				title: constants.selectDacpac,
				ignoreFocusOut: true,
				placeHolder: constants.dacpacMustBeOnSameDrive
			});
		if (!browseSelected) {
			return undefined;
		}

		dacPacLocation = (await promptDacpacLocation())?.[0];
		if (!dacPacLocation) {
			// User cancelled
			return undefined;
		}

		// only support adding dacpacs that are on the same drive as the sqlproj
		const projectDrive = path.parse(project.projectFilePath).root;
		const dacpacDrive = path.parse(dacPacLocation.fsPath).root;
		if (projectDrive !== dacpacDrive) {
			void vscode.window.showErrorMessage(constants.dacpacNotOnSameDrive(project.projectFilePath));

			// set dacPacLocation to undefined so that the browse quickpick will show again
			dacPacLocation = undefined;
		}
	}

	// 4. Prompt for db/server values
	const dbServerValues = await promptDbServerValues(location, path.parse(dacPacLocation.fsPath).name);
	if (!dbServerValues) {
		// User cancelled
		return;
	}

	// 5. Prompt suppress unresolved ref errors
	const suppressErrors = await promptSuppressUnresolvedRefErrors();

	// 6. Construct result

	const referenceSettings: IDacpacReferenceSettings = {
		dacpacFileLocation: dacPacLocation,
		suppressMissingDependenciesErrors: suppressErrors
	};

	populateResultWithVars(referenceSettings, dbServerValues);

	TelemetryReporter.createActionEvent(TelemetryViews.ProjectTree, TelemetryActions.addDatabaseReference)
		.withAdditionalProperties({ referencedDatabaseType: constants.dacpacText })
		.send();

	return referenceSettings;
}

async function addNupkgReference(): Promise<INugetPackageReferenceSettings | undefined> {
	// (steps continued from addDatabaseReferenceQuickpick)
	// 2. Prompt for location
	const location = await promptLocation();
	if (!location) {
		// User cancelled
		return undefined;
	}

	// 3. Prompt for NuGet package name
	const nupkgName = await vscode.window.showInputBox(
		{
			title: constants.nupkgText,
			placeHolder: constants.nupkgNamePlaceholder,
			validateInput: (value) => {
				return value ? undefined : constants.nameMustNotBeEmpty;
			},
			ignoreFocusOut: true
		});

	if (!nupkgName) {
		// User cancelled
		return undefined;
	}

	// 4. Prompt for NuGet package version
	const nupkgVersion = await vscode.window.showInputBox(
		{
			title: constants.version,
			placeHolder: constants.versionPlaceholder,
			validateInput: (value) => {
				return value ? undefined : constants.versionMustNotBeEmpty;
			},
			ignoreFocusOut: true
		});

	if (!nupkgVersion) {
		// User cancelled
		return undefined;
	}


	// 5. Prompt for db/server values
	const dbServerValues = await promptDbServerValues(location, path.parse(nupkgName).name);
	if (!dbServerValues) {
		// User cancelled
		return;
	}

	// 6. Prompt suppress unresolved ref errors
	const suppressErrors = await promptSuppressUnresolvedRefErrors();

	// 7. Construct result

	const referenceSettings: INugetPackageReferenceSettings = {
		packageName: nupkgName,
		packageVersion: nupkgVersion,
		suppressMissingDependenciesErrors: suppressErrors
	};

	populateResultWithVars(referenceSettings, dbServerValues);

	TelemetryReporter.createActionEvent(TelemetryViews.ProjectTree, TelemetryActions.addDatabaseReference)
		.withAdditionalProperties({ referencedDatabaseType: constants.nupkgText })
		.send();

	return referenceSettings;
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
				return validateSqlCmdVariableName(value) ?? '';
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
				return validateSqlCmdVariableName(value) ?? '';
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

async function promptReferenceType(project: Project): Promise<SystemDbReferenceType | undefined> {
	let referenceType = SystemDbReferenceType.ArtifactReference;
	if (project.sqlProjStyle === ProjectType.SdkStyle) {
		const referenceTypeString = await vscode.window.showQuickPick(
			[constants.packageReference, constants.artifactReference],
			{ title: constants.referenceTypeRadioButtonsGroupTitle, ignoreFocusOut: true }
		);

		if (referenceTypeString === undefined) { // need to check for specifically undefined here because the enum SystemDbReferenceType.ArtifactReference evaluates to 0
			return undefined;
		}

		referenceType = referenceTypeString === constants.packageReference ? SystemDbReferenceType.PackageReference : SystemDbReferenceType.ArtifactReference;
	}

	return referenceType;
}
