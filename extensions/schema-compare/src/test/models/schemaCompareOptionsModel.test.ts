/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as mssql from 'mssql';
import * as testUtils from '../testUtils';
import { SchemaCompareOptionsModel } from '../../models/schemaCompareOptionsModel';

describe('Schema Compare Options Model', () => {
	it('Should create model and set options successfully', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		should.notEqual(model.getOptionsData(), undefined, 'Options shouldn\'t be undefined');
		should.notEqual(model.getObjectsData(), undefined, 'Objects shouldn\'t be undefined');

		should.doesNotThrow(() => model.setDeploymentOptions());
		should.doesNotThrow(() => model.setObjectTypeOptions());

		should(model.getSchemaCompareOptionUtil('')).equal(undefined, 'Should retube undefined if an invalid option is passed in');
		should(model.getSchemaCompareIncludedObjectsUtil('')).be.false('Should return false if invalid object name is passed in');
	});

	it('Should exclude objects', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		should(model.excludedObjectTypes.length).be.equal(0, 'There should be no excluded objects');

		model.objectTypeLabels.forEach(l => {
			model.setSchemaCompareIncludedObjectsUtil(l, false);
		});

		should(model.excludedObjectTypes.length).be.equal(model.objectTypeLabels.length, 'All the object types should be excluded');
	});

	it('Should get descriptions', function (): void {
		const model = new SchemaCompareOptionsModel(testUtils.getDeploymentOptions());
		model.optionsLabels.forEach(l => {
			should(model.getDescription(l)).not.equal(undefined);
		});
	});
});
