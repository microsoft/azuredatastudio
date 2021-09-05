/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationCutoverDialogModel } from './migrationCutoverDialogModel';
import * as constants from '../../constants/strings';
import { SqlManagedInstance } from '../../api/azure';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { convertByteSizeToReadableUnit, get12HourTime } from '../../api/utils';

export class ConfirmCutoverDialog {
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _disposables: vscode.Disposable[] = [];

	constructor(private migrationCutoverModel: MigrationCutoverDialogModel) {
		this._dialogObject = azdata.window.createModelViewDialog('', 'ConfirmCutoverDialog', 500);
	}

	async initialize(): Promise<void> {

		let tab = azdata.window.createTab('');
		tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;

			const completeCutoverText = view.modelBuilder.text().withProps({
				value: constants.COMPLETE_CUTOVER,
				CSSStyles: {
					'font-size': '20px',
					'font-weight': 'bold',
					'margin-bottom': '0px'
				}
			}).component();

			const sourceDatabaseText = view.modelBuilder.text().withProps({
				value: this.migrationCutoverModel._migration.migrationContext.properties.sourceDatabaseName,
				CSSStyles: {
					'font-size': '10px',
					'margin': '5px 0px 10px 0px'
				}
			}).component();

			const separator = this._view.modelBuilder.separator().withProps({ width: '800px' }).component();

			const helpMainText = this._view.modelBuilder.text().withProps({
				value: constants.CUTOVER_HELP_MAIN,
				CSSStyles: {
					'font-size': '13px',
				}
			}).component();

			const helpStepsText = this._view.modelBuilder.text().withProps({
				value: this.migrationCutoverModel.confirmCutoverStepsString(),
				CSSStyles: {
					'font-size': '13px',
				}
			}).component();


			const fileContainer = this.migrationCutoverModel.isBlobMigration() ? this.createBlobFileContainer() : this.createNewtorkShareFileContainer();

			const confirmCheckbox = this._view.modelBuilder.checkBox().withProps({
				CSSStyles: {
					'font-size': '13px',
					'margin-bottom': '8px'
				},
				label: constants.CONFIRM_CUTOVER_CHECKBOX,
			}).component();

			this._disposables.push(confirmCheckbox.onChanged(e => {
				this._dialogObject.okButton.enabled = e;
			}));

			const cutoverWarning = this._view.modelBuilder.infoBox().withProps({
				text: constants.COMPLETING_CUTOVER_WARNING,
				style: 'warning',
				CSSStyles: {
					'font-size': '13px',
				}
			}).component();


			let infoDisplay = 'none';
			if (this.migrationCutoverModel._migration.targetManagedInstance.id.toLocaleLowerCase().includes('managedinstances')
				&& (<SqlManagedInstance>this.migrationCutoverModel._migration.targetManagedInstance)?.sku?.tier === 'BusinessCritical') {
				infoDisplay = 'inline';
			}

			const businessCriticalinfoBox = this._view.modelBuilder.infoBox().withProps({
				text: constants.BUSINESS_CRITICAL_INFO,
				style: 'information',
				CSSStyles: {
					'font-size': '13px',
					'display': infoDisplay
				}
			}).component();

			const container = this._view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column'
			}).withItems([
				completeCutoverText,
				sourceDatabaseText,
				separator,
				helpMainText,
				helpStepsText,
				fileContainer,
				confirmCheckbox,
				cutoverWarning,
				businessCriticalinfoBox
			]).component();


			this._dialogObject.okButton.enabled = false;
			this._dialogObject.okButton.label = constants.COMPLETE_CUTOVER;
			this._disposables.push(this._dialogObject.okButton.onClick((e) => {
				this.migrationCutoverModel.startCutover();
				vscode.window.showInformationMessage(constants.CUTOVER_IN_PROGRESS(this.migrationCutoverModel._migration.migrationContext.properties.sourceDatabaseName));
			}));

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: container
					}
				],
				{
					horizontal: false
				}
			);
			const form = formBuilder.withLayout({ width: '100%' }).component();

			this._disposables.push(this._view.onClosed(e => {
				this._disposables.forEach(
					d => { try { d.dispose(); } catch { } });
			}));

			return view.initializeModel(form);
		});
		this._dialogObject.content = [tab];
		azdata.window.openDialog(this._dialogObject);
	}

	private createBlobFileContainer(): azdata.FlexContainer {
		const container = this._view.modelBuilder.flexContainer().component();

		const containerHeading = this._view.modelBuilder.text().withProps({
			value: constants.PENDING_BACKUPS(this.migrationCutoverModel.getPendingLogBackupsCount() ?? 0),
			width: 250,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'font-weight': 'bold'
			}
		}).component();

		const refreshButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: 16,
			iconWidth: 16,
			width: 70,
			height: 20,
			label: constants.REFRESH,
			CSSStyles: {
				'margin-top': '13px'
			}
		}).component();


		container.addItem(containerHeading, {
			flex: '0'
		});

		refreshButton.onDidClick(async e => {
			refreshLoader.loading = true;
			try {
				await this.migrationCutoverModel.fetchStatus();
				containerHeading.value = constants.PENDING_BACKUPS(this.migrationCutoverModel.getPendingLogBackupsCount() ?? 0);
			} catch (e) {
				this._dialogObject.message = {
					level: azdata.window.MessageLevel.Error,
					text: e.toString()
				};
			} finally {
				refreshLoader.loading = false;
			}
		});

		container.addItem(refreshButton, {
			flex: '0'
		});

		const refreshLoader = this._view.modelBuilder.loadingComponent().withProps({
			loading: false,
			CSSStyles: {
				'margin-top': '8px',
				'margin-left': '5px'
			}
		}).component();

		container.addItem(refreshLoader, {
			flex: '0'
		});
		return container;
	}

	private createNewtorkShareFileContainer(): azdata.FlexContainer {
		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		const headingRow = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row'
		}).component();

		let expanded: boolean = false;
		const containerHeading = this._view.modelBuilder.button().withProps({
			label: constants.PENDING_BACKUPS(this.migrationCutoverModel.getPendingLogBackupsCount() ?? 0),
			width: 220,
			height: 14,
			iconHeight: 12,
			iconWidth: 8,
			iconPath: IconPathHelper.expandButtonClosed,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'font-weight': 'bold',
				'margin': '16px 10px 0px 0px'
			}
		}).component();

		containerHeading.onDidClick(async e => {
			if (expanded) {
				containerHeading.iconPath = IconPathHelper.expandButtonClosed;
				containerHeading.iconHeight = 12;
				fileTable.updateCssStyles({
					'display': 'none'
				});

			} else {
				containerHeading.iconPath = IconPathHelper.expandButtonOpen;
				containerHeading.iconHeight = 8;
				fileTable.updateCssStyles({
					'display': 'inline'
				});
			}
			expanded = !expanded;
		});

		const refreshButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: 16,
			iconWidth: 16,
			width: 70,
			height: 20,
			label: constants.REFRESH,
			CSSStyles: {
				'margin-top': '13px'
			}
		}).component();

		headingRow.addItem(containerHeading, {
			flex: '0'
		});

		refreshButton.onDidClick(async e => {
			refreshLoader.loading = true;
			try {
				await this.migrationCutoverModel.fetchStatus();
				containerHeading.label = constants.PENDING_BACKUPS(this.migrationCutoverModel.getPendingLogBackupsCount() ?? 0);
				lastScanCompleted.value = constants.LAST_SCAN_COMPLETED(get12HourTime(new Date()));
				this.refreshFileTable(fileTable);
			} catch (e) {
				this._dialogObject.message = {
					level: azdata.window.MessageLevel.Error,
					text: e.toString()
				};
			} finally {
				refreshLoader.loading = false;
			}
		});

		headingRow.addItem(refreshButton, {
			flex: '0'
		});

		const refreshLoader = this._view.modelBuilder.loadingComponent().withProps({
			loading: false,
			CSSStyles: {
				'margin-top': '15px',
				'margin-left': '5px',
				'height': '13px'
			}
		}).component();

		headingRow.addItem(refreshLoader, {
			flex: '0'
		});

		container.addItem(headingRow);

		const lastScanCompleted = this._view.modelBuilder.text().withProps({
			value: constants.LAST_SCAN_COMPLETED(get12HourTime(new Date())),
			CSSStyles: {
				'font-size': '12px',
			}
		}).component();

		container.addItem(lastScanCompleted);

		const fileTable = this._view.modelBuilder.table().withProps({
			columns: [
				{
					value: constants.FILE_NAME,
					type: azdata.ColumnType.text,
					width: 250
				},
				{
					value: constants.STATUS,
					type: azdata.ColumnType.text,
					width: 80
				},
				{
					value: constants.SIZE_COLUMN_HEADER,
					type: azdata.ColumnType.text,
					width: 70
				}
			],
			data: [],
			width: 400,
			height: 150,
			CSSStyles: {
				'display': 'none'
			}
		}).component();
		container.addItem(fileTable);
		this.refreshFileTable(fileTable);
		return container;
	}

	private refreshFileTable(filetable: azdata.TableComponent) {
		const pendingFiles = this.migrationCutoverModel.getPendingfiles();
		if (pendingFiles.length > 0) {
			filetable.data = pendingFiles.map(f => {
				return [
					f.fileName,
					f.status,
					convertByteSizeToReadableUnit(f.totalSize)
				];
			});
		} else {
			filetable.data = [
				[constants.NO_PENDING_BACKUPS]
			];
		}

	}
}
