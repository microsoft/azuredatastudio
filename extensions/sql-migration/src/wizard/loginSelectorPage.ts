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
import { IconPathHelper } from '../constants/iconPathHelper';

export class LoginSelectorPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _loginSelectorTable!: azdata.TableComponent;
	private _loginNames!: string[];
	private _loginCount!: azdata.TextComponent;
	private _loginTableValues!: any[];
	private _disposables: vscode.Disposable[] = [];
	private _isCurrentPage: boolean;
	private _refreshButton!: azdata.ButtonComponent;
	private _refreshLoading!: azdata.LoadingComponent;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.LOGIN_MIGRATIONS_SELECT_LOGINS_PAGE_TITLE), migrationStateModel);
		this._isCurrentPage = false;
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
		this._isCurrentPage = true;
		this.updateNextButton();
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
					text: constants.SELECT_LOGIN_TO_CONTINUE,
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			return true;
		});

		await this._loadLoginList();

		// load unfiltered table list and pre-select list of logins saved in state
		await this._filterTableList('', this.migrationStateModel._loginsForMigration);
	}

	public async onPageLeave(): Promise<void> {
		// TODO AKMA : should i run login migration here? or on the next page

		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});

		this._isCurrentPage = false;
		this.resetNextButton();
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
			const login: string = tableRows[row][1];
			if (selectedLogins.includes(login)) {
				selectedRows.push(row);
			}
		}

		await this._loginSelectorTable.updateProperty('data', tableRows);
		this._loginSelectorTable.selectedRows = selectedRows;
		await this.updateValuesOnSelection();
	}


	public async createRootContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		await this._loadLoginList();

		this._refreshButton = this._view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.refresh,
				label: constants.DATABASE_TABLE_REFRESH_LABEL,
				width: 70,
				CSSStyles: { 'margin': '15px 0 0 0' },
			})
			.component();

		this._disposables.push(
			this._refreshButton.onDidClick(
				async e => await this._loadLoginList()));

		this._refreshLoading = this._view.modelBuilder.loadingComponent()
			.withItem(this._refreshButton)
			.withProps({ loading: false })
			.component();

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

		// load unfiltered table list and pre-select list of logins saved in state
		await this._filterTableList('', this.migrationStateModel._loginsForMigration);

		const flex = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '100%',
		}).withProps({
			CSSStyles: {
				'margin': '0px 28px 0px 28px'
			}
		}).component();
		flex.addItem(this._refreshLoading);
		flex.addItem(this.createSearchComponent(), { flex: '0 0 auto' });
		flex.addItem(this._loginCount, { flex: '0 0 auto' });
		flex.addItem(this._loginSelectorTable);
		return flex;
	}

	private async _loadLoginList(): Promise<void> {
		const stateMachine: MigrationStateModel = this.migrationStateModel;
		const selectedLogins: string[] = stateMachine._loginsForMigration;
		const sourceLogins: LoginTableInfo[] = [];
		const targetLogins: string[] = [];

		// execute a query against the source to get the logins
		try {
			sourceLogins.push(...await collectSourceLogins(stateMachine.sourceConnectionId));
			console.log('AKMA DEBUG LOG: ', sourceLogins);
		} catch (error) {
			this.wizard.message = {
				level: azdata.window.MessageLevel.Error,
				text: constants.LOGIN_MIGRATIONS_GET_LOGINS_ERROR_TITLE('source'),
				description: constants.LOGIN_MIGRATIONS_GET_LOGINS_ERROR(error.message),
			};
		}

		// execute a query against the target to get the logins
		try {
			if (this.isTargetInstanceSet()) {
				targetLogins.push(...await collectTargetLogins(stateMachine._targetServerInstance as AzureSqlDatabaseServer, stateMachine._targetUserName, stateMachine._targetPassword));
				console.log('AKMA DEBUG LOG: ', targetLogins);
			}
			// TODO AKMA : Remove following 3 lines
			else {
				console.log('AKMA DEBUG LOG: Target info is empty.');
			}
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
				selectedLogins?.some(login => login === loginName.toLocaleLowerCase()),
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
		const logins = this._loginSelectorTable?.selectedRows || [];
		return logins
			.filter(row => row < rows.length)
			.map(row => rows[row][1] /* loginName */)
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
		this.updateNextButton();
	}

	private updateNextButton() {
		// Only uppdate next label if we are currently on this page
		if (this._isCurrentPage) {
			this.wizard.nextButton.label = constants.LOGIN_MIGRATE_BUTTON_TEXT;
			this.wizard.nextButton.enabled = this.migrationStateModel._loginsForMigration && this.migrationStateModel._loginsForMigration.length > 0;
		}
	}

	private resetNextButton() {
		this.wizard.nextButton.label = constants.NEXT_LABEL;
		this.wizard.nextButton.enabled = true;
	}

	private isTargetInstanceSet() {
		const stateMachine: MigrationStateModel = this.migrationStateModel;
		return stateMachine._targetServerInstance && stateMachine._targetUserName && stateMachine._targetPassword;
	}
}
