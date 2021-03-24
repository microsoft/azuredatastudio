/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { SqlMigrationAssessmentResultItem, SqlMigrationImpactedObjectInfo } from '../../../../mssql/src/mssql';
import { MigrationStateModel, MigrationTargetType } from '../../models/stateMachine';

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

export class SqlDatabaseTree {

	private _instanceTable!: azdata.DeclarativeTableComponent;
	private _databaseTable!: azdata.DeclarativeTableComponent;
	private _assessmentResultsTable!: azdata.DeclarativeTableComponent;

	private _impactedObjectsTable!: azdata.DeclarativeTableComponent;

	private _recommendation!: azdata.TextComponent;
	private _dbName!: azdata.TextComponent;
	private _recommendationText!: azdata.TextComponent;
	private _descriptionText!: azdata.TextComponent;
	private _impactedObjects!: SqlMigrationImpactedObjectInfo[];
	private _objectDetailsType!: azdata.TextComponent;
	private _objectDetailsName!: azdata.TextComponent;
	private _objectDetailsSample!: azdata.TextComponent;
	private _moreInfo!: azdata.HyperlinkComponent;
	private _assessmentTitle!: azdata.TextComponent;

	private _activeIssues!: SqlMigrationAssessmentResultItem[];
	private _selectedIssue!: SqlMigrationAssessmentResultItem;
	private _selectedObject!: SqlMigrationImpactedObjectInfo;

	constructor(
		private _model: MigrationStateModel,
		private _targetType: MigrationTargetType
	) {
	}

