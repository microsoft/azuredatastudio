/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as vscode from 'vscode';

import { Project } from '../models/project';
import { FolderNode, FileNode, sortFileFolderNodes } from '../models/tree/fileFolderTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';

describe('Project Tree tests', function (): void {
	it('Should correctly order tree nodes by type, then by name', async function (): Promise<void> {
		const parent = new ProjectRootTreeItem(new Project(vscode.Uri.file('Z:\\Fake.sqlproj').fsPath));

		let inputNodes: (FileNode | FolderNode)[] = [
			new FileNode(vscode.Uri.file('Z:\\C'), parent),
			new FileNode(vscode.Uri.file('Z:\\D'), parent),
			new FolderNode(vscode.Uri.file('Z:\\Z'), parent),
			new FolderNode(vscode.Uri.file('Z:\\X'), parent),
			new FileNode(vscode.Uri.file('Z:\\B'), parent),
			new FileNode(vscode.Uri.file('Z:\\A'), parent),
			new FolderNode(vscode.Uri.file('Z:\\W'), parent),
			new FolderNode(vscode.Uri.file('Z:\\Y'), parent)
		];

		console.log('==A: ' + inputNodes.map(n => n.uri.path));
		inputNodes = inputNodes.sort(sortFileFolderNodes);
		console.log('==B: ' + inputNodes.map(n => n.uri.path));


		const expectedNodes: (FileNode | FolderNode)[] = [
			new FolderNode(vscode.Uri.file('Z:\\W'), parent),
			new FolderNode(vscode.Uri.file('Z:\\X'), parent),
			new FolderNode(vscode.Uri.file('Z:\\Y'), parent),
			new FolderNode(vscode.Uri.file('Z:\\Z'), parent),
			new FileNode(vscode.Uri.file('Z:\\A'), parent),
			new FileNode(vscode.Uri.file('Z:\\B'), parent),
			new FileNode(vscode.Uri.file('Z:\\C'), parent),
			new FileNode(vscode.Uri.file('Z:\\D'), parent)
		];

		should(inputNodes.map(n => n.uri.path)).deepEqual(expectedNodes.map(n => n.uri.path));
	});
});
