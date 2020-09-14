/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { AssessmentDialogComponent } from './model/assessmentDialogComponent';

export class SqlDatabaseTree extends AssessmentDialogComponent {

	async createComponent(view: azdata.ModelView): Promise<azdata.Component> {
		let databases = await azdata.connection.listDatabases(this._model.sourceConnection.connectionId);
		return this.createTableComponent(view, databases);
	}

	private createTableComponent(view: azdata.ModelView, databases: string[]): azdata.DeclarativeTableComponent {

		const style: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left'
		};

		let dataValues = new Array(databases.length);
		for (let i = 0; i < databases.length; ++i) {
			dataValues[i] = [
				{
					value: false,
					style
				},
				{
					value: databases[i],
					style
				},
				{
					value: '',
					style
				}
			];
		}

		const table = view.modelBuilder.declarativeTable().withProps(
			{
				selectEffect: true,
				columns: [
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.boolean,
						isReadOnly: false,
						showCheckAll: true,
						headerCssStyles: style,
						ariaLabel: 'Database Migration Check' // TODO localize
					},
					{
						displayName: 'Database', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						isReadOnly: true,
						headerCssStyles: style
					},
					{
						displayName: '', // Incidents
						valueType: azdata.DeclarativeDataType.string,
						isReadOnly: true,
						headerCssStyles: style,
						ariaLabel: 'Issue Count' // TODO localize
					}
				],
				dataValues: dataValues,
				width: 210
			}
		);

		table.component().onRowSelected(({ row }) => {
			console.log(row);
		});

		return table.component();
	}
}
