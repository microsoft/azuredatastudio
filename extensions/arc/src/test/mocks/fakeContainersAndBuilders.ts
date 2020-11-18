/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import { FakeRadioButton } from './fakeRadioButton';

export const radioButtons: FakeRadioButton[] = [];

export const divContainer = <azdata.DivContainer><any>{
	withProperties(obj: azdata.DivContainerProperties) {
		should(obj).not.be.undefined();
		should(obj.clickable).not.be.undefined();
		obj.clickable!.should.equal(false, 'withProperties need to be get called with clickable set to false');
		return divContainer;
	},
	component: () => divContainer,
	clearItems: () => { radioButtons.length = 0; },
	addItem: (component: azdata.Component) => radioButtons.push(component as FakeRadioButton),
	get items() { return radioButtons; }
};

export const loadingComponent = <azdata.LoadingComponent>{
	get loading() { return false; },
	set loading(_value: boolean) { }
};

const loadingBuilder = (<azdata.LoadingComponentBuilder><any>{
	withItem(obj: any) {
		obj.should.equal(divContainer);
		return loadingBuilder;
	},
	component: () => loadingComponent,
});


export const loadingError = new Error('Error loading options');

export const modelBuilder = {
	divContainer: () => divContainer,
	loadingComponent: () => loadingBuilder,
	radioButton: () => <any>{
		withProperties: (rbProps: azdata.RadioButtonProperties) => {
			return {
				component: () => new FakeRadioButton(rbProps),
			};
		}
	},
	text: () => <any>{
		withProperties: (props: azdata.TextComponentProperties) => {
			return { component: () => props };
		},
	},
};

export const modelView = <azdata.ModelView>{
	modelBuilder: <azdata.ModelBuilder><any>modelBuilder
};

