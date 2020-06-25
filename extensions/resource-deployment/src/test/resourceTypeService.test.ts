/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as TypeMoq from 'typemoq';
import assert = require('assert');
import { EOL } from 'os';
import { ResourceTypeService } from '../services/resourceTypeService';
import { IPlatformService } from '../services/platformService';
import { ToolsService } from '../services/toolsService';
import { NotebookService } from '../services/notebookService';

suite('Resource Type Service Tests', function (): void {

	test('test resource types', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const toolsService = new ToolsService(mockPlatformService.object);
		const notebookService = new NotebookService(mockPlatformService.object, '');
		const resourceTypeService = new ResourceTypeService(mockPlatformService.object, toolsService, notebookService);
		// index 0: platform name, index 1: expected resource types
		const platforms: { platform: string; resourceTypes: string[] }[] = [
			{
				platform: 'win32', resourceTypes: ['sql-image', 'sql-bdc', 'sql-windows-setup']
			},
			{
				platform: 'darwin', resourceTypes: ['sql-image', 'sql-bdc']
			},
			{
				platform: 'linux', resourceTypes: ['sql-image', 'sql-bdc']
			}
		];
		platforms.forEach(platformInfo => {
			mockPlatformService.reset();
			mockPlatformService.setup(service => service.platform()).returns(() => platformInfo.platform);
			mockPlatformService.setup(service => service.showErrorMessage(TypeMoq.It.isAnyString()));
			const resourceTypes = resourceTypeService.getResourceTypes(true).map(rt => rt.name);
			for (let i = 0; i < platformInfo.resourceTypes.length; i++) {
				assert(resourceTypes.indexOf(platformInfo.resourceTypes[i]) !== -1, `resource type '${platformInfo.resourceTypes[i]}' should be available for platform: ${platformInfo.platform}.`);
			}
		});

		const allResourceTypes = resourceTypeService.getResourceTypes(false);
		const validationErrors = resourceTypeService.validateResourceTypes(allResourceTypes);
		assert(validationErrors.length === 0, `Validation errors detected in the package.json: ${validationErrors.join(EOL)}.`);
	});
});
