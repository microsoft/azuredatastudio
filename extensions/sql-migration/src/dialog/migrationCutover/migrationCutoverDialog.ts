/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { MigrationContext } from '../../models/migrationLocalStorage';
import { MigrationCutoverDialogModel, MigrationStatus } from './migrationCutoverDialogModel';
import * as loc from '../../constants/strings';
import { convertByteSizeToReadableUnit, convertIsoTimeToLocalTime, getSqlServerName, SupportedAutoRefreshIntervals } from '../../api/utils';
import { EOL } from 'os';
import { ConfirmCutoverDialog } from './confirmCutoverDialog';

const refreshFrequency: SupportedAutoRefreshIntervals = 30000;

export class MigrationCutoverDialog {
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _model: MigrationCutoverDialogModel;

	private _databaseTitleName!: azdata.TextComponent;
	private _cutoverButton!: azdata.ButtonComponent;
	private _refreshButton!: azdata.ButtonComponent;
	private _cancelButton!: azdata.ButtonComponent;
	private _refreshLoader!: azdata.LoadingComponent;
	private _copyDatabaseMigrationDetails!: azdata.ButtonComponent;

	private _serverName!: azdata.TextComponent;
	private _serverVersion!: azdata.TextComponent;
	private _sourceDatabase!: azdata.TextComponent;
	private _targetDatabase!: azdata.TextComponent;
	private _targetServer!: azdata.TextComponent;
	private _targetVersion!: azdata.TextComponent;
	private _migrationStatus!: azdata.TextComponent;
	private _fullBackupFile!: azdata.TextComponent;
	private _backupLocation!: azdata.TextComponent;
	private _lastAppliedLSN!: azdata.TextComponent;
	private _lastAppliedBackupFile!: azdata.TextComponent;
	private _lastAppliedBackupTakenOn!: azdata.TextComponent;
	private _fileCount!: azdata.TextComponent;
	private fileTable!: azdata.TableComponent;
	private _autoRefreshHandle!: any;
	private _disposables: vscode.Disposable[] = [];

	readonly _infoFieldWidth: string = '250px';

	constructor(migration: MigrationContext) {
		this._model = new MigrationCutoverDialogModel(migration);
		this._dialogObject = azdata.window.createModelViewDialog('', 'MigrationCutoverDialog', 'wide');
	}

