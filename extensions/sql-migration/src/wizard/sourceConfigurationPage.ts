/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';

const headerLeft: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'left',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
	'border-bottom': '1px solid'
};

export class SourceConfigurationPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _databaseSelectorTable!: azdata.DeclarativeTableComponent;

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
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	public createRootContainer(view: azdata.ModelView): azdata.FlexContainer {
		// build table of databases here

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

		const databases = this.migrationStateModel.getDatabases();
		this._databaseSelectorTable = this._view.modelBuilder.declarativeTable().withProps(
			{
				enableRowSelection: true,
				width: '200px',
				CSSStyles: {
					'table-layout': 'fixed'
				},
				columns: [
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.boolean,
						width: 20,
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
						width: 30,
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
						width: 30,
						isReadOnly: true,
						headerCssStyles: headerLeft
					}
				]
			}
		).component();
		const flex = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '100%',
			width: '100%'
		}).component();
		flex.addItem(title, { flex: '0 0 auto' });
		flex.addItem(text, { flex: '0 0 auto' });
		flex.addItem(this._databaseSelectorTable);
		return flex;
	}

}
