/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { Issues } from './assessmentResultsDialog';
import { AssessmentDialogComponent } from './model/assessmentDialogComponent';

export class SqlDatabaseTree extends AssessmentDialogComponent {

	private instanceTable!: azdata.ComponentBuilder<azdata.DeclarativeTableComponent, azdata.DeclarativeTableProperties>;
	private databaseTable!: azdata.ComponentBuilder<azdata.DeclarativeTableComponent, azdata.DeclarativeTableProperties>;
	private _assessmentData: Map<string, Issues[]>;

	constructor(assessmentData: Map<string, Issues[]>) {
		super();
		this._assessmentData = assessmentData;
	}

	async createComponent(view: azdata.ModelView): Promise<azdata.Component> {
		const component = view.modelBuilder.flexContainer().withLayout({
			height: '100%',
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				'border-right': 'solid 1px'
			},
		}).component();

		component.addItem(this.createSearchComponent(view), { flex: '0 0 auto' });
		component.addItem(this.createInstanceComponent(view), { flex: '0 0 auto' });
		component.addItem(this.createDatabaseComponent(view), { flex: '1 1 auto' });
		return component;
	}

	private createDatabaseComponent(view: azdata.ModelView): azdata.DivContainer {

		const styleLeft: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left !important'
		};
		const styleRight: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'right'
		};

		this.databaseTable = view.modelBuilder.declarativeTable().withProps(
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
				]
			}
		);

		if (this._assessmentData.keys.length > 1) {

			this._assessmentData.forEach((value, key) => {
				this.databaseTable.component().dataValues?.push(
					[
						{
							value: false,
							style: styleLeft
						},
						{
							value: key,
							style: styleLeft
						},
						{
							value: value.length,
							style: styleRight
						}
					]

				);
			});
			// fill in table fields
		}

		this.databaseTable.component().onRowSelected(({ row }) => {
			console.log(row); //TODO: Put data for each row so it can be displayed as each DB entry is selected
			// deselect instance table

			// if (this.instanceTable.component().) {

			// }
		});


		const tableContainer = view.modelBuilder.divContainer().withItems([this.databaseTable.component()]).withProps({
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

		this.instanceTable = view.modelBuilder.declarativeTable().withProps(
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

		this.instanceTable.component().onRowSelected(({ row }) => {
			console.log(row); //TODO: Put data for each row so it can be displayed as each DB entry is selected
			//deselect database table
		});

		const instanceContainer = view.modelBuilder.divContainer().withItems([this.instanceTable.component()]).withProps({
			CSSStyles: {
				'margin-left': '15px',
			},
		}).component();

		return instanceContainer;
	}
}
