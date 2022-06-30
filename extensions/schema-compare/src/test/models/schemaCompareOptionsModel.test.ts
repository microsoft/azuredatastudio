/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as testUtils from '../testUtils';
import { SchemaCompareOptionsModel } from '../../models/schemaCompareOptionsModel';

describe('Schema Compare Options Model', () => {
	it('Should create model and set options successfully', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		should.notEqual(model.InitializeOptionsData(), undefined, 'Options shouldn\'t be undefined');
		should.notEqual(model.InitializeObjectsData(), undefined, 'Objects shouldn\'t be undefined');

		should.doesNotThrow(() => model.setDeploymentOptions());
		should.doesNotThrow(() => model.setSchemaCompareIncludedObjectsUtil());

		should(model.getSchemaCompareOptionUtil('')).equal(undefined, 'Should return undefined if an invalid option is passed in');
		should(model.getSchemaCompareIncludedObjectsUtil('')).be.true('Should return true if invalid object name is passed in');
	});

	it('Should have no exclude objects but include objects', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		should(model.excludedObjectTypes.length).be.equal(0, 'There should be no excluded objects');

		model.includeObjectTypeLabels.forEach(l => {
			if(!model.getSchemaCompareIncludedObjectsUtil(l)){
				model.excludedObjectTypes.push(model.deploymentOptions.includeObjects[l]);
			}
		});
		model.setSchemaCompareIncludedObjectsUtil();

		// includeObjectTypes have two sample options, expected-0 and actual-2, should not equal
		should(model.excludedObjectTypes.length).not.equal(model.includeObjectTypeLabels.length, 'All the object types should be excluded');
	});

	it('Should have exclude objects and matches with includeObjects', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		model.deploymentOptions.excludeObjectTypes.value = [0, 2];

		should(model.excludedObjectTypes.length).be.equal(0, 'There should be no excluded objects');

		model.includeObjectTypeLabels.forEach(l => {
			if(!model.getSchemaCompareIncludedObjectsUtil(l)){
				model.excludedObjectTypes.push(model.deploymentOptions.includeObjects[l]);
			}
		});

		// includeObjectTypes have two sample options, expected-2 and actual-2, should not equal
		should(model.excludedObjectTypes.length).be.equal(model.includeObjectTypeLabels.length, 'All the object types should be excluded');
	});

	it('Should get descriptions', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		model.optionsLabels.forEach(l => {
			should(model.getDescription(l)).not.equal(undefined);
		});
	});
});
