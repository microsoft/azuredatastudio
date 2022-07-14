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
		should.notEqual(model.getOptionsData(), undefined, 'Options shouldn\'t be undefined');
		should.notEqual(model.getIncludeObjectTypesOptionsData(), undefined, 'Objects shouldn\'t be undefined');

		should.doesNotThrow(() => model.setDeploymentOptions());
		should.doesNotThrow(() => model.setIncludeObjectTypesToDeploymentOptions());
	});

	it('Should exclude objects', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		should(model.deploymentOptions.excludeObjectTypes.value.length).be.equal(0, 'There should be no excluded objects');

		Object.keys(model.deploymentOptions.includeObjectsDictionary).forEach(option => {
			should(model.getIncludeObjectTypeOptionCheckStatus(option)).equal(true);
		});
	});

	it('Should have default exclude objects', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		model.deploymentOptions.excludeObjectTypes.value = ['SampleProperty1'];

		should(model.deploymentOptions.excludeObjectTypes.value.length).be.equal(1, 'There should be one excluded object');

		// should return true for all exclude object types options and false for the exising defauit option
		Object.keys(model.deploymentOptions.includeObjectsDictionary).forEach(option => {
			if (option === 'SampleProperty1') {
				should(model.getIncludeObjectTypeOptionCheckStatus(option)).equal(false);
			} else {
				should(model.getIncludeObjectTypeOptionCheckStatus(option)).equal(true);
			}
		});
	});

	it('Should get descriptions', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		model.getOptionsData();
		Object.entries(model.deploymentOptions.booleanOptionsDictionary).forEach(option => {
			should(model.getOptionDescription(option[1].displayName)).not.equal(undefined);
		});
	});

	it('Should return empty string for null option ', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		should(model.getOptionDescription('')).equal('');
	});
});
