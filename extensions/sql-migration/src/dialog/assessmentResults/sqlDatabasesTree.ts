/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { AssessmentDialogComponent } from './model/assessmentDialogComponent';

export class SqlDatabaseTree extends AssessmentDialogComponent {

	async createComponent(view: azdata.ModelView): Promise<azdata.Component> {

		return view.modelBuilder.flexContainer().withItems([
			this.createSearchComponent(view),
			this.createInstanceComponent(view),
			this.createDatabaseComponent(view)

		]).withLayout({
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				'border-right': 'solid 1px',
				'width': '300px'
			},
		}).component();
	}

	private createDatabaseComponent(view: azdata.ModelView): azdata.DivContainer {

		const styleLeft: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left'
		};
		const styleRight: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'right'
		};

		const databaseTable = view.modelBuilder.declarativeTable().withProps(
			{
				selectEffect: true,
				width: '100%',
				columns: [
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.boolean,
						width: 1,
						isReadOnly: false,
						showCheckAll: true,
						headerCssStyles: styleLeft,
						ariaLabel: 'Database Migration Check' // TODO localize
					},
					{
						displayName: 'Databases', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						width: 5,
						isReadOnly: true,
						headerCssStyles: styleLeft
					},
					{
						displayName: 'Issues', // Incidents
						valueType: azdata.DeclarativeDataType.string,
						width: 1,
						isReadOnly: true,
						headerCssStyles: styleRight,
						ariaLabel: 'Issue Count' // TODO localize

					}
				],
				dataValues: [
					[
						{
							value: false,
							style: styleLeft
						},
						{
							value: 'DB1',
							style: styleLeft
						},
						{
							value: 1,
							style: styleRight
						}
					],
					[
						{
							value: true,
							style: styleLeft
						},
						{
							value: 'DB2',
							style: styleLeft
						},
						{
							value: 2,
							style: styleRight
						}
					],
					[
						{
							value: false,
							style: styleLeft
						},
						{
							value: 'DB3',
							style: styleLeft
						},
						{
							value: 1,
							style: styleRight
						}
					],
					[
						{
							value: true,
							style: styleLeft
						},
						{
							value: 'DB4',
							style: styleLeft
						},
						{
							value: 2,
							style: styleRight
						}
					],
					[
						{
							value: false,
							style: styleLeft
						},
						{
							value: 'DB5',
							style: styleLeft
						},
						{
							value: 1,
							style: styleRight
						}
					],
					[
						{
							value: true,
							style: styleLeft
						},
						{
							value: 'DB6',
							style: styleLeft
						},
						{
							value: 2,
							style: styleRight
						}
					],
					[
						{
							value: false,
							style: styleLeft
						},
						{
							value: 'DB7',
							style: styleLeft
						},
						{
							value: 1,
							style: styleRight
						}
					],
					[
						{
							value: true,
							style: styleLeft
						},
						{
							value: 'DB8',
							style: styleLeft
						},
						{
							value: 2,
							style: styleRight
						}
					]
				],
				CSSStyles: {
					'text-align': 'left'
				}
			}
		);

		databaseTable.component().onRowSelected(({ row }) => {
			console.log(row); //TODO: Put data for each row so it can be displayed as each DB entry is selected
			// deselect instance table
		});


		const tableContainer = view.modelBuilder.divContainer().withItems([databaseTable.component()]).withProps({
			CSSStyles: {
				'margin-left': '15px',
			},
		}).component();
		return tableContainer;
	}

	private createSearchComponent(view: azdata.ModelView): azdata.DivContainer {
		let resourceSearchBox = view.modelBuilder.inputBox().withProperties({
			placeHolder: 'Search',
			ariaLabel: 'searchbar'
		}).component();

		const searchContainer = view.modelBuilder.divContainer().withItems([resourceSearchBox]).withProps({
			CSSStyles: {
				'width': '200px',
				'margin-left': '15px',
				'margin-right': '5px'

			},
		}).component();

		return searchContainer;
	}

	private createInstanceComponent(view: azdata.ModelView): azdata.DivContainer {
		const styleLeft: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left'
		};

		const styleRight: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'right'
		};

		const instanceTable = view.modelBuilder.declarativeTable().withProps(
			{
				selectEffect: true,
				width: '100%',
				columns: [
					{
						displayName: 'Instance',
						valueType: azdata.DeclarativeDataType.string,
						width: 5,
						isReadOnly: true,
						headerCssStyles: styleLeft,
						ariaLabel: 'Database Migration Check' // TODO localize
					},
					{
						displayName: 'Warnings', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						width: 1,
						isReadOnly: true,
						headerCssStyles: styleRight
					}
				],
				dataValues: [
					[
						{
							value: 'SQL Server 1',
							style: styleLeft
						},
						{
							value: 2,
							style: styleRight
						}
					]
				]
			});

		instanceTable.component().onRowSelected(({ row }) => {
			console.log(row); //TODO: Put data for each row so it can be displayed as each DB entry is selected
			//deselect database table
		});

		const instanceContainer = view.modelBuilder.divContainer().withItems([instanceTable.component()]).withProps({
			CSSStyles: {
				'margin-left': '15px',
			},
		}).component();

		return instanceContainer;
	}
}
