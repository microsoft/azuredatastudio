/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { ToolsService } from '../../services/toolsService';
import { ITool, ToolType } from '../../interfaces';
import { IPlatformService } from '../../services/platformService';
import { AzdataToolName } from '../../services/tools/azdataTool';


const tools: { name: string; type: ToolType }[] = [
	{ name: 'azure-cli', type: ToolType.AzCli },
	{ name: 'docker', type: ToolType.Docker },
	{ name: 'kubectl', type: ToolType.KubeCtl },
	{ name: AzdataToolName, type: ToolType.Azdata }
];
const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
const toolsService = new ToolsService(mockPlatformService.object);

describe('Tools Service Tests', function (): void {

	it('run getToolByName with all known values', () => {
		const missingTypes: string[] = [];
		// Make sure all the enum values are covered
		for (const type in ToolType) {
			if (typeof ToolType[type] === 'number') {
				if (tools.findIndex(element => element.type === parseInt(ToolType[type])) === -1) {
					missingTypes.push(type);
				}
			}
		}
		assert(missingTypes.length === 0, `the following enum values are not included in the test:${missingTypes.join(',')}`);

		tools.forEach(toolInfo => {
			const tool = toolsService.getToolByName(toolInfo.name);
			assert(!!tool, `The tool: ${toolInfo.name} is not recognized`);
			assert.strictEqual(tool!.type, toolInfo.type, 'returned tool name does not match expected value');
		});
	});

	it('run getToolByName with a name that is not defined', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const toolsService = new ToolsService(mockPlatformService.object);
		const tool = toolsService.getToolByName('no-such-tool');
		assert(tool === undefined, 'for a not defined tool, expected value is undefined');
	});

	it('get/set tools for CurrentProvider', () => {
		const iTools: ITool[] = tools.map(toolInfo => {
			const tool = toolsService.getToolByName(toolInfo.name);
			assert(!!tool, `The tool: ${toolInfo.name} is not recognized`);
			assert.strictEqual(tool!.type, toolInfo.type, 'returned notebook name does not match expected value');
			return tool!;
		});
		toolsService.toolsForCurrentProvider = iTools;
		assert.deepEqual(iTools, toolsService.toolsForCurrentProvider, 'toolsForCurrentProvider did not return the value we set');
	});
});
