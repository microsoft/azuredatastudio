/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as testUtils from '../../test/testContext';
import { DeployOptionsModel } from '../../models/options/deployOptionsModel';

describe('Publish Dialog Deploy Options Model', () => {
	it('Should create model and set options successfully', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		should.notEqual(model.getOptionsData(), undefined, 'Options shouldn\'t be undefined');

		should.doesNotThrow(() => model.setDeploymentOptions());
	});

	it('Should get description', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		Object.entries(model.deploymentOptions.booleanOptionsDictionary).forEach(option => {
			// option[1] contains the value, description and displayName
			should(model.getOptionDescription(option[1].displayName)).not.equal(undefined, 'publish option description should not be undefined');
		});
	});

	it('Should return empty string for null option ', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		should(model.getOptionDescription('')).equal('');
	});


	it('Should have no default exclude object types', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		should(model.deploymentOptions.excludeObjectTypes.value.length).be.equal(0, 'There should be no object types excluded from excludeObjectTypes');

		// should return true for all object type options as there are no default excludeObjectTypes in the deployment options
		Object.keys(model.deploymentOptions.objectTypesDictionary).forEach(option => {
			should(model.getExcludeObjectTypeOptionCheckStatus(option)).equal(false, 'excludeObjectTypes property should be empty by default and return false');
		});
	});

	it('Should have atleast one default exclude object types', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		model.deploymentOptions.excludeObjectTypes.value = ['SampleProperty1'];

		should(model.deploymentOptions.excludeObjectTypes.value.length).be.equal(1, 'There should be one excluded object');

		// should return true for all exclude object types options and false for the exising defauit option
		Object.keys(model.deploymentOptions.objectTypesDictionary).forEach(option => {
			if (option === 'SampleProperty1') {
				should(model.getExcludeObjectTypeOptionCheckStatus(option)).equal(true, 'should return true for the excludeObjectTypes SampleProperty1 ');
			} else {
				should(model.getExcludeObjectTypeOptionCheckStatus(option)).equal(false, 'should return false for all excludeObjectTypes property as it is empty');
			}
		});
	});
});
