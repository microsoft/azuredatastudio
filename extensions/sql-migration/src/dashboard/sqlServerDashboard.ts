/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../constants/strings';
import { DashboardTab } from './dashboardTab';
import { MigrationsTab, MigrationsTabId } from './migrationsTab';
import { AdsMigrationStatus } from './tabBase';

export interface DashboardStatusBar {
	showError: (errorTitle: string, errorLable: string, errorDescription: string) => Promise<void>;
	clearError: () => Promise<void>;
	errorTitle: string;
	errorLabel: string;
	errorDescription: string;
}

export class DashboardWidget implements DashboardStatusBar {
	private _context: vscode.ExtensionContext;
	private _view!: azdata.ModelView;
	private _tabs!: azdata.TabbedPanelComponent;
	private _statusInfoBox!: azdata.InfoBoxComponent;
	private _dashboardTab!: DashboardTab;
	private _migrationsTab!: MigrationsTab;
	private _disposables: vscode.Disposable[] = [];

	constructor(context: vscode.ExtensionContext) {
		this._context = context;
	}

	public errorTitle: string = '';
	public errorLabel: string = '';
	public errorDescription: string = '';

	public async showError(errorTitle: string, errorLabel: string, errorDescription: string): Promise<void> {
		this.errorTitle = errorTitle;
		this.errorLabel = errorLabel;
		this.errorDescription = errorDescription;
		this._statusInfoBox.style = 'error';
		this._statusInfoBox.text = errorTitle;
		await this._updateStatusDisplay(this._statusInfoBox, true);
	}

	public async clearError(): Promise<void> {
		await this._updateStatusDisplay(this._statusInfoBox, false);
		this.errorTitle = '';
		this.errorLabel = '';
		this.errorDescription = '';
		this._statusInfoBox.style = 'success';
		this._statusInfoBox.text = '';
	}

	public register(): void {
		azdata.ui.registerModelViewProvider('migration-dashboard', async (view) => {
			this._view = view;
			this._disposables.push(
				this._view.onClosed(e => {
					this._disposables.forEach(
						d => { try { d.dispose(); } catch { } });
				}));

			const openMigrationFcn = async (filter: AdsMigrationStatus): Promise<void> => {
				this._tabs.selectTab(MigrationsTabId);
				await this._migrationsTab.setMigrationFilter(filter);
			};

			this._dashboardTab = await new DashboardTab().create(
				view,
				async (filter: AdsMigrationStatus) => await openMigrationFcn(filter),
				this);
			this._disposables.push(this._dashboardTab);

			this._migrationsTab = await new MigrationsTab().create(
				this._context,
				view,
				this);
			this._disposables.push(this._migrationsTab);

			this._tabs = view.modelBuilder.tabbedPanel()
				.withTabs([this._dashboardTab, this._migrationsTab])
				.withLayout({ alwaysShowTabs: true, orientation: azdata.TabOrientation.Horizontal })
				.withProps({
					CSSStyles: {
						'margin': '0px',
						'padding': '0px',
						'width': '100%'
					}
				})
				.component();

			this._disposables.push(
				this._tabs.onTabChanged(
					async id => {
						await this.clearError();
						await this.onDialogClosed();
					}));

			this._statusInfoBox = view.modelBuilder.infoBox()
				.withProps({
					style: 'error',
					text: '',
					announceText: true,
					isClickable: true,
					display: 'none',
					CSSStyles: { 'font-size': '14px' },
				}).component();

			this._disposables.push(
				this._statusInfoBox.onDidClick(
					async e => await this.openErrorDialog()));

			const flexContainer = view.modelBuilder.flexContainer()
				.withLayout({ flexFlow: 'column' })
				.withItems([this._statusInfoBox, this._tabs])
				.component();
			await view.initializeModel(flexContainer);

			await this.refresh();
		});
	}

	public async refresh(): Promise<void> {
		void this._migrationsTab.refresh();
		await this._dashboardTab.refresh();
	}

	public async onDialogClosed(): Promise<void> {
		await this._dashboardTab.onDialogClosed();
		await this._migrationsTab.onDialogClosed();
	}

	private _errorDialogIsOpen: boolean = false;

	protected async openErrorDialog(): Promise<void> {
		if (this._errorDialogIsOpen) {
			return;
		}

		try {
			const tab = azdata.window.createTab(this.errorTitle);
			tab.registerContent(async (view) => {
				const flex = view.modelBuilder.flexContainer()
					.withItems([
						view.modelBuilder.text()
							.withProps({ value: this.errorLabel, CSSStyles: { 'margin': '0px 0px 5px 5px' } })
							.component(),
						view.modelBuilder.inputBox()
							.withProps({
								value: this.errorDescription,
								readOnly: true,
								multiline: true,
								inputType: 'text',
								rows: 20,
								CSSStyles: { 'overflow': 'hidden auto', 'margin': '0px 0px 0px 5px' },
							})
							.component()
					])
					.withLayout({
						flexFlow: 'column',
						width: 420,
					})
					.withProps({ CSSStyles: { 'margin': '0 10px 0 10px' } })
					.component();

				await view.initializeModel(flex);
			});

			const dialog = azdata.window.createModelViewDialog(
				this.errorTitle,
				'errorDialog',
				450,
				'flyout');
			dialog.content = [tab];
			dialog.okButton.label = loc.ERROR_DIALOG_CLEAR_BUTTON_LABEL;
			dialog.okButton.focused = true;
			dialog.cancelButton.label = loc.CLOSE;
			this._disposables.push(
				dialog.onClosed(async e => {
					if (e === 'ok') {
						await this.clearError();
					}
					this._errorDialogIsOpen = false;
				}));

			azdata.window.openDialog(dialog);
		} catch (error) {
			this._errorDialogIsOpen = false;
		}
	}

	private async _updateStatusDisplay(control: azdata.Component, visible: boolean): Promise<void> {
		await control.updateCssStyles({ 'display': visible ? 'inline' : 'none' });
	}
}
