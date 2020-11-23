/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
//import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
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
const { mockModelView, mockRadioButtonBuilder, mockModelBuilder, mockDivBuilder } = createModelViewMock();

console.log(`TCL::: mockModelView`, JSON.stringify(mockModelView, undefined, '\t'));
const modelView = mockModelView.object;
console.log(`TCL::: mockModelView`, JSON.stringify(mockModelView, undefined, '\t'));
describe('radioOptionsGroup', function (): void {
	beforeEach(async () => {
		console.log(`TCL::: mockRadioButtonBuilder`, mockRadioButtonBuilder);
		const mockLoadingBuilder = setupMockComponentBuilder<azdata.LoadingComponent, azdata.LoadingComponentProperties, azdata.LoadingComponentBuilder>();
		mockLoadingBuilder.setup(b => b.withItem(TypeMoq.It.isAny())).returns(() => mockLoadingBuilder.object);
		mockModelBuilder.setup(b => b.loadingComponent()).returns(() => mockLoadingBuilder.object);
		mockRadioButtonBuilder.reset(); // reset any previous mock so that we can set our own.
		setupMockComponentBuilder<azdata.RadioButtonComponent, azdata.RadioButtonProperties>(
			(props) => new FakeRadioButton(props),
			mockRadioButtonBuilder,
		);
		mockDivBuilder.reset();
		setupMockComponentBuilder<azdata.DivContainer, azdata.DivContainerProperties, azdata.DivBuilder>(
			() => <azdata.DivContainer>{
				addItem: (item) => { divItems.push(item); },
				clearItems: () => { divItems.length = 0; },
				get items() { return divItems; },
			},
			mockDivBuilder
		);
		const divContainer = mockDivBuilder.object.component();
		console.log(`TCL::: divContainer=${JSON.stringify(divContainer, undefined, '\t')}`);
		// sinon.stub(divContainer, 'addItem').callsFake(item => divItems.push(item));
		// sinon.stub(divContainer, 'clearItems').callsFake(() => divItems.length = 0);
		// sinon.stub(divContainer, 'items').get(() => divItems);

		// mockRadioButtonBuilder.setup(b => {

		// });
		// const radioButtonBuilderSpy = sinon.spy(mockRadioButtonBuilder.object, 'withProperties');
		// sinon.stub(mockRadioButtonBuilder.object, 'component').returns(new FakeRadioButton(<azdata.RadioButtonProperties>radioButtonBuilderSpy.getCall(0).args[0]));
		console.log(`TCL::: modelView`, modelView);
		radioOptionsGroup = new RadioOptionsGroup(modelView, (_disposable) => { });
		await radioOptionsGroup.load(async () => radioOptionsInfo);
	});

	afterEach(() => {
		//sinon.restore();
	});

	it('verify construction and load', async () => {
		should(radioOptionsGroup).not.be.undefined();
		should(radioOptionsGroup.value).not.be.undefined();
		radioOptionsGroup.value!.should.equal('value2');
		// verify all the radioButtons created in the group
		verifyRadioGroup('value2');
	});

	it('onClick', async () => {
		//click the radioButton corresponding to 'value1'
		(divItems as FakeRadioButton[]).filter(r => r.value === 'value1').pop()!.click();
		radioOptionsGroup.value!.should.equal('value1');
		// verify all the radioButtons created in the group
		verifyRadioGroup('value1');
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
});

function verifyRadioGroup(checkedValue: string) {
	const radioButtons = divItems as FakeRadioButton[];
	radioButtons.length.should.equal(radioOptionsInfo.values!.length);
	radioButtons.forEach(rb => {
		should(rb.label).not.be.undefined();
		should(rb.value).not.be.undefined();
		should(rb.enabled).not.be.undefined();
		rb.label!.should.equal(rb.value);
		rb.enabled!.should.be.true();
	});
	const checked = radioButtons.filter(r => r.checked);
	checked.length.should.equal(1);
	checked.pop()!.value!.should.equal(checkedValue);
}

