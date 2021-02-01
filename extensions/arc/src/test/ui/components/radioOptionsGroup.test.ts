/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import { getErrorMessage } from '../../../common/utils';
import { RadioOptionsGroup, RadioOptionsInfo } from '../../../ui/components/radioOptionsGroup';
import { createModelViewMock } from 'azdata-test/out/mocks/modelView/modelViewMock';
import { StubRadioButton } from 'azdata-test/out/stubs/modelView/stubRadioButton';


const loadingError = new Error('Error loading options');
const radioOptionsInfo: RadioOptionsInfo = {
	values: [
		'value1',
		'value2'
	],
	defaultValue: 'value2'
};

let radioOptionsGroup: RadioOptionsGroup;

describe('radioOptionsGroup', function (): void {
	beforeEach(async () => {
		const { modelBuilderMock } = createModelViewMock();
		radioOptionsGroup = new RadioOptionsGroup(modelBuilderMock.object, (_disposable) => { });
		await radioOptionsGroup.load(async () => radioOptionsInfo);
	});

	it('verify construction and load', async () => {
		should(radioOptionsGroup).not.be.undefined();
		should(radioOptionsGroup.value).not.be.undefined();
		radioOptionsGroup.value!.should.equal('value2', 'radio options group should be the default checked value');
		// verify all the radioButtons created in the group
		verifyRadioGroup();
	});

	it('onClick', async () => {
		// click the radioButton corresponding to 'value1'
		((radioOptionsGroup.items as azdata.RadioButtonComponent[]).find(r => r.value === 'value1') as StubRadioButton).click();
		radioOptionsGroup.value!.should.equal('value1', 'radio options group should correspond to the radioButton that we clicked');
		// verify all the radioButtons created in the group
		verifyRadioGroup();
	});

	it('load throws', async () => {
		await radioOptionsGroup.load(() => { throw loadingError; });
		//in error case radioButtons array wont hold radioButtons but holds a TextComponent with value equal to error string
		radioOptionsGroup.items.length.should.equal(1, 'There is should be only one element in the divContainer when loading error happens');
		const label = radioOptionsGroup.items[0] as azdata.TextComponent;
		should(label.value).not.be.undefined();
		label.value!.should.deepEqual(getErrorMessage(loadingError));
		should(label.CSSStyles).not.be.undefined();
		should(label.CSSStyles!.color).not.be.undefined();
		label.CSSStyles!.color.should.equal('Red');
	});

	describe('getters and setters', async () => {
		it(`component getter`, () => {
			should(radioOptionsGroup.component()).not.be.undefined();
		});
	});
});

function verifyRadioGroup() {
	const radioButtons = radioOptionsGroup.items as azdata.RadioButtonComponent[];
	radioButtons.length.should.equal(radioOptionsInfo.values!.length, 'Unexpected number of radio buttons');
	radioButtons.forEach(rb => {
		should(rb.label).not.equal(undefined, 'Radio Button label should not be undefined');
		should(rb.value).not.equal(undefined, 'Radio button value should not be undefined');
		should(rb.enabled).not.equal(undefined, 'Enabled should not be undefined');
		rb.label!.should.equal(rb.value, 'Radio button label did not match');
		rb.enabled!.should.be.true('Radio button should be enabled');
	});
}

