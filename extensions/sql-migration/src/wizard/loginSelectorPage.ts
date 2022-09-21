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
import { collectSourceLogins, collectTargetLogins, LoginTableInfo } from '../api/sqlUtils';
import { AzureSqlDatabaseServer } from '../api/azure';

export class LoginSelectorPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _loginSelectorTable!: azdata.TableComponent;
	private _loginNames!: string[];
	private _loginCount!: azdata.TextComponent;
	private _loginTableValues!: any[];
	private _disposables: vscode.Disposable[] = [];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.LOGIN_MIGRATIONS_SELECT_LOGINS_PAGE_TITLE), migrationStateModel);
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
			if (this.selectedLogins().length === 0) {
				this.wizard.message = {
					// TODO AKMA: Change to logins
					text: constants.SELECT_DATABASE_TO_CONTINUE,
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			return true;
		});

		// await this._loadDatabaseList(this.migrationStateModel, this.migrationStateModel._assessedDatabaseList);
	}

	public async onPageLeave(): Promise<void> {

		// TODO AKMA: Remove assessment stuff
		const assessedDatabases = this.migrationStateModel._assessedDatabaseList ?? [];
		const selectedLogins = this.migrationStateModel._loginsForMigration;
		// run assessment if
		// * no prior assessment
		// * the prior assessment had an error or
		// * the assessed databases list is different from the selected databases list
		this.migrationStateModel._runAssessments = !this.migrationStateModel._assessmentResults
			|| !!this.migrationStateModel._assessmentResults?.assessmentError
			|| assessedDatabases.length === 0
			|| assessedDatabases.length !== selectedLogins.length
			|| assessedDatabases.some(db => selectedLogins.indexOf(db) < 0);

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
		const selectedLogins = selectedList || this.selectedLogins();
		let tableRows = this._loginTableValues ?? [];
		if (this._loginTableValues && value?.length > 0) {
			tableRows = this._loginTableValues
				.filter(row => {
					const searchText = value?.toLowerCase();
					return row[1]?.toLowerCase()?.indexOf(searchText) > -1	// source login
						|| row[2]?.toLowerCase()?.indexOf(searchText) > -1	// login type
						|| row[3]?.toLowerCase()?.indexOf(searchText) > -1  // default database
						|| row[4]?.toLowerCase()?.indexOf(searchText) > -1  // status
						|| row[5]?.toLowerCase()?.indexOf(searchText) > -1;	// target status
				});
		}

		for (let row = 0; row < tableRows.length; row++) {
			const database: string = tableRows[row][2];
			if (selectedLogins.includes(database)) {
				selectedRows.push(row);
			}
		}

		await this._loginSelectorTable.updateProperty('data', tableRows);
		this._loginSelectorTable.selectedRows = selectedRows;
		await this.updateValuesOnSelection();
	}


	public async createRootContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		await this._loadDatabaseList(this.migrationStateModel, this.migrationStateModel._assessedDatabaseList);

		this._loginCount = this._view.modelBuilder.text().withProps({
			value: constants.LOGINS_SELECTED(
				this.selectedLogins().length,
				this._loginTableValues.length),
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-top': '8px'
			},
			ariaLive: 'polite'
		}).component();

		const cssClass = 'no-borders';
		this._loginSelectorTable = this._view.modelBuilder.table()
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
						name: constants.SOURCE_LOGIN,
						value: 'sourceLogin',
						type: azdata.ColumnType.text,
						width: 360,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
					{
						name: constants.LOGIN_TYPE,
						value: 'loginType',
						type: azdata.ColumnType.text,
						width: 80,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
					{
						name: constants.DEFAULT_DATABASE,
						value: 'defaultDatabase',
						type: azdata.ColumnType.text,
						width: 80,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
					{
						name: constants.LOGIN_STATUS_COLUMN,
						value: 'status',
						type: azdata.ColumnType.text,
						width: 130,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
					{
						name: constants.LOGIN_TARGET_STATUS_COLUMN,
						value: 'targetStatus',
						type: azdata.ColumnType.text,
						width: 130,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
				]
			}).component();

		this._disposables.push(this._loginSelectorTable.onRowSelected(async (e) => {
			await this.updateValuesOnSelection();
		}));

		// load unfiltered table list and pre-select list of databases saved in state
		await this._filterTableList('', this.migrationStateModel._loginsForMigration);

		const flex = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '100%',
		}).withProps({
			CSSStyles: {
				'margin': '0px 28px 0px 28px'
			}
		}).component();
		flex.addItem(this.createSearchComponent(), { flex: '0 0 auto' });
		flex.addItem(this._loginCount, { flex: '0 0 auto' });
		flex.addItem(this._loginSelectorTable);
		return flex;
	}

	private async _loadDatabaseList(stateMachine: MigrationStateModel, selectedLogins: string[]): Promise<void> {
		const sourceLogins: LoginTableInfo[] = [];
		const targetLogins: string[] = [];

		// execute a query against the source to get the logins
		try {
			sourceLogins.push(...await collectSourceLogins(stateMachine.sourceConnectionId));
			console.log(sourceLogins);
		} catch (error) {
			this.wizard.message = {
				level: azdata.window.MessageLevel.Error,
				text: constants.LOGIN_MIGRATIONS_GET_LOGINS_ERROR_TITLE('source'),
				description: constants.LOGIN_MIGRATIONS_GET_LOGINS_ERROR(error.message),
			};
		}

		// execute a query against the target to get the logins
		try {
			targetLogins.push(...await collectTargetLogins(stateMachine._targetServerInstance as AzureSqlDatabaseServer, stateMachine._targetUserName, stateMachine._targetPassword));
			console.log(targetLogins);
		} catch (error) {
			this.wizard.message = {
				level: azdata.window.MessageLevel.Error,
				text: constants.LOGIN_MIGRATIONS_GET_LOGINS_ERROR_TITLE('target'),
				description: constants.LOGIN_MIGRATIONS_GET_LOGINS_ERROR(error.message),
			};
		}

		this._loginNames = [];

		this._loginTableValues = sourceLogins.map(row => {
			const loginName = row.loginName;
			this._loginNames.push(loginName);
			return [
				selectedLogins?.indexOf(loginName) > -4,
				loginName,
				row.loginType,
				row.defaultDatabaseName,
				row.status,
				targetLogins.some(targetLogin => targetLogin.toLowerCase() === loginName.toLocaleLowerCase()) ? 'Login found' : 'Login not found',
			];
		}) || [];
	}

	public selectedLogins(): string[] {
		const rows = this._loginSelectorTable?.data || [];
		const databases = this._loginSelectorTable?.selectedRows || [];
		return databases
			.filter(row => row < rows.length)
			.map(row => rows[row][2])
			|| [];
	}

	private async updateValuesOnSelection() {
		const selectedLogins = this.selectedLogins() || [];
		await this._loginCount.updateProperties({
			'value': constants.LOGINS_SELECTED(
				selectedLogins.length,
				this._loginSelectorTable.data?.length || 0)
		});

		// TODO AKMA: change to logins for migration
		this.migrationStateModel._loginsForMigration = selectedLogins;
	}
}
