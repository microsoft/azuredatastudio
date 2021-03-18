/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { SqlMigrationImpactedObjectInfo } from '../../../../mssql/src/mssql';
import { MigrationStateModel } from '../../models/stateMachine';
import { Issues } from './assessmentResultsDialog';
import { AssessmentDialogComponent } from './model/assessmentDialogComponent';

type DbIssues = {
	name: string,
	issues: Issues[]
};
export class SqlDatabaseTree extends AssessmentDialogComponent {
	static EXCLUDED_DB = [
		'master',
		'tempdb',
		'msdb',
		'model'
	];

	private _instanceTable!: azdata.DeclarativeTableComponent;
	private _databaseTable!: azdata.DeclarativeTableComponent;
	private _assessmentResultsTable!: azdata.DeclarativeTableComponent;
	private _impactedObjectsTable!: azdata.DeclarativeTableComponent;

	private _recommendation!: azdata.TextComponent;
	private _dbName!: azdata.TextComponent;
	private _recommendationText!: azdata.TextComponent;
	private _descriptionText!: azdata.TextComponent;
	private _issues!: Issues;
	private _impactedObjects!: SqlMigrationImpactedObjectInfo[];
	private _objectDetailsType!: azdata.TextComponent;
	private _objectDetailsName!: azdata.TextComponent;
	private _objectDetailsSample!: azdata.TextComponent;
	private _moreInfo!: azdata.TextComponent;

	constructor(
		private _model: MigrationStateModel,
		private _assessmentData: Map<string, Issues[]>,
		private _assessmentType: string) {
		super();
		if (this._assessmentType === 'vm') {
			this._assessmentData.clear();
		}
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
		component.addItem(await this.createDatabaseComponent(view), { flex: '1 1 auto' });
		return component;
	}

