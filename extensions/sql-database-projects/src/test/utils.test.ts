/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import {createDummyFileStructure} from './testUtils';
import { exists, trimUri} from '../common/utils';
import { Uri } from 'vscode';

describe('Tests to verify utils functions', function (): void {
	it('Should determine existence of files/folders', async () => {
		let testFolderPath = await createDummyFileStructure();

		should(await exists(testFolderPath)).equal(true);
		should(await exists(path.join(testFolderPath, 'file1.sql'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder2'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder4'))).equal(false);
		should(await exists(path.join(testFolderPath, 'folder2','file4.sql'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder4','file2.sql'))).equal(false);
	});

	it('Should get correct relative paths of files/folders', async () => {
		// test mac style paths
		let projectUri = Uri.file('project/folder/project.sqlproj');
		let fileUri = Uri.file('project/folder/file.sql');
		should(trimUri(projectUri, fileUri)).equal('file.sql');

		fileUri = Uri.file('project/file.sql');
		let urifile = trimUri(projectUri, fileUri);
		should(urifile).equal('../file.sql');

		fileUri = Uri.file('project/forked/file.sql');
		should(trimUri(projectUri, fileUri)).equal('../forked/file.sql');

		fileUri = Uri.file('forked/from/top/file.sql');
		should(trimUri(projectUri, fileUri)).equal('../../forked/from/top/file.sql');

		// test windows style paths
		projectUri = Uri.file('z:\\project\\folder\\project.sqlproj');
		fileUri = Uri.file('z:\\project\\file.sql');
		should(trimUri(projectUri, fileUri)).equal('../file.sql');

		fileUri = Uri.file('z:\\forked\\from\\top\\file.sql');
		should(trimUri(projectUri, fileUri)).equal('../../forked/from/top/file.sql');
	});
});