	async initialize(): Promise<void> {
		let tab = azdata.window.createTab('');
		tab.registerContent(async (view: azdata.ModelView) => {
			try {
				this._view = view;
				const sourceDatabase = this.createInfoField(loc.SOURCE_DATABASE, '');
				const sourceDetails = this.createInfoField(loc.SOURCE_SERVER, '');
				const sourceVersion = this.createInfoField(loc.SOURCE_VERSION, '');

				this._sourceDatabase = sourceDatabase.text;
				this._serverName = sourceDetails.text;
				this._serverVersion = sourceVersion.text;

				const flexServer = view.modelBuilder.flexContainer().withLayout({
					flexFlow: 'column'
				}).component();

				flexServer.addItem(sourceDatabase.flexContainer, {
					CSSStyles: {
						'width': this._infoFieldWidth
					}
				});
				flexServer.addItem(sourceDetails.flexContainer, {
					CSSStyles: {
						'width': this._infoFieldWidth
					}
				});
				flexServer.addItem(sourceVersion.flexContainer, {
					CSSStyles: {
						'width': this._infoFieldWidth
					}
				});

				const targetDatabase = this.createInfoField(loc.TARGET_DATABASE_NAME, '');
				const targetServer = this.createInfoField(loc.TARGET_SERVER, '');
				const targetVersion = this.createInfoField(loc.TARGET_VERSION, '');

				this._targetDatabase = targetDatabase.text;
				this._targetServer = targetServer.text;
				this._targetVersion = targetVersion.text;

				const flexTarget = view.modelBuilder.flexContainer().withLayout({
					flexFlow: 'column'
				}).component();

				flexTarget.addItem(targetDatabase.flexContainer, {
					CSSStyles: {
						'width': this._infoFieldWidth
					}
				});
				flexTarget.addItem(targetServer.flexContainer, {
					CSSStyles: {
						'width': this._infoFieldWidth
					}
				});
				flexTarget.addItem(targetVersion.flexContainer, {
					CSSStyles: {
						'width': this._infoFieldWidth
					}
				});

				const migrationStatus = this.createInfoField(loc.MIGRATION_STATUS, '');
				const fullBackupFileOn = this.createInfoField(loc.FULL_BACKUP_FILES, '');
				const backupLocation = this.createInfoField(loc.BACKUP_LOCATION, '');

				this._migrationStatus = migrationStatus.text;
				this._fullBackupFile = fullBackupFileOn.text;
				this._backupLocation = backupLocation.text;

				const flexStatus = view.modelBuilder.flexContainer().withLayout({
					flexFlow: 'column'
				}).component();

				flexStatus.addItem(migrationStatus.flexContainer, {
					CSSStyles: {
						'width': this._infoFieldWidth
					}
				});
				flexStatus.addItem(fullBackupFileOn.flexContainer, {
					CSSStyles: {
						'width': this._infoFieldWidth
					}
				});
				flexStatus.addItem(backupLocation.flexContainer, {
					CSSStyles: {
						'width': this._infoFieldWidth
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
						'width': this._infoFieldWidth
					}
				});
				flexFile.addItem(lastAppliedBackup.flexContainer, {
					CSSStyles: {
						'width': this._infoFieldWidth
					}
				});
				flexFile.addItem(lastAppliedBackupOn.flexContainer, {
					CSSStyles: {
						'width': this._infoFieldWidth
					}
				});
				const flexInfo = view.modelBuilder.flexContainer().withProps({
					width: 1000
				}).component();

				flexInfo.addItem(flexServer, {
					flex: '0',
					CSSStyles: {
						'flex': '0',
						'width': this._infoFieldWidth
					}
				});

				flexInfo.addItem(flexTarget, {
					flex: '0',
					CSSStyles: {
						'flex': '0',
						'width': this._infoFieldWidth
					}
				});

				flexInfo.addItem(flexStatus, {
					flex: '0',
					CSSStyles: {
						'flex': '0',
						'width': this._infoFieldWidth
					}
				});

				flexInfo.addItem(flexFile, {
					flex: '0',
					CSSStyles: {
						'flex': '0',
						'width': this._infoFieldWidth
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
							width: 230,
							type: azdata.ColumnType.text,
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
							value: loc.DATA_UPLOADED,
							width: 120,
							type: azdata.ColumnType.text
						},
						{
							value: loc.COPY_THROUGHPUT,
							width: 150,
							type: azdata.ColumnType.text
						},
						{
							value: loc.BACKUP_START_TIME,
							width: 130,
							type: azdata.ColumnType.text
						},
						{
							value: loc.FIRST_LSN,
							width: 120,
							type: azdata.ColumnType.text
						},
						{
							value: loc.LAST_LSN,
							width: 120,
							type: azdata.ColumnType.text
						}
					],
					data: [],
					width: '1100px',
					height: '300px',
					fontSize: '12px'
				}).component();

				const formBuilder = view.modelBuilder.formContainer().withFormItems(
					[
						{ component: this.migrationContainerHeader() },
						{ component: this._view.modelBuilder.separator().withProps({ width: 1000 }).component() },
						{ component: flexInfo },
						{ component: this._view.modelBuilder.separator().withProps({ width: 1000 }).component() },
						{ component: this._fileCount },
						{ component: this.fileTable }
					],
					{ horizontal: false }
				);
				const form = formBuilder.withLayout({ width: '100%' }).component();

				this._disposables.push(this._view.onClosed(e => {
					clearInterval(this._autoRefreshHandle);
					this._disposables.forEach(
						d => { try { d.dispose(); } catch { } });
				}));

				return view.initializeModel(form).then((value) => {
					this.refreshStatus();
				});
			} catch (e) {
				console.log(e);
			}
		});
		this._dialogObject.content = [tab];

