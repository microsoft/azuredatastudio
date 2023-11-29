/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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

const AZURE_SQL_MI_DB_COUNT_THRESHOLD = 100;

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
	private _databaseTableValues!: azdata.DeclarativeTableCellValue[][];
	private _serverName!: string;
	private _dbNames!: string[];
	private _databaseCount!: azdata.TextComponent;
	private _disposables: vscode.Disposable[] = [];

	constructor(public wizard: azdata.window.Wizard,
		public model: MigrationStateModel, private _readOnly: boolean = false) { }

	public get instanceTable() {
		return this._instanceTable;
	}

	public get databaseTable() {
		return this._databaseTable;
	}

	// function that creates components for tree section
	public createTreeComponent(view: azdata.ModelView) {
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
		component.addItem(this.createDatabaseComponent(), { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'auto' } });
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
				'margin': '10px 15px 0px 0px'
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
						displayName: constants.FINDINGS_LABEL,
						valueType: azdata.DeclarativeDataType.string,
						width: 50,
						isReadOnly: true,
						headerCssStyles: headerRight
					}
				],
			}).component();

		const instanceContainer = this._view.modelBuilder.divContainer().withItems([this._instanceTable]).withProps({
			CSSStyles: {
				'margin': '19px 15px 0px 0px'
			}
		}).component();

		return instanceContainer;
	}

	private createDatabaseCount(): azdata.TextComponent {
		this._databaseCount = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.BOLD_NOTE_CSS,
				'margin-right': '15px'
			}
		}).component();
		return this._databaseCount;
	}

	private createDatabaseComponent(): azdata.DivContainer {

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
						isReadOnly: this._readOnly,
						showCheckAll: !this._readOnly,
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
						displayName: constants.FINDINGS_LABEL,
						valueType: azdata.DeclarativeDataType.string,
						width: 50,
						isReadOnly: true,
						headerCssStyles: headerRight,
					}
				]
			}
		).component();

		this._disposables.push(this._databaseTable.onDataChanged(async () => {
			await this.updateValuesOnSelectionAsync(this.model);
			this.model._databasesForMigration = this.selectedDbs();
		}));

		const tableContainer = this._view.modelBuilder.divContainer().withItems([this._databaseTable]).withProps({
			width: '100%',
			CSSStyles: {
				'margin-right': '15px'
			}
		}).component();
		return tableContainer;
	}

	private async updateValuesOnSelectionAsync(migrationStateModel: MigrationStateModel) {
		const selectedDbsCount = this.selectedDbs()?.length;
		if (!this._readOnly && migrationStateModel._targetType === MigrationTargetType.SQLMI && selectedDbsCount > AZURE_SQL_MI_DB_COUNT_THRESHOLD) {
			this.wizard.nextButton.enabled = false;
			this.wizard.message = {
				level: azdata.window.MessageLevel.Error,
				text: constants.AZURE_SQL_MI_DB_COUNT_THRESHOLD_EXCEEDS_ERROR(AZURE_SQL_MI_DB_COUNT_THRESHOLD)
			};
		}
		else if (!this._readOnly && !this.wizard.nextButton.enabled) {
			this.wizard.nextButton.enabled = true;
			this.wizard.message = {
				level: azdata.window.MessageLevel.Information,
				text: constants.AZURE_SQL_MI_DB_COUNT_UNDER_THRESHOLD
			};
		}

		await this._databaseCount.updateProperties({
			'value': constants.DATABASES(selectedDbsCount, migrationStateModel._databasesForAssessment?.length)
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

	// populates tree component values.
	public async initialize(): Promise<void> {
		let instanceTableValues: azdata.DeclarativeTableCellValue[][] = [];
		this._databaseTableValues = [];
		this._dbNames = this.model._databasesForAssessment;
		this._serverName = this.model.serverName ?? (await getSourceConnectionProfile()).serverName;

		// pre-select the entire list
		const selectedDbs = this._dbNames.filter(db => this.model._databasesForMigration.includes(db));

		if (this.model._targetType === MigrationTargetType.SQLVM || !this.model._assessmentResults) {
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

			if (!this._readOnly && this.model._targetType === MigrationTargetType.SQLMI && selectedDbs?.length > AZURE_SQL_MI_DB_COUNT_THRESHOLD) {
				this.wizard.nextButton.enabled = false;
				this.wizard.message = {
					level: azdata.window.MessageLevel.Error,
					text: constants.AZURE_SQL_MI_DB_COUNT_THRESHOLD_EXCEEDS_ERROR(AZURE_SQL_MI_DB_COUNT_THRESHOLD),
				};
			}

			instanceTableValues = [[
				{
					value: this.createIconTextCell(IconPathHelper.sqlServerLogo, this._serverName),
					style: styleLeft
				},
				{
					value: this.getUniqueIssuesBasedOnCheckId(this.model._assessmentResults?.issues)?.filter(issue => issue.appliesToMigrationTargetPlatform === this.model._targetType).length,
					style: styleRight
				}
			]];
			this.model._assessmentResults?.databaseAssessments
				.sort((db1, db2) => db2.issues?.length - db1.issues?.length);

			// Reset the dbName list so that it is in sync with the table
			this._dbNames = this.model._assessmentResults?.databaseAssessments.map(da => da.name);
			this.model._assessmentResults?.databaseAssessments.forEach((db) => {
				let selectable = true;
				if (db.issues.find(issue => issue.databaseRestoreFails && issue.appliesToMigrationTargetPlatform === this.model._targetType)) {
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
						value: this.getUniqueIssuesBasedOnCheckId(db.issues)?.filter(v => v.appliesToMigrationTargetPlatform === this.model._targetType)?.length,
						style: styleRight
					}
				]);
			});
		}
		await this._instanceTable.setDataValues(instanceTableValues);

		this._databaseTableValues = selectDatabasesFromList(this.model._databasesForMigration, this._databaseTableValues);
		await this._databaseTable.setDataValues(this._databaseTableValues);
		await this.updateValuesOnSelectionAsync(this.model);
		this._databaseCount.value = constants.DATABASES(selectedDbs.length, this.model._databasesForAssessment?.length);
	}

	private createIconTextCell(icon: IconPath, text: string): string {
		return text;
	}

	// function that return list of unique issues based on checkId
	private getUniqueIssuesBasedOnCheckId(issues: SqlMigrationAssessmentResultItem[]): SqlMigrationAssessmentResultItem[] {
		let distinctIssues: SqlMigrationAssessmentResultItem[] = [];
		let distinctCheckIds: string[] = [];
		issues.forEach((issue) => {
			if (!distinctCheckIds.includes(issue.checkId)) {
				distinctCheckIds.push(issue.checkId);
				distinctIssues.push(issue);
			}
		});
		return distinctIssues;
	}

}
