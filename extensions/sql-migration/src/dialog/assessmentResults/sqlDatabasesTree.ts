/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { AssessmentDialogComponent } from './model/assessmentDialogComponent';
import { Issues } from './assessmentResultsDialog';

export class SqlDatabaseTree extends AssessmentDialogComponent {

	// private _assessmentData: Map<string, Issues[]>;

	constructor(assessmentData: Map<string, Issues[]>) {
		super();
		// this._assessmentData = assessmentData;
	}

	async createComponent(view: azdata.ModelView): Promise<azdata.Component> {

		return view.modelBuilder.divContainer().withItems([
			this.createTableComponent(view)
		]
		).component();
	}

	private createTableComponent(view: azdata.ModelView): azdata.DeclarativeTableComponent {

		const style: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left'
		};

		const table = view.modelBuilder.declarativeTable().withProps(
			{
				selectEffect: true,
				columns: [
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.boolean,
						width: 5,
						isReadOnly: false,
						showCheckAll: true,
						headerCssStyles: style,
						ariaLabel: 'Database Migration Check' // TODO localize
					},
					{
						displayName: 'Database', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						width: 50,
						isReadOnly: true,
						headerCssStyles: style
					},
					{
						displayName: '', // Incidents
						valueType: azdata.DeclarativeDataType.string,
						width: 5,
						isReadOnly: true,
						headerCssStyles: style,
						ariaLabel: 'Issue Count' // TODO localize
					}
				],
				dataValues: [
					[
						{
							value: false,
							style
						},
						{
							value: 'DB1',
							style
						},
						{
							value: 1,
							style
						}
					],
					[
						{
							value: true,
							style
						},
						{
							value: 'DB2',
							style
						},
						{
							value: 2,
							style
						}
					]
				],
			}
		);

		table.component().onRowSelected(({ row }) => {
			console.log(row);
		});

		return table.component();
	}

}
