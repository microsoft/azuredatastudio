/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { IconPath, IconPathHelper } from '../constants/iconPathHelper';

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
export class DatabaseSelectorPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _databaseSelectorTable!: azdata.DeclarativeTableComponent;
	private _dbNames!: string[];
	private _dbCount!: azdata.TextComponent;

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


	public async createRootContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const providerId = (await this.migrationStateModel.getSourceConnectionProfile()).providerId;
		const metaDataService = azdata.dataprotocol.getProvider<azdata.MetadataProvider>(providerId, azdata.DataProviderType.MetadataProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.migrationStateModel.sourceConnectionId);
		const results = <azdata.DatabaseInfo[]>await metaDataService.getDatabases(ownerUri);
		// const results = await queryProvider.runQueryAndReturn(await (azdata.connection.getUriForConnection(this.migrationStateModel.sourceConnectionId)), query);
		const excludeDbs: string[] = [
			'master',
			'tempdb',
			'msdb',
			'model'
		];
		this._dbNames = [];
		// need to sort list of dbs alphabetically
		let finalResult = results.filter((db) => !excludeDbs.includes(db.options.name));
		finalResult.sort((a, b) => a.options.name.localeCompare(b.options.name));
		const databasesArray: azdata.DeclarativeTableCellValue[][] = [];
		for (let index in finalResult) {
			databasesArray.push([
				{
					value: false,
					style: styleLeft
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
				'margin': '16px 0px'
			}
		}).component();

		const text = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_MIGRATE_TEXT,
			CSSStyles: {
				'font-size': '13px',
				'line-size': '19px',
				'margin': '0px 0px 0px 0px'
			}
		}).component();

		this._dbCount = this._view.modelBuilder.text().withProps({
			value: constants.DATABASES_SELECTED(this.selectedDbs.length, databasesArray.length),
			CSSStyles: {
				'font-size': '13px',
				'line-size': '19px',
				'margin': '0px 0px 0px 0px'
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
						width: 10,
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

		this._databaseSelectorTable.dataValues = databasesArray;
		this._databaseSelectorTable.onDataChanged(() => {
			this._dbCount.updateProperties({
				'value': constants.DATABASES_SELECTED(this.selectedDbs().length, databasesArray.length)
			});
		});
		const flex = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '100%',
			width: '100%'
		}).component();
		flex.addItem(title, { flex: '0 0 auto' });
		flex.addItem(text, { flex: '0 0 auto' });
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
