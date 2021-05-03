/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'sqldbproj' {
	import * as vscode from 'vscode';
	export const enum extension {
		name = 'Microsoft.sql-database-projects'
	}

	/**
	 * sql database projects extension
	 */
	export interface IExtension {
		/**
		 * Create a project
		 * @param name name of the project
		 * @param location the parent directory
		 * @param projectTypeId the ID of the project/template
		 * @returns Uri of the newly created project file
		 */
		createProject(name: string, location: vscode.Uri, projectTypeId: string): Promise<vscode.Uri>;

		/**
		 * returns array of open sql projects
		 */
		getProjects(): ISqlProject[];
	}

	export interface ISqlProject {
		/**
		 * Reads the project setting and contents from the file
		 */
		readProjFile(): Promise<void>;

		/**
		 * Adds the list of sql files and directories to the project, and saves the project file
		 * @param list list of files and folder Uris. Files and folders must already exist. No files or folders will be added if any do not exist.
		 */
		addToProject(list: vscode.Uri[]): Promise<void>;

		/**
		 * Adds a folder to the project, and saves the project file
		 * @param relativeFolderPath Relative path of the folder
		 */
		addFolderItem(relativeFolderPath: string): Promise<IFileProjectEntry>;

		/**
		 * Writes a file to disk if contents are provided, adds that file to the project, and writes it to disk
		 * @param relativeFilePath Relative path of the file
		 * @param contents Contents to be written to the new file
		 */
		addScriptItem(relativeFilePath: string, contents?: string, itemType?: string): Promise<IFileProjectEntry>;

		/**
		 * Adds a SQLCMD variable to the project
		 * @param name name of the variable
		 * @param defaultValue
		 */
		addSqlCmdVariable(name: string, defaultValue: string): Promise<void>;

		/**
		 * Excludes entry from project by removing it from the project file
		 * @param entry
		 */
		exclude(entry: IFileProjectEntry): Promise<void>;

		/**
		 * Deletes file or folder and removes it from the project file
		 * @param entry
		 */
		deleteFileFolder(entry: IFileProjectEntry): Promise<void>;

		/**
		 * returns the sql version the project is targeting
		 */
		getProjectTargetVersion(): string;

		/**
		 * Path where dacpac is output to after a successful build
		 */
		readonly dacpacOutputPath: string;

		/**
		 * Path to folder containing the project file
		 */
		readonly projectFolderPath: string;

		/**
		 * Project file path
		 */
		readonly projectFilePath: string;

		/**
		 * Project file name
		 */
		readonly projectFileName: string;

		/**
		 * Files and folders that are included in the project
		 */
		readonly files: IFileProjectEntry[];

		/**
		 * SqlCmd variables and their values
		 */
		readonly sqlCmdVariables: Record<string, string>;
	}

	/**
	 * Represents an entry in a project file
	 */
	export interface IFileProjectEntry {
		fsUri: vscode.Uri;
		relativePath: string;
	}
}
