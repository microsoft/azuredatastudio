/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import should = require('should');
import { CalculateRelativity } from '../common/telemetry';

suite('Utilities Tests', function (): void {
	test('test CalculateRelativity', async () => {
		const workspacePath = 'c:\\Source\\Workspace\\qwerty.code-workspace';

		should.equal(CalculateRelativity('c:\\Source\\Workspace\\qwerty.sqlproj', workspacePath), 'sameFolder');
		should.equal(CalculateRelativity('c:\\Source\\Workspace\\qwerty\\asdfg\\qwerty.sqlproj', workspacePath), 'directAncestor');
		should.equal(CalculateRelativity('c:\\Users\\BillG\\\\qwerty.sqlproj', workspacePath), 'other');
	});
});
