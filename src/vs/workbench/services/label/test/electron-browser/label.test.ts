/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { TestWorkspace } from 'vs/platform/workspace/test/common/testWorkspace';
import { URI } from 'vs/base/common/uri';
import { sep } from 'vs/base/common/path';
import { isWindows } from 'vs/base/common/platform';
import { LabelService } from 'vs/workbench/services/label/common/labelService';
import { TestContextService, TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { TestNativePathService, TestEnvironmentService } from 'vs/workbench/test/electron-browser/workbenchTestServices';
import { TestLifecycleService, TestRemoteAgentService } from 'vs/workbench/test/browser/workbenchTestServices';

suite('URI Label', () => {

	let labelService: LabelService;

	setup(() => {
		labelService = new LabelService(TestEnvironmentService, new TestContextService(), new TestNativePathService(), new TestRemoteAgentService(), new TestStorageService(), new TestLifecycleService());
	});

	test('file scheme', function () {
		labelService.registerFormatter({
			scheme: 'file',
			formatting: {
				label: '${path}',
				separator: sep,
				tildify: !isWindows,
				normalizeDriveLetter: isWindows
			}
		});

		const uri1 = TestWorkspace.folders[0].uri.with({ path: TestWorkspace.folders[0].uri.path.concat('/a/b/c/d') });
		assert.strictEqual(labelService.getUriLabel(uri1, { relative: true }), isWindows ? 'a\\b\\c\\d' : 'a/b/c/d');
		assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), isWindows ? 'C:\\testWorkspace\\a\\b\\c\\d' : '/testWorkspace/a/b/c/d');
		assert.strictEqual(labelService.getUriBasenameLabel(uri1), 'd');

		const uri2 = URI.file('c:\\1/2/3');
		assert.strictEqual(labelService.getUriLabel(uri2, { relative: false }), isWindows ? 'C:\\1\\2\\3' : '/c:\\1/2/3');
		assert.strictEqual(labelService.getUriBasenameLabel(uri2), '3');
	});
});
