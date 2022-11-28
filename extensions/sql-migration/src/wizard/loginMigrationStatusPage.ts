/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { debounce, getPipelineStatusImage } from '../api/utils';
import * as styles from '../constants/styles';
import { IconPathHelper } from '../constants/iconPathHelper';

export class LoginMigrationStatusPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _migratingLoginsTable!: azdata.TableComponent;
	private _loginCount!: azdata.TextComponent;
	private _loginsTableValues!: any[];
	private _disposables: vscode.Disposable[] = [];
	private _progressLoaderContainer!: azdata.FlexContainer;
	private _migrationProgress!: azdata.InfoBoxComponent;
	private _progressLoader!: azdata.LoadingComponent;
	private _progressContainer!: azdata.FlexContainer;
	private _migrationProgressDetails!: azdata.TextComponent;

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

		this.wizard.backButton.enabled = false;
		this.wizard.backButton.hidden = true;
		this.wizard.doneButton.enabled = false;

		await this._loadMigratingLoginsList(this.migrationStateModel);

		// load unfiltered table list
		await this._filterTableList('');

		await this._runLoginMigrations();
		await this._loadMigratingLoginsList(this.migrationStateModel);
		await this._filterTableList('');
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

	private createMigrationProgressLoader(): azdata.FlexContainer {
		this._progressLoader = this._view.modelBuilder.loadingComponent()
			.withProps({
				loadingText: constants.LOGIN_MIGRATION_IN_PROGRESS,
				loadingCompletedText: constants.LOGIN_MIGRATIONS_COMPLETE,
				loading: true,
				CSSStyles: { 'margin-right': '20px' }
			})
			.component();

		this._migrationProgress = this._view.modelBuilder.infoBox()
			.withProps({
				style: 'information',
				text: constants.LOGIN_MIGRATION_IN_PROGRESS,
				CSSStyles: {
					...styles.PAGE_TITLE_CSS,
					'margin-right': '20px',
					'font-size': '14px',
					'line-height': '17px'
				}
			}).component();

		this._progressLoaderContainer = this._view.modelBuilder.flexContainer()
			.withLayout({
				height: '100%',
				flexFlow: 'row',
				alignItems: 'center'
			}).component();

		this._progressLoaderContainer.addItem(this._migrationProgress, { flex: '0 0 auto' });
		this._progressLoaderContainer.addItem(this._progressLoader, { flex: '0 0 auto' });

		return this._progressLoaderContainer;
	}

	private async createMigrationProgressDetails(): Promise<azdata.TextComponent> {
		this._migrationProgressDetails = this._view.modelBuilder.text()
			.withProps({
				value: constants.STARTING_LOGIN_MIGRATION,
				CSSStyles: {
					...styles.BODY_CSS,
					'width': '660px'
				}
			}).component();
		return this._migrationProgressDetails;
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
					return row[0]?.toLowerCase()?.indexOf(searchText) > -1			// source login
						|| row[1]?.toLowerCase()?.indexOf(searchText) > -1			// login type
						|| row[2]?.toLowerCase()?.indexOf(searchText) > -1  		// default database
						|| row[3]?.title.toLowerCase()?.indexOf(searchText) > -1;	// migration status
				});
		}

		await this._migratingLoginsTable.updateProperty('data', tableRows);
		await this.updateDisplayedLoginCount();
	}

	public async createRootContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		await this._loadMigratingLoginsList(this.migrationStateModel);

		this._progressContainer = this._view.modelBuilder.flexContainer()
			.withLayout({ height: '100%', flexFlow: 'column' })
			.withProps({ CSSStyles: { 'margin-bottom': '10px' } })
			.component();

		this._progressContainer.addItem(this.createMigrationProgressLoader(), { flex: '0 0 auto' });
		this._progressContainer.addItem(await this.createMigrationProgressDetails(), { flex: '0 0 auto' });

		this._loginCount = this._view.modelBuilder.text().withProps({
			value: constants.NUMBER_LOGINS_MIGRATING(this._loginsTableValues.length, this._loginsTableValues.length),
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
					<azdata.HyperlinkColumn>{
						name: constants.LOGIN_MIGRATION_STATUS_COLUMN,
						value: 'migrationStatus',
						width: 200,
						type: azdata.ColumnType.hyperlink,
						icon: IconPathHelper.inProgressMigration,
						showText: true,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
				]
			}).component();

		this._disposables.push(
			this._migratingLoginsTable.onCellAction!(async (rowState: azdata.ICellActionEventArgs) => {
				const buttonState = <azdata.ICellActionEventArgs>rowState;
				switch (buttonState?.column) {
					case 3:
						const loginName = this._migratingLoginsTable!.data[rowState.row][0];
						const status = this._migratingLoginsTable!.data[rowState.row][3].title;
						const statusMessage = constants.DATABASE_MIGRATION_STATUS_LABEL(status);
						var errors = "";

						if (this.migrationStateModel._loginMigrationsResult?.exceptionMap) {
							const exception_key = Object.keys(this.migrationStateModel._loginMigrationsResult.exceptionMap).find(key => key.toLocaleLowerCase() === loginName.toLocaleLowerCase());
							if (exception_key) {
								errors = this.migrationStateModel._loginMigrationsResult.exceptionMap[exception_key][0].Message;
							}
						}

						this.showDialogMessage(
							constants.DATABASE_MIGRATION_STATUS_TITLE,
							statusMessage,
							errors);
						break;
				}
			}));

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
		flex.addItem(this._progressContainer, { flex: '0 0 auto' });
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

			var status = "InProgress";
			var title = "In progress";
			if (stateMachine._didLoginMigrationsSucceed && stateMachine._loginMigrationsResult) {
				status = "Succeeded";
				title = "Succeeded";
				var didLoginFail = Object.keys(stateMachine._loginMigrationsResult.exceptionMap).some(key => key.toLocaleLowerCase() === loginName.toLocaleLowerCase());
				if (didLoginFail) {
					status = "Failed"
					title = "Failed"
				}
			}

			return [
				loginName,
				login.loginType,
				login.defaultDatabaseName,
				<azdata.HyperlinkColumnCellValue>{
					icon: getPipelineStatusImage(status), // TODO AKMA : change to new method
					title: title, // TODO AKMA : Change hardcoding
				},
			];
		}) || [];
	}

	private _getTotalNumberOfLogins(): number {
		return this._loginsTableValues?.length || 0;
	}

	private async updateDisplayedLoginCount() {
		await this._loginCount.updateProperties({
			// 'value': constants.NUMBER_LOGINS_MIGRATING(this._migratingLoginsTable.data?.length || 0)
			'value': constants.NUMBER_LOGINS_MIGRATING(this._getNumberOfDisplayedLogins(), this._getTotalNumberOfLogins())
		});
	}

	private _getNumberOfDisplayedLogins(): number {
		return this._migratingLoginsTable?.data?.length || 0;
	}

	private async _runLoginMigrations(): Promise<Boolean> {
		this._progressLoader.loading = true;

		if (this.migrationStateModel._targetServerInstance) {
			// TODO AKMA : remove debug below and pretty-ify this.migrationStateModel._targetType with proper spacing
			await this._migrationProgress.updateProperties({
				'text': constants.LOGIN_MIGRATIONS_STATUS_PAGE_DESCRIPTION(this._getTotalNumberOfLogins(), this.migrationStateModel._targetType, this.migrationStateModel._targetServerInstance.name)
			});
		}

		await this._migrationProgressDetails.updateProperties({
			'value': constants.STARTING_LOGIN_MIGRATION
		});

		var result = await this.migrationStateModel.migrateLogins();

		await this._migrationProgressDetails.updateProperties({
			'value': constants.ESTABLISHING_USER_MAPPINGS
		});

		result = await this.migrationStateModel.establishUserMappings();

		await this._migrationProgressDetails.updateProperties({
			'value': constants.ESTABLISHING_USER_MAPPINGS
		});

		result = await this.migrationStateModel.migrateServerRolesAndSetPermissions();

		await this._migrationProgressDetails.updateProperties({
			'CSSStyles': { 'display': 'none' },
		});

		if (this.migrationStateModel._targetServerInstance) {
			// TODO AKMA : remove debug below and pretty-ify this.migrationStateModel._targetType with proper spacing
			await this._migrationProgress.updateProperties({
				'text': constants.LOGIN_MIGRATIONS_COMPLETED_STATUS_PAGE_DESCRIPTION(this._getTotalNumberOfLogins(), this.migrationStateModel._targetType, this.migrationStateModel._targetServerInstance.name),
				'style': 'success',
			});
		} else {
			await this._migrationProgress.updateProperties({
				'text': constants.LOGIN_MIGRATIONS_COMPLETE,
				'style': 'success',
			});
		}

		this._progressLoader.loading = false;

		this.wizard.doneButton.enabled = false;
		return result;
	}
}
