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
export class SourceConfigurationPage extends MigrationWizardPage {
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
		const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>((await this.migrationStateModel.getSourceConnectionProfile()).providerId, azdata.DataProviderType.QueryProvider);
		const query =
			`IF OBJECT_ID('tempdb.dbo.#space') IS NOT NULL
		DROP TABLE #space

		CREATE TABLE #space (
			database_id INT PRIMARY KEY
			, data_used_size DECIMAL(18,2)
			, log_used_size DECIMAL(18,2)
		)

		DECLARE @SQL NVARCHAR(MAX)

		SELECT @SQL = STUFF((
			SELECT '
			USE [' + d.name + ']
			INSERT INTO #space (database_id, data_used_size, log_used_size)
			SELECT
				DB_ID()
				, SUM(CASE WHEN [type] = 0 THEN space_used END)
				, SUM(CASE WHEN [type] = 1 THEN space_used END)
			FROM (
				SELECT s.[type], space_used = SUM(FILEPROPERTY(s.name, ''SpaceUsed'') * 8. / 1024)
				FROM sys.database_files s
				GROUP BY s.[type]
			) t;'
			FROM sys.databases d
			WHERE d.[state] = 0
			FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '')

		EXEC sys.sp_executesql @SQL

		SELECT
			d.database_id
			, d.name
			, d.state_desc
			, t.total_size
			, bu.full_last_date
		FROM (
			SELECT
				database_id
				, log_size = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. / 1024 AS DECIMAL(18,2))
				, data_size = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. / 1024 AS DECIMAL(18,2))
				, total_size = CAST(SUM(size) * 8. / 1024 AS DECIMAL(18,2))
			FROM sys.master_files
			GROUP BY database_id
		) t
		JOIN sys.databases d ON d.database_id = t.database_id
		LEFT JOIN #space s ON d.database_id = s.database_id
		LEFT JOIN (
			SELECT
				database_name
				, full_last_date = MAX(CASE WHEN [type] = 'D' THEN backup_finish_date END)
				, full_size = MAX(CASE WHEN [type] = 'D' THEN backup_size END)
				, log_last_date = MAX(CASE WHEN [type] = 'L' THEN backup_finish_date END)
				, log_size = MAX(CASE WHEN [type] = 'L' THEN backup_size END)
			FROM (
				SELECT
					s.database_name
					, s.[type]
					, s.backup_finish_date
					, backup_size =
								CAST(CASE WHEN s.backup_size = s.compressed_backup_size
											THEN s.backup_size
											ELSE s.compressed_backup_size
								END / 1048576.0 AS DECIMAL(18,2))
					, RowNum = ROW_NUMBER() OVER (PARTITION BY s.database_name, s.[type] ORDER BY s.backup_finish_date DESC)
				FROM msdb.dbo.backupset s
				WHERE s.[type] IN ('D', 'L')
			) f
			WHERE f.RowNum = 1
			GROUP BY f.database_name
		) bu ON d.name = bu.database_name
		ORDER BY t.total_size DESC`;
		const results = await queryProvider.runQueryAndReturn(await (azdata.connection.getUriForConnection(this.migrationStateModel.sourceConnectionId)), query);
		const excludeDbs: string[] = [
			'master',
			'tempdb',
			'msdb',
			'model'
		];
		let finalResult = results.rows.filter((name) => !excludeDbs.includes(name[1].displayValue));
		// need to sort list of dbs alphabetically
		finalResult.sort((a, b) => a[1].displayValue.localeCompare(b[1].displayValue));
		const databasesArray: azdata.DeclarativeTableCellValue[][] = [];
		for (let index in finalResult) {
			databasesArray.push([
				{
					value: false,
					style: styleLeft
				},
				{
					value: this.createIconTextCell(IconPathHelper.sqlDatabaseLogo, finalResult[index][1].displayValue),
					style: styleLeft
				},
				{
					value: `${finalResult[index][2].displayValue}`,
					style: styleLeft
				},
				{
					value: `${finalResult[index][3].displayValue}`,
					style: styleLeft
				},
				{
					value: `${finalResult[index][4].displayValue}`,
					style: styleLeft
				}
			]);
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
				result.push(arr[1].value.toString());
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
