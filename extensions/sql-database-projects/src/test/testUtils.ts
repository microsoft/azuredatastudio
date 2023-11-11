/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as os from 'os';
import * as constants from '../common/constants';
import * as templates from '../templates/templates';

import { promises as fs } from 'fs';
import should = require('should');
import { AssertionError } from 'assert';
import { Project } from '../models/project';
import { Uri } from 'vscode';
import { exists, getSqlProjectsService } from '../common/utils';
import * as mssql from 'mssql';

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

export async function createTestSqlProject(test: Mocha.Runnable | undefined): Promise<Project> {
	const projPath = await getTestProjectPath(test);
	await (await getSqlProjectsService() as mssql.ISqlProjectsService).createProject(projPath, mssql.ProjectType.SdkStyle);
	return await Project.openProject(projPath);
}

export async function getTestProjectPath(test: Mocha.Runnable | undefined): Promise<string> {
	return path.join(await generateTestFolderPath(test), 'TestProject', 'TestProject.sqlproj');
}

export async function createTestSqlProjFile(test: Mocha.Runnable | undefined, contents: string, folderPath?: string): Promise<string> {
	folderPath = folderPath ?? path.join(await generateTestFolderPath(test), 'TestProject');
	const macroDict: Map<string, string> = new Map([['PROJECT_DSP', constants.defaultDSP]]);
	contents = templates.macroExpansion(contents, macroDict);
	return await createTestFile(test, contents, 'TestProject.sqlproj', folderPath);
}

export async function createTestProject(test: Mocha.Runnable | undefined, contents: string, folderPath?: string): Promise<Project> {
	return await Project.openProject(await createTestSqlProjFile(test, contents, folderPath));
}

export async function createTestDataSources(test: Mocha.Runnable | undefined, contents: string, folderPath?: string): Promise<string> {
	return await createTestFile(test, contents, constants.dataSourcesFileName, folderPath);
}

export async function generateTestFolderPath(test: Mocha.Runnable | undefined): Promise<string> {
	const testName = test?.title === undefined ? '' : `${normalizeTestName(test?.title)}_`
	const folderPath = path.join(generateBaseFolderName(), `Test_${testName}${new Date().getTime()}_${Math.floor((Math.random() * 1000))}`);
	await fs.mkdir(folderPath, { recursive: true });

	return folderPath;
}

function normalizeTestName(rawTestName: string): string {
	return rawTestName.replace(/[^\w]+/g, '').substring(0, 40); // remove all non-alphanumeric characters, then trim to a reasonable length
}

export function generateBaseFolderName(): string {
	const folderPath = path.join(os.tmpdir(), 'ADS_Tests');
	return folderPath;
}

