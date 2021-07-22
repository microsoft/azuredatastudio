/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { IconPath, IconPathHelper } from '../constants/iconPathHelper';
import { debounce } from '../api/utils';

const headerLeft: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'left',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
	'border-bottom': '1px solid'
};

const styleLeft: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'left',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
};

const styleCenter: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'center',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
};

export class DatabaseSelectorPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _databaseSelectorTable!: azdata.DeclarativeTableComponent;
	private _dbNames!: string[];
	private _dbCount!: azdata.TextComponent;
	private _databaseTableValues!: azdata.DeclarativeTableCellValue[][];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.SOURCE_CONFIGURATION, 'MigrationModePage'), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		const flex = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			height: '100%',
			width: '100%'
		}).component();
		flex.addItem(await this.createRootContainer(view), { flex: '1 1 auto' });

		await view.initializeModel(flex);
	}

	public async onPageEnter(): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
	}
	public async onPageLeave(): Promise<void> {
		this.migrationStateModel._databaseAssessment = this.selectedDbs();
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

		resourceSearchBox.onTextChanged(value => this._filterTableList(value));

		const searchContainer = this._view.modelBuilder.divContainer().withItems([resourceSearchBox]).withProps({
			CSSStyles: {
				'width': '200px',
				'margin': '10px 8px 0px 0px'
			}
		}).component();

		return searchContainer;
	}

	@debounce(500)
	private _filterTableList(value: string): void {
		if (this._databaseTableValues && value?.length > 0) {
			const filter: number[] = [];
			this._databaseTableValues.forEach((row, index) => {
				const flexContainer: azdata.FlexContainer = row[1]?.value as azdata.FlexContainer;
				const textComponent: azdata.TextComponent = flexContainer.items[1] as azdata.TextComponent;
				const cellText = textComponent.value?.toLowerCase();
				const searchText: string = value.toLowerCase();
				if (cellText?.includes(searchText)) {
					filter.push(index);
				}
			});

			this._databaseSelectorTable.setFilter(filter);
		} else {
			this._databaseSelectorTable.setFilter(undefined);
		}
	}


	public async createRootContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const providerId = (await this.migrationStateModel.getSourceConnectionProfile()).providerId;
		const metaDataService = azdata.dataprotocol.getProvider<azdata.MetadataProvider>(providerId, azdata.DataProviderType.MetadataProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.migrationStateModel.sourceConnectionId);
		const results = <azdata.DatabaseInfo[]>await metaDataService.getDatabases(ownerUri);
		const excludeDbs: string[] = [
			'master',
			'tempdb',
			'msdb',
			'model'
		];
		this._dbNames = [];
		let finalResult = results.filter((db) => !excludeDbs.includes(db.options.name));
		finalResult.sort((a, b) => a.options.name.localeCompare(b.options.name));
		this._databaseTableValues = [];
		for (let index in finalResult) {
			let selectable = true;
			if (constants.OFFLINE_CAPS.includes(finalResult[index].options.state)) {
				selectable = false;
			}
			this._databaseTableValues.push([
				{
					value: false,
					style: styleCenter,
					enabled: selectable
				},
				{
					value: this.createIconTextCell(IconPathHelper.sqlDatabaseLogo, finalResult[index].options.name),
					style: styleLeft
				},
				{
					value: `${finalResult[index].options.state}`,
					style: styleLeft
				},
				{
					value: `${finalResult[index].options.sizeInMB}`,
					style: styleLeft
				},
				{
					value: `${finalResult[index].options.lastBackup}`,
					style: styleLeft
				}
			]);
			this._dbNames.push(finalResult[index].options.name);
		}

		const title = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_FOR_MIGRATION,
			CSSStyles: {
				'font-size': '28px',
				'line-size': '19px',
				'margin': '16px 0px 20px 0px'
			}
		}).component();

		const text = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_MIGRATE_TEXT,
			CSSStyles: {
				'font-size': '13px',
				'line-size': '19px',
				'margin': '10px 0px 0px 0px'
			}
		}).component();

		this._dbCount = this._view.modelBuilder.text().withProps({
			value: constants.DATABASES_SELECTED(this.selectedDbs.length, this._databaseTableValues.length),
			CSSStyles: {
				'font-size': '13px',
				'line-size': '19px',
				'margin': '10px 0px 0px 0px'
			}
		}).component();

		this._databaseSelectorTable = this._view.modelBuilder.declarativeTable().withProps(
			{
				enableRowSelection: true,
				width: '800px',
				CSSStyles: {
					'table-layout': 'fixed',
					'border': 'none'
				},
				columns: [
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.boolean,
						width: 1,
						isReadOnly: false,
						showCheckAll: true,
						headerCssStyles: headerLeft,
					},
					{
						displayName: constants.DATABASE,
						valueType: azdata.DeclarativeDataType.component,
						width: 100,
						isReadOnly: true,
						headerCssStyles: headerLeft
					},
					{
						displayName: constants.STATUS,
						valueType: azdata.DeclarativeDataType.string,
						width: 20,
						isReadOnly: true,
						headerCssStyles: headerLeft
					},
					{
						displayName: constants.SIZE,
						valueType: azdata.DeclarativeDataType.string,
						width: 30,
						isReadOnly: true,
						headerCssStyles: headerLeft
					},
					{
						displayName: constants.LAST_BACKUP,
						valueType: azdata.DeclarativeDataType.string,
						width: 50,
						isReadOnly: true,
						headerCssStyles: headerLeft
					}
				]
			}
		).component();

		await this._databaseSelectorTable.setDataValues(this._databaseTableValues);
		this._databaseSelectorTable.onDataChanged(() => {
			this._dbCount.updateProperties({
				'value': constants.DATABASES_SELECTED(this.selectedDbs().length, this._databaseTableValues.length)
			});
		});
		const flex = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '100%',
			width: '100%'
		}).withProps({
			CSSStyles: {
				'margin': '0px 0px 0px 28px'
			}
		}).component();
		flex.addItem(title, { flex: '0 0 auto' });
		flex.addItem(text, { flex: '0 0 auto' });
		flex.addItem(this.createSearchComponent(), { flex: '0 0 auto' });
		flex.addItem(this._dbCount, { flex: '0 0 auto' });
		flex.addItem(this._databaseSelectorTable);
		return flex;
		// insert names of databases into table
	}

	public selectedDbs(): string[] {
		let result: string[] = [];
		this._databaseSelectorTable.dataValues?.forEach((arr, index) => {
			if (arr[0].value === true) {
				result.push(this._dbNames[index]);
			}
		});
		return result;
	}

	private createIconTextCell(icon: IconPath, text: string): azdata.FlexContainer {

		const iconComponent = this._view.modelBuilder.image().withProps({
			iconPath: icon,
			iconWidth: '16px',
			iconHeight: '16px',
			width: '20px',
			height: '20px'
		}).component();
		const textComponent = this._view.modelBuilder.text().withProps({
			value: text,
			title: text,
			CSSStyles: {
				'margin': '0px',
				'width': '110px'
			}
		}).component();

		const cellContainer = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'justify-content': 'left'
			}
		}).component();
		cellContainer.addItem(iconComponent, {
			flex: '0',
			CSSStyles: {
				'width': '32px'
			}
		});
		cellContainer.addItem(textComponent, {
			CSSStyles: {
				'width': 'auto'
			}
		});

		return cellContainer;
	}

}
