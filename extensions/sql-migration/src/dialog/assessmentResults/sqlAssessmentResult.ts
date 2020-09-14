/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';

import { AssessmentDialogComponent } from './model/assessmentDialogComponent';

export class SqlAssessmentResult extends AssessmentDialogComponent {
	async createComponent(view: azdata.ModelView): Promise<azdata.Component> {

		const title = this.createTitleComponent(view);
		const impact = this.createImpactComponent(view);
		const recommendation = this.createRecommendationComponent(view);
		const moreInfo = this.createMoreInfoComponent(view);
		const impactedObjects = this.createImpactedObjectsComponent(view);

		return view.modelBuilder.divContainer().withItems([title, impact, recommendation, moreInfo, impactedObjects]).withProps({
			CSSStyles: {
				'overflow': 'auto',
				'max-width': '650px'
			}
		}).component();
	}

	private createTitleComponent(view: azdata.ModelView): azdata.TextComponent {
		const title = view.modelBuilder.text().component();

		this._model.rulePickedEvent.event((e) => {
			title.value = e?.checkId;
		});

		return title;
	}

	private createImpactComponent(view: azdata.ModelView): azdata.TextComponent {
		const impact = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			title: 'Impact', // TODO localize
			value: 'SQL Server allows a database to log transactions across multiple files. This databases uses multiple log files' // TODO: Get this string from the actual results
		}).component();

		this._model.rulePickedEvent.event((e) => {
			impact.value = e?.description;
		});

		return impact;
	}

	private createRecommendationComponent(view: azdata.ModelView): azdata.TextComponent {
		const recommendation = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			title: 'Recommendation', // TODO localize
			value: 'Azure SQL Managed Instance allows a single log file per database only. Please delete all but one of the log files before migrating this database.' // TODO: Get this string from the actual results
		}).component();

		this._model.rulePickedEvent.event((e) => {
			recommendation.value = e?.message;
		});

		return recommendation;
	}

	private createMoreInfoComponent(view: azdata.ModelView): azdata.TextComponent {
		const moreInfo = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			title: 'More info', // TODO localize
			value: '{0}',
			links: [
				{
					text: 'Managed instance T-SQL differences - Azure SQL Database', // TODO: Get this string from the actual results
					url: 'https://microsoft.com' // TODO: Get this string from the actual results
				}
			]
		}).component();

		this._model.rulePickedEvent.event((e) => {
			if (e?.checkId === undefined || e?.helpLink === undefined) {
				moreInfo.display = 'none';
				return;
			}

			moreInfo.updateProperty('links', [
				{
					text: e.checkId,
					url: e.helpLink
				}
			]);

		});

		return moreInfo;
	}

	private createImpactedObjectsComponent(view: azdata.ModelView): azdata.TableComponent {
		const impactedObjects = view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			title: 'Impacted Objects',
			columns: [
				'Type', // TODO localize
				'Name',
			],
			data: [
				['Database', 'AAAW2008P7'] // TODO: Get this string from the actual results
			]
		});

		return impactedObjects.component();
	}
}
