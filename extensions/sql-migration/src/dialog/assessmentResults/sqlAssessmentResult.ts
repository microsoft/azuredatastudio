/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';

import { AssessmentDialogComponent } from './model/assessmentDialogComponent';

export class SqlAssessmentResult extends AssessmentDialogComponent {
	async createComponent(view: azdata.ModelView): Promise<azdata.Component> {

		const title = this.createTitleComponent(view);
		const impact = this.createPlatformComponent(view);
		const recommendation = this.createDatabaseComponent(view);
		// const moreInfo = this.createMoreInfoComponent(view);
		const impactedObjects = this.createImpactedObjectsComponent(view);

		return view.modelBuilder.flexContainer().withItems([title, impact, recommendation, impactedObjects]).withLayout({
			flexFlow: 'column',
			// width: '100%'
		}).component();
	}

	private createTitleComponent(view: azdata.ModelView): azdata.TextComponent {
		const title = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Target Platform',
			CSSStyles: {
				'font-size': '14px'
			}
		});

		return title.component();
	}

	private createPlatformComponent(view: azdata.ModelView): azdata.TextComponent {
		const impact = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			title: 'Platform', // TODO localize
			value: 'Azure SQL Managed Instance', // TODO: Get this string from the actual results
			CSSStyles: {
				'font-size': '18px'
			}
		});

		return impact.component();
	}

	private createDatabaseComponent(view: azdata.ModelView): azdata.TextComponent {
		const recommendation = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			title: 'Recommendation', // TODO localize
			value: 'SQL Server 1', // TODO: Get this string from the actual results
			CSSStyles: {
				'font-size': '14px',
				'font-weight': 'bold'
			}
		});

		return recommendation.component();
	}


	private createImpactedObjectsComponent(view: azdata.ModelView): azdata.DeclarativeTableComponent {

		const headerStyle: azdata.CssStyles = {
			'border-bottom': 'solid 1px',
			'text-align': 'left'
		};
		const rowStyle: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left'
		};

		const impactedObjects = view.modelBuilder.declarativeTable().withProps(
			{
				selectEffect: true,
				columns: [
					{
						displayName: 'Assessment Results', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						width: '100%',
						isReadOnly: true,
						headerCssStyles: headerStyle,
						rowCssStyles: rowStyle
					}
				],
				dataValues: [
					[
						{
							value: 'DB1'
						}
					]
				]
			}
		);

		impactedObjects.component().onRowSelected(({ row }) => {
			console.log(row); //TODO: Put data for each row so it can be displayed as each DB entry is selected, need some kind of dictionary
		});

		return impactedObjects.component();
	}
}
