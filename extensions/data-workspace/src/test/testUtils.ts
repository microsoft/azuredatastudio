/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import { IProjectType } from 'dataworkspace';
import { promises as fs } from 'fs';

export const testProjectType: IProjectType = {
	id: 'tp1',
	description: '',
	projectFileExtension: 'testproj',
	icon: '',
	displayName: 'test project'
};

/**
 * Creates a unique test project file
 * @param fileExt
 * @param contents
 */
export async function createProjectFile(fileExt: string, contents?: string): Promise<string> {
	const filepath = generateUniqueProjectFilePath(fileExt);
	await fs.writeFile(filepath, contents ?? '');

	return filepath;
}

export function generateUniqueProjectFilePath(fileExt: string): string {
	return path.join(os.tmpdir(), `TestProject_${new Date().getTime()}.${fileExt}`);
}
