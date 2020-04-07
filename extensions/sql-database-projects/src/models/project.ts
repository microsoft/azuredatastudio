/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { DataSource } from './dataSources/dataSources';
import { getErrorMessage } from '../common/utils';
import * as xmldom from 'xmldom';

/**
 * Class representing a Project, and providing functions for operating on it
 */
export class Project {
	public projectFilePath: string;
	public files: ProjectEntry[] = [];
	public dataSources: DataSource[] = [];

	public get projectFolderPath() {
		return path.dirname(this.projectFilePath);
	}

	private projFileXmlDoc: any = undefined;

	constructor(projectFilePath: string) {
		this.projectFilePath = projectFilePath;
	}

	/**
	 * Reads the project setting and contents from the file
	 */
	public async readProjFile() {
		let projFileText = await fs.readFile(this.projectFilePath);

		try {
			this.projFileXmlDoc = new xmldom.DOMParser().parseFromString(projFileText.toString());
		}
		catch (err) {
			vscode.window.showErrorMessage(err);
			return;
		}

		// find all folders and files to include

		for (let ig = 0; ig < this.projFileXmlDoc.documentElement.getElementsByTagName('ItemGroup').length; ig++) {
			const itemGroup = this.projFileXmlDoc.documentElement.getElementsByTagName('ItemGroup')[ig];

			for (let b = 0; b < itemGroup.getElementsByTagName('Build').length; b++) {
				this.files.push(this.createProjectEntry(itemGroup.getElementsByTagName('Build')[b].getAttribute('Include'), EntryType.File));
			}

			for (let f = 0; f < itemGroup.getElementsByTagName('Folder').length; f++) {
				this.files.push(this.createProjectEntry(itemGroup.getElementsByTagName('Folder')[f].getAttribute('Include'), EntryType.Folder));
			}
		}
	}

	public async writeProjFile() {
		try {
			const projFileText = '';
			await fs.writeFile(this.projectFilePath, projFileText);
		}
		catch (err) {
			vscode.window.showErrorMessage(err);
			return;
		}
	}

	private createProjectEntry(relativePath: string, entryType: EntryType): ProjectEntry {
		return new ProjectEntry(vscode.Uri.file(path.join(this.projectFolderPath, relativePath)), relativePath, entryType);
	}

	public async addFolderItem(relativeFolderPath: string): Promise<ProjectEntry> {
		const absoluteFolderPath = path.join(this.projectFolderPath, relativeFolderPath);
		await fs.mkdir(absoluteFolderPath, { recursive: true });

		const folderEntry = this.createProjectEntry(relativeFolderPath, EntryType.Folder);
		this.files.push(folderEntry);

		await this.addToProjFile(folderEntry);
		return folderEntry;
	}

	public async addScriptItem(relativeFilePath: string, contents: string): Promise<ProjectEntry> {
		const absoluteFilePath = path.join(this.projectFolderPath, relativeFilePath);
		await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });
		await fs.writeFile(absoluteFilePath, contents);

		const fileEntry = this.createProjectEntry(relativeFilePath, EntryType.File);
		this.files.push(fileEntry);

		await this.addToProjFile(fileEntry);

		return fileEntry;
	}

	private findOrCreateItemGroup(containedTag?: string): any {
		let outputItemGroup = undefined;

		// find any ItemGroup node that contains files; that's where we'll add
		for (let i = 0; i < this.projFileXmlDoc.documentElement.getElementsByTagName('ItemGroup').length; i++) {
			const currentItemGroup = this.projFileXmlDoc.documentElement.getElementsByTagName('ItemGroup')[i];

			// if we're not hunting for a particular child type, or if we are and we find it, use the ItemGroup
			if (!containedTag || currentItemGroup.getElementsByTagName(containedTag).length > 0) {
				outputItemGroup = currentItemGroup;
				break;
			}
		}

		// if none already exist, make a new ItemGroup for it
		if (!outputItemGroup) {
			outputItemGroup = this.projFileXmlDoc.createElement('ItemGroup');
			this.projFileXmlDoc.documentElement.appendChild(outputItemGroup);
		}

		return outputItemGroup;
	}

	private addFileToProjFile(path: string) {
		const newFileNode = this.projFileXmlDoc.createElement('Build');
		newFileNode.setAttribute('Include', path);

		this.findOrCreateItemGroup('Build').appendChild(newFileNode);
	}

	private addFolderToProjFile(path: string) {
		const newFolderNode = this.projFileXmlDoc.createElement('Folder');
		newFolderNode.setAttribute('Include', path);

		this.findOrCreateItemGroup('Folder').appendChild(newFolderNode);
	}

	private async addToProjFile(entry: ProjectEntry) {
		try {
			switch (entry.type) {
				case EntryType.File:
					this.addFileToProjFile(entry.relativePath);
					break;
				case EntryType.Folder:
					this.addFolderToProjFile(entry.relativePath);
			}

			await this.serializeToProjFile(this.projFileXmlDoc);
		}
		catch (err) {
			vscode.window.showErrorMessage(getErrorMessage(err));
			return;
		}
	}

	private async serializeToProjFile(projFileContents: any) {
		const xml = new xmldom.XMLSerializer().serializeToString(projFileContents); // TODO: how to get this to serialize with "pretty" formatting

		await fs.writeFile(this.projectFilePath, xml);
	}
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
