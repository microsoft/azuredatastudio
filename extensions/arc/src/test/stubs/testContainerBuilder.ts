/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { TestComponentBuilder } from './testComponentBuilder';

export class TestContainerBuilder<T extends azdata.Component, TLayout, TItemLayout> extends TestComponentBuilder<T> implements azdata.ContainerBuilder<T, TLayout, TItemLayout> {

	constructor(component: T) {
		super(component);
	}

	///###################################
	// # ContainerBuilder Implementation #
	// ###################################
	withLayout(_layout: TLayout): azdata.ContainerBuilder<T, TLayout, TItemLayout> { return this; }
	withItems(_components: azdata.Component[], _itemLayout?: TItemLayout | undefined): azdata.ContainerBuilder<T, TLayout, TItemLayout> { return this; }
}
