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

	public async construct() {
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
					this.files.push(this.createProjectEntry(fileEntry.$['Include']));
				}
			}

			if (itemGroup['Folder'] !== undefined) {
				for (const folderEntry of itemGroup['Folder']) {
					this.files.push(this.createProjectEntry(folderEntry.$['Include']));
				}
			}
		}
	}

	private createProjectEntry(relativePath: string): ProjectEntry {
		return new ProjectEntry(vscode.Uri.file(path.join(this.projectFile.fsPath, relativePath)));
	}
}

export class ProjectEntry {
	entryUri: vscode.Uri;

	constructor(uri: vscode.Uri) {
		this.entryUri = uri;
	}
}
