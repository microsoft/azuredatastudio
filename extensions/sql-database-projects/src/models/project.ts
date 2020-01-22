/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as xml2js from 'xml2js';
import * as path from 'path';
import { promises as fs } from 'fs';
import { DataSource } from './dataSources/dataSources';

/**
 * Class representing a Project, and providing functions for operating on it
 */
export class Project {
	public projectFile: string;
	public files: ProjectEntry[] = [];
	public dataSources: DataSource[] = [];

	constructor(projectFilePath: string) {
		this.projectFile = projectFilePath;
	}

	/**
	 * Reads the project setting and contents from the file
	 */
	public async readProjFile() {
		let projFileContents = await fs.readFile(this.projectFile);

		const parser = new xml2js.Parser({
			explicitArray: true,
			explicitCharkey: false,
			explicitRoot: false
		});

		let result;

		try {
			result = await parser.parseStringPromise(projFileContents.toString());
		}
		catch (err) {
			vscode.window.showErrorMessage(err);
			return;
		}

		// find all folders and files to include

		for (const itemGroup of result['ItemGroup']) {
			if (itemGroup['Build'] !== undefined) {
				for (const fileEntry of itemGroup['Build']) {
					this.files.push(this.createProjectEntry(fileEntry.$['Include'], EntryType.File));
				}
			}

			if (itemGroup['Folder'] !== undefined) {
				for (const folderEntry of itemGroup['Folder']) {
					this.files.push(this.createProjectEntry(folderEntry.$['Include'], EntryType.Folder));
				}
			}
		}
	}

	private createProjectEntry(relativePath: string, entryType: EntryType): ProjectEntry {
		return new ProjectEntry(vscode.Uri.file(path.join(this.projectFile, relativePath)), entryType);
	}
}

/**
 * Represents an entry in a project file
 */
export class ProjectEntry {
	/**
	 * Absolute file system URI
	 */
	uri: vscode.Uri;
	type: EntryType;

	constructor(uri: vscode.Uri, type: EntryType) {
		this.uri = uri;
		this.type = type;
	}

	public toString(): string {
		return this.uri.path;
	}
}

export enum EntryType {
	File,
	Folder
}
