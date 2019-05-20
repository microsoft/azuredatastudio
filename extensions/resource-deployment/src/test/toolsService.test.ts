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

		const tools: { name: string; type: ToolType }[] = [
			{ name: 'azcli', type: ToolType.AzCli },
			{ name: 'docker', type: ToolType.Docker },
			{ name: 'kubectl', type: ToolType.KubeCtl },
			{ name: 'mssqlctl', type: ToolType.MSSQLCtl },
			{ name: 'python', type: ToolType.Python }];

		tools.forEach(toolInfo => {
			const tool = toolsService.getToolByName(toolInfo.name);
			assert(!!tool, `The tool: ${toolInfo.name} is not recognized`);
			assert.equal(tool!.type, toolInfo.type, 'returned notebook name does not match expected value');
		});
	});

	test('run getToolByName with a name that is not defined', () => {
		const toolsService = new ToolsService();
		const tool = toolsService.getToolByName('no-such-tool');
		assert(tool === undefined, 'for a not defined tool, expected value is undefined');
	});
});