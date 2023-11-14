/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

import { Project } from '../models/project';
import { FolderNode, FileNode, sortFileFolderNodes, SqlObjectFileNode } from '../models/tree/fileFolderTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { DatabaseProjectItemType } from '../common/constants';
import { EntryType } from 'sqldbproj';

describe('Project Tree tests', function (): void {
	it('Should correctly order tree nodes by type, then by name', function (): void {
		const root = os.platform() === 'win32' ? 'Z:\\' : '/';

		const sqlprojUri = vscode.Uri.file(`${root}Fake.sqlproj`);

		let inputNodes: (FileNode | FolderNode)[] = [
			new SqlObjectFileNode(vscode.Uri.file(`${root}C`), sqlprojUri, 'C'),
			new SqlObjectFileNode(vscode.Uri.file(`${root}D`), sqlprojUri, 'D'),
			new FolderNode(vscode.Uri.file(`${root}Z`), sqlprojUri, 'Z'),
			new FolderNode(vscode.Uri.file(`${root}X`), sqlprojUri, 'X'),
			new SqlObjectFileNode(vscode.Uri.file(`${root}B`), sqlprojUri, 'B'),
			new SqlObjectFileNode(vscode.Uri.file(`${root}A`), sqlprojUri, 'A'),
			new FolderNode(vscode.Uri.file(`${root}W`), sqlprojUri, 'W'),
			new FolderNode(vscode.Uri.file(`${root}Y`), sqlprojUri, 'Y')
		];

		inputNodes = inputNodes.sort(sortFileFolderNodes);

		const expectedNodes: (FileNode | FolderNode)[] = [
			new FolderNode(vscode.Uri.file(`${root}W`), sqlprojUri, 'W'),
			new FolderNode(vscode.Uri.file(`${root}X`), sqlprojUri, 'X'),
			new FolderNode(vscode.Uri.file(`${root}Y`), sqlprojUri, 'Y'),
			new FolderNode(vscode.Uri.file(`${root}Z`), sqlprojUri, 'Z'),
			new SqlObjectFileNode(vscode.Uri.file(`${root}A`), sqlprojUri, 'A'),
			new SqlObjectFileNode(vscode.Uri.file(`${root}B`), sqlprojUri, 'B'),
			new SqlObjectFileNode(vscode.Uri.file(`${root}C`), sqlprojUri, 'C'),
			new SqlObjectFileNode(vscode.Uri.file(`${root}D`), sqlprojUri, 'D')
		];

		should(inputNodes.map(n => n.relativeProjectUri.path)).deepEqual(expectedNodes.map(n => n.relativeProjectUri.path));
	});

	it('Should build tree from Project file correctly', function (): void {
		const root = os.platform() === 'win32' ? 'Z:\\' : '/';
		const proj = new Project(vscode.Uri.file(`${root}TestProj.sqlproj`).fsPath);

		// nested entries before explicit top-level folder entry
		// also, ordering of files/folders at all levels
		proj.sqlObjectScripts.push(proj.createFileProjectEntry(path.join('someFolder', 'bNestedTest.sql'), EntryType.File));
		proj.folders.push(proj.createFileProjectEntry(path.join('someFolder', 'bNestedFolder'), EntryType.Folder));
		proj.sqlObjectScripts.push(proj.createFileProjectEntry(path.join('someFolder', 'aNestedTest.sql'), EntryType.File));
		proj.folders.push(proj.createFileProjectEntry(path.join('someFolder', 'aNestedFolder'), EntryType.Folder));
		proj.folders.push(proj.createFileProjectEntry('someFolder', EntryType.Folder));

		// duplicate files
		proj.sqlObjectScripts.push(proj.createFileProjectEntry('duplicate.sql', EntryType.File));
		proj.sqlObjectScripts.push(proj.createFileProjectEntry('duplicate.sql', EntryType.File));

		// duplicate folders
		proj.folders.push(proj.createFileProjectEntry('duplicateFolder', EntryType.Folder));
		proj.folders.push(proj.createFileProjectEntry('duplicateFolder', EntryType.Folder));

		const tree = new ProjectRootTreeItem(proj);
		should(tree.children.map(x => x.relativeProjectUri.path)).deepEqual([
			'/TestProj/Database References',
			'/TestProj/SQLCMD Variables',
			'/TestProj/duplicateFolder',
			'/TestProj/someFolder',
			'/TestProj/duplicate.sql']);

		should(tree.children.find(x => x.relativeProjectUri.path === '/TestProj/someFolder')?.children.map(y => y.relativeProjectUri.path)).deepEqual([
			'/TestProj/someFolder/aNestedFolder',
			'/TestProj/someFolder/bNestedFolder',
			'/TestProj/someFolder/aNestedTest.sql',
			'/TestProj/someFolder/bNestedTest.sql']);

		should(tree.children.map(x => x.treeItem.contextValue)).deepEqual([
			DatabaseProjectItemType.referencesRoot,
			DatabaseProjectItemType.sqlcmdVariablesRoot,
			DatabaseProjectItemType.folder,
			DatabaseProjectItemType.folder,
			DatabaseProjectItemType.sqlObjectScript]);

		should(tree.children.find(x => x.relativeProjectUri.path === '/TestProj/someFolder')?.children.map(y => y.treeItem.contextValue)).deepEqual([
			DatabaseProjectItemType.folder,
			DatabaseProjectItemType.folder,
			DatabaseProjectItemType.sqlObjectScript,
			DatabaseProjectItemType.sqlObjectScript]);
	});

	it('Should be able to parse windows relative path as platform safe path', function (): void {
		const root = os.platform() === 'win32' ? 'Z:\\' : '/';
		const proj = new Project(vscode.Uri.file(`${root}TestProj.sqlproj`).fsPath);

		// nested entries before explicit top-level folder entry
		// also, ordering of files/folders at all levels
		proj.sqlObjectScripts.push(proj.createFileProjectEntry('someFolder1\\MyNestedFolder1\\MyFile1.sql', EntryType.File));
		proj.folders.push(proj.createFileProjectEntry('someFolder1\\MyNestedFolder2', EntryType.Folder));
		proj.folders.push(proj.createFileProjectEntry('someFolder1', EntryType.Folder));
		proj.folders.push(proj.createFileProjectEntry('someFolder1\\MyNestedFolder1', EntryType.Folder));
		proj.sqlObjectScripts.push(proj.createFileProjectEntry('someFolder1\\MyFile2.sql', EntryType.File));

		const tree = new ProjectRootTreeItem(proj);
		should(tree.children.map(x => x.relativeProjectUri.path)).deepEqual([
			'/TestProj/Database References',
			'/TestProj/SQLCMD Variables',
			'/TestProj/someFolder1']);

		should(tree.children.find(x => x.relativeProjectUri.path === '/TestProj/someFolder1')?.children.map(y => y.relativeProjectUri.path)).deepEqual([
			'/TestProj/someFolder1/MyNestedFolder1',
			'/TestProj/someFolder1/MyNestedFolder2',
			'/TestProj/someFolder1/MyFile2.sql']);
	});

	it('Should be able to parse and include relative paths outside project folder', function (): void {
		const root = os.platform() === 'win32' ? 'Z:\\Level1\\Level2\\' : '/Root/Level1/Level2/';
		const proj = new Project(vscode.Uri.file(`${root}TestProj.sqlproj`).fsPath);

		// nested entries before explicit top-level folder entry
		// also, ordering of files/folders at all levels
		proj.sqlObjectScripts.push(proj.createFileProjectEntry('..\\someFolder1\\MyNestedFolder1\\MyFile1.sql', EntryType.File));
		proj.sqlObjectScripts.push(proj.createFileProjectEntry('..\\..\\someFolder2\\MyFile2.sql', EntryType.File));
		proj.sqlObjectScripts.push(proj.createFileProjectEntry('..\\..\\someFolder3', EntryType.Folder)); // folder should not be counted (same as SSDT)

		const tree = new ProjectRootTreeItem(proj);
		should(tree.children.map(x => x.relativeProjectUri.path)).deepEqual([
			'/TestProj/Database References',
			'/TestProj/SQLCMD Variables',
			'/TestProj/MyFile1.sql',
			'/TestProj/MyFile2.sql']);
	});
});
