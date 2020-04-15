/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as os from 'os';
import * as constants from '../common/constants';

import { promises as fs } from 'fs';

export async function createTestSqlProj(contents: string, folderPath?: string): Promise<string> {
	return createTestFile(contents, 'TestProject.sqlproj', folderPath);
}

export async function createTestDataSources(contents: string, folderPath?: string): Promise<string> {
	return createTestFile(contents, constants.dataSourcesFileName, folderPath);
}

export async function generateTestFolderPath(): Promise<string> {
	const folderPath = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);
	await fs.mkdir(folderPath, { recursive: true });

	return folderPath;
}

async function createTestFile(contents: string, fileName: string, folderPath?: string): Promise<string> {
	folderPath = folderPath ?? await generateTestFolderPath();
	const filePath = path.join(folderPath, fileName);

	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, contents);

	return filePath;
}
