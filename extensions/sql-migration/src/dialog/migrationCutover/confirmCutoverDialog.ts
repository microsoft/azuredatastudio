/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationCutoverDialogModel } from './migrationCutoverDialogModel';
import * as constants from '../../constants/strings';
import { SqlManagedInstance } from '../../api/azure';

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
				value: `${constants.CUTOVER_HELP_STEP1}
				${constants.CUTOVER_HELP_STEP2}
				${constants.CUTOVER_HELP_STEP3}`,
				CSSStyles: {
					'font-size': '13px',
				}
			}).component();


			const pendingBackupCount = this.migrationCutoverModel.migrationStatus.properties.migrationStatusDetails?.pendingLogBackupsCount ?? 0;
			const pendingText = this._view.modelBuilder.text().withProps({
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				},
				value: constants.PENDING_BACKUPS(pendingBackupCount!)
			}).component();

			const confirmCheckbox = this._view.modelBuilder.checkBox().withProps({
				CSSStyles: {
					'font-size': '13px',
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
				pendingText,
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
}
