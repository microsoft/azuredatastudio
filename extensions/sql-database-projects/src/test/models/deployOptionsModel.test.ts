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
		should.notEqual(model.initializeOptionsData(), undefined, 'Options shouldn\'t be undefined');

		should.doesNotThrow(() => model.setDeploymentOptions());

		should(model.getOptionValue('')).equal(undefined);
	});

	it('Should get description', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		model.initializeOptionsData();
		Object.entries(model.deploymentOptions.booleanOptionsDict).forEach(l => {
			should(model.getOptionDescription(l[1].displayName)).not.equal(undefined);
		});
	});

	it('Should be undefined for null description', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		should(model.getOptionDescription('')).equal(undefined);
	});
});
