/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { SqlMigrationAssessmentResultItem, SqlMigrationImpactedObjectInfo } from '../../../../mssql/src/mssql';
import { IconPath, IconPathHelper } from '../../constants/iconPathHelper';
import { MigrationStateModel, MigrationTargetType } from '../../models/stateMachine';
import * as constants from '../../constants/strings';

const styleLeft: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'left',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
};
const styleRight: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'right',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
};

const headerLeft: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'left',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
	'border-bottom': '1px solid'
};
const headerRight: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'right',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
	'border-bottom': '1px solid'
};

export class SqlDatabaseTree {
	private _view!: azdata.ModelView;
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

	private _serverName!: string;
	private _dbNames!: string[];

	constructor(
		private _model: MigrationStateModel,
		private _targetType: MigrationTargetType
	) {
	}

	async createComponent(view: azdata.ModelView, dbs: string[]): Promise<azdata.Component> {
		this._view = view;
		const component = view.modelBuilder.flexContainer().withLayout({
			height: '100%',
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				'border-right': 'solid 1px'
			},
		}).component();

		component.addItem(this.createSearchComponent(), { flex: '0 0 auto' });
		component.addItem(this.createInstanceComponent(), { flex: '0 0 auto' });
		component.addItem(this.createDatabaseComponent(dbs), { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'auto' } });
		return component;
	}

	private createDatabaseComponent(dbs: string[]): azdata.DivContainer {

		this._databaseTable = this._view.modelBuilder.declarativeTable().withProps(
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
						headerCssStyles: headerLeft,
					},
					{
						displayName: constants.DATABASES,
						valueType: azdata.DeclarativeDataType.component,
						width: 100,
						isReadOnly: true,
						headerCssStyles: headerLeft
					},
					{
						displayName: constants.ISSUES,
						valueType: azdata.DeclarativeDataType.string,
						width: 30,
						isReadOnly: true,
						headerCssStyles: headerRight,
					}
				]
			}
		).component();

		this._databaseTable.onRowSelected(({ row }) => {
			this._databaseTable.focus();
			this._activeIssues = this._model._assessmentResults?.databaseAssessments[row].issues;
			this._selectedIssue = this._model._assessmentResults?.databaseAssessments[row].issues[0];
			this._dbName.value = this._dbNames[row];
			this.refreshResults();
		});

		const tableContainer = this._view.modelBuilder.divContainer().withItems([this._databaseTable]).withProps({
			CSSStyles: {
				'width': '200px',
				'margin': '0px 8px 0px 34px'
			}
		}).component();
		return tableContainer;
	}

	private createSearchComponent(): azdata.DivContainer {
		let resourceSearchBox = this._view.modelBuilder.inputBox().withProps({
			placeHolder: constants.SEARCH,
			width: 200
		}).component();

		const searchContainer = this._view.modelBuilder.divContainer().withItems([resourceSearchBox]).withProps({
			CSSStyles: {
				'width': '200px',
				'margin': '32px 8px 0px 34px'
			}
		}).component();

		return searchContainer;
	}

	private createInstanceComponent(): azdata.DivContainer {
		this._instanceTable = this._view.modelBuilder.declarativeTable().withProps(
			{
				enableRowSelection: true,
				width: 200,
				columns: [
					{
						displayName: constants.INSTANCE,
						valueType: azdata.DeclarativeDataType.component,
						width: 150,
						isReadOnly: true,
						headerCssStyles: headerLeft
					},
					{
						displayName: constants.WARNINGS,
						valueType: azdata.DeclarativeDataType.string,
						width: 50,
						isReadOnly: true,
						headerCssStyles: headerRight
					}
				],
			}).component();

		const instanceContainer = this._view.modelBuilder.divContainer().withItems([this._instanceTable]).withProps({
			CSSStyles: {
				'width': '200px',
				'margin': '19px 8px 0px 34px'
			}
		}).component();

		this._instanceTable.onRowSelected((e) => {
			this._activeIssues = this._model._assessmentResults?.issues;
			this._selectedIssue = this._model._assessmentResults?.issues[0];
			this._dbName.value = this._serverName;
			this.refreshResults();
		});

		return instanceContainer;
	}

	async createComponentResult(view: azdata.ModelView): Promise<azdata.Component> {
		this._view = view;
		const topContainer = this.createTopContainer();
		const bottomContainer = this.createBottomContainer();

		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '100%'
		}).withProps({
			CSSStyles: {
				'margin': '32px 0px 0px 18px',
				'overflow-y': 'hidden'
			}
		}).component();

		container.addItem(topContainer, { flex: '0 0 auto' });
		container.addItem(bottomContainer, { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'hidden' } });

		return container;
	}


	private createTopContainer(): azdata.FlexContainer {
		const title = this.createTitleComponent();
		const impact = this.createPlatformComponent();
		const recommendation = this.createRecommendationComponent();
		const assessmentResultsTitle = this.createAssessmentResultsTitle();
		const assessmentDetailsTitle = this.createAssessmentDetailsTitle();

		const titleContainer = this._view.modelBuilder.flexContainer().withItems([
		]).withProps({
			CSSStyles: {
				'border-bottom': 'solid 1px',
				'width': '800px'
			}
		}).component();

		titleContainer.addItem(assessmentResultsTitle, {
			flex: '0 0 auto'
		});

		titleContainer.addItem(assessmentDetailsTitle, {
			flex: '0 0 auto'
		});

		const container = this._view.modelBuilder.flexContainer().withItems([title, impact, recommendation, titleContainer]).withLayout({
			flexFlow: 'column'
		}).component();

		return container;
	}

	private createBottomContainer(): azdata.FlexContainer {

		const impactedObjects = this.createImpactedObjectsTable();
		const rightContainer = this.createAssessmentContainer();

		const container = this._view.modelBuilder.flexContainer().withLayout({
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

	private createAssessmentContainer(): azdata.FlexContainer {
		const title = this.createAssessmentTitle();

		const bottomContainer = this.createDescriptionContainer();


		const container = this._view.modelBuilder.flexContainer().withItems([title, bottomContainer]).withLayout({
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				'margin-left': '24px'
			}
		}).component();

		return container;
	}

	private createDescriptionContainer(): azdata.FlexContainer {
		const description = this.createDescription();
		const impactedObjects = this.createImpactedObjectsDescription();


		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row'
		}).withProps({
			CSSStyles: {
				'height': '100%'
			}
		}).component();
		container.addItem(description, { flex: '0 0 auto', CSSStyles: { 'width': '200px', 'margin-right': '35px' } });
		container.addItem(impactedObjects, { flex: '0 0 auto', CSSStyles: { 'width': '280px' } });

		return container;
	}

	private createImpactedObjectsDescription(): azdata.FlexContainer {
		const impactedObjectsTitle = this._view.modelBuilder.text().withProps({
			value: constants.IMPACTED_OBJECTS,
			CSSStyles: {
				'font-size': '14px',
				'width': '280px',
				'margin': '10px 0px 0px 0px'
			}
		}).component();

		const rowStyle: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left',
			'border-bottom': '1px solid'
		};

		this._impactedObjectsTable = this._view.modelBuilder.declarativeTable().withProps(
			{
				enableRowSelection: true,
				width: '100%',
				columns: [
					{
						displayName: constants.TYPE,
						valueType: azdata.DeclarativeDataType.string,
						width: '120px',
						isReadOnly: true,
						headerCssStyles: headerLeft,
						rowCssStyles: rowStyle
					},
					{
						displayName: constants.NAME,
						valueType: azdata.DeclarativeDataType.string,
						width: '130px',
						isReadOnly: true,
						headerCssStyles: headerLeft,
						rowCssStyles: rowStyle
					},
				],
				dataValues: [
					[
						{
							value: ''
						},
						{
							value: ''
						}
					]
				],
				CSSStyles: {
					'margin-top': '12px'
				}
			}
		).component();

		this._impactedObjectsTable.onRowSelected(({ row }) => {
			this._selectedObject = this._impactedObjects[row];
			this.refreshImpactedObject();
		});

		const objectDetailsTitle = this._view.modelBuilder.text().withProps({
			value: constants.OBJECT_DETAILS,
			CSSStyles: {
				'font-size': '13px',
				'line-size': '18px',
				'margin': '12px 0px 0px 0px'
			}
		}).component();

		this._objectDetailsType = this._view.modelBuilder.text().withProps({
			value: constants.TYPES_LABEL,
			CSSStyles: {
				'font-size': '13px',
				'line-size': '18px',
				'margin': '5px 0px 0px 0px'
			}
		}).component();

		this._objectDetailsName = this._view.modelBuilder.text().withProps({
			value: constants.NAMES_LABEL,
			CSSStyles: {
				'font-size': '13px',
				'line-size': '18px',
				'margin': '5px 0px 0px 0px'
			}
		}).component();

		this._objectDetailsSample = this._view.modelBuilder.text().withProps({
			value: '',
			CSSStyles: {
				'font-size': '13px',
				'line-size': '18px',
				'margin': '5px 0px 0px 0px'
			}
		}).component();

		const container = this._view.modelBuilder.flexContainer().withItems([impactedObjectsTitle, this._impactedObjectsTable, objectDetailsTitle, this._objectDetailsType, this._objectDetailsName, this._objectDetailsSample]).withLayout({
			flexFlow: 'column'
		}).component();

		return container;
	}

	private createDescription(): azdata.FlexContainer {
		const descriptionTitle = this._view.modelBuilder.text().withProps({
			value: constants.DESCRIPTION,
			CSSStyles: {
				'font-size': '14px',
				'width': '200px',
				'margin': '10px 35px 0px 0px'
			}
		}).component();
		this._descriptionText = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				'font-size': '12px',
				'width': '200px',
				'margin': '3px 35px 0px 0px'
			}
		}).component();

		const recommendationTitle = this._view.modelBuilder.text().withProps({
			value: constants.RECOMMENDATION,
			CSSStyles: {
				'font-size': '14px',
				'width': '200px',
				'margin': '12px 35px 0px 0px'
			}
		}).component();
		this._recommendationText = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				'font-size': '12px',
				'width': '200px',
				'margin': '3px 35px 0px 0px'
			}
		}).component();
		const moreInfo = this._view.modelBuilder.text().withProps({
			value: constants.MORE_INFO,
			CSSStyles: {
				'font-size': '14px',
				'width': '200px',
				'margin': '15px 35px 0px 0px'
			}
		}).component();
		this._moreInfo = this._view.modelBuilder.hyperlink().withProps({
			label: '',
			url: '',
			CSSStyles: {
				'font-size': '12px',
				'width': '200px',
				'margin': '3px 35px 0px 0px'
			},
			showLinkIcon: true
		}).component();


		const container = this._view.modelBuilder.flexContainer().withItems([descriptionTitle, this._descriptionText, recommendationTitle, this._recommendationText, moreInfo, this._moreInfo]).withLayout({
			flexFlow: 'column'
		}).component();

		return container;
	}


	private createAssessmentTitle(): azdata.TextComponent {
		this._assessmentTitle = this._view.modelBuilder.text().withProps({
			value: '',
			CSSStyles: {
				'font-size': '13px',
				'line-size': '18px',
				'height': '48px',
				'width': '540px',
				'font-weight': '600',
				'border-bottom': 'solid 1px'
			}
		}).component();

		return this._assessmentTitle;
	}

	private createTitleComponent(): azdata.TextComponent {
		const title = this._view.modelBuilder.text().withProps({
			value: constants.TARGET_PLATFORM,
			CSSStyles: {
				'font-size': '13px',
				'line-size': '19px',
				'margin': '0px 0px 0px 0px'
			}
		});

		return title.component();
	}

	private createPlatformComponent(): azdata.TextComponent {
		const impact = this._view.modelBuilder.text().withProps({
			value: (this._targetType === MigrationTargetType.SQLVM) ? constants.SUMMARY_VM_TYPE : constants.SUMMARY_MI_TYPE,
			CSSStyles: {
				'font-size': '18px',
				'margin': '0px 0px 0px 0px'
			}
		});

		return impact.component();
	}

	private createRecommendationComponent(): azdata.TextComponent {
		this._dbName = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold',
				'margin': '10px 0px 0px 0px'
			}
		}).component();

		return this._dbName;
	}

	private createAssessmentResultsTitle(): azdata.TextComponent {
		this._recommendation = this._view.modelBuilder.text().withProps({
			value: constants.WARNINGS,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'width': '200px',
				'font-weight': '600',
				'margin': '8px 35px 5px 0px'
			}
		}).component();

		return this._recommendation;
	}

	private createAssessmentDetailsTitle(): azdata.TextComponent {
		this._recommendation = this._view.modelBuilder.text().withProps({
			value: constants.WARNINGS_DETAILS,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'width': '200px',
				'font-weight': '600',
				'margin': '8px 0px 5px 0px'
			}
		}).component();

		return this._recommendation;
	}


	private createImpactedObjectsTable(): azdata.DeclarativeTableComponent {

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
			'overflow': 'hidden',
			'border-bottom': '1px solid'
		};

		this._assessmentResultsTable = this._view.modelBuilder.declarativeTable().withProps(
			{
				enableRowSelection: true,
				width: '200px',
				CSSStyles: {
					'table-layout': 'fixed'
				},
				columns: [
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.string,
						width: '100%',
						isReadOnly: true,
						headerCssStyles: headerStyle,
						rowCssStyles: rowStyle
					}
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
			this._recommendationText.value = this._selectedIssue.message; //TODO: Expose correct property for recommendation.
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
			this._objectDetailsType.value = constants.IMPACT_OBJECT_TYPE(this._selectedObject.objectType!);
			this._objectDetailsName.value = constants.IMPACT_OBJECT_NAME(this._selectedObject.name);
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
		this._dbNames = (await azdata.connection.listDatabases(this._model.sourceConnectionId)).filter(db => !excludedDatabases.includes(db));
		const selectedDbs = (this._targetType === MigrationTargetType.SQLVM) ? this._model._vmDbs : this._model._miDbs;
		this._serverName = (await this._model.getSourceConnectionProfile()).serverName;

		if (this._targetType === MigrationTargetType.SQLVM || !this._model._assessmentResults) {
			instanceTableValues = [
				[
					{
						value: this.createIconTextCell(IconPathHelper.sqlServerLogo, this._serverName),
						style: styleLeft
					},
					{
						value: '0',
						style: styleRight
					}
				]
			];
			this._dbNames.forEach((db) => {
				databaseTableValues.push(
					[
						{
							value: selectedDbs.includes(db),
							style: styleLeft
						},
						{
							value: this.createIconTextCell(IconPathHelper.sqlDatabaseLogo, db),
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
						value: this.createIconTextCell(IconPathHelper.sqlServerLogo, this._serverName),
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
							value: this.createIconTextCell((db.issues.length === 0) ? IconPathHelper.sqlDatabaseLogo : IconPathHelper.sqlDatabaseWarningLogo, db.name),
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
		this._dbName.value = this._serverName;
		this._instanceTable.dataValues = instanceTableValues;
		this._databaseTable.dataValues = databaseTableValues;
		if (this._targetType === MigrationTargetType.SQLMI) {
			this._activeIssues = this._model._assessmentResults.issues;
			this._selectedIssue = this._model._assessmentResults?.issues[0];
			this.refreshResults();
		}
	}

	private createIconTextCell(icon: IconPath, text: string): azdata.FlexContainer {

		const iconComponent = this._view.modelBuilder.image().withProps({
			iconPath: icon,
			iconWidth: '16px',
			iconHeight: '16px',
			width: '20px',
			height: '20px'
		}).component();
		const textComponent = this._view.modelBuilder.text().withProps({
			value: text,
			CSSStyles: {
				'margin': '0px'
			}
		}).component();

		const cellContainer = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'justify-content': 'left'
			}
		}).component();
		cellContainer.addItem(iconComponent, {
			flex: '0',
			CSSStyles: {
				'width': '32px'
			}
		});
		cellContainer.addItem(textComponent, {
			CSSStyles: {
				'width': 'auto'
			}
		});

		return cellContainer;
	}
}
