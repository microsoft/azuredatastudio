/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { MigrationContext } from '../../models/migrationLocalStorage';
import { MigrationCutoverDialogModel } from './migrationCutoverDialogModel';

export class MigrationCutoverDialog {
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _model: MigrationCutoverDialogModel;

	private _databaseTitleName!: azdata.TextComponent;
	private _databaseCutoverButton!: azdata.ButtonComponent;
	private _refresh!: azdata.ButtonComponent;

	private _serverName!: azdata.TextComponent;
	private _serverVersion!: azdata.TextComponent;
	private _targetServer!: azdata.TextComponent;
	private _targetVersion!: azdata.TextComponent;
	private _migrationStatus!: azdata.TextComponent;
	private _fullBackupFile!: azdata.TextComponent;
	private _lastAppliedLSN!: azdata.TextComponent;
	private _lastAppliedBackupFile!: azdata.TextComponent;
	private _lastAppliedBackupTakenOn!: azdata.TextComponent;

	private _fileCount!: azdata.TextComponent;

	private fileTable!: azdata.TableComponent;

	private _startCutover!: boolean;

	constructor(migration: MigrationContext) {
		this._model = new MigrationCutoverDialogModel(migration);
		this._dialogObject = azdata.window.createModelViewDialog('Migration Cutover', 'MigrationCutoverDialog', 1000);
	}

