/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as os from 'os';
import * as constants from '../common/constants';

import { promises as fs } from 'fs';
import should = require('should');
import { AssertionError } from 'assert';
import { Project } from '../models/project';

export async function shouldThrowSpecificError(block: Function, expectedMessage: string, details?: string) {
	let succeeded = false;
	try {
		await block();
		succeeded = true;
	}
	catch (err) {
		should(err.message).equal(expectedMessage);
	}

	if (succeeded) {
		throw new AssertionError({ message: `Operation succeeded, but expected failure with exception: "${expectedMessage}".${details ? '  ' + details : ''}` });
	}
}

export async function createTestSqlProjFile(contents: string, folderPath?: string): Promise<string> {
	return await createTestFile(contents, 'TestProject.sqlproj', folderPath);
}

export async function createTestProject(contents: string, folderPath?: string): Promise<Project> {
	return await Project.openProject(await createTestSqlProjFile(contents, folderPath));
}

export async function createTestDataSources(contents: string, folderPath?: string): Promise<string> {
	return await createTestFile(contents, constants.dataSourcesFileName, folderPath);
}

export async function generateTestFolderPath(): Promise<string> {
	const folderPath = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);
	await fs.mkdir(folderPath, { recursive: true });

	return folderPath;
}

export async function createTestFile(contents: string, fileName: string, folderPath?: string): Promise<string> {
	folderPath = folderPath ?? await generateTestFolderPath();
	const filePath = path.join(folderPath, fileName);

	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, contents);

	return filePath;
}
/**
 * TestFolder directory structure
 * 		- file1.sql
 * 		- folder1
 * 			-file1.sql
 * 			-file2.sql
 * 			-file3.sql
 * 			-file4.sql
 * 			-file5.sql
 *	 	- folder2
 * 			-file1.sql
 * 			-file2.sql
 * 			-file3.sql
 * 			-file4.sql
 * 			-file5.sql
 * 		- file2.txt
 *
 * @param createList Boolean specifying to create a list of the files and folders been created
 * @param list List of files and folders that are been created
 */
export async function createDummyFileStructure(createList?: boolean, list?: string[], testFolderPath?: string): Promise<string> {
	testFolderPath = testFolderPath ?? await generateTestFolderPath();

	let filePath = path.join(testFolderPath, 'file1.sql');
	await fs.writeFile(filePath, '');
	if (createList) {
		list?.push(testFolderPath);
		list?.push(filePath);
	}

	for (let dirCount = 1; dirCount <= 2; dirCount++) {
		let dirName = path.join(testFolderPath, `folder${dirCount}`);
		await fs.mkdir(dirName, { recursive: true });

		if (createList) {
			list?.push(dirName);
		}

		for (let fileCount = 1; fileCount <= 5; fileCount++) {
			let fileName = path.join(dirName, `file${fileCount}.sql`);
			await fs.writeFile(fileName, '');
			if (createList) {
				list?.push(fileName);
			}
		}
	}

	filePath = path.join(testFolderPath, 'file2.txt');
	//await touchFile(filePath);
	await fs.writeFile(filePath, '');
	if (createList) {
		list?.push(filePath);
	}

	return testFolderPath;
}

export async function createListOfFiles(filePath?: string): Promise<string[]> {
	let fileFolderList: string[] = [];

	await createDummyFileStructure(true, fileFolderList, filePath);

	return fileFolderList;
}
