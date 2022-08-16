/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationMode, MigrationStateModel, MigrationTargetType, NetworkContainerType } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { formatNumber } from '../../constants/helper';

export class TargetDatabaseSummaryDialog {
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _tableLength: number;

	constructor(private _model: MigrationStateModel) {
		let dialogWidth: azdata.window.DialogWidth;
		if (this._model._databaseBackup.networkContainerType === NetworkContainerType.BLOB_CONTAINER) {
			this._tableLength = 800;
			dialogWidth = 900;
		} else {
			this._tableLength = 700;
			dialogWidth = 'medium';
		}
		this._dialogObject = azdata.window.createModelViewDialog(
			constants.DATABASE_TO_BE_MIGRATED,
			'TargetDatabaseSummaryDialog',
			dialogWidth);
	}

	async initialize(): Promise<void> {
		const tab = azdata.window.createTab('sql.migration.CreateResourceGroupDialog');
		tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;

			const isSqlDbMigration = this._model._targetType === MigrationTargetType.SQLDB;
			const databaseCount = this._view.modelBuilder.text()
				.withProps({
					value: constants.COUNT_DATABASES(this._model._databasesForMigration.length),
					CSSStyles: { ...styles.BODY_CSS, 'margin-bottom': '20px' }
				}).component();

			const headerCssStyle = {
				'border': 'none',
				'text-align': 'left',
				'white-space': 'nowrap',
				'text-overflow': 'ellipsis',
				'overflow': 'hidden',
				'border-bottom': '1px solid'
			};

			const rowCssStyle = {
				'border': 'none',
				'text-align': 'left',
				'white-space': 'nowrap',
				'text-overflow': 'ellipsis',
				'overflow': 'hidden',
			};

			const columnWidth = 150;

			const columns: azdata.DeclarativeTableColumn[] = [
				{
					valueType: azdata.DeclarativeDataType.string,
					displayName: constants.SOURCE_DATABASE,
					isReadOnly: true,
					width: columnWidth,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyle
				},
				{
					valueType: azdata.DeclarativeDataType.string,
					displayName: constants.TARGET_DATABASE_NAME,
					isReadOnly: true,
					width: columnWidth,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyle
				}];

			if (this._model._databaseBackup.networkContainerType === NetworkContainerType.BLOB_CONTAINER) {
				columns.push(
					{
						valueType: azdata.DeclarativeDataType.string,
						displayName: constants.LOCATION,
						isReadOnly: true,
						width: columnWidth,
						rowCssStyles: rowCssStyle,
						headerCssStyles: headerCssStyle
					},
					{
						valueType: azdata.DeclarativeDataType.string,
						displayName: constants.RESOURCE_GROUP,
						isReadOnly: true,
						width: columnWidth,
						rowCssStyles: rowCssStyle,
						headerCssStyles: headerCssStyle
					},
					{
						valueType: azdata.DeclarativeDataType.string,
						displayName: constants.SUMMARY_AZURE_STORAGE,
						isReadOnly: true,
						width: columnWidth,
						rowCssStyles: rowCssStyle,
						headerCssStyles: headerCssStyle
					},
					{
						valueType: azdata.DeclarativeDataType.string,
						displayName: constants.BLOB_CONTAINER,
						isReadOnly: true,
						width: columnWidth,
						rowCssStyles: rowCssStyle,
						headerCssStyles: headerCssStyle
					},
					{
						valueType: azdata.DeclarativeDataType.string,
						displayName: constants.BLOB_CONTAINER_LAST_BACKUP_FILE,
						isReadOnly: true,
						width: columnWidth,
						rowCssStyles: rowCssStyle,
						headerCssStyles: headerCssStyle,
						hidden: this._model._databaseBackup.migrationMode === MigrationMode.ONLINE
					});
			} else if (isSqlDbMigration) {
				columns.push({
					valueType: azdata.DeclarativeDataType.string,
					displayName: constants.TARGET_TABLE_COUNT_NAME,
					isReadOnly: true,
					width: columnWidth,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyle
				});
			} else {
				columns.push({
					valueType: azdata.DeclarativeDataType.string,
					displayName: constants.NETWORK_SHARE_PATH,
					isReadOnly: true,
					width: columnWidth,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyle
				});
			}

			const tableRows: azdata.DeclarativeTableCellValue[][] = [];

			this._model._databasesForMigration.forEach((db, index) => {
				const tableRow: azdata.DeclarativeTableCellValue[] = [];
				tableRow.push(
					{ value: db },
					{
						value: isSqlDbMigration
							? this._model._sourceTargetMapping.get(db)?.databaseName ?? this._model._targetDatabaseNames[index]
							: this._model._targetDatabaseNames[index]
					});

				if (this._model._databaseBackup.networkContainerType === NetworkContainerType.BLOB_CONTAINER) {
					tableRow.push(
						{ value: this._model._databaseBackup.blobs[index].storageAccount.location },
						{ value: this._model._databaseBackup.blobs[index].storageAccount.resourceGroup! },
						{ value: this._model._databaseBackup.blobs[index].storageAccount.name },
						{ value: this._model._databaseBackup.blobs[index].blobContainer.name });

					if (this._model._databaseBackup.migrationMode === MigrationMode.OFFLINE) {
						tableRow.push(
							{ value: this._model._databaseBackup.blobs[index].lastBackupFile! });
					}
				} else if (isSqlDbMigration) {
					tableRow.push(
						{ value: formatNumber(this._model._sourceTargetMapping.get(db)?.targetTables.size ?? 0) });
				} else {
					tableRow.push(
						{ value: this._model._databaseBackup.networkShares[index].networkShareLocation });
				}
				tableRows.push(tableRow);
			});

			const databaseTable: azdata.DeclarativeTableComponent = this._view.modelBuilder.declarativeTable()
				.withProps({
					ariaLabel: constants.DATABASE_TO_BE_MIGRATED,
					columns: columns,
					dataValues: tableRows,
					width: this._tableLength
				}).component();

			const container = this._view.modelBuilder.flexContainer()
				.withLayout({ flexFlow: 'column' })
				.withItems([databaseCount, databaseTable])
				.component();
			const form = this._view.modelBuilder.formContainer()
				.withFormItems(
					[{ component: container }],
					{ horizontal: false })
				.withLayout({ width: '100%' })
				.component();

			return view.initializeModel(form);
		});
		this._dialogObject.content = [tab];
		azdata.window.openDialog(this._dialogObject);
	}
}
