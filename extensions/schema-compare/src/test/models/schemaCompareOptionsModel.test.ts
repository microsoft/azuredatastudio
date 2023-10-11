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

	it('Should not have a default object types to exclude from IncludeObjectTypes ', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		should(model.deploymentOptions.excludeObjectTypes.value.length).be.equal(0, 'There should be no object type excluded from IncludeObjectTypes');

		Object.keys(model.deploymentOptions.objectTypesDictionary).forEach(option => {
			should(model.getIncludeObjectTypeOptionCheckStatus(option)).equal(true, 'Object types that are not excluded should return true');
		});
	});

	it('Should have default object types to exclude from IncludeObjectTypes ', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		model.deploymentOptions.excludeObjectTypes.value = ['SampleProperty1'];

		should(model.deploymentOptions.excludeObjectTypes.value.length).be.equal(1, 'There should be one object type excluding from IncludeObjectTypes ');

		// should return false for the default object types and false for the remaining object types
		Object.keys(model.deploymentOptions.objectTypesDictionary).forEach(option => {
			if (option === 'SampleProperty1') {
				should(model.getIncludeObjectTypeOptionCheckStatus(option)).equal(false, 'Object type property that have default object types to exclude from IncludeObjectTypes should return false');
			} else {
				should(model.getIncludeObjectTypeOptionCheckStatus(option)).equal(true, 'All including Object type should return true');
			}
		});
	});

	it('Should get descriptions', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		model.getOptionsData();
		Object.entries(model.deploymentOptions.booleanOptionsDictionary).forEach(option => {
			should(model.getOptionDescription(option[1].displayName)).not.equal(undefined, 'Option description shouldn\'t be undefined');
		});
	});

	it('Should return empty string for null option ', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		should(model.getOptionDescription('')).equal('');
	});
});
