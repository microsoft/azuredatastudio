/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import assert = require('assert');
import { ToolsService } from '../services/toolsService';
import { ToolType } from '../interfaces';

suite('Tools Service Tests', function (): void {

	test('run getToolByName with all known values', () => {
		const toolsService = new ToolsService();

		const tools = [['azcli', ToolType.AzCli], ['docker', ToolType.Docker], ['kubectl', ToolType.KubeCtl], ['mssqlctl', ToolType.MSSQLCtl], ['python', ToolType.Python]];
		tools.forEach(pair => {
			const tool = toolsService.getToolByName(pair[0] as string);
			assert(!!tool, `The tool: ${pair[0]} is not recognized`);
			assert.equal(tool!.type, pair[1], 'returned notebook name does not match expected value');
		});
	});

	test('run getToolByName with a name that is not defined', () => {
		const toolsService = new ToolsService();
		const tool = toolsService.getToolByName('no-such-tool');
		assert(tool === undefined, 'for a not defined tool, expected value is undefined');
	});
});