/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as xml2js from 'xml2js';
import * as path from 'path';
import { promises as fs } from 'fs';

export class Project {
	public projectFile: vscode.Uri;
	public files: ProjectEntry[] = [];

	constructor(projectFile: vscode.Uri) {
		this.projectFile = projectFile;
	}

	public async readProjFile() {
		let projFileContents = await fs.readFile(this.projectFile.fsPath);

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
		return new ProjectEntry(vscode.Uri.file(path.join(this.projectFile.fsPath, relativePath)), entryType);
	}
}

export class ProjectEntry {
	uri: vscode.Uri;
	type: EntryType;

	constructor(uri: vscode.Uri, type: EntryType) {
		this.uri = uri;
		this.type = type;
	}
}

enum EntryType {
	File,
	Folder
}
