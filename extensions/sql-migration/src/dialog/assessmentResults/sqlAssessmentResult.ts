/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as loc from '../../constants/strings';

export class SqlAssessmentResult {
	async createComponent(view: azdata.ModelView): Promise<azdata.Component> {

		const title = this.createTitleComponent(view);
		const impact = this.createImpactComponent(view);
		const recommendation = this.createRecommendationComponent(view);
		const moreInfo = this.createMoreInfoComponent(view);
		const impactedObjects = this.createImpactedObjectsComponent(view);

		return view.modelBuilder.divContainer().withItems([title, impact, recommendation, moreInfo, impactedObjects]).component();
	}

	private createTitleComponent(view: azdata.ModelView): azdata.TextComponent {
		const title = view.modelBuilder.text().withProps({
			value: 'Azure SQL Managed Instance does not support multiple log files', // TODO: Get this string from the actual results
		});

		return title.component();
	}

	private createImpactComponent(view: azdata.ModelView): azdata.TextComponent {
		const impact = view.modelBuilder.text().withProps({
			title: loc.IMPACT,
			value: 'SQL Server allows a database to log transactions across multiple files. This databases uses multiple log files' // TODO: Get this string from the actual results
		});

		return impact.component();
	}

	private createRecommendationComponent(view: azdata.ModelView): azdata.TextComponent {
		const recommendation = view.modelBuilder.text().withProps({
			title: loc.RECOMMENDATION,
			value: 'Azure SQL Managed Instance allows a single log file per database only. Please delete all but one of the log files before migrating this database.' // TODO: Get this string from the actual results
		});

		return recommendation.component();
	}

	private createMoreInfoComponent(view: azdata.ModelView): azdata.TextComponent {
		const moreInfo = view.modelBuilder.text().withProps({
			title: loc.MORE_INFO,
			value: '{0}',
			links: [
				{
					text: 'Managed instance T-SQL differences - Azure SQL Database', // TODO: Get this string from the actual results
					url: 'https://microsoft.com' // TODO: Get this string from the actual results
				}
			]
		});

		return moreInfo.component();
	}

	private createImpactedObjectsComponent(view: azdata.ModelView): azdata.TableComponent {
		const impactedObjects = view.modelBuilder.table().withProps({
			title: 'Impacted Objects',
			columns: [
				loc.TYPE,
				loc.NAME
			],
			data: [
				['Database', 'AAAW2008P7'] // TODO: Get this string from the actual results
			]
		});

		return impactedObjects.component();
	}
}
