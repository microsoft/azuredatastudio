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
import * as styles from '../../constants/styles';
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
					...styles.PAGE_TITLE_CSS
				}
			}).component();

			const sourceDatabaseText = view.modelBuilder.text().withProps({
				value: this.migrationCutoverModel._migration.migrationContext.properties.sourceDatabaseName,
				CSSStyles: {
					...styles.SMALL_NOTE_CSS,
					'margin': '4px 0px 8px'
				}
			}).component();

			const separator = this._view.modelBuilder.separator().withProps({ width: '800px' }).component();

			const helpMainText = this._view.modelBuilder.text().withProps({
				value: constants.CUTOVER_HELP_MAIN,
				CSSStyles: {
					...styles.BODY_CSS
				}
			}).component();

			const helpStepsText = this._view.modelBuilder.text().withProps({
				value: this.migrationCutoverModel.confirmCutoverStepsString(),
				CSSStyles: {
					...styles.BODY_CSS,
					'padding': '8px'
				}
			}).component();


			const fileContainer = this.migrationCutoverModel.isBlobMigration() ? this.createBlobFileContainer() : this.createNetworkShareFileContainer();

			const confirmCheckbox = this._view.modelBuilder.checkBox().withProps({
				CSSStyles: {
					...styles.BODY_CSS,
					'margin-bottom': '12px'
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
					...styles.BODY_CSS
				}
			}).component();


			let infoDisplay = 'none';
			if (this.migrationCutoverModel._migration.targetManagedInstance.id.toLocaleLowerCase().includes('managedinstances')
				&& (<SqlManagedInstance>this.migrationCutoverModel._migration.targetManagedInstance)?.sku?.tier === 'BusinessCritical') {
				infoDisplay = 'inline';
			}

			const businessCriticalInfoBox = this._view.modelBuilder.infoBox().withProps({
				text: constants.BUSINESS_CRITICAL_INFO,
				style: 'information',
				CSSStyles: {
					...styles.BODY_CSS,
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
				businessCriticalInfoBox
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
		const container = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin': '8px 0'
			}
		}).component();

		const containerHeading = this._view.modelBuilder.text().withProps({
			value: constants.PENDING_BACKUPS(this.migrationCutoverModel.getPendingLogBackupsCount() ?? 0),
			width: 250,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();

		const refreshButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: 16,
			iconWidth: 16,
			width: 70,
			height: 20,
			label: constants.REFRESH,
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
				'margin-top': '-4px',
				'margin-left': '8px'
			}
		}).component();

		container.addItem(refreshLoader, {
			flex: '0'
		});
		return container;
	}

	private createNetworkShareFileContainer(): azdata.FlexContainer {
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
				...styles.LABEL_CSS,
				'margin': '16px 8px 0px 0px'
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
				...styles.NOTE_CSS
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

	private refreshFileTable(fileTable: azdata.TableComponent) {
		const pendingFiles = this.migrationCutoverModel.getPendingFiles();
		if (pendingFiles.length > 0) {
			fileTable.data = pendingFiles.map(f => {
				return [
					f.fileName,
					f.status,
					convertByteSizeToReadableUnit(f.totalSize)
				];
			});
		} else {
			fileTable.data = [
				[constants.NO_PENDING_BACKUPS]
			];
		}

	}
}
