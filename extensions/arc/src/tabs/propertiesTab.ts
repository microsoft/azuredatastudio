/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IconPathHelper } from '../constants';
import { Tab } from './tab';

export class PropertiesTab extends Tab {
	tab(view: azdata.ModelView): Promise<azdata.DashboardTab> {
		const properties: azdata.FlexContainer = view.modelBuilder.flexContainer().withItems([
			view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Properties' }).component()
		]).component();

		return Promise.resolve({
			title: 'Properties',
			id: 'properties-tab',
			icon: IconPathHelper.properties,
			content: properties
		});
	}
}
