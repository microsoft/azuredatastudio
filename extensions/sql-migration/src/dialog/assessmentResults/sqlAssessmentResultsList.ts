/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';

export class SqlAssessmentResultList {
	async createComponent(view: azdata.ModelView): Promise<azdata.Component> {

		return view.modelBuilder.divContainer().withItems([
			this.createListComponent(view)
		]
		).component();
	}

	private createListComponent(view: azdata.ModelView): azdata.ListBoxComponent {
		const list = view.modelBuilder.listBox().withProps({
			values: [
				'Filestream not supported in Azure SQL Managed Instance',
				'Number of Log files per database something something',
			]
		});

		return list.component();
	}
}
