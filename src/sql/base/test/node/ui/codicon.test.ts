/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { readFile } from 'vs/base/node/pfs';
import { join } from 'vs/base/common/path';
import { URI } from 'vs/base/common/uri';

const icons: string[] = [
	'codicon-chevron-down',
	'codicon-chevron-up',
	'codicon-clear-all',
	'codicon-debug-pause',
	'codicon-play'
];

suite('codicon css', () => {
	test('codicon.css contains expected icons', async () => {
		const codiconFile = await readFile(join(URI.parse(__dirname).fsPath, '..', '..', '..', '..', '..', 'vs', 'base', 'browser', 'ui', 'codiconLabel', 'codicon', 'codicon.css'));
		icons.forEach(icon => {
			assert.ok(codiconFile.includes(icon), `codicon.css did not contain expected icon ${icon}`);
		});
	});
});

