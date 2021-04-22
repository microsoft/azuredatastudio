/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as os from 'os';
import * as path from 'path';
import should = require('should');
import { calculateRelativity } from '../common/telemetry';

suite('Utilities Tests', function (): void {
	test('test CalculateRelativity', async () => {
		const root = os.platform() === 'win32' ? 'Z:\\' : '/';
		const workspacePath = path.join(root, 'Source', 'Workspace', 'qwerty.code-workspace');

		should.equal(calculateRelativity(path.join(root, 'Source', 'Workspace', 'qwerty.sqlproj'), workspacePath), 'sameFolder');
		should.equal(calculateRelativity(path.join(root, 'Source', 'Workspace', 'qwerty', 'asdfg', 'qwerty.sqlproj'), workspacePath), 'directAncestor');
		should.equal(calculateRelativity(path.join(root, 'Users', 'BillG', 'qwerty.sqlproj'), workspacePath), 'other');
	});
});