		this._dialogObject.cancelButton.hidden = true;
		this._dialogObject.okButton.label = loc.CLOSE;

		this._disposables.push(this._dialogObject.okButton.onClick(e => {
			clearInterval(this._autoRefreshHandle);
		}));
		azdata.window.openDialog(this._dialogObject);
	}

	private migrationContainerHeader(): azdata.FlexContainer {
		const sqlDatbaseLogo = this._view.modelBuilder.image().withProps({
			iconPath: IconPathHelper.sqlDatabaseLogo,
			iconHeight: '32px',
			iconWidth: '32px',
			width: '32px',
			height: '32px'
		}).component();

		this._databaseTitleName = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				'font-size': '16px',
				'font-weight': 'bold',
				'margin': '0px'
			},
			width: 950,
			value: this._model._migration.migrationContext.properties.sourceDatabaseName
		}).component();

		const databaseSubTitle = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				'font-size': '10px',
				'margin': '5px 0px'
			},
			width: 950,
			value: loc.DATABASE
		}).component();

		const titleContainer = this._view.modelBuilder.flexContainer().withItems([
			this._databaseTitleName,
			databaseSubTitle
		]).withLayout({
			'flexFlow': 'column'
		}).withProps({
			width: 950
		}).component();

		this.setAutoRefresh(refreshFrequency);

		const titleLogoContainer = this._view.modelBuilder.flexContainer().withProps({
			width: 1000
		}).component();

		titleLogoContainer.addItem(sqlDatbaseLogo, {
			flex: '0'
		});
		titleLogoContainer.addItem(titleContainer, {
			flex: '0',
			CSSStyles: {
				'margin-left': '5px',
				'width': '930px'
			}
		});

		const headerActions = this._view.modelBuilder.flexContainer().withLayout({
		}).withProps({
			width: 1000
		}).component();

		this._cutoverButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.cutover,
			iconHeight: '16px',
			iconWidth: '16px',
			label: loc.COMPLETE_CUTOVER,
			height: '20px',
			width: '150px',
			enabled: false,
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		this._disposables.push(this._cutoverButton.onDidClick(async (e) => {
			await this.refreshStatus();
			const dialog = new ConfirmCutoverDialog(this._model);
			await dialog.initialize();
			await this.refreshStatus();
		}));

		headerActions.addItem(this._cutoverButton, {
			flex: '0'
		});

		this._cancelButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.cancel,
			iconHeight: '16px',
			iconWidth: '16px',
			label: loc.CANCEL_MIGRATION,
			height: '20px',
			width: '150px',
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		this._disposables.push(this._cancelButton.onDidClick((e) => {
			vscode.window.showInformationMessage(loc.CANCEL_MIGRATION_CONFIRMATION, { modal: true }, loc.YES, loc.NO).then(async (v) => {
				if (v === loc.YES) {
					await this._model.cancelMigration();
					await this.refreshStatus();
				}
			});
		}));

		headerActions.addItem(this._cancelButton, {
			flex: '0'
		});


		this._refreshButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: '16px',
			iconWidth: '16px',
			label: 'Refresh',
			height: '20px',
			width: '100px',
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		this._disposables.push(this._refreshButton.onDidClick(
			async (e) => await this.refreshStatus()));

		headerActions.addItem(this._refreshButton, {
			flex: '0',
		});

		this._copyDatabaseMigrationDetails = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.copy,
			iconHeight: '16px',
			iconWidth: '16px',
			label: loc.COPY_MIGRATION_DETAILS,
			height: '20px',
			width: '200px',
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		this._disposables.push(this._copyDatabaseMigrationDetails.onDidClick(async (e) => {
			await this.refreshStatus();
			if (this._model.migrationOpStatus) {
				vscode.env.clipboard.writeText(JSON.stringify({
					'async-operation-details': this._model.migrationOpStatus,
					'details': this._model.migrationStatus
				}, undefined, 2));
			} else {
				vscode.env.clipboard.writeText(JSON.stringify(this._model.migrationStatus, undefined, 2));
			}

			vscode.window.showInformationMessage(loc.DETAILS_COPIED);
		}));

		headerActions.addItem(this._copyDatabaseMigrationDetails, {
			flex: '0',
			CSSStyles: {
				'margin-left': '5px'
			}
		});

		this._refreshLoader = this._view.modelBuilder.loadingComponent().withProps({
			loading: false,
			height: '15px'
		}).component();

		headerActions.addItem(this._refreshLoader, {
			flex: '0',
			CSSStyles: {
				'margin-left': '16px'
			}
		});

		const header = this._view.modelBuilder.flexContainer().withItems([
			titleLogoContainer
		]).withLayout({
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				width: 1000
			}
		}).component();

		header.addItem(headerActions, {
			'CSSStyles': {
				'margin-top': '16px'
			}
		});

		return header;
	}

	private setAutoRefresh(interval: SupportedAutoRefreshIntervals): void {
		const classVariable = this;
		clearInterval(this._autoRefreshHandle);
		if (interval !== -1) {
			this._autoRefreshHandle = setInterval(function () { classVariable.refreshStatus(); }, interval);
		}
	}


	private async refreshStatus(): Promise<void> {
		try {
			this._refreshLoader.loading = true;
			this._cutoverButton.enabled = false;
			this._cancelButton.enabled = false;
			await this._model.fetchStatus();
			const errors = [];
			errors.push(this._model.migrationOpStatus.error?.message);
			errors.push(this._model.migrationStatus.properties.migrationFailureError?.message);
			errors.push(this._model.migrationStatus.properties.migrationStatusDetails?.fileUploadBlockingErrors ?? []);
			errors.push(this._model.migrationStatus.properties.migrationStatusDetails?.restoreBlockingReason);
			this._dialogObject.message = {
				text: errors.filter(e => e !== undefined).join(EOL),
				level: (this._model.migrationStatus.properties.migrationStatus === MigrationStatus.InProgress || this._model.migrationStatus.properties.migrationStatus === 'Completing') ? azdata.window.MessageLevel.Warning : azdata.window.MessageLevel.Error
			};
			const sqlServerInfo = await azdata.connection.getServerInfo((await azdata.connection.getCurrentConnection()).connectionId);
			const sqlServerName = this._model._migration.sourceConnectionProfile.serverName;
			const sourceDatabaseName = this._model._migration.migrationContext.properties.sourceDatabaseName;
			const versionName = getSqlServerName(sqlServerInfo.serverMajorVersion!);
			const sqlServerVersion = versionName ? versionName : sqlServerInfo.serverVersion;
			const targetDatabaseName = this._model._migration.migrationContext.name;
			const targetServerName = this._model._migration.targetManagedInstance.name;
			let targetServerVersion;
			if (this._model.migrationStatus.id.includes('managedInstances')) {
				targetServerVersion = loc.AZURE_SQL_DATABASE_MANAGED_INSTANCE;
			} else {
				targetServerVersion = loc.AZURE_SQL_DATABASE_VIRTUAL_MACHINE;
			}

			const migrationStatusTextValue = this._model.migrationStatus.properties.migrationStatus ? this._model.migrationStatus.properties.migrationStatus : this._model.migrationStatus.properties.provisioningState;

			let lastAppliedSSN: string;
			let lastAppliedBackupFileTakenOn: string;


			const tableData: ActiveBackupFileSchema[] = [];

			this._model.migrationStatus.properties.migrationStatusDetails?.activeBackupSets?.forEach((activeBackupSet) => {

				tableData.push(
					{
						fileName: activeBackupSet.listOfBackupFiles[0].fileName,
						type: activeBackupSet.backupType,
						status: activeBackupSet.listOfBackupFiles[0].status,
						dataUploaded: `${convertByteSizeToReadableUnit(activeBackupSet.listOfBackupFiles[0].dataWritten)}/ ${convertByteSizeToReadableUnit(activeBackupSet.listOfBackupFiles[0].totalSize)}`,
						copyThroughput: (activeBackupSet.listOfBackupFiles[0].copyThroughput / 1024).toFixed(2),
						backupStartTime: activeBackupSet.backupStartDate,
						firstLSN: activeBackupSet.firstLSN,
						lastLSN: activeBackupSet.lastLSN

					}
				);
				if (activeBackupSet.listOfBackupFiles[0].fileName === this._model.migrationStatus.properties.migrationStatusDetails?.lastRestoredFilename) {
					lastAppliedSSN = activeBackupSet.lastLSN;
					lastAppliedBackupFileTakenOn = activeBackupSet.backupFinishDate;
				}
			});

			this._sourceDatabase.value = sourceDatabaseName;
			this._serverName.value = sqlServerName;
			this._serverVersion.value = `${sqlServerVersion} ${sqlServerInfo.serverVersion}`;

			this._targetDatabase.value = targetDatabaseName;
			this._targetServer.value = targetServerName;
			this._targetVersion.value = targetServerVersion;

			this._migrationStatus.value = migrationStatusTextValue ?? '---';
			this._fullBackupFile.value = this._model.migrationStatus?.properties?.migrationStatusDetails?.fullBackupSetInfo?.listOfBackupFiles[0]?.fileName! ?? '-';
			let backupLocation;

			const isBlobMigration = this._model._migration.migrationContext.properties.backupConfiguration.sourceLocation?.azureBlob !== undefined;
			// Displaying storage accounts and blob container for azure blob backups.
			if (isBlobMigration) {
				backupLocation = `${this._model._migration.migrationContext.properties.backupConfiguration.sourceLocation?.azureBlob?.storageAccountResourceId.split('/').pop()} - ${this._model._migration.migrationContext.properties.backupConfiguration.sourceLocation?.azureBlob?.blobContainerName}`;
				this._fileCount.display = 'none';
				this.fileTable.updateCssStyles({
					'display': 'none'
				});
			} else {
				backupLocation = this._model._migration.migrationContext.properties.backupConfiguration?.sourceLocation?.fileShare?.path! ?? '-';
			}
			this._backupLocation.value = backupLocation ?? '-';

			this._lastAppliedLSN.value = lastAppliedSSN! ?? '-';
			this._lastAppliedBackupFile.value = this._model.migrationStatus.properties.migrationStatusDetails?.lastRestoredFilename ?? '-';
			this._lastAppliedBackupTakenOn.value = lastAppliedBackupFileTakenOn! ? convertIsoTimeToLocalTime(lastAppliedBackupFileTakenOn).toLocaleString() : '-';

			this._fileCount.value = loc.ACTIVE_BACKUP_FILES_ITEMS(tableData.length);

			// Sorting files in descending order of backupStartTime
			tableData.sort((file1, file2) => new Date(file1.backupStartTime) > new Date(file2.backupStartTime) ? - 1 : 1);

			this.fileTable.data = tableData.map((row) => {
				return [
					row.fileName,
					row.type,
					row.status,
					row.dataUploaded,
					row.copyThroughput,
					convertIsoTimeToLocalTime(row.backupStartTime).toLocaleString(),
					row.firstLSN,
					row.lastLSN
				];
			});

			if (migrationStatusTextValue === MigrationStatus.InProgress) {
				const restoredCount = (this._model.migrationStatus.properties.migrationStatusDetails?.activeBackupSets?.filter(a => a.listOfBackupFiles[0].status === 'Restored'))?.length ?? 0;
				if (restoredCount > 0 || isBlobMigration) {
					this._cutoverButton.enabled = true;
				}
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
				'margin-bottom': '0',
				'font-size': '12px'
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
				'text-overflow': 'ellipses',
				'font-size': '12px'
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
	dataUploaded: string,
	copyThroughput: string,
	backupStartTime: string,
	firstLSN: string,
	lastLSN: string
}
