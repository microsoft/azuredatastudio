/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IconPathHelper } from '../../../../constants';
import { Tab } from './tab';

export class ConnectionStringsTab extends Tab {
	tab(view: azdata.ModelView): Promise<azdata.DashboardTab> {
		const connectionStrings: azdata.FlexContainer = view.modelBuilder.flexContainer().withItems([
			view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Connection strings' }).component()
		]).component();

		return Promise.resolve({
			title: 'Connection strings',
			id: 'connection-strings-tab',
			icon: IconPathHelper.connection,
			content: connectionStrings
		});
	}
}
