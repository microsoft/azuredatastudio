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
});
