/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { BackupFileInfoStatus, MigrationContext, MigrationStatus } from '../../models/migrationLocalStorage';
import { MigrationCutoverDialogModel } from './migrationCutoverDialogModel';
import * as loc from '../../constants/strings';
import { convertByteSizeToReadableUnit, convertIsoTimeToLocalTime, getSqlServerName, getMigrationStatusImage, SupportedAutoRefreshIntervals, clearDialogMessage, displayDialogErrorMessage } from '../../api/utils';
import { EOL } from 'os';
import { ConfirmCutoverDialog } from './confirmCutoverDialog';
import { RetryMigrationDialog } from '../retryMigration/retryMigrationDialog';
import * as styles from '../../constants/styles';
import { canRetryMigration } from '../../constants/helper';

const refreshFrequency: SupportedAutoRefreshIntervals = 30000;
const statusImageSize: number = 14;

export class MigrationCutoverDialog {
	private _context: vscode.ExtensionContext;
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _model: MigrationCutoverDialogModel;
	private _migration: MigrationContext;

	private _databaseTitleName!: azdata.TextComponent;
	private _cutoverButton!: azdata.ButtonComponent;
	private _refreshButton!: azdata.ButtonComponent;
	private _cancelButton!: azdata.ButtonComponent;
	private _refreshLoader!: azdata.LoadingComponent;
	private _copyDatabaseMigrationDetails!: azdata.ButtonComponent;
	private _newSupportRequest!: azdata.ButtonComponent;
	private _retryButton!: azdata.ButtonComponent;

	private _sourceDatabaseInfoField!: InfoFieldSchema;
	private _sourceDetailsInfoField!: InfoFieldSchema;
	private _sourceVersionInfoField!: InfoFieldSchema;
	private _targetDatabaseInfoField!: InfoFieldSchema;
	private _targetServerInfoField!: InfoFieldSchema;
	private _targetVersionInfoField!: InfoFieldSchema;
	private _migrationStatusInfoField!: InfoFieldSchema;
	private _fullBackupFileOnInfoField!: InfoFieldSchema;
	private _backupLocationInfoField!: InfoFieldSchema;
	private _lastLSNInfoField!: InfoFieldSchema;
	private _lastAppliedBackupInfoField!: InfoFieldSchema;
	private _lastAppliedBackupTakenOnInfoField!: InfoFieldSchema;

	private _fileCount!: azdata.TextComponent;
	private _fileTable!: azdata.DeclarativeTableComponent;
	private _autoRefreshHandle!: any;
	private _disposables: vscode.Disposable[] = [];
	private _emptyTableFill!: azdata.FlexContainer;

	private isRefreshing = false;

	readonly _infoFieldWidth: string = '250px';

	constructor(context: vscode.ExtensionContext, migration: MigrationContext) {
		this._context = context;
		this._migration = migration;
		this._model = new MigrationCutoverDialogModel(migration);
		this._dialogObject = azdata.window.createModelViewDialog('', 'MigrationCutoverDialog', 'wide');
	}

