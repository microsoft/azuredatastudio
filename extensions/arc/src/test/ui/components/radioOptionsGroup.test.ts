/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import { getErrorMessage } from '../../../common/utils';
import { RadioOptionsGroup, RadioOptionsInfo } from '../../../ui/components/radioOptionsGroup';
import { FakeRadioButton } from '../../mocks/fakeRadioButton';
import { setupMockComponentBuilder, createModelViewMock } from '../../stubs';


const loadingError = new Error('Error loading options');
const radioOptionsInfo = <RadioOptionsInfo>{
	values: [
		'value1',
		'value2'
	],
	defaultValue: 'value2'
};
const divItems: azdata.Component[] = [];
let radioOptionsGroup: RadioOptionsGroup;
let loadingComponent: azdata.LoadingComponent;

describe('radioOptionsGroup', function (): void {
	beforeEach(async () => {
		const { mockModelBuilder, mockRadioButtonBuilder, mockDivBuilder, mockLoadingBuilder } = createModelViewMock();
		mockRadioButtonBuilder.reset(); // reset any previous mock so that we can set our own.
		setupMockComponentBuilder<azdata.RadioButtonComponent, azdata.RadioButtonProperties>(
			(props) => new FakeRadioButton(props),
			mockRadioButtonBuilder,
		);
		mockDivBuilder.reset(); // reset previous setups so new setups we are about to create will replace the setups instead creating a recording chain
		// create new setups for the DivContainer with custom behavior
		setupMockComponentBuilder<azdata.DivContainer, azdata.DivContainerProperties, azdata.DivBuilder>(
			() => <azdata.DivContainer>{
				addItem: (item) => { divItems.push(item); },
				clearItems: () => { divItems.length = 0; },
				get items() { return divItems; },
			},
			mockDivBuilder
		);
		radioOptionsGroup = new RadioOptionsGroup(mockModelBuilder.object, (_disposable) => { });
		await radioOptionsGroup.load(async () => radioOptionsInfo);
		loadingComponent = mockLoadingBuilder.object.component();
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
		(divItems as FakeRadioButton[]).filter(r => r.value === 'value1').pop()!.click();
		radioOptionsGroup.value!.should.equal('value1', 'radio options group should correspond to the radioButton that we clicked');
		// verify all the radioButtons created in the group
		verifyRadioGroup();
	});

	it('load throws', async () => {
		radioOptionsGroup.load(() => { throw loadingError; });
		//in error case radioButtons array wont hold radioButtons but holds a TextComponent with value equal to error string
		divItems.length.should.equal(1, 'There is should be only one element in the divContainer when loading error happens');
		const label = divItems[0] as azdata.TextComponent;
		should(label.value).not.be.undefined();
		label.value!.should.deepEqual(getErrorMessage(loadingError));
		should(label.CSSStyles).not.be.undefined();
		should(label.CSSStyles!.color).not.be.undefined();
		label.CSSStyles!.color.should.equal('Red');
	});

	describe('getters and setters', async () => {
		it(`component getter`, () => {
			radioOptionsGroup.component().should.deepEqual(loadingComponent);
		});

		[true, false].forEach(testValue => {
			it(`Test readOnly with testValue: ${testValue}`, () => {
				radioOptionsGroup.readOnly = testValue;
				radioOptionsGroup.readOnly!.should.equal(testValue);
			});
			it(`Test enabled with testValue: ${testValue}`, () => {
				radioOptionsGroup.enabled = testValue;
				radioOptionsGroup.enabled!.should.equal(testValue);
			});
		});
	});
});

function verifyRadioGroup() {
	const radioButtons = divItems as FakeRadioButton[];
	radioButtons.length.should.equal(radioOptionsInfo.values!.length);
	radioButtons.forEach(rb => {
		should(rb.label).not.be.undefined();
		should(rb.value).not.be.undefined();
		should(rb.enabled).not.be.undefined();
		rb.label!.should.equal(rb.value);
		rb.enabled!.should.be.true();
	});
}

