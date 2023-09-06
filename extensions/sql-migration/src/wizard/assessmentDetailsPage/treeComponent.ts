/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { MigrationTargetType, debounce } from '../../api/utils';
import { MigrationStateModel } from '../../models/stateMachine';
import { IconPath, IconPathHelper } from '../../constants/iconPathHelper';
import { selectDatabasesFromList } from '../../constants/helper';
import { getSourceConnectionProfile } from '../../api/sqlUtils';
import { SqlMigrationAssessmentResultItem } from '../../service/contracts';

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

// Class that defines list of instance and databases to select in assessment results page
export class TreeComponent {
	private _view!: azdata.ModelView;
	private _instanceTable!: azdata.DeclarativeTableComponent;
	private _databaseTable!: azdata.DeclarativeTableComponent;
	private _assessmentResultsList!: azdata.ListViewComponent;
	private _assessmentContainer!: azdata.FlexContainer;
	private _assessmentsTable!: azdata.FlexContainer;
	private _noIssuesContainer!: azdata.FlexContainer;
	private _recommendation!: azdata.TextComponent;
	private _recommendationTitle!: azdata.TextComponent;
	private _databaseTableValues!: azdata.DeclarativeTableCellValue[][];
	private _activeIssues!: SqlMigrationAssessmentResultItem[];
	private _serverName!: string;
	private _dbNames!: string[];
	private _databaseCount!: azdata.TextComponent;
	private _disposables: vscode.Disposable[] = [];

	constructor(
		private _model: MigrationStateModel,
		private _targetType: MigrationTargetType
	) { }

	// function that creates components for tree section
	public createTreeComponent(view: azdata.ModelView, dbs: string[]) {
		this._view = view;
		const component = view.modelBuilder.flexContainer().withLayout({
			height: '100%',
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				'border-right': 'solid 1px',
				'width': '285px'
			},
		}).component();

		component.addItem(this.createSearchComponent(), { flex: '0 0 auto' });
		component.addItem(this.createInstanceComponent(), { flex: '0 0 auto' });
		component.addItem(this.createDatabaseCount(), { flex: '0 0 auto' });
		component.addItem(this.createDatabaseComponent(dbs), { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'auto' } });
		return component;
	}

	// function to create search component.
	private createSearchComponent(): azdata.DivContainer {
		let resourceSearchBox = this._view.modelBuilder.inputBox().withProps({
			stopEnterPropagation: true,
			placeHolder: constants.SEARCH,
			width: 260
		}).component();

		this._disposables.push(resourceSearchBox.onTextChanged(value => this._filterTableList(value)));

		const searchContainer = this._view.modelBuilder.divContainer().withItems([resourceSearchBox]).withProps({
			CSSStyles: {
				'margin': '10px 15px 0px 15px'
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

		return instanceContainer;
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

	private createDatabaseCount(): azdata.TextComponent {
		this._databaseCount = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.BOLD_NOTE_CSS,
				'margin': '0px 15px 0px 15px'
			}
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

		const tableContainer = this._view.modelBuilder.divContainer().withItems([this._databaseTable]).withProps({
			width: '100%',
			CSSStyles: {
				'margin': '0px 15px 0px 15px'
			}
		}).component();
		return tableContainer;
	}

	private async updateValuesOnSelection() {
		await this._databaseCount.updateProperties({
			'value': constants.DATABASES(this.selectedDbs()?.length, this._model._databasesForAssessment?.length)
		});
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
		this._databaseCount.value = constants.DATABASES(0, this._model._databasesForAssessment?.length);
	}

	private createIconTextCell(icon: IconPath, text: string): string {
		return text;
	}

}
