/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { TestContainerBuilder } from './testContainerBuilder';

export class TestFormBuilder extends TestContainerBuilder<azdata.FormContainer, azdata.FormLayout, azdata.FormItemLayout> implements azdata.FormBuilder {

	constructor(component: azdata.FormContainer) {
		super(component);
	}

	///##############################
	// # FormBuilder Implementation #
	// ##############################

	withFormItems(_components: (azdata.FormComponent | azdata.FormComponentGroup)[], _itemLayout?: azdata.FormItemLayout | undefined): azdata.FormBuilder { return this; }
	addFormItems(_formComponents: (azdata.FormComponent | azdata.FormComponentGroup)[], _itemLayout?: azdata.FormItemLayout | undefined): void { }
	addFormItem(_formComponent: azdata.FormComponent | azdata.FormComponentGroup, _itemLayout?: azdata.FormItemLayout | undefined): void { }
	insertFormItem(_formComponent: azdata.FormComponent | azdata.FormComponentGroup, _index?: number | undefined, _itemLayout?: azdata.FormItemLayout | undefined): void { }
	removeFormItem(_formComponent: azdata.FormComponent | azdata.FormComponentGroup): boolean { return true; }
}