	async createComponent(view: azdata.ModelView, dbs: string[]): Promise<azdata.Component> {
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
		component.addItem(this.createDatabaseComponent(view, dbs), { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'auto' } });
		return component;
	}

	private createDatabaseComponent(view: azdata.ModelView, dbs: string[]): azdata.DivContainer {
		this._databaseTable = view.modelBuilder.declarativeTable().withProps(
			{
				enableRowSelection: true,
				width: 200,
				CSSStyles: {
					'table-layout': 'fixed'
				},
				columns: [
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.boolean,
						width: 20,
						isReadOnly: false,
						showCheckAll: true,
						headerCssStyles: styleLeft,
						ariaLabel: 'Database Migration Check' // TODO localize
					},
					{
						displayName: 'Databases', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						width: 100,
						isReadOnly: true,
						headerCssStyles: styleLeft
					},
					{
						displayName: 'Issues', // Incidents
						valueType: azdata.DeclarativeDataType.string,
						width: 30,
						isReadOnly: true,
						headerCssStyles: styleRight,
					}
				]
			}
		).component();

		this._databaseTable.onRowSelected(({ row }) => {
			this._databaseTable.focus();
			this._activeIssues = this._model._assessmentResults?.databaseAssessments[row].issues;
			this._selectedIssue = this._model._assessmentResults?.databaseAssessments[row].issues[0];
			this._dbName.value = <string>this._databaseTable.dataValues![row][1].value;
			this.refreshResults();
		});

		const tableContainer = view.modelBuilder.divContainer().withItems([this._databaseTable]).withProps({
			CSSStyles: {
				'width': '200px',
				'margin-left': '15px',
				'margin-right': '5px',
				'margin-bottom': '10px'
			}
		}).component();
		return tableContainer;
	}

	private createSearchComponent(view: azdata.ModelView): azdata.DivContainer {
		let resourceSearchBox = view.modelBuilder.inputBox().withProperties({
			placeHolder: 'Search',
		}).component();

		const searchContainer = view.modelBuilder.divContainer().withItems([resourceSearchBox]).withProps({
			CSSStyles: {
				'width': '200px',
				'margin-left': '15px',
				'margin-right': '5px',
				'margin-bottom': '10px'
			}
		}).component();

		return searchContainer;
	}

	private createInstanceComponent(view: azdata.ModelView): azdata.DivContainer {
		this._instanceTable = view.modelBuilder.declarativeTable().withProps(
			{
				enableRowSelection: true,
				width: 200,
				columns: [
					{
						displayName: 'Instance',
						valueType: azdata.DeclarativeDataType.string,
						width: 150,
						isReadOnly: true,
						headerCssStyles: styleLeft,
						ariaLabel: 'Database Migration Check' // TODO localize
					},
					{
						displayName: 'Warnings', // TODO localize
						valueType: azdata.DeclarativeDataType.string,
						width: 50,
						isReadOnly: true,
						headerCssStyles: styleRight
					}
				],

			}).component();

		const instanceContainer = view.modelBuilder.divContainer().withItems([this._instanceTable]).withProps({
			CSSStyles: {
				'width': '200px',
				'margin-left': '15px',
				'margin-right': '5px',
				'margin-bottom': '10px'
			}
		}).component();

		this._instanceTable.onRowSelected((e) => {
			this._activeIssues = this._model._assessmentResults?.issues;
			this._selectedIssue = this._model._assessmentResults?.issues[0];
			this._dbName.value = <string>this._instanceTable.dataValues![0][0].value;
			this.refreshResults();
		});

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
				'margin-left': '10px',
				'margin-right': '15px',
				'overflow-y': 'hidden'
			}
		}).component();

		container.addItem(topContainer, { flex: '0 0 auto' });
		container.addItem(bottomContainer, { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'hidden' } });

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

		container.addItem(impactedObjects, { flex: '0 0 auto', CSSStyles: { 'border-right': 'solid 1px', 'overflow-y': 'auto' } });
		container.addItem(rightContainer, { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'auto' } });
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


		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row'
		}).withProps({
			CSSStyles: {
				'height': '100%'
			}
		}).component();
		container.addItem(description, { flex: '1 1 auto', CSSStyles: { 'width': '50%', 'margin-right': '10px' } });
		container.addItem(impactedObjects, { flex: '1 1 auto', CSSStyles: { 'width': '50%', 'margin-left': '10px' } });

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
				enableRowSelection: true,
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
			this._selectedObject = this._impactedObjects[row];
			this.refreshImpactedObject();
		});




		const objectDetailsTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Object details',
			CSSStyles: {
				'margin-top': '10px',
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
		this._moreInfo = view.modelBuilder.hyperlink().component();


		const container = view.modelBuilder.flexContainer().withItems([descriptionTitle, this._descriptionText, recommendationTitle, this._recommendationText, moreInfo, this._moreInfo]).withLayout({
			flexFlow: 'column'
		}).component();

		return container;
	}


	private createAssessmentTitle(view: azdata.ModelView): azdata.TextComponent {
		this._assessmentTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: '',
			CSSStyles: {
				'font-size': '15px',
				'line-size': '19px',
				'padding-bottom': '15px',
				'border-bottom': 'solid 1px'
			}
		}).component();

		return this._assessmentTitle;
	}

	private createTitleComponent(view: azdata.ModelView): azdata.TextComponent {
		const title = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Target Platform',
			CSSStyles: {
				'font-size': '13px',
				'line-size': '19px',
				'margin-block-start': '0px',
				'margin-block-end': '2px'
			}
		});

		return title.component();
	}

	private createPlatformComponent(view: azdata.ModelView): azdata.TextComponent {
		const impact = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			title: 'Platform', // TODO localize
			value: (this._targetType === MigrationTargetType.SQLVM) ? 'Azure SQL Virtual Machine' : 'Azure SQL Managed Instance',
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
			value: 'Warnings',
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
				enableRowSelection: true,
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
			this._selectedIssue = this._activeIssues[row];
			this.refreshAssessmentDetails();
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

	public refreshResults(): void {
		const assessmentResults: azdata.DeclarativeTableCellValue[][] = [];
		this._activeIssues.forEach((v) => {
			assessmentResults.push(
				[
					{
						value: v.checkId
					}
				]
			);
		});
		this._assessmentResultsTable.dataValues = assessmentResults;
		this._selectedIssue = this._activeIssues[0];
		this.refreshAssessmentDetails();
	}

	public refreshAssessmentDetails(): void {
		if (this._selectedIssue) {
			this._assessmentTitle.value = this._selectedIssue.checkId;
			this._descriptionText.value = this._selectedIssue.description;
			this._moreInfo.url = this._selectedIssue.helpLink;
			this._moreInfo.label = this._selectedIssue.helpLink;
			this._impactedObjects = this._selectedIssue.impactedObjects;
			this._recommendationText.value = this._selectedIssue.message; // Expose correct property for recommendation.
			this._impactedObjectsTable.dataValues = this._selectedIssue.impactedObjects.map((object) => {
				return [
					{
						value: object.objectType
					},
					{
						value: object.name
					}
				];
			});
			this._selectedObject = this._selectedIssue.impactedObjects[0];
		}
		else {
			this._assessmentTitle.value = '';
			this._descriptionText.value = '';
			this._moreInfo.url = '';
			this._moreInfo.label = '';
			this._recommendationText.value = '';
			this._impactedObjectsTable.dataValues = [];
		}
		this.refreshImpactedObject();
	}

	public refreshImpactedObject(): void {
		if (this._selectedObject) {
			this._objectDetailsType.value = `Type: ${this._selectedObject.objectType!}`;
			this._objectDetailsName.value = `Name: ${this._selectedObject.name}`;
			this._objectDetailsSample.value = this._selectedObject.impactDetail;
		} else {
			this._objectDetailsType.value = ``;
			this._objectDetailsName.value = ``;
			this._objectDetailsSample.value = '';
		}

	}

	public async initialize(): Promise<void> {
		let instanceTableValues: azdata.DeclarativeTableCellValue[][] = [];
		let databaseTableValues: azdata.DeclarativeTableCellValue[][] = [];
		const excludedDatabases = ['master', 'msdb', 'tempdb', 'model'];
		const dbList = (await azdata.connection.listDatabases(this._model.sourceConnectionId)).filter(db => !excludedDatabases.includes(db));
		const selectedDbs = (this._targetType === MigrationTargetType.SQLVM) ? this._model._vmDbs : this._model._miDbs;
		const serverName = (await this._model.getSourceConnectionProfile()).serverName;

		if (this._targetType === MigrationTargetType.SQLVM || !this._model._assessmentResults) {
			instanceTableValues = [
				[
					{
						value: serverName,
						style: styleLeft
					},
					{
						value: '0',
						style: styleRight
					}
				]
			];
			dbList.forEach((db) => {
				databaseTableValues.push(
					[
						{
							value: selectedDbs.includes(db),
							style: styleLeft
						},
						{
							value: db,
							style: styleLeft
						},
						{
							value: '0',
							style: styleRight
						}
					]
				);
			});
		} else {
			instanceTableValues = [
				[
					{
						value: serverName,
						style: styleLeft
					},
					{
						value: this._model._assessmentResults.issues.length,
						style: styleRight
					}
				]
			];
			this._model._assessmentResults.databaseAssessments.forEach((db) => {
				databaseTableValues.push(
					[
						{
							value: selectedDbs.includes(db.name),
							style: styleLeft
						},
						{
							value: db.name,
							style: styleLeft
						},
						{
							value: db.issues.length,
							style: styleRight
						}
					]
				);
			});
		}
		this._dbName.value = serverName;
		this._activeIssues = this._model._assessmentResults.issues;
		this._selectedIssue = this._model._assessmentResults?.issues[0];
		this.refreshResults();
		this._instanceTable.dataValues = instanceTableValues;
		this._databaseTable.dataValues = databaseTableValues;
	}
}
