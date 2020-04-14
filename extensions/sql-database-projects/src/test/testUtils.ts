/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as os from 'os';

import { promises as fs } from 'fs';

export async function createTestSqlProj(contents: string): Promise<string> {
	const projFilePath = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`, 'TestProject.sqlproj');

	await fs.mkdir(path.dirname(projFilePath), { recursive: true });
	await fs.writeFile(projFilePath, contents);

	return projFilePath;
}
