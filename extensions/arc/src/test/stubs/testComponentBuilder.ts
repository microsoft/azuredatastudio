/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export class TestComponentBuilder<T extends azdata.Component> implements azdata.ComponentBuilder<T> {

	constructor(protected _component: T) { }

	///###################################
	// # ComponentBuilder Implementation #
	// ###################################

	component(): T {
		return this._component;
	}
	withProperties<U>(properties: U): azdata.ComponentBuilder<T> {
		this._component.updateProperties(properties);
		return this;
	}
	withValidation(_validation: (component: T) => boolean): azdata.ComponentBuilder<T> {
		throw new Error('Method not implemented.');
	}

}
