/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { isSameProduct } from '../../models/product';
import { AssessmentDialogComponent } from './model/assessmentDialogComponent';

export class SqlAssessmentResultList extends AssessmentDialogComponent {
	async createComponent(view: azdata.ModelView): Promise<azdata.Component> {

		return view.modelBuilder.divContainer().withItems([
			this.createListComponent(view)
		]
		).component();
	}

	private createListComponent(view: azdata.ModelView): azdata.DeclarativeTableComponent {
		const style: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left'
		};

		const dataValues = this._model.assessmentResults?.
			filter(s => isSameProduct(this._productType, s.appliesToMigrationTargetPlatform)). // Filter results based on the product type selected
			map((s): azdata.DeclarativeTableCellValue[] => {
				return [
					{
						value: s.checkId,
						style
					}
				];
			});

		const table = view.modelBuilder.declarativeTable().withProps(
			{
				selectEffect: true,
				columns: [

					{
						displayName: 'Asessment Results', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						width: 300,
						isReadOnly: true,
						headerCssStyles: style
					},

				],
				dataValues: dataValues,
				width: 300
			}
		);

		table.component().onRowSelected(({ row }) => {
			if (this._model.assessmentResults) {
				this._model.rulePickedEvent.fire(this._model.assessmentResults[row]);
			}
		});

		return table.component();
	}
}
