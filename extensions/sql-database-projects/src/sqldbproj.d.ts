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
		* Adds the list of files and directories to the project, and saves the project file
		* @param projectFile The Uri of the project file
		* @param list list of uris of files and folders to add. Files and folders must already exist. No files or folders will be added if any do not exist.
		*/
		addToProject(projectFile: vscode.Uri, list: vscode.Uri[]): Promise<void>;
	}
}
