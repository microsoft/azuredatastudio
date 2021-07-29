/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { SqlMigrationAssessmentResultItem, SqlMigrationImpactedObjectInfo } from '../../../../mssql/src/mssql';
import { MigrationStateModel, MigrationTargetType } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import { debounce } from '../../api/utils';
import { IconPath, IconPathHelper } from '../../constants/iconPathHelper';

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

const blockingIssues: Array<string> = [
	'MultipleLogFiles',
	'FileStream',
	'MIDatabaseSize'
];

export class SqlDatabaseTree {
	private _view!: azdata.ModelView;
	private _instanceTable!: azdata.DeclarativeTableComponent;
	private _databaseTable!: azdata.DeclarativeTableComponent;
	private _assessmentResultsTable!: azdata.DeclarativeTableComponent;
	private _impactedObjectsTable!: azdata.DeclarativeTableComponent;
	private _assessmentContainer!: azdata.FlexContainer;
	private _assessmentsTable!: azdata.FlexContainer;
	private _dbMessageContainer!: azdata.FlexContainer;
	private _rootContainer!: azdata.FlexContainer;
	private _resultComponent!: azdata.Component;
	private _noIssuesContainer!: azdata.FlexContainer;

	private _recommendation!: azdata.TextComponent;
	private _dbName!: azdata.TextComponent;
	private _recommendationText!: azdata.TextComponent;
	private _recommendationTitle!: azdata.TextComponent;
	private _descriptionText!: azdata.TextComponent;
	private _impactedObjects!: SqlMigrationImpactedObjectInfo[];
	private _objectDetailsType!: azdata.TextComponent;
	private _objectDetailsName!: azdata.TextComponent;
	private _objectDetailsSample!: azdata.TextComponent;
	private _moreInfo!: azdata.HyperlinkComponent;
	private _assessmentTitle!: azdata.TextComponent;
	private _databaseTableValues!: azdata.DeclarativeTableCellValue[][];

	private _activeIssues!: SqlMigrationAssessmentResultItem[];

	private _serverName!: string;
	private _dbNames!: string[];
	private _databaseCount!: azdata.TextComponent;
	private _disposables: vscode.Disposable[] = [];

	constructor(
		private _model: MigrationStateModel,
		private _targetType: MigrationTargetType
	) {
	}

