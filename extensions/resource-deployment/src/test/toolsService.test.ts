/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert = require('assert');
import * as TypeMoq from 'typemoq';
import { ToolsService } from '../services/toolsService';
import { ToolType } from '../interfaces';
import { isNumber } from 'util';
import { IPlatformService } from '../services/platformService';

suite('Tools Service Tests', function (): void {

	test('run getToolByName with all known values', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const toolsService = new ToolsService(mockPlatformService.object);

		const tools: { name: string; type: ToolType }[] = [
			{ name: 'azure-cli', type: ToolType.AzCli },
			{ name: 'docker', type: ToolType.Docker },
			{ name: 'kubectl', type: ToolType.KubeCtl },
			{ name: 'azdata', type: ToolType.Azdata }];

		const missingTypes: string[] = [];

		// Make sure all the enum values are covered
		for (const type in ToolType) {
			if (isNumber(ToolType[type])) {
				if (tools.findIndex(element => element.type === parseInt(ToolType[type])) === -1) {
					missingTypes.push(type);
				}
			}
		}
		assert(missingTypes.length === 0, `the following enum values are not included in the test:${missingTypes.join(',')}`);

		tools.forEach(toolInfo => {
			const tool = toolsService.getToolByName(toolInfo.name);
			assert(!!tool, `The tool: ${toolInfo.name} is not recognized`);
			assert.equal(tool!.type, toolInfo.type, 'returned notebook name does not match expected value');
		});
	});

	test('run getToolByName with a name that is not defined', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const toolsService = new ToolsService(mockPlatformService.object);
		const tool = toolsService.getToolByName('no-such-tool');
		assert(tool === undefined, 'for a not defined tool, expected value is undefined');
	});
});
