/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { AssessmentDialogComponent } from './model/assessmentDialogComponent';

export class SqlDatabaseTree extends AssessmentDialogComponent {
	async createComponent(view: azdata.ModelView): Promise<azdata.Component> {

		return view.modelBuilder.divContainer().withItems([
			this.createTableComponent(view)
		]
		).component();
	}

	private createTableComponent(view: azdata.ModelView): azdata.DeclarativeTableComponent {

		const table = view.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>(
			{
				columns: [
					{
						displayName: 'Database', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						width: 50,
						isReadOnly: true,
						showCheckAll: true
					},
					{
						displayName: '', // Incidents
						valueType: azdata.DeclarativeDataType.string,
						width: 5,
						isReadOnly: true,
						showCheckAll: false
					}
				],
				data: [
					['DB1', '1'],
					['DB2', '0']
				],
				width: '200px'
			}
		);

		return table.component();
	}
}
