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
			should(model.getOptionDescription(option[1].displayName)).not.equal(undefined);
		});
	});

	it('Should return empty string for null option ', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		should(model.getOptionDescription('')).equal('');
	});


	it('Should have no exclude objects but include objects', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		should(model.deploymentOptions.excludeObjectTypes.value.length).be.equal(0, 'There should be no excluded objects');

		// should return true for all include object options as there are no exclude options
		Object.keys(model.deploymentOptions.includeObjectsDictionary).forEach(option => {
			should(model.getIncludObjecttypeOptionCheckStatus(option)).equal(true);
		});
	});

	it('Should have exclude objects and matches with includeObjects', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		model.deploymentOptions.excludeObjectTypes.value = ['SampleProperty1'];

		should(model.deploymentOptions.excludeObjectTypes.value.length).be.equal(1, 'There should be one excluded object');

		// should return true for all include object options and false for the aggregate option
		Object.keys(model.deploymentOptions.includeObjectsDictionary).forEach(option => {
			if (option === 'SampleProperty1') {
				should(model.getIncludObjecttypeOptionCheckStatus(option)).equal(false);
			} else {
				should(model.getIncludObjecttypeOptionCheckStatus(option)).equal(true);
			}
		});
	});
});
