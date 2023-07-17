/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import { createOneComponentFlexContainer, createTwoComponentFlexContainer, createVerticalSplitView } from '../common/utils';
import { TestContext, createViewContext } from './testUtils';

let testContext: TestContext;

describe('Test to verify flex container creation util function', () => {
	beforeEach(() => {
		testContext = createViewContext();
	});
	it('Should create a component as expected with createOneComponentFlexContainer', async () => {
		let flexContainer: azdata.FlexContainer = await createOneComponentFlexContainer(testContext.view, testContext.component, 'black');
		should(flexContainer.valid).be.true();
	});

	it('Should create a component as expected with createTwoComponentFlexContainer with row flow', () => {
		let flexContainer: azdata.FlexContainer = createTwoComponentFlexContainer(testContext.view, testContext.component, testContext.component, 'row');
		should(flexContainer.valid).be.true();
	});

	it('Should create a component as expected with createTwoComponentFlexContainer with column flow', () => {
		let flexContainer: azdata.FlexContainer = createTwoComponentFlexContainer(testContext.view, testContext.component, testContext.component, 'column');
		should(flexContainer.valid).be.true();
	});

	it('Should create a component as expected with createVerticalSplitView', () => {
		let splitViewContainer: azdata.SplitViewContainer = createVerticalSplitView(testContext.view, testContext.component, testContext.component, 100);
		should(splitViewContainer.valid).be.true();
	});
});