	async initialize(): Promise<void> {
		let tab = azdata.window.createTab('');
		tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;
			const sourceDetails = this.createInfoField('Source server', '');
			const sourceVersion = this.createInfoField('Source version', '');

			this._serverName = sourceDetails.text;
			this._serverVersion = sourceVersion.text;

			const flexServer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column'
			}).component();

			flexServer.addItem(sourceDetails.flexContainer, {
				CSSStyles: {
					'width': '150px'
				}
			});
			flexServer.addItem(sourceVersion.flexContainer, {
				CSSStyles: {
					'width': '150px'
				}
			});

			const targetServer = this.createInfoField('Target server', '');
			const targetVersion = this.createInfoField('Target version', '');

			this._targetServer = targetServer.text;
			this._targetVersion = targetVersion.text;

			const flexTarget = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column'
			}).component();

			flexTarget.addItem(targetServer.flexContainer, {
				CSSStyles: {
					'width': '230px'
				}
			});
			flexTarget.addItem(targetVersion.flexContainer, {
				CSSStyles: {
					'width': '230px'
				}
			});

			const migrationStatus = this.createInfoField('Migration Status', '');
			const fullBackupFileOn = this.createInfoField('Full backup file(s)', '');


			this._migrationStatus = migrationStatus.text;
			this._fullBackupFile = fullBackupFileOn.text;

			const flexStatus = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column'
			}).component();

			flexStatus.addItem(migrationStatus.flexContainer, {
				CSSStyles: {
					'width': '180px'
				}
			});
			flexStatus.addItem(fullBackupFileOn.flexContainer, {
				CSSStyles: {
					'width': '180px'
				}
			});

			const lastSSN = this.createInfoField('Last applied LSN', '');
			const lastAppliedBackup = this.createInfoField('Last applied backup file(s)', '');
			const lastAppliedBackupOn = this.createInfoField('Last applied backup file(s) taken on', '');

			this._lastAppliedLSN = lastSSN.text;
			this._lastAppliedBackupFile = lastAppliedBackup.text;
			this._lastAppliedBackupTakenOn = lastAppliedBackupOn.text;

			const flexFile = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column'
			}).component();
			flexFile.addItem(lastSSN.flexContainer, {
				CSSStyles: {
					'width': '230px'
				}
			});
			flexFile.addItem(lastAppliedBackup.flexContainer, {
				CSSStyles: {
					'width': '230px'
				}
			});
			flexFile.addItem(lastAppliedBackupOn.flexContainer, {
				CSSStyles: {
					'width': '230px'
				}
			});
			const flexInfo = view.modelBuilder.flexContainer().withProps({
				CSSStyles: {
					'width': '700px'
				}
			}).component();

			flexInfo.addItem(flexServer, {
				flex: '0',
				CSSStyles: {
					'flex': '0',
					'width': '150px'
				}
			});

			flexInfo.addItem(flexTarget, {
				flex: '0',
				CSSStyles: {
					'flex': '0',
					'width': '230px'
				}
			});

			flexInfo.addItem(flexStatus, {
				flex: '0',
				CSSStyles: {
					'flex': '0',
					'width': '180px'
				}
			});

			flexInfo.addItem(flexFile, {
				flex: '0',
				CSSStyles: {
					'flex': '0',
					'width': '200px'
				}
			});

			this._fileCount = view.modelBuilder.text().withProps({
				width: '150px',
				CSSStyles: {
					'width': '150px'
				}
			}).component();

			this.fileTable = view.modelBuilder.table().withProps({
				columns: [
					{
						value: 'Active Backup file(s)',
						width: 150,
						type: azdata.ColumnType.text
					},
					{
						value: 'Type',
						width: 100,
						type: azdata.ColumnType.text
					},
					{
						value: 'Status',
						width: 100,
						type: azdata.ColumnType.text
					},
					{
						value: 'Backup start time',
						width: 150,
						type: azdata.ColumnType.text
					}, {
						value: 'First LSN',
						width: 150,
						type: azdata.ColumnType.text
					}, {
						value: 'Last LSN',
						width: 150,
						type: azdata.ColumnType.text
					}
				],
				data: [],
				width: '800px',
				height: '600px',
			}).component();

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: await this.migrationContainerHeader()
					},
					{
						component: flexInfo
					},
					{
						component: this._fileCount
					},
					{
						component: this.fileTable
					}
				],
				{
					horizontal: false
				}
			);
			const form = formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
		this._dialogObject.content = [tab];
		azdata.window.openDialog(this._dialogObject);
		this.refreshStatus();
	}


	private migrationContainerHeader(): azdata.FlexContainer {
		const header = this._view.modelBuilder.flexContainer().withLayout({
		}).component();

		this._databaseTitleName = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				'font-size': 'large',
				'width': '400px'
			},
			value: this._model._migration.migrationContext.name
		}).component();

		header.addItem(this._databaseTitleName, {
			flex: '0',
			CSSStyles: {
				'width': '500px'
			}
		});

		this._databaseCutoverButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.cutover,
			iconHeight: '14px',
			iconWidth: '12px',
			label: 'Start Cutover',
			height: '55px',
			width: '100px',
			enabled: false
		}).component();

		this._databaseCutoverButton.onDidClick(async (e) => {
			if (this._startCutover) {
				await this._model.startCutover();
				this.refreshStatus();
			} else {
				this._dialogObject.message = {
					text: 'Cannot start the cutover process until all the migrations are done. Click refresh to fetch the latest file status',
					level: azdata.window.MessageLevel.Error
				};
			}
		});

		header.addItem(this._databaseCutoverButton, {
			flex: '0',
			CSSStyles: {
				'width': '100px'
			}
		});

		this._refresh = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: '16px',
			iconWidth: '16px',
			label: 'Refresh',
			height: '55px',
			width: '100px'
		}).component();

		this._refresh.onDidClick((e) => {
			this.refreshStatus();
		});

		header.addItem(this._refresh, {
			flex: '0',
			CSSStyles: {
				'width': '100px'
			}
		});

		return header;
	}


	private async refreshStatus(): Promise<void> {
		await this._model.fetchStatus();
		const sqlServerInfo = await azdata.connection.getServerInfo(this._model._migration.sourceConnectionProfile.connectionId);
		const sqlServerName = this._model._migration.sourceConnectionProfile.serverName;
		const sqlServerVersion = sqlServerInfo.serverVersion;
		const sqlServerEdition = sqlServerInfo.serverEdition;
		const targetServerName = this._model._migration.targetManagedInstance.name;
		let targetServerVersion;
		if (this._model.migrationStatus.id.includes('managedInstances')) {
			targetServerVersion = 'Azure SQL Database Managed Instance';
		} else {
			targetServerVersion = 'Azure SQL Database Virtual Machine';
		}

		const migrationStatusTextValue = this._model.migrationStatus.properties.migrationStatus;

		let fullBackupFileName: string;
		let lastAppliedSSN: string;
		let lastAppliedBackupFileTakenOn: string;


		const tableData: ActiveBackupFileSchema[] = [];

		this._model.migrationStatus.properties.migrationStatusDetails?.activeBackupSets?.forEach((activeBackupSet) => {
			tableData.push(
				{
					fileName: activeBackupSet.listOfBackupFiles[0].fileName,
					type: activeBackupSet.backupType,
					status: activeBackupSet.listOfBackupFiles[0].status,
					backupStartTime: activeBackupSet.backupStartDate,
					firstLSN: activeBackupSet.firstLSN,
					lastLSN: activeBackupSet.lastLSN
				}
			);
			if (activeBackupSet.listOfBackupFiles[0].fileName.substr(activeBackupSet.listOfBackupFiles[0].fileName.lastIndexOf('.') + 1) === 'bak') {
				fullBackupFileName = activeBackupSet.listOfBackupFiles[0].fileName;
			}
			if (activeBackupSet.listOfBackupFiles[0].fileName === this._model.migrationStatus.properties.migrationStatusDetails?.lastRestoredFilename) {
				lastAppliedSSN = activeBackupSet.lastLSN;
				lastAppliedBackupFileTakenOn = activeBackupSet.backupFinishDate;
			}
		});

		this._serverName.value = sqlServerName;
		this._serverVersion.value = `${sqlServerVersion}
		${sqlServerEdition}`;

		this._targetServer.value = targetServerName;
		this._targetVersion.value = targetServerVersion;

		this._migrationStatus.value = migrationStatusTextValue;
		this._fullBackupFile.value = fullBackupFileName!;

		this._lastAppliedLSN.value = lastAppliedSSN!;
		this._lastAppliedBackupFile.value = this._model.migrationStatus.properties.migrationStatusDetails?.lastRestoredFilename;
		this._lastAppliedBackupTakenOn.value = new Date(lastAppliedBackupFileTakenOn!).toLocaleString();

		this._fileCount.value = `Active Backup files (${tableData.length} items)`;

		this.fileTable.data = tableData.map((row) => {
			return [
				row.fileName,
				row.type,
				row.status,
				new Date(row.backupStartTime).toLocaleString(),
				row.firstLSN,
				row.lastLSN
			];
		});
		if (this._model.migrationStatus.properties.migrationStatusDetails?.isFullBackupRestored) {
			this._startCutover = true;
			// for(let i=0; i<tableData.length;i++){
			// 	if(tableData[i].status!=='Restored'){
			// 		this._startCutover = false;
			// 		break;
			// 	}
			// }
		}

		if (migrationStatusTextValue === 'InProgress') {
			this._databaseCutoverButton.enabled = true;
		} else {
			this._databaseCutoverButton.enabled = false;
		}
	}

	private createInfoField(label: string, value: string): {
		flexContainer: azdata.FlexContainer,
		text: azdata.TextComponent
	} {
		const flexContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		const labelComponent = this._view.modelBuilder.text().withProps({
			value: label,
			CSSStyles: {
				'font-weight': 'bold',
				'margin-bottom': '0'
			}
		}).component();
		flexContainer.addItem(labelComponent);

		const textComponent = this._view.modelBuilder.text().withProps({
			value: value,
			CSSStyles: {
				'margin-top': '5px',
				'margin-bottom': '0'
			}
		}).component();
		flexContainer.addItem(textComponent);
		return {
			flexContainer: flexContainer,
			text: textComponent
		};
	}
}

interface ActiveBackupFileSchema {
	fileName: string,
	type: string,
	status: string,
	backupStartTime: string,
	firstLSN: string,
	lastLSN: string
}
