/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { Issues } from './assessmentResultsDialog';
import { AssessmentDialogComponent } from './model/assessmentDialogComponent';

type DbIssues = {
	name: string,
	issues: Issues[]
};
export class SqlDatabaseTree extends AssessmentDialogComponent {

	private instanceTable!: azdata.ComponentBuilder<azdata.DeclarativeTableComponent, azdata.DeclarativeTableProperties>;
	private databaseTable!: azdata.ComponentBuilder<azdata.DeclarativeTableComponent, azdata.DeclarativeTableProperties>;
	private _assessmentData: Map<string, Issues[]>;

	// private _title!: azdata.TextComponent;
	private _recommendation!: azdata.TextComponent;
	private _dbName!: azdata.TextComponent;
	private _recommendationText!: azdata.TextComponent;
	private _assessmentResultsTable!: azdata.ComponentBuilder<azdata.DeclarativeTableComponent, azdata.DeclarativeTableProperties>;

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

		let mapRowIssue = new Map<number, DbIssues>();
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

		if (this._assessmentData.size > 0) {
			let rowNumber = 0;
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
				let dbIssues = {
					name: key,
					issues: value
				};
				mapRowIssue.set(rowNumber, dbIssues);
				rowNumber = rowNumber + 1;
			});
			// fill in table fields
		}

		this.databaseTable.component().onRowSelected(({ row }) => {
			console.log(row); //TODO: Put data for each row so it can be displayed as each DB entry is selected
			// deselect instance table
			//TODO: change values here
			const rowInfo = mapRowIssue.get(row);
			if (rowInfo) {
				this._dbName.value = rowInfo.name;
				this._recommendation.value = `Assessment Results (${rowInfo.issues.length} issues found)`;
				// Need some kind of refresh method for declarative tables
				rowInfo.issues.forEach((issue) => {
					this._assessmentResultsTable.component().dataValues?.push(
						[
							{
								value: issue.description
							}

						]
					);
				});

				this._assessmentResultsTable.component();

			}

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

	async createComponentResult(view: azdata.ModelView): Promise<azdata.Component> {

		const topContainer = this.createTopContainer(view);
		const bottomContainer = this.createBottomContainer(view);

		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '100%'
		}).withProps({
			CSSStyles: {
				'margin-left': '10px'
			}
		}).component();

		container.addItem(topContainer, { flex: '0 0 auto' });
		container.addItem(bottomContainer, { flex: '1 1 auto' });

		return container;
	}


	private createTopContainer(view: azdata.ModelView): azdata.FlexContainer {
		const title = this.createTitleComponent(view);
		const impact = this.createPlatformComponent(view);
		const recommendation = this.createRecommendationComponent(view);
		const assessmentResults = this.createAssessmentResultsTitle(view);

		// assessmentResults.CSSStyles =
		// {
		// 	'border-bottom': 'solid 1px'
		// };


		const container = view.modelBuilder.flexContainer().withItems([title, impact, recommendation, assessmentResults]).withLayout({
			flexFlow: 'column'
		}).component();

		return container;
	}

	private createBottomContainer(view: azdata.ModelView): azdata.FlexContainer {
		// need a left and right container here

		const impactedObjects = this.createImpactedObjectsTable(view);
		const rightContainer = this.createAssessmentContainer(view);

		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			height: '100%'
		}).withProps({
			CSSStyles: {
				'height': '100%'
			}
		}).component();

		container.addItem(impactedObjects, { flex: '0 0 auto' });
		container.addItem(rightContainer, { flex: '1 1 auto' });
		return container;
	}

	private createAssessmentContainer(view: azdata.ModelView): azdata.FlexContainer {
		const title = this.createAssessmentTitle(view);

		const bottomContainer = this.createDescriptionContainer(view);


		const container = view.modelBuilder.flexContainer().withItems([title, bottomContainer]).withLayout({
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				'margin-left': '10px'
			}
		}).component();

		return container;
	}

	private createDescriptionContainer(view: azdata.ModelView): azdata.FlexContainer {
		const description = this.createDescription(view);
		const impactedObjects = this.createImpactedObjectsDescription(view);


		const container = view.modelBuilder.flexContainer().withItems([description, impactedObjects]).withLayout({
			flexFlow: 'row'
		}).component();

		return container;
	}

	private createImpactedObjectsDescription(view: azdata.ModelView): azdata.FlexContainer {
		const impactedObjectsTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Impacted Objects',
			CSSStyles: {
				'font-size': '14px'
			}
		}).component();

		const headerStyle: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left'
		};
		const rowStyle: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left'
		};

		const impactedObjects = view.modelBuilder.declarativeTable().withProps(
			{
				selectEffect: true,
				width: '100%',
				columns: [
					{
						displayName: 'Type', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						width: '100%',
						isReadOnly: true,
						headerCssStyles: headerStyle,
						rowCssStyles: rowStyle
					},
					{
						displayName: 'Name', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						width: '100%',
						isReadOnly: true,
						headerCssStyles: headerStyle,
						rowCssStyles: rowStyle
					},
				],
				dataValues: [
					[
						{
							value: 'Agent Job'
						},
						{
							value: 'Process Monthly Usage'
						}
					]
				]
			}
		);

		if (this._assessmentData) {
			// fill in table fields
		}

		impactedObjects.component().onRowSelected(({ row }) => {
			console.log(row); //TODO: Put data for each row so it can be displayed as each DB entry is selected, need some kind of dictionary
		});




		const objectDetailsTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Object details',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();

		const objectDetailsType = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Type: Agent Job',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();

		const objectDetailsName = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Name: Process Monthly Usage',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();

		const objectDetailsSample = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Sample Powershell Job',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();

		const container = view.modelBuilder.flexContainer().withItems([impactedObjectsTitle, impactedObjects.component(), objectDetailsTitle, objectDetailsType, objectDetailsName, objectDetailsSample]).withLayout({
			flexFlow: 'column'
		}).component();

		return container;
	}

	private createDescription(view: azdata.ModelView): azdata.FlexContainer {
		const descriptionTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Description',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();
		const descriptionText = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'It is a job step that runs a PowerShell scripts.',
			CSSStyles: {
				'font-size': '12px'
			}
		}).component();

		const recommendationTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Recommendation',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();
		this._recommendationText = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: '',
			CSSStyles: {
				'font-size': '12px',
				'width': '250px'
			}
		}).component();


		const container = view.modelBuilder.flexContainer().withItems([descriptionTitle, descriptionText, recommendationTitle, this._recommendationText]).withLayout({
			flexFlow: 'column'
		}).component();

		return container;
	}


	private createAssessmentTitle(view: azdata.ModelView): azdata.TextComponent {
		const title = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: '',
			CSSStyles: {
				'font-size': '14px',
				'border-bottom': 'solid 1px'
			}
		});

		return title.component();
	}

	private createTitleComponent(view: azdata.ModelView): azdata.TextComponent {
		const title = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Target Platform',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '2px'
			}
		});

		return title.component();
	}

	private createPlatformComponent(view: azdata.ModelView): azdata.TextComponent {
		const impact = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			title: 'Platform', // TODO localize
			value: 'Azure SQL Managed Instance', // TODO: Get this string from the actual results
			CSSStyles: {
				'font-size': '18px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		});

		return impact.component();
	}

	private createRecommendationComponent(view: azdata.ModelView): azdata.TextComponent {
		this._dbName = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			title: 'Recommendation', // TODO localize
			value: 'SQL Server 1', // TODO: Get this string from the actual results
			CSSStyles: {
				'font-size': '14px',
				'font-weight': 'bold'
			}
		}).component();

		return this._dbName;
	}

	private createAssessmentResultsTitle(view: azdata.ModelView): azdata.TextComponent {
		this._recommendation = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			title: 'Recommendation', // TODO localize
			value: 'Assessment Results', // TODO: Get this string from the actual results
			CSSStyles: {
				'font-size': '14px',
				'font-weight': 'bold',
				'border-bottom': 'solid 1px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();

		return this._recommendation;
	}


	private createImpactedObjectsTable(view: azdata.ModelView): azdata.DeclarativeTableComponent {

		const headerStyle: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left'
		};
		const rowStyle: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left'
		};

		this._assessmentResultsTable = view.modelBuilder.declarativeTable().withProps(
			{
				selectEffect: true,
				width: '100%',
				columns: [
					{
						displayName: '', // TODO localize
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
							value: 'DB1 Assessment results'
						}
					],
					[
						{
							value: 'DB2 Assessment results'
						}
					]
				]
			}
		);

		this._assessmentResultsTable.component().onRowSelected(({ row }) => {
			console.log(row); //TODO: Put data for each row so it can be displayed as each DB entry is selected, need some kind of dictionary
		});

		return this._assessmentResultsTable.component();
	}
}