	private async createDatabaseComponent(view: azdata.ModelView): Promise<azdata.DivContainer> {
		let mapRowIssue = new Map<number, DbIssues>();
		const styleLeft: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left',
			'white-space': 'nowrap',
			'text-overflow': 'ellipsis',
			'overflow': 'hidden'
		};
		const styleRight: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'right',
			'white-space': 'nowrap',
			'text-overflow': 'ellipsis',
			'overflow': 'hidden'
		};

		this._databaseTable = view.modelBuilder.declarativeTable().withProps(
			{
				selectEffect: true,
				width: '350px',
				CSSStyles: {
					'table-layout': 'fixed'
				},
				columns: [
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.boolean,
						width: '10%',
						isReadOnly: false,
						showCheckAll: true,
						headerCssStyles: styleLeft,
						ariaLabel: 'Database Migration Check' // TODO localize
					},
					{
						displayName: 'Databases', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						width: '80%',
						isReadOnly: true,
						headerCssStyles: styleLeft
					},
					{
						displayName: 'Issues', // Incidents
						valueType: azdata.DeclarativeDataType.string,
						width: '10%',
						isReadOnly: true,
						headerCssStyles: styleRight,
						ariaLabel: 'Issue Count' // TODO localize

					}
				],
				dataValues: [
				]
			}
		).component();

		let dbList = (await azdata.connection.listDatabases(this._model.sourceConnectionId)).filter(db => !SqlDatabaseTree.EXCLUDED_DB.includes(db));

		if (dbList.length > 0) {
			let rowNumber = 0;
			this._assessmentData.forEach((value, key) => {
				this._databaseTable.dataValues?.push(
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
				dbList = dbList.filter(obj => obj !== key);

				rowNumber = rowNumber + 1;
			});

			dbList.forEach((value) => {
				this._databaseTable.dataValues?.push(
					[
						{
							value: true,
							style: styleLeft
						},
						{
							value: value,
							style: styleLeft
						},
						{
							value: 0,
							style: styleRight
						}
					]

				);
				let impactedObjects: SqlMigrationImpactedObjectInfo[] = [];
				let issue: Issues[] = [{
					description: 'No Issues',
					recommendation: 'No Issues',
					moreInfo: 'No Issues',
					impactedObjects: impactedObjects,
					rowNumber: rowNumber
				}];
				let noIssues = {
					name: value,
					issues: issue
				};
				mapRowIssue.set(rowNumber, noIssues);
				rowNumber = rowNumber + 1;
			});
		}

		this._databaseTable.onRowSelected(({ row }) => {
			const rowInfo = mapRowIssue.get(row);
			if (rowInfo) {
				this._assessmentResultsTable.dataValues = [];
				this._dbName.value = rowInfo.name;
				this._recommendation.value = `Assessment Results (${rowInfo.issues.length} issues found)`;
				// Need some kind of refresh method for declarative tables
				let dataValues: string[][] = [];
				rowInfo.issues.forEach(async (issue) => {
					dataValues.push([
						issue.description
					]);

				});

				this._assessmentResultsTable.updateProperties({
					data: dataValues
				});

			}

		});


		const tableContainer = view.modelBuilder.divContainer().withItems([this._databaseTable]).withProps({
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

		this._instanceTable = view.modelBuilder.declarativeTable().withProps(
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
			}).component();

		const instanceContainer = view.modelBuilder.divContainer().withItems([this._instanceTable]).withProps({
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

		const container = view.modelBuilder.flexContainer().withItems([title, impact, recommendation, assessmentResults]).withLayout({
			flexFlow: 'column'
		}).component();

		return container;
	}

	private createBottomContainer(view: azdata.ModelView): azdata.FlexContainer {

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

		this._impactedObjectsTable = view.modelBuilder.declarativeTable().withProps(
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
		).component();


		this._impactedObjectsTable.onRowSelected(({ row }) => {
			if (this._dbName.value) {
				this._impactedObjects = this._issues.impactedObjects;
			}
			this._objectDetailsType.value = `Type: ${this._impactedObjects[row].objectType!}`;
			this._objectDetailsName.value = `Name: ${this._impactedObjects[row].name}`;
			this._objectDetailsSample.value = this._impactedObjects[row].impactDetail;


		});




		const objectDetailsTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Object details',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();

		this._objectDetailsType = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Type:',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();

		this._objectDetailsName = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Name:',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();

		this._objectDetailsSample = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Sample',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();

		const container = view.modelBuilder.flexContainer().withItems([impactedObjectsTitle, this._impactedObjectsTable, objectDetailsTitle, this._objectDetailsType, this._objectDetailsName, this._objectDetailsSample]).withLayout({
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
		this._descriptionText = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
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
		const moreInfo = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'More Info',
			CSSStyles: {
				'font-size': '14px',
				'margin-block-start': '0px',
				'margin-block-end': '0px'
			}
		}).component();
		this._moreInfo = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: '',
			CSSStyles: {
				'font-size': '12px',
				'width': '250px'
			}
		}).component();


		const container = view.modelBuilder.flexContainer().withItems([descriptionTitle, this._descriptionText, recommendationTitle, this._recommendationText, moreInfo, this._moreInfo]).withLayout({
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
			value: 'Azure SQL Managed Instance',
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
			value: 'SQL Server 1',
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
			value: 'Assessment Results',
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
			'text-align': 'left',
			'white-space': 'nowrap',
			'text-overflow': 'ellipsis',
			'width': '200px',
			'overflow': 'hidden'
		};

		this._assessmentResultsTable = view.modelBuilder.declarativeTable().withProps(
			{
				selectEffect: true,
				width: '200px',
				CSSStyles: {
					'table-layout': 'fixed'
				},
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
		).component();

		this._assessmentResultsTable.onRowSelected(({ row }) => {
			this._descriptionText.value = this._assessmentResultsTable.data![row][0];

			if (this._dbName.value) {
				this._issues = this._assessmentData.get(this._dbName.value)![row];
				this._moreInfo.value = this._issues.moreInfo;
				this._impactedObjects = this._issues.impactedObjects;
				let data: { value: string; }[][] = [];
				this._impactedObjects.forEach(async (impactedObject) => {
					data.push([
						{
							value: impactedObject.objectType
						},
						{
							value: impactedObject.name
						}

					]);
				});

				this._impactedObjectsTable.updateProperties({
					dataValues: data
				});
			}
		});

		return this._assessmentResultsTable;
	}

	public selectedDbs(): string[] {
		let result: string[] = [];
		this._databaseTable.dataValues?.forEach((arr) => {
			if (arr[0].value === true) {
				result.push(arr[1].value.toString());
			}
		});
		return result;
	}

}
