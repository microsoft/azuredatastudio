/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import { createDummyFileStructure } from './testUtils';
import { exists, trimUri } from '../common/utils';
import { Uri } from 'vscode';

describe('Tests to verify utils functions', function (): void {
	it('Should determine existence of files/folders', async () => {
		let testFolderPath = await createDummyFileStructure();

		should(await exists(testFolderPath)).equal(true);
		should(await exists(path.join(testFolderPath, 'file1.sql'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder2'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder4'))).equal(false);
		should(await exists(path.join(testFolderPath, 'folder2', 'file4.sql'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder4', 'file2.sql'))).equal(false);
	});

	it.skip('Should get correct relative paths of files/folders', async () => {
		const root = os.platform() === 'win32' ? 'Z:\\' : '/';
		let projectUri = Uri.file(path.join(root, 'project', 'folder', 'project.sqlproj'));
		let fileUri = Uri.file(path.join(root, 'project', 'folder', 'file.sql'));
		should(trimUri(projectUri, fileUri)).equal('file.sql');

		fileUri = Uri.file(path.join(root, 'project', 'file.sql'));
		let urifile = trimUri(projectUri, fileUri);
		should(urifile).equal('../file.sql');

		fileUri = Uri.file(path.join(root, 'project', 'forked', 'file.sql'));
		should(trimUri(projectUri, fileUri)).equal('../forked/file.sql');

		fileUri = Uri.file(path.join(root, 'forked', 'from', 'top', 'file.sql'));
		should(trimUri(projectUri, fileUri)).equal('../../forked/from/top/file.sql');
	});
});

