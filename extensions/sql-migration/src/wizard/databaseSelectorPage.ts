/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { EOL } from 'os';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { debounce, promptUserForFolder } from '../api/utils';
import * as styles from '../constants/styles';
import { IconPathHelper } from '../constants/iconPathHelper';
import { getDatabasesList, excludeDatabases, SourceDatabaseInfo, getSourceConnectionProfile } from '../api/sqlUtils';
import { WizardController } from './wizardController';
import { SourceSelectionSection } from './sourceSelectionSection';


export class DatabaseSelectorPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _sourceSelectionSection!: azdata.Component;
	private _databaseSelectorTable!: azdata.TableComponent;
	private _xEventsGroup!: azdata.GroupContainer;
	private _xEventsFolderPickerInput!: azdata.InputBoxComponent;
	private _xEventsFilesFolderPath: string = '';
	private _dbNames!: string[];
	private _dbCount!: azdata.TextComponent;
	private _databaseTableValues!: any[];
	private _disposables: vscode.Disposable[] = [];
	private _enableNavigationValidation: boolean = true;
	private _adhocQueryCollectionCheckbox!: azdata.CheckBoxComponent;
	private _sourceSelection;

	private readonly TABLE_WIDTH = 650;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel, private wizardController: WizardController) {
		super(wizard, azdata.window.createWizardPage(constants.DATABASE_FOR_ASSESSMENT_PAGE_TITLE), migrationStateModel);
		this._sourceSelection = new SourceSelectionSection(wizard, migrationStateModel);
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
		await this._sourceSelection.populateAzureAccountsDropdown();
		await this._sourceSelection.populateSubscriptionDropdown();
		await this._sourceSelection.populateLocationDropdown();
		await this._sourceSelection.populateResourceGroupDropdown();
	}

	public async onPageEnter(): Promise<void> {
		this.wizardController.cancelReasonsList([
			constants.WIZARD_CANCEL_REASON_CONTINUE_WITH_MIGRATION_LATER,
			constants.WIZARD_CANCEL_REASON_CHANGE_SOURCE_SQL_SERVER
		]);

		this.wizard.registerNavigationValidator(async (pageChangeInfo) => {
			this.wizard.message = {
				text: '',
				level: azdata.window.MessageLevel.Error
			};
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			if (!this._enableNavigationValidation) {
				this._enableNavigationValidation = true;
				return true;
			}

			const errors: string[] = [];
			if (this.selectedDbs().length === 0) {
				errors.push(constants.SELECT_DATABASE_TO_CONTINUE);
			}

			if (this.migrationStateModel._isSqlServerEnabledByArc || this.migrationStateModel._trackMigration) {
				if (!this.migrationStateModel._azureAccount) {
					errors.push(constants.INVALID_ACCOUNT_ERROR);
				}

				if (!this.migrationStateModel._arcResourceSubscription ||
					(<azdata.CategoryValue>this._sourceSelection._azureSubscriptionDropdown.value)?.displayName === constants.NO_SUBSCRIPTIONS_FOUND) {
					errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
				}
				if (!this.migrationStateModel._arcResourceLocation ||
					(<azdata.CategoryValue>this._sourceSelection._azureLocationDropdown.value)?.displayName === constants.NO_LOCATION_FOUND) {
					errors.push(constants.INVALID_LOCATION_ERROR);
				}
				if (!this.migrationStateModel._arcResourceResourceGroup ||
					(<azdata.CategoryValue>this._sourceSelection._azureResourceGroupDropdown.value)?.displayName === constants.RESOURCE_GROUP_NOT_FOUND) {
					errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
				}

				if (!this.migrationStateModel._isSqlServerEnabledByArc && !this.migrationStateModel._sourceInfrastructureType) {
					errors.push(constants.INVALID_SOURCE_INFRASTRUCTURE_TYPE_ERROR);
				}

				if (this.migrationStateModel._isSqlServerEnabledByArc && (!this.migrationStateModel._arcSqlServer ||
					(<azdata.CategoryValue>this._sourceSelection._azureArcSqlServerDropdown.value)?.displayName === constants.SQL_SERVER_INSTANCE_NOT_FOUND)) {
					errors.push(constants.INVALID_SQL_SERVER_INSTANCE_ERROR);
				}
			}

			if (errors.length > 0) {
				this.wizard.message = {
					text: errors.join(EOL),
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}

			if (!this.migrationStateModel._isSqlServerEnabledByArc) {
				const fullInstanceName = await this.migrationStateModel.getFullArcInstanceName();
				const getArcSqlServerResponse = await this.migrationStateModel.getArcSqlServerInstance(fullInstanceName);
				if (this.migrationStateModel._arcSqlServer) {
					if (getArcSqlServerResponse?.arcSqlServer.properties?.hostType !== this.migrationStateModel._sourceInfrastructureType) {
						await this.migrationStateModel.createOrUpdateArcSqlServerInstance(fullInstanceName);
					}
				} else {
					if (getArcSqlServerResponse?.status === 200) {
						if (getArcSqlServerResponse?.arcSqlServer.location !== this.migrationStateModel._arcResourceLocation.name) {
							this.wizard.message = {
								text: constants.SQL_SERVER_INSTANCE_EXISTS_IN_LOCATION(getArcSqlServerResponse.arcSqlServer.location),
								level: azdata.window.MessageLevel.Error
							};
						} else {
							this.wizard.message = {
								text: constants.SQL_SERVER_INSTANCE_EXISTS,
								level: azdata.window.MessageLevel.Error
							};
						}
						return false;
					} else {
						await this.migrationStateModel.registerArcResourceProvider();
						if (this.migrationStateModel._arcRpRegistrationStatus === 200) {
							await this.migrationStateModel.createOrUpdateArcSqlServerInstance(fullInstanceName);
						}
					}
				}
			}

			return true;
		});

		if (this.migrationStateModel.resumeAssessment || this.migrationStateModel.restartMigration) {
			// if start a new session, it won't trigger navigation validator until clicking 'Next'.
			// It works as expected if no target or databases are selected, it should show errors and block to next page.
			// However, if resume the previously saved session or restart migration, wizard.setCurrentPage will trigger wizard navigation validator without clicking 'Next'.
			// At this moment, all components are not initialized yet. Therefore, _databaseSelectorTable is undefined, so selectedDbs().length is always 0.
			this._enableNavigationValidation = false;
		}

		this._xEventsFilesFolderPath = this.migrationStateModel._xEventsFilesFolderPath;
		this._adhocQueryCollectionCheckbox.checked = this.migrationStateModel._collectAdhocQueries;
	}

	public async onPageLeave(): Promise<void> {
		this.wizard.registerNavigationValidator(pageChangeInfo => true);
		this.wizard.message = { text: '' };

		const assessedDatabases = this.migrationStateModel._assessedDatabaseList ?? [];
		const selectedDatabases = this.migrationStateModel._databasesForAssessment;
		// run assessment if
		// * no prior assessment
		// * the prior assessment had an error or
		// * the assessed databases list is different from the selected databases list
		// * the XEvents path has changed
		this.migrationStateModel._runAssessments = !this.migrationStateModel._assessmentResults
			|| !!this.migrationStateModel._assessmentResults?.assessmentError
			|| assessedDatabases.length === 0
			|| assessedDatabases.length !== selectedDatabases.length
			|| assessedDatabases.some(db => selectedDatabases.indexOf(db) < 0)
			|| this.migrationStateModel._xEventsFilesFolderPath.toLowerCase() !== this._xEventsFilesFolderPath.toLowerCase();

		this.migrationStateModel._xEventsFilesFolderPath = this._xEventsFilesFolderPath;
		this.migrationStateModel._collectAdhocQueries = this._adhocQueryCollectionCheckbox.checked ?? false;
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
						|| row[4]?.toLowerCase()?.indexOf(searchText) > -1; // size
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
		this._sourceSelectionSection = await this._sourceSelection.createSourceSelectionContainer(this._view);

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
				width: this.TABLE_WIDTH,
				height: '100%',
				CSSStyles: { 'margin-bottom': '12px' },
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
				]
			}).component();

		this._disposables.push(
			this._databaseSelectorTable.onRowSelected(
				async (e) => await this.updateValuesOnSelection()));

		// load unfiltered table list and pre-select list of databases saved in state
		await this._filterTableList('', this.migrationStateModel._databasesForAssessment);

		const xEventsDescription = this._view.modelBuilder.text()
			.withProps({
				value: constants.XEVENTS_ASSESSMENT_DESCRIPTION,
				width: this.TABLE_WIDTH,
				CSSStyles: { ...styles.BODY_CSS },
				links: [{ text: constants.XEVENTS_ASSESSMENT_HELPLINK, url: 'https://aka.ms/sql-migration-xe-assess' }]
			}).component();

		const xEventsInstructions = this._view.modelBuilder.text()
			.withProps({
				value: constants.XEVENTS_ASSESSMENT_OPEN_FOLDER,
				width: this.TABLE_WIDTH,
				CSSStyles: { ...styles.LABEL_CSS },
			}).component();

		this._xEventsFolderPickerInput = this._view.modelBuilder.inputBox()
			.withProps({
				placeHolder: constants.FOLDER_NAME,
				readOnly: true,
				width: 460,
				ariaLabel: constants.XEVENTS_ASSESSMENT_OPEN_FOLDER
			}).component();
		this._disposables.push(
			this._xEventsFolderPickerInput.onTextChanged(async (value) => {
				if (value) {
					this._xEventsFilesFolderPath = value.trim();
				}
			}));

		const xEventsFolderPickerButton = this._view.modelBuilder.button()
			.withProps({
				label: constants.OPEN,
				width: 80,
			}).component();
		this._disposables.push(
			xEventsFolderPickerButton.onDidClick(
				async () => this._xEventsFolderPickerInput.value = await promptUserForFolder()));

		const xEventsFolderPickerClearButton = this._view.modelBuilder.button()
			.withProps({
				label: constants.CLEAR,
				width: 80,
			}).component();
		this._disposables.push(
			xEventsFolderPickerClearButton.onDidClick(
				async () => {
					this._xEventsFolderPickerInput.value = '';
					this._xEventsFilesFolderPath = '';
				}));

		const xEventsFolderPickerContainer = this._view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: { 'flex-direction': 'row', 'align-items': 'left' }
			}).withItems([
				this._xEventsFolderPickerInput,
				xEventsFolderPickerButton,
				xEventsFolderPickerClearButton
			]).component();

		this._adhocQueryCollectionCheckbox = this._view.modelBuilder.checkBox().withProps({
			label: constants.QDS_ASSESSMENT_LABEL,
			checked: false,
			CSSStyles: { ...styles.BODY_CSS, 'margin-bottom': '8px' }
		}).component();


		this._xEventsGroup = this._view.modelBuilder.groupContainer()
			.withLayout({
				header: constants.XEVENTS_ASSESSMENT_TITLE,
				collapsible: true,
				collapsed: true
			}).withItems([
				xEventsDescription,
				// TODO: enable when qds is supported
				//this._adhocQueryCollectionCheckbox,
				//xEventCheckBox,
				xEventsInstructions,
				xEventsFolderPickerContainer
			]).component();

		const flex = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '65%',
		}).withProps({
			CSSStyles: {
				'margin': '0px 28px 0px 28px'
			}
		}).component();

		flex.addItem(this._sourceSelectionSection, { flex: '0 0 auto' });
		flex.addItem(text, { flex: '0 0 auto' });
		flex.addItem(this.createSearchComponent(), { flex: '0 0 auto' });
		flex.addItem(this._dbCount, { flex: '0 0 auto' });
		flex.addItem(this._databaseSelectorTable);
		flex.addItem(this._xEventsGroup, { flex: '0 0 auto' });

		return flex;
	}

	private async _loadDatabaseList(stateMachine: MigrationStateModel, selectedDatabases: string[]): Promise<void> {
		const allDatabases = (<azdata.DatabaseInfo[]>await getDatabasesList(await getSourceConnectionProfile()));

		const databaseList = allDatabases
			.filter(database => !excludeDatabases.includes(database.options.name))
			|| [];

		databaseList.sort((a, b) => a.options.name.localeCompare(b.options.name));
		this._dbNames = [];
		stateMachine._databaseInfosForMigration = [];

		this._databaseTableValues = databaseList.map(database => {
			const databaseName = database.options.name;
			this._dbNames.push(databaseName);
			const sourceDatabaseInfo = this.getSourceDatabaseInfo(database);
			stateMachine._databaseInfosForMigration.push(sourceDatabaseInfo);
			stateMachine._databaseInfosForMigrationMap.set(databaseName, sourceDatabaseInfo);
			return [
				selectedDatabases?.indexOf(databaseName) > -1,
				<azdata.IconColumnCellValue>{
					icon: IconPathHelper.sqlDatabaseLogo,
					title: databaseName,
				},
				databaseName,
				database.options.state,
				database.options.sizeInMB,
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

	private getSourceDatabaseInfo(database: azdata.DatabaseInfo): SourceDatabaseInfo {
		return {
			databaseName: database.options.name,
			databaseCollation: database.options.collation,
			databaseSizeInMB: database.options.sizeInMB,
			databaseState: database.options.state
		};
	}
}
