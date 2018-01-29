/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import URI from 'vs/base/common/uri';
import { basename } from 'path';
import { ExtHostWorkspace } from 'vs/workbench/api/node/extHostWorkspace';
import { TestThreadService } from './testThreadService';
import { normalize } from 'vs/base/common/paths';
import { IWorkspaceFolderData } from 'vs/platform/workspace/common/workspace';

suite('ExtHostWorkspace', function () {

	function assertAsRelativePath(workspace: ExtHostWorkspace, input: string, expected: string, includeWorkspace?: boolean) {
		const actual = workspace.getRelativePath(input, includeWorkspace);
		if (actual === expected) {
			assert.ok(true);
		} else {
			assert.equal(actual, normalize(expected, true));
		}
	}

	test('asRelativePath', function () {
	});

	function aWorkspaceFolderData(uri: URI, index: number, name: string = ''): IWorkspaceFolderData {
		return {
			uri,
			index,
			name: name || basename(uri.path)
		};
	}
});
