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

export class LoginMigrationStatusPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _textBox!: azdata.TextComponent;
	private _migratingLoginsTable!: azdata.TableComponent;
	private _loginCount!: azdata.TextComponent;
	private _loginsTableValues!: any[];
	private _disposables: vscode.Disposable[] = [];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.LOGIN_MIGRATIONS_STATUS_PAGE_TITLE), migrationStateModel);
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
			return true;
		});

		await this._loadMigratingLoginsList(this.migrationStateModel);

		// load unfiltered table list
		await this._filterTableList('');

		if (this.migrationStateModel._targetServerInstance) {
			// TODO AKMA : remove debug below and pretty-ify this.migrationStateModel._targetType with proper spacing
			console.log('AKMA DEBUG LOG: target server: ', this.migrationStateModel._targetServerInstance);
			await this._textBox.updateProperties({
				'value': constants.LOGIN_MIGRATIONS_STATUS_PAGE_DESCRIPTION(this._getNumberOfLogins(), this.migrationStateModel._targetType, this.migrationStateModel._targetServerInstance.name)
			});
		}
	}

	public async onPageLeave(): Promise<void> {
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
	private async _filterTableList(value: string): Promise<void> {
		let tableRows = this._loginsTableValues;
		if (this._loginsTableValues && value?.length > 0) {
			tableRows = this._loginsTableValues
				.filter(row => {
					const searchText = value?.toLowerCase();
					return row[0]?.toLowerCase()?.indexOf(searchText) > -1	// source login
						|| row[1]?.toLowerCase()?.indexOf(searchText) > -1	// login type
						|| row[2]?.toLowerCase()?.indexOf(searchText) > -1  // default database
						|| row[3]?.toLowerCase()?.indexOf(searchText) > -1;	// migration status
				});
		}

		await this._migratingLoginsTable.updateProperty('data', tableRows);
		await this.updateLoginCount();
	}

	public async createRootContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		await this._loadMigratingLoginsList(this.migrationStateModel);

		this._textBox = this._view.modelBuilder.text().withProps({
			value: constants.LOGIN_MIGRATIONS_STATUS_PAGE_DESCRIPTION(0, '', ''),
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		this._loginCount = this._view.modelBuilder.text().withProps({
			value: constants.NUMBER_LOGINS_MIGRATING(this._loginsTableValues.length),
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-top': '8px'
			},
			ariaLive: 'polite'
		}).component();

		const cssClass = 'no-borders';
		this._migratingLoginsTable = this._view.modelBuilder.table()
			.withProps({
				data: [],
				width: 650,
				height: '100%',
				forceFitColumns: azdata.ColumnSizingMode.ForceFit,
				columns: [
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
						name: constants.LOGIN_MIGRATION_STATUS_COLUMN,
						value: 'migrationStatus',
						type: azdata.ColumnType.text,
						width: 130,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
				]
			}).component();

		// load unfiltered table list
		await this._filterTableList('');

		const flex = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '100%',
		}).withProps({
			CSSStyles: {
				'margin': '0px 28px 0px 28px'
			}
		}).component();
		flex.addItem(this._textBox, { flex: '0 0 auto' });
		flex.addItem(this.createSearchComponent(), { flex: '0 0 auto' });
		flex.addItem(this._loginCount, { flex: '0 0 auto' });
		flex.addItem(this._migratingLoginsTable);
		return flex;
	}

	private async _loadMigratingLoginsList(stateMachine: MigrationStateModel): Promise<void> {
		const loginList = stateMachine._loginsForMigration || [];
		loginList.sort((a, b) => a.loginName.localeCompare(b.loginName));

		this._loginsTableValues = loginList.map(login => {
			const loginName = login.loginName;
			return [
				loginName,
				login.loginType,
				login.defaultDatabaseName,
				'In progress'
			];
		}) || [];
	}

	private async updateLoginCount() {
		await this._loginCount.updateProperties({
			// 'value': constants.NUMBER_LOGINS_MIGRATING(this._migratingLoginsTable.data?.length || 0)
			'value': constants.NUMBER_LOGINS_MIGRATING(this._getNumberOfLogins())
		});
	}

	private _getNumberOfLogins(): number {
		return this._migratingLoginsTable?.data?.length || 0;
	}
}
