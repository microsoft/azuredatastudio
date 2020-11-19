/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import * as sinon from 'sinon';
import { getErrorMessage } from '../../../common/utils';
import { RadioOptionsGroup, RadioOptionsInfo } from '../../../ui/components/radioOptionsGroup';
import { loadingComponent, loadingError, modelView, radioButtons } from '../../mocks/fakeContainersAndBuilders';

const radioOptionsInfo = <RadioOptionsInfo>{
	values: [
		'value1',
		'value2'
	],
	defaultValue: 'value2'
};

let radioOptionsGroup: RadioOptionsGroup;

describe('radioOptionsGroup', function (): void {
	beforeEach(async () => {
		radioOptionsGroup = new RadioOptionsGroup(modelView, (_disposable) => { });
		await radioOptionsGroup.load(async () => radioOptionsInfo);
	});

	afterEach(() => {
		sinon.restore();
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
		radioButtons.filter(r => r.value === 'value1').pop()!.click();
		radioOptionsGroup.value!.should.equal('value1');
		// verify all the radioButtons created in the group
		verifyRadioGroup('value1');
	});

	it('load throws', async () => {
		radioOptionsGroup.load(() => { throw loadingError; });
		radioButtons.length.should.equal(1, 'There is should be only one element in the divContainer when loading error happens');
		const label = radioButtons[0] as azdata.TextComponent;
		should(label.value).not.be.undefined();
		label.value!.should.deepEqual(getErrorMessage(loadingError));
		should(label.CSSStyles).not.be.undefined();
		should(label.CSSStyles!.color).not.be.undefined();
		label.CSSStyles!.color.should.equal('Red');
	});
});
function verifyRadioGroup(checkedValue: string) {
	radioButtons.length.should.equal(radioOptionsInfo.values!.length);
	radioButtons.forEach(rb => {
		should(rb.name).not.be.undefined();
		should(rb.label).not.be.undefined();
		should(rb.value).not.be.undefined();
		should(rb.enabled).not.be.undefined();
		rb.name!.should.be.oneOf(radioOptionsInfo.values);
		rb.label!.should.equal(rb.name);
		rb.value!.should.equal(rb.name);
		rb.enabled!.should.be.true();
	});
	const checked = radioButtons.filter(r => r.checked);
	checked.length.should.equal(1);
	checked.pop()!.value!.should.equal(checkedValue);
}