	async initialize(): Promise<void> {
		let tab = azdata.window.createTab('');
		tab.registerContent(async (view: azdata.ModelView) => {
			try {
				this._view = view;

				this._fileCount = view.modelBuilder.text().withProps({
					width: '500px',
					CSSStyles: {
						...styles.BODY_CSS
					}
				}).component();

				const rowCssStyle: azdata.CssStyles = {
					'border': 'none',
					'text-align': 'left',
					'border-bottom': '1px solid',
					'font-size': '12px'
				};

				const headerCssStyles: azdata.CssStyles = {
					'border': 'none',
					'text-align': 'left',
					'border-bottom': '1px solid',
					'font-weight': 'bold',
					'padding-left': '0px',
					'padding-right': '0px',
					'font-size': '12px'
				};

				this._fileTable = view.modelBuilder.declarativeTable().withProps({
					ariaLabel: loc.ACTIVE_BACKUP_FILES,
					columns: [
						{
							displayName: loc.ACTIVE_BACKUP_FILES,
							valueType: azdata.DeclarativeDataType.string,
							width: '230px',
							isReadOnly: true,
							rowCssStyles: rowCssStyle,
							headerCssStyles: headerCssStyles
						},
						{
							displayName: loc.TYPE,
							valueType: azdata.DeclarativeDataType.string,
							width: '90px',
							isReadOnly: true,
							rowCssStyles: rowCssStyle,
							headerCssStyles: headerCssStyles
						},
						{
							displayName: loc.STATUS,
							valueType: azdata.DeclarativeDataType.string,
							width: '60px',
							isReadOnly: true,
							rowCssStyles: rowCssStyle,
							headerCssStyles: headerCssStyles
						},
						{
							displayName: loc.DATA_UPLOADED,
							valueType: azdata.DeclarativeDataType.string,
							width: '120px',
							isReadOnly: true,
							rowCssStyles: rowCssStyle,
							headerCssStyles: headerCssStyles
						},
						{
							displayName: loc.COPY_THROUGHPUT,
							valueType: azdata.DeclarativeDataType.string,
							width: '150px',
							isReadOnly: true,
							rowCssStyles: rowCssStyle,
							headerCssStyles: headerCssStyles
						},
						{
							displayName: loc.BACKUP_START_TIME,
							valueType: azdata.DeclarativeDataType.string,
							width: '130px',
							isReadOnly: true,
							rowCssStyles: rowCssStyle,
							headerCssStyles: headerCssStyles
						},
						{
							displayName: loc.FIRST_LSN,
							valueType: azdata.DeclarativeDataType.string,
							width: '120px',
							isReadOnly: true,
							rowCssStyles: rowCssStyle,
							headerCssStyles: headerCssStyles
						},
						{
							displayName: loc.LAST_LSN,
							valueType: azdata.DeclarativeDataType.string,
							width: '120px',
							isReadOnly: true,
							rowCssStyles: rowCssStyle,
							headerCssStyles: headerCssStyles
						}
					],
					data: [],
					width: '1100px',
					height: '300px',
					CSSStyles: {
						...styles.BODY_CSS,
						'display': 'none',
						'padding-left': '0px'
					}
				}).component();

				const _emptyTableImage = view.modelBuilder.image().withProps({
					iconPath: IconPathHelper.emptyTable,
					iconHeight: '100px',
					iconWidth: '100px',
					height: '100px',
					width: '100px',
					CSSStyles: {
						'text-align': 'center'
					}
				}).component();

				const _emptyTableText = view.modelBuilder.text().withProps({
					value: loc.EMPTY_TABLE_TEXT,
					CSSStyles: {
						...styles.NOTE_CSS,
						'margin-top': '8px',
						'text-align': 'center',
						'width': '300px'
					}
				}).component();

				this._emptyTableFill = view.modelBuilder.flexContainer()
					.withLayout({
						flexFlow: 'column',
						alignItems: 'center'
					}).withItems([
						_emptyTableImage,
						_emptyTableText,
					]).withProps({
						width: 1000,
						display: 'none'
					}).component();

				let formItems = [
					{ component: this.migrationContainerHeader() },
					{ component: this._view.modelBuilder.separator().withProps({ width: 1000 }).component() },
					{ component: await this.migrationInfoGrid() },
					{ component: this._view.modelBuilder.separator().withProps({ width: 1000 }).component() },
					{ component: this._fileCount },
					{ component: this._fileTable },
					{ component: this._emptyTableFill }
				];

				const formBuilder = view.modelBuilder.formContainer().withFormItems(
					formItems,
					{ horizontal: false }
				);
				const form = formBuilder.withLayout({ width: '100%' }).component();

				this._disposables.push(this._view.onClosed(e => {
					clearInterval(this._autoRefreshHandle);
					this._disposables.forEach(
						d => { try { d.dispose(); } catch { } });
				}));

				return view.initializeModel(form).then(async (value) => {
					await this.refreshStatus();
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
				...styles.PAGE_TITLE_CSS
			},
			width: 950,
			value: this._model._migration.migrationContext.properties.sourceDatabaseName
		}).component();

		const databaseSubTitle = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.NOTE_CSS
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
			width: '140px',
			enabled: false,
			CSSStyles: {
				...styles.BODY_CSS,
				'display': this._isOnlineMigration() ? 'block' : 'none'
			}
		}).component();

		this._disposables.push(this._cutoverButton.onDidClick(async (e) => {
			await this.refreshStatus();
			const dialog = new ConfirmCutoverDialog(this._model);
			await dialog.initialize();
			await this.refreshStatus();

			if (this._model.CutoverError) {
				displayDialogErrorMessage(this._dialogObject, loc.MIGRATION_CUTOVER_ERROR, this._model.CutoverError);
			}
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
			width: '140px',
			enabled: false,
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();

		this._disposables.push(this._cancelButton.onDidClick((e) => {
			void vscode.window.showInformationMessage(loc.CANCEL_MIGRATION_CONFIRMATION, { modal: true }, loc.YES, loc.NO).then(async (v) => {
				if (v === loc.YES) {
					await this._model.cancelMigration();
					await this.refreshStatus();
					if (this._model.CancelMigrationError) {
						displayDialogErrorMessage(this._dialogObject, loc.MIGRATION_CANCELLATION_ERROR, this._model.CancelMigrationError);
					}
				}
			});
		}));

		headerActions.addItem(this._cancelButton, {
			flex: '0'
		});

		this._retryButton = this._view.modelBuilder.button().withProps({
			label: loc.RETRY_MIGRATION,
			iconPath: IconPathHelper.retry,
			enabled: false,
			iconHeight: '16px',
			iconWidth: '16px',
			height: '20px',
			width: '120px',
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();
		this._disposables.push(this._retryButton.onDidClick(
			async (e) => {
				await this.refreshStatus();
				let retryMigrationDialog = new RetryMigrationDialog(this._context, this._migration);
				await retryMigrationDialog.openDialog();
			}
		));
		headerActions.addItem(this._retryButton, {
			flex: '0',
		});

		this._refreshButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: '16px',
			iconWidth: '16px',
			label: 'Refresh',
			height: '20px',
			width: '80px',
			CSSStyles: {
				...styles.BODY_CSS,
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
			width: '160px',
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();

		this._disposables.push(this._copyDatabaseMigrationDetails.onDidClick(async (e) => {
			await this.refreshStatus();
			await vscode.env.clipboard.writeText(this.getMigrationDetails());

			void vscode.window.showInformationMessage(loc.DETAILS_COPIED);
		}));

		headerActions.addItem(this._copyDatabaseMigrationDetails, {
			flex: '0',
			CSSStyles: {
				'margin-left': '5px'
			}
		});

		// create new support request button.  Hiding button until sql migration support has been setup.
		this._newSupportRequest = this._view.modelBuilder.button().withProps({
			label: loc.NEW_SUPPORT_REQUEST,
			iconPath: IconPathHelper.newSupportRequest,
			iconHeight: '16px',
			iconWidth: '16px',
			height: '20px',
			width: '160px',
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();

		this._newSupportRequest.onDidClick(async (e) => {
			const serviceId = this._model._migration.controller.id;
			const supportUrl = `https://portal.azure.com/#resource${serviceId}/supportrequest`;
			await vscode.env.openExternal(vscode.Uri.parse(supportUrl));
		});

		headerActions.addItem(this._newSupportRequest, {
			flex: '0',
			CSSStyles: {
				'margin-left': '5px'
			}
		});

		this._refreshLoader = this._view.modelBuilder.loadingComponent().withProps({
			loading: false,
			CSSStyles: {
				'height': '8px',
				'margin-top': '4px'
			}
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

	private async migrationInfoGrid(): Promise<azdata.FlexContainer> {
		const addInfoFieldToContainer = (infoField: InfoFieldSchema, container: azdata.FlexContainer): void => {
			container.addItem(infoField.flexContainer, {
				CSSStyles: {
					width: this._infoFieldWidth,
				}
			});
		};

		const flexServer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();
		this._sourceDatabaseInfoField = await this.createInfoField(loc.SOURCE_DATABASE, '');
		this._sourceDetailsInfoField = await this.createInfoField(loc.SOURCE_SERVER, '');
		this._sourceVersionInfoField = await this.createInfoField(loc.SOURCE_VERSION, '');
		addInfoFieldToContainer(this._sourceDatabaseInfoField, flexServer);
		addInfoFieldToContainer(this._sourceDetailsInfoField, flexServer);
		addInfoFieldToContainer(this._sourceVersionInfoField, flexServer);

		const flexTarget = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();
		this._targetDatabaseInfoField = await this.createInfoField(loc.TARGET_DATABASE_NAME, '');
		this._targetServerInfoField = await this.createInfoField(loc.TARGET_SERVER, '');
		this._targetVersionInfoField = await this.createInfoField(loc.TARGET_VERSION, '');
		addInfoFieldToContainer(this._targetDatabaseInfoField, flexTarget);
		addInfoFieldToContainer(this._targetServerInfoField, flexTarget);
		addInfoFieldToContainer(this._targetVersionInfoField, flexTarget);

		const isBlobMigration = this._model.isBlobMigration();
		const flexStatus = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();
		this._migrationStatusInfoField = await this.createInfoField(loc.MIGRATION_STATUS, '', false, ' ');
		this._fullBackupFileOnInfoField = await this.createInfoField(loc.FULL_BACKUP_FILES, '', isBlobMigration);
		this._backupLocationInfoField = await this.createInfoField(loc.BACKUP_LOCATION, '');
		addInfoFieldToContainer(this._migrationStatusInfoField, flexStatus);
		addInfoFieldToContainer(this._fullBackupFileOnInfoField, flexStatus);
		addInfoFieldToContainer(this._backupLocationInfoField, flexStatus);

		const flexFile = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();
		this._lastLSNInfoField = await this.createInfoField(loc.LAST_APPLIED_LSN, '', isBlobMigration);
		this._lastAppliedBackupInfoField = await this.createInfoField(loc.LAST_APPLIED_BACKUP_FILES, '');
		this._lastAppliedBackupTakenOnInfoField = await this.createInfoField(loc.LAST_APPLIED_BACKUP_FILES_TAKEN_ON, '', isBlobMigration);
		addInfoFieldToContainer(this._lastLSNInfoField, flexFile);
		addInfoFieldToContainer(this._lastAppliedBackupInfoField, flexFile);
		addInfoFieldToContainer(this._lastAppliedBackupTakenOnInfoField, flexFile);

		const flexInfoProps = {
			flex: '0',
			CSSStyles: {
				'flex': '0',
				'width': this._infoFieldWidth
			}
		};

		const flexInfo = this._view.modelBuilder.flexContainer().withProps({
			width: 1000
		}).component();
		flexInfo.addItem(flexServer, flexInfoProps);
		flexInfo.addItem(flexTarget, flexInfoProps);
		flexInfo.addItem(flexStatus, flexInfoProps);
		flexInfo.addItem(flexFile, flexInfoProps);

		return flexInfo;
	}

	private setAutoRefresh(interval: SupportedAutoRefreshIntervals): void {
		const shouldRefresh = (status: string | undefined) => !status
			|| status === MigrationStatus.InProgress
			|| status === MigrationStatus.Creating
			|| status === MigrationStatus.Completing
			|| status === MigrationStatus.Canceling;

		if (shouldRefresh(this.getMigrationStatus())) {
			const classVariable = this;
			clearInterval(this._autoRefreshHandle);
			if (interval !== -1) {
				this._autoRefreshHandle = setInterval(async function () { await classVariable.refreshStatus(); }, interval);
			}
		}
	}

	private getMigrationDetails(): string {
		if (this._model.migrationOpStatus) {
			return (JSON.stringify(
				{
					'async-operation-details': this._model.migrationOpStatus,
					'details': this._model.migrationStatus
				}
				, undefined, 2));
		} else {
			return (JSON.stringify(this._model.migrationStatus, undefined, 2));
		}
	}

	private async refreshStatus(): Promise<void> {
		if (this.isRefreshing) {
			return;
		}

		try {
			clearDialogMessage(this._dialogObject);

			if (this._isOnlineMigration()) {
				await this._cutoverButton.updateCssStyles({
					'display': 'block'
				});
			}

			this.isRefreshing = true;
			this._refreshLoader.loading = true;
			await this._model.fetchStatus();
			const errors = [];
			errors.push(this._model.migrationOpStatus.error?.message);
			errors.push(this._model._migration.asyncOperationResult?.error?.message);
			errors.push(this._model.migrationStatus.properties.provisioningError);
			errors.push(this._model.migrationStatus.properties.migrationFailureError?.message);
			errors.push(this._model.migrationStatus.properties.migrationStatusDetails?.fileUploadBlockingErrors ?? []);
			errors.push(this._model.migrationStatus.properties.migrationStatusDetails?.restoreBlockingReason);
			this._dialogObject.message = {
				// remove undefined and duplicate error entries
				text: errors
					.filter((e, i, arr) => e !== undefined && i === arr.indexOf(e))
					.join(EOL),
				level: this._model.migrationStatus.properties.migrationStatus === MigrationStatus.InProgress
					|| this._model.migrationStatus.properties.migrationStatus === MigrationStatus.Completing
					? azdata.window.MessageLevel.Warning
					: azdata.window.MessageLevel.Error,
				description: this.getMigrationDetails()
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

			let lastAppliedSSN: string;
			let lastAppliedBackupFileTakenOn: string;

			const tableData: ActiveBackupFileSchema[] = [];

			this._model.migrationStatus.properties.migrationStatusDetails?.activeBackupSets?.forEach((activeBackupSet) => {

				if (this._shouldDisplayBackupFileTable()) {
					tableData.push(
						...activeBackupSet.listOfBackupFiles.map(f => {
							return {
								fileName: f.fileName,
								type: activeBackupSet.backupType,
								status: f.status,
								dataUploaded: `${convertByteSizeToReadableUnit(f.dataWritten)} / ${convertByteSizeToReadableUnit(f.totalSize)}`,
								copyThroughput: (f.copyThroughput) ? (f.copyThroughput / 1024).toFixed(2) : '-',
								backupStartTime: activeBackupSet.backupStartDate,
								firstLSN: activeBackupSet.firstLSN,
								lastLSN: activeBackupSet.lastLSN
							};
						})
					);
				}

				if (activeBackupSet.listOfBackupFiles[0].fileName === this._model.migrationStatus.properties.migrationStatusDetails?.lastRestoredFilename) {
					lastAppliedSSN = activeBackupSet.lastLSN;
					lastAppliedBackupFileTakenOn = activeBackupSet.backupFinishDate;
				}
			});

			this._sourceDatabaseInfoField.text.value = sourceDatabaseName;
			this._sourceDetailsInfoField.text.value = sqlServerName;
			this._sourceVersionInfoField.text.value = `${sqlServerVersion} ${sqlServerInfo.serverVersion}`;

			this._targetDatabaseInfoField.text.value = targetDatabaseName;
			this._targetServerInfoField.text.value = targetServerName;
			this._targetVersionInfoField.text.value = targetServerVersion;

			const migrationStatusTextValue = this.getMigrationStatus();
			this._migrationStatusInfoField.text.value = migrationStatusTextValue ?? '-';
			this._migrationStatusInfoField.icon!.iconPath = getMigrationStatusImage(migrationStatusTextValue);

			this._fullBackupFileOnInfoField.text.value = this._model.migrationStatus?.properties?.migrationStatusDetails?.fullBackupSetInfo?.listOfBackupFiles[0]?.fileName! ?? '-';

			let backupLocation;
			const isBlobMigration = this._model.isBlobMigration();
			// Displaying storage accounts and blob container for azure blob backups.
			if (isBlobMigration) {
				const storageAccountResourceId = this._model._migration.migrationContext.properties.backupConfiguration?.sourceLocation?.azureBlob?.storageAccountResourceId;
				const blobContainerName = this._model._migration.migrationContext.properties.backupConfiguration?.sourceLocation?.azureBlob?.blobContainerName;
				backupLocation = `${storageAccountResourceId?.split('/').pop()} - ${blobContainerName}`;
			} else {
				const fileShare = this._model._migration.migrationContext.properties.backupConfiguration?.sourceLocation?.fileShare;
				backupLocation = fileShare?.path! ?? '-';
			}
			this._backupLocationInfoField.text.value = backupLocation ?? '-';

			this._lastLSNInfoField.text.value = lastAppliedSSN! ?? '-';
			this._lastAppliedBackupInfoField.text.value = this._model.migrationStatus.properties.migrationStatusDetails?.lastRestoredFilename ?? '-';
			this._lastAppliedBackupTakenOnInfoField.text.value = lastAppliedBackupFileTakenOn! ? convertIsoTimeToLocalTime(lastAppliedBackupFileTakenOn).toLocaleString() : '-';

			if (this._shouldDisplayBackupFileTable()) {
				await this._fileCount.updateCssStyles({
					...styles.SECTION_HEADER_CSS,
					display: 'inline'
				});
				await this._fileTable.updateCssStyles({
					display: 'inline'
				});

				this._fileCount.value = loc.ACTIVE_BACKUP_FILES_ITEMS(tableData.length);

				if (tableData.length === 0) {
					await this._emptyTableFill.updateCssStyles({
						'display': 'flex'
					});
					this._fileTable.height = '50px';
				} else {
					await this._emptyTableFill.updateCssStyles({
						'display': 'none'
					});
					this._fileTable.height = '300px';

					// Sorting files in descending order of backupStartTime
					tableData.sort((file1, file2) => new Date(file1.backupStartTime) > new Date(file2.backupStartTime) ? - 1 : 1);

					this._fileTable.data = tableData.map((row) => {
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
				}
			}

			this._cutoverButton.enabled = false;
			if (migrationStatusTextValue === MigrationStatus.InProgress) {
				const restoredCount = this._model.migrationStatus.properties.migrationStatusDetails?.activeBackupSets?.filter(
					(a) => a.listOfBackupFiles[0].status === BackupFileInfoStatus.Restored)?.length ?? 0;

				if (restoredCount > 0 || isBlobMigration) {
					this._cutoverButton.enabled = true;
				}
			}

			this._cancelButton.enabled =
				migrationStatusTextValue === MigrationStatus.Creating ||
				migrationStatusTextValue === MigrationStatus.InProgress;

			this._retryButton.enabled = canRetryMigration(migrationStatusTextValue);

		} catch (e) {
			displayDialogErrorMessage(this._dialogObject, loc.MIGRATION_STATUS_REFRESH_ERROR, e);
			console.log(e);
		} finally {
			this.isRefreshing = false;
			this._refreshLoader.loading = false;
		}
	}

	private async createInfoField(label: string, value: string, defaultHidden: boolean = false, iconPath?: azdata.IconPath): Promise<{
		flexContainer: azdata.FlexContainer,
		text: azdata.TextComponent,
		icon?: azdata.ImageComponent
	}> {
		const flexContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		if (defaultHidden) {
			await flexContainer.updateCssStyles({
				'display': 'none'
			});
		}

		const labelComponent = this._view.modelBuilder.text().withProps({
			value: label,
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'margin-bottom': '0',
			}
		}).component();
		flexContainer.addItem(labelComponent);

		const textComponent = this._view.modelBuilder.text().withProps({
			value: value,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '4px 0 12px',
				'width': '100%',
				'overflow': 'hidden',
				'text-overflow': 'ellipses'
			}
		}).component();

		let iconComponent;
		if (iconPath) {
			iconComponent = this._view.modelBuilder.image().withProps({
				iconPath: (iconPath === ' ') ? undefined : iconPath,
				iconHeight: statusImageSize,
				iconWidth: statusImageSize,
				height: statusImageSize,
				width: statusImageSize,
				CSSStyles: {
					'margin': '7px 3px 0 0',
					'padding': '0'
				}
			}).component();

			const iconTextComponent = this._view.modelBuilder.flexContainer()
				.withItems([
					iconComponent,
					textComponent
				]).withProps({
					CSSStyles: {
						'margin': '0',
						'padding': '0'
					},
					display: 'inline-flex'
				}).component();
			flexContainer.addItem(iconTextComponent);
		} else {
			flexContainer.addItem(textComponent);
		}

		return {
			flexContainer: flexContainer,
			text: textComponent,
			icon: iconComponent
		};
	}

	private _isOnlineMigration(): boolean {
		return this._model._migration.migrationContext.properties.offlineConfiguration?.offline?.valueOf() ? false : true;
	}

	private _shouldDisplayBackupFileTable(): boolean {
		return !this._model.isBlobMigration();
	}

	private getMigrationStatus(): string {
		if (this._model.migrationStatus) {
			return this._model.migrationStatus.properties.migrationStatus
				?? this._model.migrationStatus.properties.provisioningState;
		}
		return this._model._migration.migrationContext.properties.migrationStatus
			?? this._model._migration.migrationContext.properties.provisioningState;
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

interface InfoFieldSchema {
	flexContainer: azdata.FlexContainer,
	text: azdata.TextComponent,
	icon?: azdata.ImageComponent
}
