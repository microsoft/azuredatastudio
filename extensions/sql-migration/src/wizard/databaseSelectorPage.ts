/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { IconPath, IconPathHelper } from '../constants/iconPathHelper';
import { debounce } from '../api/utils';

const styleLeft: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'left',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
	'box-shadow': '0px -1px 0px 0px rgba(243, 242, 241, 1) inset'
};

const styleCheckBox: azdata.CssStyles = {
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
	'box-shadow': '0px -1px 0px 0px rgba(243, 242, 241, 1) inset'
};

export class DatabaseSelectorPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _databaseSelectorTable!: azdata.DeclarativeTableComponent;
	private _dbNames!: string[];
	private _dbCount!: azdata.TextComponent;
	private _databaseTableValues!: azdata.DeclarativeTableCellValue[][];
	private _disposables: vscode.Disposable[] = [];

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
		const assessedDatabases = this.migrationStateModel._databaseAssessment ?? [];
		const selectedDatabases = this.selectedDbs();
		// run assessment if
		// * the prior assessment had an error or
		// * the assessed databases list is different from the selected databases list
		this.migrationStateModel._runAssessments = !!this.migrationStateModel._assessmentResults?.assessmentError
			|| assessedDatabases.length === 0
			|| assessedDatabases.length !== selectedDatabases.length
			|| assessedDatabases.some(db => selectedDatabases.indexOf(db) < 0);

		this.migrationStateModel._databaseAssessment = selectedDatabases;
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
					style: styleCheckBox,
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
					style: styleRight
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
				width: '100%',
				CSSStyles: {
					'border': 'none'
				},
				columns: [
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.boolean,
						width: 20,
						isReadOnly: false,
						showCheckAll: true,
						headerCssStyles: styleCheckBox
					},
					{
						displayName: constants.DATABASE,
						// undo when bug #16445 is fixed
						// valueType: azdata.DeclarativeDataType.component,
						valueType: azdata.DeclarativeDataType.string,
						width: '100%',
						isReadOnly: true,
						headerCssStyles: styleLeft
					},
					{
						displayName: constants.STATUS,
						valueType: azdata.DeclarativeDataType.string,
						width: 100,
						isReadOnly: true,
						headerCssStyles: styleLeft
					},
					{
						displayName: constants.SIZE,
						valueType: azdata.DeclarativeDataType.string,
						width: 125,
						isReadOnly: true,
						headerCssStyles: styleRight
					},
					{
						displayName: constants.LAST_BACKUP,
						valueType: azdata.DeclarativeDataType.string,
						width: 150,
						isReadOnly: true,
						headerCssStyles: styleLeft
					}
				]
			}
		).component();

		await this._databaseSelectorTable.setDataValues(this._databaseTableValues);
		this._disposables.push(this._databaseSelectorTable.onDataChanged(() => {
			this._dbCount.updateProperties({
				'value': constants.DATABASES_SELECTED(this.selectedDbs().length, this._databaseTableValues.length)
			});
		}));
		const flex = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '100%',
		}).withProps({
			CSSStyles: {
				'margin': '0px  28px 0px 28px'
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

	// undo when bug #16445 is fixed
	private createIconTextCell(icon: IconPath, text: string): string {
		return text;
	}
	// private createIconTextCell(icon: IconPath, text: string): azdata.FlexContainer {
	// 	const cellContainer = this._view.modelBuilder.flexContainer().withProps({
	// 		CSSStyles: {
	// 			'justify-content': 'left'
	// 		}
	// 	}).component();

	// 	const iconComponent = this._view.modelBuilder.image().withProps({
	// 		iconPath: icon,
	// 		iconWidth: '16px',
	// 		iconHeight: '16px',
	// 		width: '20px',
	// 		height: '20px'
	// 	}).component();
	// 	cellContainer.addItem(iconComponent, {
	// 		flex: '0',
	// 		CSSStyles: {
	// 			'width': '32px'
	// 		}
	// 	});

	// 	const textComponent = this._view.modelBuilder.text().withProps({
	// 		value: text,
	// 		title: text,
	// 		CSSStyles: {
	// 			'margin': '0px',
	// 			'width': '110px'
	// 		}
	// 	}).component();

	// 	cellContainer.addItem(textComponent, {
	// 		CSSStyles: {
	// 			'width': 'auto'
	// 		}
	// 	});

	// 	return cellContainer;
	// }
	// undo when bug #16445 is fixed

}
