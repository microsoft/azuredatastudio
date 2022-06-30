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
		should.notEqual(model.InitializeOptionsData(), undefined, 'Options shouldn\'t be undefined');

		should.doesNotThrow(() => model.setDeploymentOptions());

		should(model.getOptionValue('')).equal(undefined);
	});

	it('Should get description', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		model.optionsLabels.forEach(l => {
			should(model.getOptionDescription(l)).not.equal(undefined);
		});
	});

	it('Should be undefined for null description', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		should(model.getOptionDescription('')).equal(undefined);
	});

	it('Should have no exclude objects but include objects', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		should(model.excludedObjectTypes.length).be.equal(0, 'There should be no excluded objects');

		model.includeObjectTypeLabels.forEach(l => {
			if(!model.getIncludedObjectsCheckedboxValue(l)){
				model.excludedObjectTypes.push(model.deploymentOptions.includeObjects[l]);
			}
		});
		model.setIncludeObjectTypeOptions();

		// includeObjectTypes have two sample options, expected-0 and actual-2, should not equal
		should(model.excludedObjectTypes.length).not.equal(model.includeObjectTypeLabels.length, 'All the object types should be excluded');
	});

	it('Should have exclude objects and matches with includeObjects', function (): void {
		const model = new DeployOptionsModel(testUtils.getDeploymentOptions());
		model.deploymentOptions.excludeObjectTypes.value = [0, 2];

		should(model.excludedObjectTypes.length).be.equal(0, 'There should be no excluded objects');

		model.includeObjectTypeLabels.forEach(l => {
			if(!model.getIncludedObjectsCheckedboxValue(l)){
				model.excludedObjectTypes.push(model.deploymentOptions.includeObjects[l]);
			}
		});

		// includeObjectTypes have two sample options, expected-2 and actual-2, should not equal
		should(model.excludedObjectTypes.length).be.equal(model.includeObjectTypeLabels.length, 'All the object types should be excluded');
	});
});
