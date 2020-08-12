/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

import { Project, EntryType } from '../models/project';
import { FolderNode, FileNode, sortFileFolderNodes } from '../models/tree/fileFolderTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { DatabaseProjectItemType } from '../common/constants';

describe.skip('Project Tree tests', function (): void {
	it('Should correctly order tree nodes by type, then by name', function (): void {
		const root = os.platform() === 'win32' ? 'Z:\\' : '/';

		const parent = new ProjectRootTreeItem(new Project(vscode.Uri.file(`${root}Fake.sqlproj`).fsPath));

		let inputNodes: (FileNode | FolderNode)[] = [
			new FileNode(vscode.Uri.file(`${root}C`), parent),
			new FileNode(vscode.Uri.file(`${root}D`), parent),
			new FolderNode(vscode.Uri.file(`${root}Z`), parent),
			new FolderNode(vscode.Uri.file(`${root}X`), parent),
			new FileNode(vscode.Uri.file(`${root}B`), parent),
			new FileNode(vscode.Uri.file(`${root}A`), parent),
			new FolderNode(vscode.Uri.file(`${root}W`), parent),
			new FolderNode(vscode.Uri.file(`${root}Y`), parent)
		];

		inputNodes = inputNodes.sort(sortFileFolderNodes);

		const expectedNodes: (FileNode | FolderNode)[] = [
			new FolderNode(vscode.Uri.file(`${root}W`), parent),
			new FolderNode(vscode.Uri.file(`${root}X`), parent),
			new FolderNode(vscode.Uri.file(`${root}Y`), parent),
			new FolderNode(vscode.Uri.file(`${root}Z`), parent),
			new FileNode(vscode.Uri.file(`${root}A`), parent),
			new FileNode(vscode.Uri.file(`${root}B`), parent),
			new FileNode(vscode.Uri.file(`${root}C`), parent),
			new FileNode(vscode.Uri.file(`${root}D`), parent)
		];

		should(inputNodes.map(n => n.uri.path)).deepEqual(expectedNodes.map(n => n.uri.path));
	});

	it('Should build tree from Project file correctly', function (): void {
		const root = os.platform() === 'win32' ? 'Z:\\' : '/';
		const proj = new Project(vscode.Uri.file(`${root}TestProj.sqlproj`).fsPath);

		// nested entries before explicit top-level folder entry
		// also, ordering of files/folders at all levels
		proj.files.push(proj.createProjectEntry(path.join('someFolder', 'bNestedTest.sql'), EntryType.File));
		proj.files.push(proj.createProjectEntry(path.join('someFolder', 'bNestedFolder'), EntryType.Folder));
		proj.files.push(proj.createProjectEntry(path.join('someFolder', 'aNestedTest.sql'), EntryType.File));
		proj.files.push(proj.createProjectEntry(path.join('someFolder', 'aNestedFolder'), EntryType.Folder));
		proj.files.push(proj.createProjectEntry('someFolder', EntryType.Folder));

		// duplicate files
		proj.files.push(proj.createProjectEntry('duplicate.sql', EntryType.File));
		proj.files.push(proj.createProjectEntry('duplicate.sql', EntryType.File));

		// duplicate folders
		proj.files.push(proj.createProjectEntry('duplicateFolder', EntryType.Folder));
		proj.files.push(proj.createProjectEntry('duplicateFolder', EntryType.Folder));

		const tree = new ProjectRootTreeItem(proj);
		should(tree.children.map(x => x.uri.path)).deepEqual([
			'/TestProj.sqlproj/Data Sources',
			'/TestProj.sqlproj/Database References',
			'/TestProj.sqlproj/duplicateFolder',
			'/TestProj.sqlproj/someFolder',
			'/TestProj.sqlproj/duplicate.sql']);

		should(tree.children.find(x => x.uri.path === '/TestProj.sqlproj/someFolder')?.children.map(y => y.uri.path)).deepEqual([
			'/TestProj.sqlproj/someFolder/aNestedFolder',
			'/TestProj.sqlproj/someFolder/bNestedFolder',
			'/TestProj.sqlproj/someFolder/aNestedTest.sql',
			'/TestProj.sqlproj/someFolder/bNestedTest.sql']);

		should(tree.children.map(x => x.treeItem.contextValue)).deepEqual([
			DatabaseProjectItemType.dataSourceRoot,
			DatabaseProjectItemType.referencesRoot,
			DatabaseProjectItemType.folder,
			DatabaseProjectItemType.folder,
			DatabaseProjectItemType.file]);

		should(tree.children.find(x => x.uri.path === '/TestProj.sqlproj/someFolder')?.children.map(y => y.treeItem.contextValue)).deepEqual([
			DatabaseProjectItemType.folder,
			DatabaseProjectItemType.folder,
			DatabaseProjectItemType.file,
			DatabaseProjectItemType.file]);
	});

	it('Should be able to parse windows relative path as platform safe path', function (): void {
		const root = os.platform() === 'win32' ? 'Z:\\' : '/';
		const proj = new Project(vscode.Uri.file(`${root}TestProj.sqlproj`).fsPath);

		// nested entries before explicit top-level folder entry
		// also, ordering of files/folders at all levels
		proj.files.push(proj.createProjectEntry('someFolder1\\MyNestedFolder1\\MyFile1.sql', EntryType.File));
		proj.files.push(proj.createProjectEntry('someFolder1\\MyNestedFolder2', EntryType.Folder));
		proj.files.push(proj.createProjectEntry('someFolder1\\MyFile2.sql', EntryType.File));

		const tree = new ProjectRootTreeItem(proj);
		should(tree.children.map(x => x.uri.path)).deepEqual([
			'/TestProj.sqlproj/Data Sources',
			'/TestProj.sqlproj/Database References',
			'/TestProj.sqlproj/someFolder1']);

		// Why are we only matching names - https://github.com/microsoft/azuredatastudio/issues/11026
		should(tree.children.find(x => x.uri.path === '/TestProj.sqlproj/someFolder1')?.children.map(y => path.basename(y.uri.path))).deepEqual([
			'MyNestedFolder1',
			'MyNestedFolder2',
			'MyFile2.sql']);
	});

	it('Should be able to parse and include relative paths outside project folder', function (): void {
		const root = os.platform() === 'win32' ? 'Z:\\Level1\\Level2\\' : '/Root/Level1/Level2';
		const proj = new Project(vscode.Uri.file(`${root}TestProj.sqlproj`).fsPath);

		// nested entries before explicit top-level folder entry
		// also, ordering of files/folders at all levels
		proj.files.push(proj.createProjectEntry('..\\someFolder1\\MyNestedFolder1\\MyFile1.sql', EntryType.File));
		proj.files.push(proj.createProjectEntry('..\\..\\someFolder2\\MyFile2.sql', EntryType.File));
		proj.files.push(proj.createProjectEntry('..\\..\\someFolder3', EntryType.Folder)); // folder should not be counted (same as SSDT)

		const tree = new ProjectRootTreeItem(proj);
		should(tree.children.map(x => x.uri.path)).deepEqual([
			'/TestProj.sqlproj/Data Sources',
			'/TestProj.sqlproj/Database References',
			'/TestProj.sqlproj/MyFile1.sql',
			'/TestProj.sqlproj/MyFile2.sql']);
	});
});
