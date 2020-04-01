/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as xml2js from 'xml2js';
import * as path from 'path';
import { promises as fs } from 'fs';
import { DataSource } from './dataSources/dataSources';
import { getErrorMessage } from '../common/utils';

/**
 * Class representing a Project, and providing functions for operating on it
 */
export class Project {
	public projectFilePath: string;
	public files: ProjectEntry[] = [];
	public dataSources: DataSource[] = [];
	private projFileContents: any = undefined;

	constructor(projectFilePath: string) {
		this.projectFilePath = projectFilePath;
	}

	/**
	 * Reads the project setting and contents from the file
	 */
	public async readProjFile() {
		let projFileText = await fs.readFile(this.projectFilePath);

		const parser = new xml2js.Parser({
			explicitArray: true,
			explicitCharkey: false,
			explicitRoot: false
		});

		try {
			this.projFileContents = await parser.parseStringPromise(projFileText.toString());
		}
		catch (err) {
			vscode.window.showErrorMessage(err);
			return;
		}

		// find all folders and files to include

		for (const itemGroup of this.projFileContents['ItemGroup']) {
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

	public async writeProjFile() {
		try {
			const thing = new xml2js.Builder({
				explicitArray: true,
				explicitCharkey: false,
				explicitRoot: false
			});

			const projFileText = thing.buildObject(this.projFileContents);
			await fs.writeFile(this.projectFilePath, projFileText);
		}
		catch (err) {
			vscode.window.showErrorMessage(err);
			return;
		}
	}

	private createProjectEntry(relativePath: string, entryType: EntryType): ProjectEntry {
		return new ProjectEntry(vscode.Uri.file(path.join(path.dirname(this.projectFilePath), relativePath)), relativePath, entryType);
	}

	public async addScriptItem(fileName: string, contents: string): Promise<ProjectEntry> {
		await fs.writeFile(path.join(path.dirname(this.projectFilePath), fileName), contents);

		const fileEntry = this.createProjectEntry(fileName, EntryType.File);
		this.files.push(fileEntry);

		await this.addToProjFile(fileEntry);

		return fileEntry;
	}

	private async addToProjFile(fileEntry: ProjectEntry) {
		let fileItemGroupNode;

		// find any ItemGroup node that contains files; that's where we'll add
		for (const itemGroup of this.projFileContents['ItemGroup']) {
			if (itemGroup['Build']) {
				fileItemGroupNode = itemGroup;
				break;
			}
		}

		if (!fileItemGroupNode) {
			this.projFileContents['ItemGroup'] = [];
			fileItemGroupNode = this.projFileContents['ItemGroup'];
		}

		if (!fileItemGroupNode['Build']) {
			fileItemGroupNode['Build'] = [];
		}

		fileItemGroupNode['Build'].push(
			{
				$: {
					'Include': fileEntry.relativePath
				}
			}
		);

		try {
			await this.serializeToProjFile(this.projFileContents);
		}
		catch (err) {
			vscode.window.showErrorMessage(getErrorMessage(err));
			return;
		}
	}

	private async serializeToProjFile(projFileContents: any) {
		const builder = new xml2js.Builder();
		const xml = builder.buildObject(projFileContents);

		await fs.writeFile(this.projectFilePath, xml);
	}

	// 	private updateProjFile() {
	// 		let toAdd: Set<string> = new Set<string>();

	// 		for (const currentFile of this.files) {
	// 			toAdd.add(currentFile.fsUri.fsPath);
	// 		}

	// 		this.projFileContents['ItemGroup'].find


	// 		for (const itemGroup of this.projFileContents['ItemGroup']) {
	// 			if (itemGroup['Build'] === undefined) {
	// 				this.projFileContents['ItemGroup'];
	// 			}
	// 					if (itemGroup['Build'] !== undefined) {
	// 				let found
	// 			}
	// 		}
	// 	}
}

/**
 * Represents an entry in a project file
 */
export class ProjectEntry {
	/**
	 * Absolute file system URI
	 */
	fsUri: vscode.Uri;
	relativePath: string;
	type: EntryType;

	constructor(uri: vscode.Uri, relativePath: string, type: EntryType) {
		this.fsUri = uri;
		this.relativePath = relativePath;
		this.type = type;
	}

	public toString(): string {
		return this.fsUri.path;
	}
}

export enum EntryType {
	File,
	Folder
}
