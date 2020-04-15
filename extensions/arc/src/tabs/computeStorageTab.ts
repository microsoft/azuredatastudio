/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IconPathHelper } from '../constants';
import { Tab } from './tab';

export class ComputeStorageTab extends Tab {
	tab(view: azdata.ModelView): Promise<azdata.DashboardTab> {
		const computeStorage: azdata.FlexContainer = view.modelBuilder.flexContainer().withItems([
			view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Compute + storage' }).component()
		]).component();

		return Promise.resolve({
			title: 'Compute + storage',
			id: 'compute-storage-tab',
			icon: IconPathHelper.computeStorage,
			content: computeStorage
		});
	}
}