	async createRootContainer(dialog: azdata.window.Dialog, view: azdata.ModelView): Promise<azdata.Component> {
		this._view = view;

		const selectDbMessage = this.createSelectDbMessage();
		this._resultComponent = await this.createComponentResult(view);
		const treeComponent = await this.createComponent(view, this._targetType === MigrationTargetType.SQLVM ? this._model._vmDbs : this._model._miDbs);
		this._rootContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			height: '100%',
			width: '100%'
		}).component();
		this._rootContainer.addItem(treeComponent, { flex: '0 0 auto' });
		this._rootContainer.addItem(this._resultComponent, { flex: '0 0 auto' });
		this._rootContainer.addItem(selectDbMessage, { flex: '1 1 auto' });

		if (this._targetType === MigrationTargetType.SQLMI) {
			if (!!this._model._assessmentResults?.issues.find(value => blockingIssues.includes(value.ruleId)) ||
				!!this._model._assessmentResults?.databaseAssessments.find(d => !!d.issues.find(issue => blockingIssues.includes(issue.ruleId)))) {
				dialog.message = {
					level: azdata.window.MessageLevel.Warning,
					text: constants.ASSESSMENT_MIGRATION_WARNING,
				};
			}
		}

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));

		return this._rootContainer;
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
		component.addItem(this.createDatabaseCount(), { flex: '0 0 auto' });
		component.addItem(this.createDatabaseComponent(dbs), { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'auto' } });
		return component;
	}

	private createDatabaseCount(): azdata.TextComponent {
		this._databaseCount = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				'font-size': '11px',
				'font-weight': 'bold',
				'margin': '0px 15px 0px 15px'
			},
			value: constants.DATABASES(0, this._model._databaseAssessment.length)
		}).component();
		return this._databaseCount;
	}

	private createDatabaseComponent(dbs: string[]): azdata.DivContainer {

		this._databaseTable = this._view.modelBuilder.declarativeTable().withProps(
			{
				enableRowSelection: true,
				width: 230,
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
						displayName: constants.DATABASE,
						// undo when bug #16445 is fixed
						// valueType: azdata.DeclarativeDataType.component,
						valueType: azdata.DeclarativeDataType.string,
						width: 160,
						isReadOnly: true,
						headerCssStyles: headerLeft
					},
					{
						displayName: constants.ISSUES,
						valueType: azdata.DeclarativeDataType.string,
						width: 50,
						isReadOnly: true,
						headerCssStyles: headerRight,
					}
				]
			}
		).component();

		this._disposables.push(this._databaseTable.onDataChanged(() => {
			this._databaseCount.updateProperties({
				'value': constants.DATABASES(this.selectedDbs().length, this._model._databaseAssessment.length)
			});
		}));

		this._disposables.push(this._databaseTable.onRowSelected(async (e) => {
			if (this._targetType === MigrationTargetType.SQLMI) {
				this._activeIssues = this._model._assessmentResults?.databaseAssessments[e.row].issues;
			} else {
				this._activeIssues = [];
			}
			this._dbName.value = this._dbNames[e.row];
			this._recommendationTitle.value = constants.ISSUES_COUNT(this._activeIssues.length);
			this._recommendation.value = constants.ISSUES_DETAILS;
			this._resultComponent.updateCssStyles({
				'display': 'block'
			});
			this._dbMessageContainer.updateCssStyles({
				'display': 'none'
			});
			await this.refreshResults();
		}));

		const tableContainer = this._view.modelBuilder.divContainer().withItems([this._databaseTable]).withProps({
			width: '100%',
			CSSStyles: {
				'margin': '0px 15px 0px 15px'
			}
		}).component();
		return tableContainer;
	}

	private createSearchComponent(): azdata.DivContainer {
		let resourceSearchBox = this._view.modelBuilder.inputBox().withProps({
			stopEnterPropagation: true,
			placeHolder: constants.SEARCH,
			width: 260
		}).component();

		this._disposables.push(resourceSearchBox.onTextChanged(value => this._filterTableList(value)));

		const searchContainer = this._view.modelBuilder.divContainer().withItems([resourceSearchBox]).withProps({
			CSSStyles: {
				'margin': '32px 15px 0px 15px'
			}
		}).component();

		return searchContainer;
	}

	@debounce(500)
	private _filterTableList(value: string): void {
		if (this._databaseTableValues && value?.length > 0) {
			const filter: number[] = [];
			this._databaseTableValues.forEach((row, index) => {
				// undo when bug #16445 is fixed
				// const flexContainer: azdata.FlexContainer = row[1]?.value as azdata.FlexContainer;
				// const textComponent: azdata.TextComponent = flexContainer?.items[1] as azdata.TextComponent;
				// const cellText = textComponent?.value?.toLowerCase();
				const text = row[1]?.value as string;
				const cellText = text?.toLowerCase();
				const searchText: string = value?.toLowerCase();
				if (cellText?.includes(searchText)) {
					filter.push(index);
				}
			});

			this._databaseTable.setFilter(filter);
		} else {
			this._databaseTable.setFilter(undefined);
		}
	}

	private createInstanceComponent(): azdata.DivContainer {
		this._instanceTable = this._view.modelBuilder.declarativeTable().withProps(
			{
				enableRowSelection: true,
				width: 240,
				CSSStyles: {
					'table-layout': 'fixed'
				},
				columns: [
					{
						displayName: constants.INSTANCE,
						// undo when bug #16445 is fixed
						// valueType: azdata.DeclarativeDataType.component,
						valueType: azdata.DeclarativeDataType.string,
						width: 190,
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
				'margin': '19px 15px 0px 15px'
			}
		}).component();


		this._disposables.push(this._instanceTable.onRowSelected(async (e) => {
			this._activeIssues = this._model._assessmentResults?.issues;
			this._dbName.value = this._serverName;
			this._resultComponent.updateCssStyles({
				'display': 'block'
			});
			this._dbMessageContainer.updateCssStyles({
				'display': 'none'
			});
			this._recommendation.value = constants.WARNINGS_DETAILS;
			this._recommendationTitle.value = constants.WARNINGS_COUNT(this._activeIssues.length);
			if (this._targetType === MigrationTargetType.SQLMI) {
				await this.refreshResults();
			}
		}));

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
				'overflow-y': 'hidden',
				'display': 'none'
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

		this._assessmentsTable = this.createImpactedObjectsTable();
		this._assessmentContainer = this.createAssessmentContainer();
		const noIssuesText = this.createNoIssuesText();

		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			height: '100%'
		}).withProps({
			CSSStyles: {
				'height': '100%'
			}
		}).component();

		container.addItem(noIssuesText, { flex: '0 0 auto', CSSStyles: { 'overflow-y': 'auto' } });
		container.addItem(this._assessmentsTable, { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'auto' } });
		container.addItem(this._assessmentContainer, { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'auto' } });
		return container;
	}

	private createNoIssuesText(): azdata.FlexContainer {
		let message: azdata.TextComponent;
		if (this._targetType === MigrationTargetType.SQLVM) {
			message = this._view.modelBuilder.text().withProps({
				value: constants.NO_ISSUES_FOUND_VM,
				CSSStyles: {
					'font-size': '14px',
					'width': '100%',
					'margin': '0',
					'text-align': 'left'
				}
			}).component();
		} else {
			message = this._view.modelBuilder.text().withProps({
				value: constants.NO_ISSUES_FOUND_MI,
				CSSStyles: {
					'font-size': '14px',
					'width': '100%',
					'margin': '0',
					'text-align': 'left'
				}
			}).component();
		}
		//TODO: will need to add a SQL DB condition here in the future

		this._noIssuesContainer = this._view.modelBuilder.flexContainer().withItems([message]).withProps({
			CSSStyles: {
				'margin-left': '24px',
				'margin-top': '20px',
				'display': 'none'
			}
		}).component();

		return this._noIssuesContainer;
	}

	private createSelectDbMessage(): azdata.FlexContainer {
		const message = this._view.modelBuilder.text().withProps({
			value: constants.SELECT_DB_PROMPT,
			CSSStyles: {
				'font-size': '14px',
				'width': '400px',
				'margin': '10px 0px 0px 0px',
				'text-align': 'left'
			}
		}).component();
		this._dbMessageContainer = this._view.modelBuilder.flexContainer().withItems([message]).withProps({
			CSSStyles: {
				'margin-top': '20px',
				'margin-left': '15px',
			}
		}).component();

		return this._dbMessageContainer;
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
				'font-size': '13px',
				'width': '280px',
				'margin': '10px 0px 0px 0px',
				'font-weight': 'bold'
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

		this._disposables.push(this._impactedObjectsTable.onRowSelected((e) => {
			const impactedObject = e.row > -1 ? this._impactedObjects[e.row] : undefined;
			this.refreshImpactedObject(impactedObject);
		}));

		const objectDetailsTitle = this._view.modelBuilder.text().withProps({
			value: constants.OBJECT_DETAILS,
			CSSStyles: {
				'font-size': '13px',
				'line-size': '18px',
				'margin': '12px 0px 0px 0px',
				'font-weight': 'bold'
			}
		}).component();
		const objectDescriptionStyle = {
			'font-size': '12px',
			'line-size': '18px',
			'margin': '5px 0px 0px 0px',
			'text-align': 'justify',
			'word-wrap': 'break-word'
		};
		this._objectDetailsType = this._view.modelBuilder.text().withProps({
			value: constants.TYPES_LABEL,
			CSSStyles: objectDescriptionStyle
		}).component();

		this._objectDetailsName = this._view.modelBuilder.text().withProps({
			value: constants.NAMES_LABEL,
			CSSStyles: objectDescriptionStyle
		}).component();

		this._objectDetailsSample = this._view.modelBuilder.text().withProps({
			value: '',
			CSSStyles: objectDescriptionStyle
		}).component();

		const container = this._view.modelBuilder.flexContainer().withItems([impactedObjectsTitle, this._impactedObjectsTable, objectDetailsTitle, this._objectDetailsType, this._objectDetailsName, this._objectDetailsSample]).withLayout({
			flexFlow: 'column'
		}).component();

		return container;
	}

	private createDescription(): azdata.FlexContainer {
		const labelStyle = {
			'font-size': '13px',
			'width': '200px',
			'font-weight': 'bold',
			'margin': '10px 35px 0px 0px'
		};
		const textStyle = {
			'font-size': '12px',
			'width': '200px',
			'margin': '3px 35px 0px 0px',
			'text-align': 'justify',
			'word-wrap': 'break-word'
		};
		const descriptionTitle = this._view.modelBuilder.text().withProps({
			value: constants.DESCRIPTION,
			CSSStyles: labelStyle
		}).component();
		this._descriptionText = this._view.modelBuilder.text().withProps({
			CSSStyles: textStyle
		}).component();

		const recommendationTitle = this._view.modelBuilder.text().withProps({
			value: constants.RECOMMENDATION,
			CSSStyles: labelStyle
		}).component();
		this._recommendationText = this._view.modelBuilder.text().withProps({
			CSSStyles: textStyle
		}).component();
		const moreInfo = this._view.modelBuilder.text().withProps({
			value: constants.MORE_INFO,
			CSSStyles: labelStyle
		}).component();
		this._moreInfo = this._view.modelBuilder.hyperlink().withProps({
			label: '',
			url: '',
			CSSStyles: textStyle,
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
		this._recommendationTitle = this._view.modelBuilder.text().withProps({
			value: constants.WARNINGS,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'width': '200px',
				'font-weight': '600',
				'margin': '8px 35px 5px 0px'
			}
		}).component();

		return this._recommendationTitle;
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

	private createImpactedObjectsTable(): azdata.FlexContainer {

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
						valueType: azdata.DeclarativeDataType.component,
						width: '16px',
						isReadOnly: true,
						headerCssStyles: headerStyle,
						rowCssStyles: rowStyle
					},
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.string,
						width: '184px',
						isReadOnly: true,
						headerCssStyles: headerStyle,
						rowCssStyles: rowStyle
					}
				]
			}
		).component();

		this._disposables.push(this._assessmentResultsTable.onRowSelected(async (e) => {
			const selectedIssue = e.row > -1 ? this._activeIssues[e.row] : undefined;
			await this.refreshAssessmentDetails(selectedIssue);
		}));

		const container = this._view.modelBuilder.flexContainer().withItems([this._assessmentResultsTable]).withLayout({
			flexFlow: 'column',
			height: '100%'
		}).withProps({
			CSSStyles: {
				'border-right': 'solid 1px'
			}
		}).component();

		return container;
	}

	public selectedDbs(): string[] {
		let result: string[] = [];
		this._databaseTable.dataValues?.forEach((arr, index) => {
			if (arr[0].value === true) {
				result.push(this._dbNames[index]);
			}
		});
		return result;
	}

	public async refreshResults(): Promise<void> {
		if (this._targetType === MigrationTargetType.SQLMI) {
			if (this._activeIssues.length === 0) {
				/// show no issues here
				this._assessmentsTable.updateCssStyles({
					'display': 'none',
					'border-right': 'none'
				});
				this._assessmentContainer.updateCssStyles({
					'display': 'none'
				});
				this._noIssuesContainer.updateCssStyles({
					'display': 'flex'
				});
			} else {
				this._assessmentContainer.updateCssStyles({
					'display': 'flex'
				});
				this._assessmentsTable.updateCssStyles({
					'display': 'flex',
					'border-right': 'solid 1px'
				});
				this._noIssuesContainer.updateCssStyles({
					'display': 'none'
				});
			}
		} else {
			this._assessmentsTable.updateCssStyles({
				'display': 'none',
				'border-right': 'none'
			});
			this._assessmentContainer.updateCssStyles({
				'display': 'none'
			});
			this._noIssuesContainer.updateCssStyles({
				'display': 'flex'
			});
			this._recommendationTitle.value = constants.ASSESSMENT_RESULTS;
			this._recommendation.value = '';
		}

		const assessmentResults: azdata.DeclarativeTableCellValue[][] = this._activeIssues
			.sort((e1, e2) => {
				if (blockingIssues.includes(e1.ruleId)) { return -1; }
				if (blockingIssues.includes(e2.ruleId)) { return 1; }

				return e1.checkId.localeCompare(e2.checkId);
			}).map((v) => [
				{
					value: this._view.modelBuilder
						.image()
						.withProps({
							iconPath: blockingIssues.includes(v.ruleId)
								? IconPathHelper.error
								: undefined,
							iconHeight: 16,
							iconWidth: 16,
							height: 16,
							width: 16,
							title: blockingIssues.includes(v.ruleId)
								? constants.ASSESSMENT_BLOCKING_ISSUE_TITLE
								: '',
						})
						.component()
				},
				{ value: v.checkId }])
			|| [];

		await this._assessmentResultsTable.setDataValues(assessmentResults);
		this._assessmentResultsTable.selectedRow = assessmentResults.length > 0 ? 0 : -1;
	}

	public async refreshAssessmentDetails(selectedIssue?: SqlMigrationAssessmentResultItem): Promise<void> {
		this._assessmentTitle.value = selectedIssue?.checkId || '';
		this._descriptionText.value = selectedIssue?.description || '';
		this._moreInfo.url = selectedIssue?.helpLink || '';
		this._moreInfo.label = selectedIssue?.message || '';
		this._impactedObjects = selectedIssue?.impactedObjects || [];
		this._recommendationText.value = selectedIssue?.message || ''; //TODO: Expose correct property for recommendation.

		await this._impactedObjectsTable.setDataValues(this._impactedObjects.map(
			(object) => [{ value: object.objectType }, { value: object.name }]));

		this._impactedObjectsTable.selectedRow = this._impactedObjects.length > 0 ? 0 : -1;
	}

	public refreshImpactedObject(impactedObject?: SqlMigrationImpactedObjectInfo): void {
		this._objectDetailsType.value = constants.IMPACT_OBJECT_TYPE(impactedObject?.objectType);
		this._objectDetailsName.value = constants.IMPACT_OBJECT_NAME(impactedObject?.name);
		this._objectDetailsSample.value = impactedObject?.impactDetail || '';
	}

	public async initialize(): Promise<void> {
		let instanceTableValues: azdata.DeclarativeTableCellValue[][] = [];
		this._databaseTableValues = [];
		this._dbNames = this._model._databaseAssessment;
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
				this._databaseTableValues.push(
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
			this._model._assessmentResults.databaseAssessments.sort((db1, db2) => {
				return db2.issues.length - db1.issues.length;
			});
			// Reset the dbName list so that it is in sync with the table
			this._dbNames = this._model._assessmentResults.databaseAssessments.map(da => da.name);
			this._model._assessmentResults.databaseAssessments.forEach((db) => {
				let selectable = true;
				if (db.issues.find(item => blockingIssues.includes(item.ruleId))) {
					selectable = false;
				}
				this._databaseTableValues.push(
					[
						{
							value: selectedDbs.includes(db.name),
							style: styleLeft,
							enabled: selectable
						},
						{
							value: this.createIconTextCell((selectable) ? IconPathHelper.sqlDatabaseLogo : IconPathHelper.sqlDatabaseWarningLogo, db.name),
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
		await this._instanceTable.setDataValues(instanceTableValues);
		await this._databaseTable.setDataValues(this._databaseTableValues);
	}

	// undo when bug #16445 is fixed
	private createIconTextCell(icon: IconPath, text: string): string {
		return text;
	}
	// private createIconTextCell(icon: IconPath, text: string): azdata.FlexContainer {
	// 	const cellContainer = this._view.modelBuilder.flexContainer().withProps({
	// 		CSSStyles: {
	// 			'justify-content': 'left'
	// 		}
	// 	}).component();

	// 	const iconComponent = this._view.modelBuilder.image().withProps({
	// 		iconPath: icon,
	// 		iconWidth: '16px',
	// 		iconHeight: '16px',
	// 		width: '20px',
	// 		height: '20px'
	// 	}).component();
	// 	cellContainer.addItem(iconComponent, {
	// 		flex: '0',
	// 		CSSStyles: {
	// 			'width': '32px'
	// 		}
	// 	});

	// 	const textComponent = this._view.modelBuilder.text().withProps({
	// 		value: text,
	// 		title: text,
	// 		CSSStyles: {
	// 			'margin': '0px',
	// 			'width': '100%',
	// 		}
	// 	}).component();

	// 	cellContainer.addItem(textComponent, {
	// 		CSSStyles: {
	// 			'width': 'auto'
	// 		}
	// 	});

	// 	return cellContainer;
	// }
	// undo when bug #16445 is fixed
}
