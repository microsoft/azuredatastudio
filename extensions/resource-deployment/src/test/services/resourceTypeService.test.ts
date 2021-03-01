/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import * as should from 'should';
import { EOL } from 'os';
import { ResourceTypeService, processWhenClause } from '../../services/resourceTypeService';
import { IPlatformService } from '../../services/platformService';
import { ToolsService } from '../../services/toolsService';
import { NotebookService } from '../../services/notebookService';

describe('Resource Type Service Tests', function (): void {

	it('test resource types', () => {
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

	it('Selected options containing all when clauses should return true', () => {
		const whenSelectedTrue: { when: string; selectedOptions: { option: string, value: string }[] }[] = [
			{
				when: 'resourceType=sql-bdc && newType=sql-windows-setup', selectedOptions: [{ option: 'resourceType', value: 'sql-image' }, { option: 'resourceType', value: 'sql-bdc' }, { option: 'newType', value: 'sql-windows-setup' }]
			},
			{
				when: 'resourceType=sql-image', selectedOptions: [{ option: 'resourceType', value: 'sql-image' }, { option: 'resourceType', value: 'sql-bdc' }]
			},
		];

		whenSelectedTrue.forEach(whenOption => {
			should(processWhenClause(whenOption.when, whenOption.selectedOptions)).be.true(`when clause '${whenOption.when}' should return true for it's associated selectedOptions`);
		});
	});

	it('When clause that reads "true" (ignoring case) should always return true', () => {
		should(processWhenClause(undefined, [])).be.true('undefined when clause should always return true');
		should(processWhenClause('TrUe', [])).be.true(`"true" when clause should always return true`);
	});

	it('No selected options returns false', () => {
		should(processWhenClause('newType=empty', [])).be.false('No selected options should return false');
	});

	it('Unfulfilled or partially fulfilled when clauses return false', () => {
		const whenSelectedFalse: { when: string; selectedOptions: { option: string, value: string }[] }[] = [
			{
				when: 'resourceType=sql-bdc && dneType=does-not-exist', selectedOptions: [{ option: 'resourceType', value: 'sql-image' }, { option: 'resourceType', value: 'sql-bdc' }, { option: 'newType', value: 'sql-windows-setup' }]
			},
			{
				when: 'dneType=does-not-exist', selectedOptions: [{ option: 'resourceType', value: 'sql-image' }, { option: 'resourceType', value: 'sql-bdc' }, { option: 'newType', value: 'sql-windows-setup' }]
			}
		];
		whenSelectedFalse.forEach(whenOption => {
			should(processWhenClause(whenOption.when, whenOption.selectedOptions)).be.false(`when clause '${whenOption.when}' should return false for it's associated selectedOptions`);
		});
	});

	it('An invalid when clause should always return false', () => {
		should(processWhenClause('badWhenClause', [{ option: 'bad', value: 'WhenClause' }])).be.false(`invalid when clause should return false`);
	});
});
