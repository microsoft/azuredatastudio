/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { MigrationContext } from '../../models/migrationLocalStorage';
import { MigrationCutoverDialogModel } from './migrationCutoverDialogModel';
import * as loc from '../../constants/strings';
import { getSqlServerName } from '../../api/utils';
import { EOL } from 'os';
export class MigrationCutoverDialog {
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _model: MigrationCutoverDialogModel;

	private _databaseTitleName!: azdata.TextComponent;
	private _cutoverButton!: azdata.ButtonComponent;
	private _refreshButton!: azdata.ButtonComponent;
	private _cancelButton!: azdata.ButtonComponent;
	private _refreshLoader!: azdata.LoadingComponent;

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
		this._dialogObject = azdata.window.createModelViewDialog(loc.MIGRATION_CUTOVER, 'MigrationCutoverDialog', 1000);
	}

	async initialize(): Promise<void> {
		let tab = azdata.window.createTab('');
		tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;
			const sourceDetails = this.createInfoField(loc.SOURCE_SERVER, '');
			const sourceVersion = this.createInfoField(loc.SOURCE_VERSION, '');

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

			const targetServer = this.createInfoField(loc.TARGET_SERVER, '');
			const targetVersion = this.createInfoField(loc.TARGET_VERSION, '');

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

			const migrationStatus = this.createInfoField(loc.MIGRATION_STATUS, '');
			const fullBackupFileOn = this.createInfoField(loc.FULL_BACKUP_FILES, '');


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

			const lastSSN = this.createInfoField(loc.LAST_APPLIED_LSN, '');
			const lastAppliedBackup = this.createInfoField(loc.LAST_APPLIED_BACKUP_FILES, '');
			const lastAppliedBackupOn = this.createInfoField(loc.LAST_APPLIED_BACKUP_FILES_TAKEN_ON, '');

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
				width: '500px',
				CSSStyles: {
					'font-size': '14px',
					'font-weight': 'bold'
				}
			}).component();

			this.fileTable = view.modelBuilder.table().withProps({
				columns: [
					{
						value: loc.ACTIVE_BACKUP_FILES,
						width: 280,
						type: azdata.ColumnType.text
					},
					{
						value: loc.TYPE,
						width: 90,
						type: azdata.ColumnType.text
					},
					{
						value: loc.STATUS,
						width: 60,
						type: azdata.ColumnType.text
					},
					{
						value: loc.BACKUP_START_TIME,
						width: 130,
						type: azdata.ColumnType.text
					}, {
						value: loc.FIRST_LSN,
						width: 120,
						type: azdata.ColumnType.text
					}, {
						value: loc.LAST_LSN,
						width: 120,
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
			return view.initializeModel(form).then((value) => {
				this.refreshStatus();
			});
		});
		this._dialogObject.content = [tab];
		azdata.window.openDialog(this._dialogObject);
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

		this._cutoverButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.cutover,
			iconHeight: '14px',
			iconWidth: '12px',
			label: 'Start Cutover',
			height: '55px',
			width: '100px',
			enabled: false
		}).component();

		this._cutoverButton.onDidClick(async (e) => {
			if (this._startCutover) {
				await this._model.startCutover();
				this.refreshStatus();
			} else {
				this._dialogObject.message = {
					text: loc.CANNOT_START_CUTOVER_ERROR,
					level: azdata.window.MessageLevel.Error
				};
			}
		});

		header.addItem(this._cutoverButton, {
			flex: '0',
			CSSStyles: {
				'width': '100px'
			}
		});

		this._cancelButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.discard,
			iconHeight: '16px',
			iconWidth: '16px',
			label: loc.CANCEL_MIGRATION,
			height: '55px',
			width: '130px'
		}).component();

		this._cancelButton.onDidClick((e) => {
			this.cancelMigration();
		});

		header.addItem(this._cancelButton, {
			flex: '0',
			CSSStyles: {
				'width': '130px'
			}
		});


		this._refreshButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: '16px',
			iconWidth: '16px',
			label: 'Refresh',
			height: '55px',
			width: '100px'
		}).component();

		this._refreshButton.onDidClick((e) => {
			this.refreshStatus();
		});

		header.addItem(this._refreshButton, {
			flex: '0',
			CSSStyles: {
				'width': '100px'
			}
		});

		this._refreshLoader = this._view.modelBuilder.loadingComponent().withProps({
			loading: false,
			height: '55px'
		}).component();

		header.addItem(this._refreshLoader, {
			flex: '0'
		});
		return header;
	}


	private async refreshStatus(): Promise<void> {
		try {
			this._refreshLoader.loading = true;
			this._cutoverButton.enabled = false;
			this._cancelButton.enabled = false;
			await this._model.fetchStatus();
			const errors = [];
			errors.push(this._model.migrationStatus.properties.migrationFailureError?.message);
			errors.push(this._model.migrationStatus.properties.migrationStatusDetails?.fileUploadBlockingErrors ?? []);
			errors.push(this._model.migrationStatus.properties.migrationStatusDetails?.restoreBlockingReason);
			this._dialogObject.message = {
				text: errors.filter(e => e !== undefined).join(EOL)
			};
			const sqlServerInfo = await azdata.connection.getServerInfo(this._model._migration.sourceConnectionProfile.connectionId);
			const sqlServerName = this._model._migration.sourceConnectionProfile.serverName;
			const versionName = getSqlServerName(sqlServerInfo.serverMajorVersion!);
			const sqlServerVersion = versionName ? versionName : sqlServerInfo.serverVersion;
			const targetServerName = this._model._migration.targetManagedInstance.name;
			let targetServerVersion;
			if (this._model.migrationStatus.id.includes('managedInstances')) {
				targetServerVersion = loc.AZURE_SQL_DATABASE_MANAGED_INSTANCE;
			} else {
				targetServerVersion = loc.AZURE_SQL_DATABASE_VIRTUAL_MACHINE;
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
			${sqlServerInfo.serverVersion}`;

			this._targetServer.value = targetServerName;
			this._targetVersion.value = targetServerVersion;

			this._migrationStatus.value = migrationStatusTextValue;
			this._fullBackupFile.value = fullBackupFileName!;

			this._lastAppliedLSN.value = lastAppliedSSN!;
			this._lastAppliedBackupFile.value = this._model.migrationStatus.properties.migrationStatusDetails?.lastRestoredFilename;
			this._lastAppliedBackupTakenOn.value = new Date(lastAppliedBackupFileTakenOn!).toLocaleString();

			this._fileCount.value = loc.ACTIVE_BACKUP_FILES_ITEMS(tableData.length);

			//Sorting files in descending order of backupStartTime
			tableData.sort((file1, file2) => new Date(file1.backupStartTime) > new Date(file2.backupStartTime) ? - 1 : 1);

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
			}

			if (migrationStatusTextValue === 'InProgress') {
				const fileNotRestored = await tableData.some(file => file.status !== 'Restored');
				this._cutoverButton.enabled = !fileNotRestored;
				this._cancelButton.enabled = true;
			} else {
				this._cutoverButton.enabled = false;
				this._cancelButton.enabled = false;
			}
		} catch (e) {
			console.log(e);
		}
		this._refreshLoader.loading = false;
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
				'margin-bottom': '0',
				'width': '100%',
				'overflow': 'hidden',
				'text-overflow': 'ellipses'
			}
		}).component();
		flexContainer.addItem(textComponent);
		return {
			flexContainer: flexContainer,
			text: textComponent
		};
	}

	private async cancelMigration(): Promise<void> {
		await this._model.cancelMigration();
		await this.refreshStatus();
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
