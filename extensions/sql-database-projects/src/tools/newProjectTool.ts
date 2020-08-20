/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as nls from 'vscode-nls';
import * as path from 'path';

import * as constants from '../common/constants';
const localize = nls.loadMessageBundle();

export const DBProjectConfigurationKey: string = 'sqlDatabaseProjects';
export const ProjectSaveLocationKey: string = 'defaultProjectSaveLocation';
export const NewDefaultProjectSaveLocation: string = localize('sqlDatabaseProjects.newDefaultProjectSaveLocation', "Would you like to set the default location to save new Database Projects?");
export const OpenWorkspaceSettings: string = localize('sqlDatabaseProjects.openWorkspaceSettings', "Yes, open Settings");
const MaxDefaultProjectNameCounter: number = 99;

export class NewProjectTool {
	/* Returns the default location to save a new database project*/
	public get defaultProjectSaveLocation(): vscode.Uri {
		return this.projectSaveLocationSettingIsValid ? vscode.Uri.file(this.projectSaveLocationSetting) : vscode.Uri.file(os.homedir());
	}

	/* Returns the workspace setting on the default location to save new database projects*/
	private get projectSaveLocationSetting(): string {
		return vscode.workspace.getConfiguration(DBProjectConfigurationKey)[ProjectSaveLocationKey];
	}

	/* Returns if the default save location for new database projects workspace setting is valid*/
	private get projectSaveLocationSettingIsValid(): boolean {
		return (this.projectSaveLocationSetting !== null) && (this.projectSaveLocationSetting !== undefined) &&
			(fs.existsSync(this.projectSaveLocationSetting));
	}

	/* Returns default project name for a fresh new project, such as 'DatabaseProject1'. Auto-increments
		the suggestion if a project of that name already exists in the default save location */
	public defaultProjectNameNewProj(): string {
		return this.defaultProjectName(constants.defaultProjectNameStarter, 1);
	}

	/* Returns default project name for a new project based on given dbName. Auto-increments
		the suggestion if a project of that name already exists in the default save location */
	public defaultProjectNameFromDb(dbName: string): string {
		let projectNameStarter = constants.defaultProjectNameStarter + dbName;
		let projectPath: string = path.join(this.defaultProjectSaveLocation.fsPath, projectNameStarter);
		if (!fs.existsSync(projectPath)) {
			return projectNameStarter;
		}

		return this.defaultProjectName(projectNameStarter, 2);
	}

	/* Returns a project name that begins with the given nameStarter, and ends in a number, such as
		'DatabaseProject1'. Number begins at the given counter, but auto-increments if a project of
		that name already exists in the default save location. */
	private defaultProjectName(nameStarter: string, counter: number): string {
		while (counter < MaxDefaultProjectNameCounter) {
			let name: string = nameStarter + counter;
			let projectPath: string = path.join(this.defaultProjectSaveLocation.fsPath, name);
			if (!fs.existsSync(projectPath)) {
				return name;
			}
			counter++;
		}
		return constants.defaultProjectNameStarter + counter;
	}

	/* Prompts user to update workspace settings*/
	public async updateDefaultSaveLocationSetting(): Promise<void> {
		if (!this.projectSaveLocationSettingIsValid) {
			let result = await vscode.window.showInformationMessage(NewDefaultProjectSaveLocation, OpenWorkspaceSettings);
			if (result === OpenWorkspaceSettings) {
				//open settings
				await vscode.commands.executeCommand('workbench.action.openGlobalSettings');
			}
		}
	}
}