export async function createTestFile(test: Mocha.Runnable | undefined, contents: string, fileName: string, folderPath?: string): Promise<string> {
	folderPath = folderPath ?? await generateTestFolderPath(test);
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
 * @param test
 * @param createList Boolean specifying to create a list of the files and folders been created
 * @param list List of files and folders that are been created
 * @param testFolderPath
 */
export async function createDummyFileStructure(test: Mocha.Runnable | undefined, createList?: boolean, list?: Uri[], testFolderPath?: string): Promise<string> {
	testFolderPath = testFolderPath ?? await generateTestFolderPath(test);

	let filePath = path.join(testFolderPath, 'file1.sql');
	await fs.writeFile(filePath, '');
	if (createList) {
		list?.push(Uri.file(filePath));
	}

	for (let dirCount = 1; dirCount <= 2; dirCount++) {
		let dirName = path.join(testFolderPath, `folder${dirCount}`);
		await fs.mkdir(dirName, { recursive: true });

		for (let fileCount = 1; fileCount <= 5; fileCount++) {
			let fileName = path.join(dirName, `file${fileCount}.sql`);
			await fs.writeFile(fileName, '');
			if (createList) {
				list?.push(Uri.file(fileName));
			}
		}
	}

	filePath = path.join(testFolderPath, 'file2.txt');

	await fs.writeFile(filePath, '');
	if (createList) {
		list?.push(Uri.file(filePath));
	}

	return testFolderPath;
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
 * 			-Script.PostDeployment2.sql
 * 			- nestedFolder
 * 				-otherFile1.sql
 * 				-otherFile2.sql
 *	 	- folder2
 * 			-file1.sql
 * 			-file2.sql
 * 			-file3.sql
 * 			-file4.sql
 * 			-file5.sql
 * 		- file2.txt
 * 		- Script.PreDeployment1.sql
 * 		- Script.PreDeployment2.sql
 * 		- Script.PostDeployment1.sql
 *
 * @param test
 * @param createList Boolean specifying to create a list of the files and folders been created
 * @param list List of files and folders that are been created
 * @param testFolderPath
 */
export async function createDummyFileStructureWithPrePostDeployScripts(test: Mocha.Runnable | undefined, createList?: boolean, list?: Uri[], testFolderPath?: string): Promise<string> {
	testFolderPath = await createDummyFileStructure(test, createList, list, testFolderPath);

	// add pre-deploy scripts
	const predeployscript1 = path.join(testFolderPath, 'Script.PreDeployment1.sql');
	await fs.writeFile(predeployscript1, '');
	const predeployscript2 = path.join(testFolderPath, 'Script.PreDeployment2.sql');
	await fs.writeFile(predeployscript2, '');

	if (createList) {
		list?.push(Uri.file(predeployscript1));
		list?.push(Uri.file(predeployscript2));
	}

	// add post-deploy scripts
	const postdeployscript1 = path.join(testFolderPath, 'Script.PostDeployment1.sql');
	await fs.writeFile(postdeployscript1, '');
	const postdeployscript2 = path.join(testFolderPath, 'folder1', 'Script.PostDeployment2.sql');
	await fs.writeFile(postdeployscript2, '');


	// add nested files
	await fs.mkdir(path.join(testFolderPath, 'folder1', 'nestedFolder'));
	const otherfile1 = path.join(testFolderPath, 'folder1', 'nestedFolder', 'otherFile1.sql');
	await fs.writeFile(otherfile1, '');
	const otherfile2 = path.join(testFolderPath, 'folder1', 'nestedFolder', 'otherFile2.sql');
	await fs.writeFile(otherfile2, '');

	if (createList) {
		list?.push(Uri.file(postdeployscript1));
		list?.push(Uri.file(postdeployscript2));
	}

	return testFolderPath;
}

export async function createListOfFiles(test: Mocha.Runnable | undefined, filePath?: string): Promise<Uri[]> {
	let fileFolderList: Uri[] = [];

	await createDummyFileStructure(test, true, fileFolderList, filePath);

	return fileFolderList;
}

/**
 * TestFolder directory structure
 * 		- file1.sql
 * 		- folder1
 * 			- file1.sql
 * 			- file2.sql
 * 			- test1.sql
 * 			- test2.sql
 * 			- testLongerName.sql
 *	 	- folder2
 * 			- file1.sql
 * 			- file2.sql
 * 			- Script.PreDeployment1.sql
 * 			- Script.PostDeployment1.sql
 * 			- Script.PostDeployment2.sql
 *
 */
export async function createOtherDummyFiles(testFolderPath: string): Promise<Uri[]> {
	const filesList: Uri[] = [];
	let filePath = path.join(testFolderPath, 'file1.sql');
	await fs.writeFile(filePath, '');
	filesList.push(Uri.file(filePath));

	for (let dirCount = 1; dirCount <= 2; dirCount++) {
		let dirName = path.join(testFolderPath, `folder${dirCount}`);
		await fs.mkdir(dirName, { recursive: true });

		for (let fileCount = 1; fileCount <= 2; fileCount++) {
			let fileName = path.join(dirName, `file${fileCount}.sql`);
			await fs.writeFile(fileName, '');
			filesList.push(Uri.file(fileName));
		}
	}

	const test1 = path.join(testFolderPath, 'folder1', 'test1.sql');
	await fs.writeFile(test1, '');
	filesList.push(Uri.file(test1));
	const test2 = path.join(testFolderPath, 'folder1', 'test2.sql');
	await fs.writeFile(test2, '');
	filesList.push(Uri.file(test2));
	const testLongerName = path.join(testFolderPath, 'folder1', 'testLongerName.sql');
	await fs.writeFile(testLongerName, '');
	filesList.push(Uri.file(testLongerName));

	const preDeploymentScript = path.join(testFolderPath, 'folder2', 'Script.PreDeployment1.sql');
	await fs.writeFile(preDeploymentScript, '');
	filesList.push(Uri.file(preDeploymentScript));

	const postDeploymentScript1 = path.join(testFolderPath, 'folder2', 'Script.PostDeployment1.sql');
	await fs.writeFile(postDeploymentScript1, '');
	filesList.push(Uri.file(preDeploymentScript));

	const postDeploymentScript2 = path.join(testFolderPath, 'folder2', 'Script.PostDeployment2.sql');
	await fs.writeFile(postDeploymentScript2, '');
	filesList.push(Uri.file(postDeploymentScript2));

	return filesList;
}

/**
 * Deletes folder generated for testing
 */
export async function deleteGeneratedTestFolder(): Promise<void> {
	const testFolderPath: string = generateBaseFolderName();
	if (await exists(testFolderPath)) {
		await fs.rm(testFolderPath, { recursive: true }); // cleanup folder
	}
}
