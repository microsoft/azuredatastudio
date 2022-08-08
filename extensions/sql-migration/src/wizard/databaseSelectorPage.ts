/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { debounce } from '../api/utils';
import * as styles from '../constants/styles';
import { IconPathHelper } from '../constants/iconPathHelper';

export class DatabaseSelectorPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _databaseSelectorTable!: azdata.TableComponent;
	private _dbNames!: string[];
	private _dbCount!: azdata.TextComponent;
	private _databaseTableValues!: any[];
	private _disposables: vscode.Disposable[] = [];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.DATABASE_FOR_ASSESSMENT_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		const flex = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			height: '100%',
			width: '100%'
		}).component();
		flex.addItem(await this.createRootContainer(view), { flex: '1 1 auto' });

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));

		await view.initializeModel(flex);
	}

	public async onPageEnter(): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			this.wizard.message = {
				text: '',
				level: azdata.window.MessageLevel.Error
			};
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}
			if (this.selectedDbs().length === 0) {
				this.wizard.message = {
					text: constants.SELECT_DATABASE_TO_CONTINUE,
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			return true;
		});
	}

	public async onPageLeave(): Promise<void> {
		const assessedDatabases = this.migrationStateModel._assessedDatabaseList ?? [];
		const selectedDatabases = this.migrationStateModel._databasesForAssessment;
		// run assessment if
		// * no prior assessment
		// * the prior assessment had an error or
		// * the assessed databases list is different from the selected databases list
		this.migrationStateModel._runAssessments = !this.migrationStateModel._assessmentResults
			|| !!this.migrationStateModel._assessmentResults?.assessmentError
			|| assessedDatabases.length === 0
			|| assessedDatabases.length !== selectedDatabases.length
			|| assessedDatabases.some(db => selectedDatabases.indexOf(db) < 0);

		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};

		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private createSearchComponent(): azdata.DivContainer {
		let resourceSearchBox = this._view.modelBuilder.inputBox().withProps({
			stopEnterPropagation: true,
			placeHolder: constants.SEARCH,
			width: 200
		}).component();

		this._disposables.push(
			resourceSearchBox.onTextChanged(value => this._filterTableList(value)));

		const searchContainer = this._view.modelBuilder.divContainer().withItems([resourceSearchBox]).withProps({
			CSSStyles: {
				'width': '200px',
				'margin-top': '8px'
			}
		}).component();

		return searchContainer;
	}

	@debounce(500)
	private async _filterTableList(value: string, selectedList?: string[]): Promise<void> {
		const selectedRows: number[] = [];
		const selectedDatabases = selectedList || this.selectedDbs();
		let tableRows = this._databaseTableValues;
		if (this._databaseTableValues && value?.length > 0) {
			tableRows = this._databaseTableValues
				.filter(row => {
					const searchText = value?.toLowerCase();
					return row[2]?.toLowerCase()?.indexOf(searchText) > -1	// database name
						|| row[3]?.toLowerCase()?.indexOf(searchText) > -1	// state
						|| row[4]?.toLowerCase()?.indexOf(searchText) > -1  // size
						|| row[5]?.toLowerCase()?.indexOf(searchText) > -1;	// last backup date
				});
		}

		for (let row = 0; row < tableRows.length; row++) {
			const database: string = tableRows[row][2];
			if (selectedDatabases.includes(database)) {
				selectedRows.push(row);
			}
		}

		await this._databaseSelectorTable.updateProperty('data', tableRows);
		this._databaseSelectorTable.selectedRows = selectedRows;
		await this.updateValuesOnSelection();
	}


	public async createRootContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		await this._loadDatabaseList(this.migrationStateModel, this.migrationStateModel._assessedDatabaseList);

		const text = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_FOR_ASSESSMENT_DESCRIPTION,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		this._dbCount = this._view.modelBuilder.text().withProps({
			value: constants.DATABASES_SELECTED(
				this.selectedDbs().length,
				this._databaseTableValues.length),
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-top': '8px'
			},
			ariaLive: 'polite'
		}).component();

		const cssClass = 'no-borders';
		this._databaseSelectorTable = this._view.modelBuilder.table()
			.withProps({
				data: [],
				width: 650,
				height: '100%',
				forceFitColumns: azdata.ColumnSizingMode.ForceFit,
				columns: [
					<azdata.CheckboxColumn>{
						value: '',
						width: 10,
						type: azdata.ColumnType.checkBox,
						action: azdata.ActionOnCellCheckboxCheck.selectRow,
						resizable: false,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
					{
						value: 'databaseicon',
						name: '',
						width: 10,
						type: azdata.ColumnType.icon,
						headerCssClass: cssClass,
						cssClass: cssClass,
						resizable: false,
					},
					{
						name: constants.DATABASE,
						value: 'database',
						type: azdata.ColumnType.text,
						width: 360,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
					{
						name: constants.STATUS,
						value: 'status',
						type: azdata.ColumnType.text,
						width: 80,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
					{
						name: constants.SIZE,
						value: 'size',
						type: azdata.ColumnType.text,
						width: 80,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
					{
						name: constants.LAST_BACKUP,
						value: 'lastBackup',
						type: azdata.ColumnType.text,
						width: 130,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
				]
			}).component();

		this._disposables.push(this._databaseSelectorTable.onRowSelected(async (e) => {
			await this.updateValuesOnSelection();
		}));

		// load unfiltered table list and pre-select list of databases saved in state
		await this._filterTableList('', this.migrationStateModel._databasesForAssessment);

		const flex = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '100%',
		}).withProps({
			CSSStyles: {
				'margin': '0px 28px 0px 28px'
			}
		}).component();
		flex.addItem(text, { flex: '0 0 auto' });
		flex.addItem(this.createSearchComponent(), { flex: '0 0 auto' });
		flex.addItem(this._dbCount, { flex: '0 0 auto' });
		flex.addItem(this._databaseSelectorTable);
		return flex;
	}

	private async _loadDatabaseList(stateMachine: MigrationStateModel, selectedDatabases: string[]): Promise<void> {
		const providerId = (await stateMachine.getSourceConnectionProfile()).providerId;
		const metaDataService = azdata.dataprotocol.getProvider<azdata.MetadataProvider>(
			providerId,
			azdata.DataProviderType.MetadataProvider);
		const ownerUri = await azdata.connection.getUriForConnection(
			stateMachine.sourceConnectionId);
		const excludeDbs: string[] = [
			'master',
			'tempdb',
			'msdb',
			'model'
		];
		const databaseList = (<azdata.DatabaseInfo[]>await metaDataService
			.getDatabases(ownerUri))
			.filter(database => !excludeDbs.includes(database.options.name))
			|| [];

		databaseList.sort((a, b) => a.options.name.localeCompare(b.options.name));
		this._dbNames = [];

		this._databaseTableValues = databaseList.map(database => {
			const databaseName = database.options.name;
			this._dbNames.push(databaseName);
			return [
				selectedDatabases?.indexOf(databaseName) > -1,
				<azdata.IconColumnCellValue>{
					icon: IconPathHelper.sqlDatabaseLogo,
					title: databaseName,
				},
				databaseName,
				database.options.state,
				database.options.sizeInMB,
				database.options.lastBackup,
			];
		}) || [];
	}

	public selectedDbs(): string[] {
		const rows = this._databaseSelectorTable?.data || [];
		const databases = this._databaseSelectorTable?.selectedRows || [];
		return databases
			.filter(row => row < rows.length)
			.map(row => rows[row][2])
			|| [];
	}

	private async updateValuesOnSelection() {
		const selectedDatabases = this.selectedDbs() || [];
		await this._dbCount.updateProperties({
			'value': constants.DATABASES_SELECTED(
				selectedDatabases.length,
				this._databaseSelectorTable.data?.length || 0)
		});
		this.migrationStateModel._databasesForAssessment = selectedDatabases;
	}
}
