/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createOneComponentFlexContainer } from '../common/utils';

/**
 * Defines a view in a query store report
 */
export class QueryStoreView {
	// TODO: add toolbar support
	component?: azdata.Component; // chart, query plan, text (query text?)

	/**
	 *
	 * @param title Title of view to display
	 * @param backgroundColor TODO: remove this after chart components are supported
	 */
	constructor(private title: string, private backgroundColor: string) {

	}

	/**
	 * Creates component and toolbar in a flex container
	 * @param view
	 * @returns
	 */
	public async createViewContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		// TODO: replace these text components with the actual chart components
		this.component = view.modelBuilder.text().withProps({
			value: this.title
		}).component();

		return await createOneComponentFlexContainer(view, this.component, this.backgroundColor);
	}
}
