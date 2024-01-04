/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import { createContext, ParentDialog } from './utils';
import { ModelDetailsPage } from '../../../views/models/modelDetailsPage';

describe('Model Details Page', () => {
	it('Should create view components successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);

		let view = new ModelDetailsPage(testContext.apiWrapper.object, parent);
		view.registerComponent(testContext.view.modelBuilder);
		should.notEqual(view.component, undefined);
	});

	it('Should load data successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);

		let view = new ModelDetailsPage(testContext.apiWrapper.object, parent);
		view.modelsViewData = [
			{
				modelData: 'motel1'
			}
		];
		view.registerComponent(testContext.view.modelBuilder);

		await view.refresh();
		should.notEqual(view.data, undefined);
		should.equal(view.data?.length, 1);
	});

	it('Should not validate the page if not model is selected ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);

		let view = new ModelDetailsPage(testContext.apiWrapper.object, parent);
		view.modelsViewData = [
		];
		view.registerComponent(testContext.view.modelBuilder);

		await view.refresh();
		await should(view.validate()).be.resolvedWith(false);
	});

	it('Should not validate the page if model does not have name', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);

		let view = new ModelDetailsPage(testContext.apiWrapper.object, parent);
		view.modelsViewData = [
			{
				modelData: 'motel1',
				modelDetails: {
					modelName: ''
				}
			}
		];

		view.registerComponent(testContext.view.modelBuilder);

		await view.refresh();
		await should(view.validate()).be.resolvedWith(false);
	});

	it('Should validate the page if model is valid', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);

		let view = new ModelDetailsPage(testContext.apiWrapper.object, parent);
		view.modelsViewData = [
			{
				modelData: 'motel1',
				modelDetails: {
					modelName: 'name'
				}
			}
		];

		view.registerComponent(testContext.view.modelBuilder);

		await view.refresh();
		await should(view.validate()).be.resolvedWith(true);
	});
});
