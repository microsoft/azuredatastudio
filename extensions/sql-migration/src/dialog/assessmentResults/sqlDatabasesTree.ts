/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import { debounce, MigrationTargetType } from '../../api/utils';
import { IconPath, IconPathHelper } from '../../constants/iconPathHelper';
import * as styles from '../../constants/styles';
import { EOL } from 'os';
import { selectDatabasesFromList } from '../../constants/helper';
import { getSourceConnectionProfile } from '../../api/sqlUtils';
import { SqlMigrationAssessmentResultItem, SqlMigrationImpactedObjectInfo } from '../../service/contracts';

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
	private _dialog!: azdata.window.Dialog;
	private _instanceTable!: azdata.DeclarativeTableComponent;
	private _databaseTable!: azdata.DeclarativeTableComponent;
	private _assessmentResultsList!: azdata.ListViewComponent;
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
		this._dialog = dialog;

		const selectDbMessage = this.createSelectDbMessage();
		this._resultComponent = await this.createComponentResult(view);
		const treeComponent = await this.createComponent(
			view,
			(this._targetType === MigrationTargetType.SQLVM)
				? this._model._vmDbs
				: (this._targetType === MigrationTargetType.SQLMI)
					? this._model._miDbs
					: this._model._sqldbDbs);

		this._rootContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			height: '100%',
			width: '100%'
		}).component();
		this._rootContainer.addItem(treeComponent, { flex: '0 0 auto' });
		this._rootContainer.addItem(this._resultComponent, { flex: '0 0 auto' });
		this._rootContainer.addItem(selectDbMessage, { flex: '1 1 auto' });

		if (this._targetType === MigrationTargetType.SQLMI) {
			if (this._model._assessmentResults?.databaseAssessments.some(db => db.issues.find(issue => issue.databaseRestoreFails && issue.appliesToMigrationTargetPlatform === MigrationTargetType.SQLMI))) {
				dialog.message = {
					level: azdata.window.MessageLevel.Warning,
					text: constants.ASSESSMENT_MIGRATION_WARNING_SQLMI,
				};
			}
		} else if (this._targetType === MigrationTargetType.SQLDB) {
			if (this._model._assessmentResults?.databaseAssessments.some(db => db.issues.find(issue => issue.databaseRestoreFails && issue.appliesToMigrationTargetPlatform === MigrationTargetType.SQLDB))) {
				dialog.message = {
					level: azdata.window.MessageLevel.Warning,
					text: constants.ASSESSMENT_MIGRATION_WARNING_SQLDB,
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
				...styles.BOLD_NOTE_CSS,
				'margin': '0px 15px 0px 15px'
			},
			value: constants.DATABASES(0, this._model._databasesForAssessment?.length)
		}).component();
		return this._databaseCount;
	}

	private createDatabaseComponent(dbs: string[]): azdata.DivContainer {

		this._databaseTable = this._view.modelBuilder.declarativeTable().withProps(
			{
				ariaLabel: constants.DATABASES_TABLE_TILE,
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

		this._disposables.push(this._databaseTable.onDataChanged(async () => {
			await this.updateValuesOnSelection();
		}));

		this._disposables.push(this._databaseTable.onRowSelected(async (e) => {
			if (this._targetType === MigrationTargetType.SQLMI ||
				this._targetType === MigrationTargetType.SQLDB) {
				this._activeIssues = this._model._assessmentResults?.databaseAssessments[e.row].issues.filter(i => i.appliesToMigrationTargetPlatform === this._targetType);
			} else {
				this._activeIssues = [];
			}
			this._dbName.value = this._dbNames[e.row];
			this._recommendationTitle.value = constants.ISSUES_COUNT(this._activeIssues?.length);
			this._recommendation.value = constants.ISSUES_DETAILS;
			await this._resultComponent.updateCssStyles({
				'display': 'block'
			});
			await this._dbMessageContainer.updateCssStyles({
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
				ariaLabel: constants.SQL_SERVER_INSTANCE,
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
			this._activeIssues = this._model._assessmentResults?.issues.filter(issue => issue.appliesToMigrationTargetPlatform === this._targetType);
			this._dbName.value = this._serverName;
			await this._resultComponent.updateCssStyles({
				'display': 'block'
			});
			await this._dbMessageContainer.updateCssStyles({
				'display': 'none'
			});
			this._recommendation.value = constants.WARNINGS_DETAILS;
			this._recommendationTitle.value = constants.WARNINGS_COUNT(this._activeIssues?.length);
			if (this._targetType === MigrationTargetType.SQLMI ||
				this._targetType === MigrationTargetType.SQLDB) {
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
		const failedAssessment = this.handleFailedAssessment();


		const value = failedAssessment
			? constants.NO_RESULTS_AVAILABLE
			: (this._targetType === MigrationTargetType.SQLVM)
				? constants.NO_ISSUES_FOUND_VM
				: (this._targetType === MigrationTargetType.SQLMI)
					? constants.NO_ISSUES_FOUND_MI
					: constants.NO_ISSUES_FOUND_SQLDB;

		const message = this._view.modelBuilder.text()
			.withProps({
				value: value,
				CSSStyles: { ...styles.BODY_CSS }
			}).component();

		this._noIssuesContainer = this._view.modelBuilder.flexContainer()
			.withItems([message])
			.withProps({ CSSStyles: { 'margin-top': '8px', 'display': 'none' } })
			.component();

		return this._noIssuesContainer;
	}

	private handleFailedAssessment(): boolean {
		const failedAssessment: boolean = this._model._assessmentResults?.assessmentError !== undefined
			|| (this._model._assessmentResults?.errors?.length ?? 0) > 0;
		if (failedAssessment) {
			this._dialog.message = {
				level: azdata.window.MessageLevel.Warning,
				text: constants.ASSESSMENT_MIGRATION_WARNING,
				description: this.getAssessmentError(),
			};
		}

		return failedAssessment;
	}

	private getAssessmentError(): string {
		const errors: string[] = [];
		const assessmentError = this._model._assessmentResults?.assessmentError;
		if (assessmentError) {
			errors.push(`message: ${assessmentError.message}${EOL}stack: ${assessmentError.stack}`);
		}
		if (this._model?._assessmentResults?.errors?.length! > 0) {
			errors.push(...this._model._assessmentResults?.errors?.map(
				e => `message: ${e.message}${EOL}errorSummary: ${e.errorSummary}${EOL}possibleCauses: ${e.possibleCauses}${EOL}guidance: ${e.guidance}${EOL}errorId: ${e.errorId}`)!);
		}

		return errors.join(EOL);
	}

	private createSelectDbMessage(): azdata.FlexContainer {
		const message = this._view.modelBuilder.text().withProps({
			value: constants.SELECT_DB_PROMPT,
			CSSStyles: {
				...styles.BODY_CSS,
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
		const container = this._view.modelBuilder.flexContainer()
			.withItems([title, bottomContainer])
			.withLayout({ flexFlow: 'column' })
			.withProps({ CSSStyles: { 'margin-left': '24px' } })
			.component();

		return container;
	}

	private createDescriptionContainer(): azdata.FlexContainer {
		const description = this.createDescription();
		const impactedObjects = this.createImpactedObjectsDescription();
		const container = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row' })
			.withProps({ CSSStyles: { 'height': '100%' } })
			.component();
		container.addItem(description, { flex: '0 0 auto', CSSStyles: { 'width': '200px', 'margin-right': '35px' } });
		container.addItem(impactedObjects, { flex: '0 0 auto', CSSStyles: { 'width': '280px' } });

		return container;
	}

	private createImpactedObjectsDescription(): azdata.FlexContainer {
		const impactedObjectsTitle = this._view.modelBuilder.text().withProps({
			value: constants.IMPACTED_OBJECTS,
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'width': '280px',
				'margin': '10px 0px 0px 0px',
			}
		}).component();

		const rowStyle: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left',
			'border-bottom': '1px solid'
		};

		this._impactedObjectsTable = this._view.modelBuilder.declarativeTable().withProps(
			{
				ariaLabel: constants.IMPACTED_OBJECTS,
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
				dataValues: [[{ value: '' }, { value: '' }]],
				CSSStyles: { 'margin-top': '12px' }
			}
		).component();

		this._disposables.push(this._impactedObjectsTable.onRowSelected((e) => {
			const impactedObject = e.row > -1 ? this._impactedObjects[e.row] : undefined;
			this.refreshImpactedObject(impactedObject);
		}));

		const objectDetailsTitle = this._view.modelBuilder.text()
			.withProps({
				value: constants.OBJECT_DETAILS,
				CSSStyles: {
					...styles.LIGHT_LABEL_CSS,
					'margin': '12px 0px 0px 0px',
				}
			}).component();
		const objectDescriptionStyle = {
			...styles.BODY_CSS,
			'margin': '5px 0px 0px 0px',
			'word-wrap': 'break-word'
		};
		this._objectDetailsType = this._view.modelBuilder.text()
			.withProps({
				value: constants.TYPES_LABEL,
				CSSStyles: objectDescriptionStyle
			}).component();

		this._objectDetailsName = this._view.modelBuilder.text()
			.withProps({
				value: constants.NAMES_LABEL,
				CSSStyles: objectDescriptionStyle
			}).component();

		this._objectDetailsSample = this._view.modelBuilder.text()
			.withProps({
				value: '',
				CSSStyles: objectDescriptionStyle
			}).component();

		const container = this._view.modelBuilder.flexContainer()
			.withItems([
				impactedObjectsTitle,
				this._impactedObjectsTable,
				objectDetailsTitle,
				this._objectDetailsType,
				this._objectDetailsName,
				this._objectDetailsSample])
			.withLayout({ flexFlow: 'column' })
			.component();

		return container;
	}

	private createDescription(): azdata.FlexContainer {
		const LABEL_CSS = {
			...styles.LIGHT_LABEL_CSS,
			'width': '200px',
			'margin': '12px 0 0'
		};
		const textStyle = {
			...styles.BODY_CSS,
			'width': '200px',
			'word-wrap': 'break-word'
		};
		const descriptionTitle = this._view.modelBuilder.text()
			.withProps({
				value: constants.DESCRIPTION,
				CSSStyles: LABEL_CSS
			}).component();
		this._descriptionText = this._view.modelBuilder.text()
			.withProps({
				CSSStyles: textStyle
			}).component();

		const recommendationTitle = this._view.modelBuilder.text()
			.withProps({
				value: constants.RECOMMENDATION,
				CSSStyles: LABEL_CSS
			}).component();
		this._recommendationText = this._view.modelBuilder.text()
			.withProps({
				CSSStyles: textStyle
			}).component();
		const moreInfo = this._view.modelBuilder.text()
			.withProps({
				value: constants.MORE_INFO,
				CSSStyles: LABEL_CSS
			}).component();
		this._moreInfo = this._view.modelBuilder.hyperlink()
			.withProps({
				label: '',
				url: '',
				CSSStyles: textStyle,
				ariaLabel: constants.MORE_INFO,
				showLinkIcon: true
			}).component();

		const container = this._view.modelBuilder.flexContainer()
			.withItems([descriptionTitle,
				this._descriptionText,
				recommendationTitle,
				this._recommendationText,
				moreInfo,
				this._moreInfo])
			.withLayout({ flexFlow: 'column' })
			.component();

		return container;
	}

	private createAssessmentTitle(): azdata.TextComponent {
		this._assessmentTitle = this._view.modelBuilder.text()
			.withProps({
				value: '',
				CSSStyles: {
					...styles.LABEL_CSS,
					'margin-top': '12px',
					'height': '48px',
					'width': '540px',
					'border-bottom': 'solid 1px'
				}
			}).component();

		return this._assessmentTitle;
	}

	private createTitleComponent(): azdata.TextComponent {
		return this._view.modelBuilder.text()
			.withProps({
				value: constants.TARGET_PLATFORM,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '0 0 4px 0'
				}
			}).component();
	}

	private createPlatformComponent(): azdata.TextComponent {
		const target = (this._targetType === MigrationTargetType.SQLVM)
			? constants.SUMMARY_VM_TYPE
			: (this._targetType === MigrationTargetType.SQLMI)
				? constants.SUMMARY_MI_TYPE
				: constants.SUMMARY_SQLDB_TYPE;

		return this._view.modelBuilder.text()
			.withProps({
				value: target,
				CSSStyles: { ...styles.PAGE_SUBTITLE_CSS }
			}).component();
	}

	private createRecommendationComponent(): azdata.TextComponent {
		this._dbName = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin-bottom': '8px',
				'font-weight': '700'
			}
		}).component();

		return this._dbName;
	}

	private createAssessmentResultsTitle(): azdata.TextComponent {
		this._recommendationTitle = this._view.modelBuilder.text().withProps({
			value: constants.WARNINGS,
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin': '0 8px 4px 0',
				'width': '220px',
			}
		}).component();

		return this._recommendationTitle;
	}

	private createAssessmentDetailsTitle(): azdata.TextComponent {
		this._recommendation = this._view.modelBuilder.text().withProps({
			value: constants.WARNINGS_DETAILS,
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin': '0 0 4px 24px',
				'width': '200px',
			}
		}).component();

		return this._recommendation;
	}

	private createImpactedObjectsTable(): azdata.FlexContainer {

		this._assessmentResultsList = this._view.modelBuilder.listView().withProps({
			width: '200px',
			options: []
		}).component();

		this._disposables.push(this._assessmentResultsList.onDidClick(async (e: azdata.ListViewClickEvent) => {
			const selectedIssue = this._activeIssues[parseInt(this._assessmentResultsList.selectedOptionId!)];
			await this.refreshAssessmentDetails(selectedIssue);
		}));

		const container = this._view.modelBuilder.flexContainer()
			.withItems([this._assessmentResultsList])
			.withLayout({
				flexFlow: 'column',
				height: '100%'
			})
			.withProps({ CSSStyles: { 'border-right': 'solid 1px' } })
			.component();

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
		if (this._targetType === MigrationTargetType.SQLMI ||
			this._targetType === MigrationTargetType.SQLDB) {
			if (this._activeIssues?.length === 0) {
				/// show no issues here
				await this._assessmentsTable.updateCssStyles({ 'display': 'none', 'border-right': 'none' });
				await this._assessmentContainer.updateCssStyles({ 'display': 'none' });
				await this._noIssuesContainer.updateCssStyles({ 'display': 'flex' });
			} else {
				await this._assessmentContainer.updateCssStyles({ 'display': 'flex' });
				await this._assessmentsTable.updateCssStyles({ 'display': 'flex', 'border-right': 'solid 1px' });
				await this._noIssuesContainer.updateCssStyles({ 'display': 'none' });
			}
		} else {
			await this._assessmentsTable.updateCssStyles({ 'display': 'none', 'border-right': 'none' });
			await this._assessmentContainer.updateCssStyles({ 'display': 'none' });
			await this._noIssuesContainer.updateCssStyles({ 'display': 'flex' });

			this._recommendationTitle.value = constants.ASSESSMENT_RESULTS;
			this._recommendation.value = '';
		}
		let assessmentResults: azdata.ListViewOption[] = this._activeIssues
			.sort((e1, e2) => {
				if (e1.databaseRestoreFails) { return -1; }
				if (e2.databaseRestoreFails) { return 1; }
				return e1.checkId.localeCompare(e2.checkId);
			}).filter((v) => {
				return v.appliesToMigrationTargetPlatform === this._targetType;
			}).map((v, index) => {
				return {
					id: index.toString(),
					label: v.checkId,
					icon: v.databaseRestoreFails ? IconPathHelper.error : undefined,
					ariaLabel: v.databaseRestoreFails ? constants.BLOCKING_ISSUE_ARIA_LABEL(v.checkId) : v.checkId,
				};
			});

		this._assessmentResultsList.options = assessmentResults;
		if (this._assessmentResultsList.options.length) {
			this._assessmentResultsList.selectedOptionId = '0';

		}
	}

	public async refreshAssessmentDetails(selectedIssue?: SqlMigrationAssessmentResultItem): Promise<void> {
		this._assessmentTitle.value = selectedIssue?.checkId || '';
		this._descriptionText.value = selectedIssue?.description || '';
		this._moreInfo.url = selectedIssue?.helpLink || '';
		this._moreInfo.label = selectedIssue?.displayName || '';
		this._moreInfo.ariaLabel = selectedIssue?.displayName || '';
		this._impactedObjects = selectedIssue?.impactedObjects || [];
		this._recommendationText.value = selectedIssue?.message || constants.NA;

		await this._impactedObjectsTable.setDataValues(
			this._impactedObjects.map(
				(object) => [{ value: object.objectType }, { value: object.name }]));

		this._impactedObjectsTable.selectedRow = this._impactedObjects?.length > 0 ? 0 : -1;
	}

	public refreshImpactedObject(impactedObject?: SqlMigrationImpactedObjectInfo): void {
		this._objectDetailsType.value = constants.IMPACT_OBJECT_TYPE(impactedObject?.objectType);
		this._objectDetailsName.value = constants.IMPACT_OBJECT_NAME(impactedObject?.name);
		this._objectDetailsSample.value = impactedObject?.impactDetail || '';
	}

	public async initialize(): Promise<void> {
		let instanceTableValues: azdata.DeclarativeTableCellValue[][] = [];
		this._databaseTableValues = [];
		this._dbNames = this._model._databasesForAssessment;
		this._serverName = (await getSourceConnectionProfile()).serverName;

		// pre-select the entire list
		const selectedDbs = this._dbNames.filter(db => this._model._databasesForAssessment.includes(db));

		if (this._targetType === MigrationTargetType.SQLVM || !this._model._assessmentResults) {
			instanceTableValues = [[
				{
					value: this.createIconTextCell(IconPathHelper.sqlServerLogo, this._serverName),
					style: styleLeft
				},
				{
					value: '0',
					style: styleRight
				}
			]];
			this._dbNames.forEach((db) => {
				this._databaseTableValues.push([
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
				]);
			});
		} else {
			instanceTableValues = [[
				{
					value: this.createIconTextCell(IconPathHelper.sqlServerLogo, this._serverName),
					style: styleLeft
				},
				{
					value: this._model._assessmentResults?.issues?.filter(issue => issue.appliesToMigrationTargetPlatform === this._targetType).length,
					style: styleRight
				}
			]];
			this._model._assessmentResults?.databaseAssessments
				.sort((db1, db2) => db2.issues?.length - db1.issues?.length);

			// Reset the dbName list so that it is in sync with the table
			this._dbNames = this._model._assessmentResults?.databaseAssessments.map(da => da.name);
			this._model._assessmentResults?.databaseAssessments.forEach((db) => {
				let selectable = true;
				if (db.issues.find(issue => issue.databaseRestoreFails && issue.appliesToMigrationTargetPlatform === this._targetType)) {
					selectable = false;
				}
				this._databaseTableValues.push([
					{
						value: selectedDbs.includes(db.name) && selectable,
						style: styleLeft,
						enabled: selectable
					},
					{
						value: this.createIconTextCell((selectable) ? IconPathHelper.sqlDatabaseLogo : IconPathHelper.sqlDatabaseWarningLogo, db.name),
						style: styleLeft
					},
					{
						value: db.issues.filter(v => v.appliesToMigrationTargetPlatform === this._targetType)?.length,
						style: styleRight
					}
				]);
			});
		}
		await this._instanceTable.setDataValues(instanceTableValues);

		this._databaseTableValues = selectDatabasesFromList(this._model._databasesForMigration, this._databaseTableValues);
		await this._databaseTable.setDataValues(this._databaseTableValues);
		await this.updateValuesOnSelection();
	}

	private async updateValuesOnSelection() {
		await this._databaseCount.updateProperties({
			'value': constants.DATABASES(this.selectedDbs()?.length, this._model._databasesForAssessment?.length)
		});
	}

	private createIconTextCell(icon: IconPath, text: string): string {
		return text;
	}
}
