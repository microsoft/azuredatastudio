/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationMode, MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';

export class MigrationModePage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private originalMigrationMode!: MigrationMode;
	private _disposables: vscode.Disposable[] = [];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.DATABASE_BACKUP_MIGRATION_MODE_LABEL, 'MigrationModePage'), migrationStateModel);
		this.wizardPage.description = constants.DATABASE_BACKUP_MIGRATION_MODE_DESCRIPTION;
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;
		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					this.migrationModeContainer(),
				]
			);

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));
		await view.initializeModel(form.component());
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.originalMigrationMode = this.migrationStateModel._databaseBackup.migrationMode;
		this.wizard.registerNavigationValidator((e) => {
			return true;
		});
	}
	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		if (this.originalMigrationMode !== this.migrationStateModel._databaseBackup.migrationMode) {
			this.migrationStateModel.refreshDatabaseBackupPage = true;
		}

		this.wizard.registerNavigationValidator((e) => {
			return true;
		});
	}
	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private migrationModeContainer(): azdata.FormComponent {
		const buttonGroup = 'cutoverContainer';

		const onlineButton = this._view.modelBuilder.radioButton().withProps({
			label: constants.DATABASE_BACKUP_MIGRATION_MODE_ONLINE_LABEL,
			name: buttonGroup,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			},
			checked: true
		}).component();

		const onlineDescription = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_MIGRATION_MODE_ONLINE_DESCRIPTION,
			CSSStyles: {
				'font-size': '13px',
				'margin': '0 0 10px 20px'
			}
		}).component();

		this._disposables.push(onlineButton.onDidChangeCheckedState((e) => {
			if (e) {
				this.migrationStateModel._databaseBackup.migrationMode = MigrationMode.ONLINE;
			}
		}));

		const offlineButton = this._view.modelBuilder.radioButton().withProps({
			label: constants.DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_LABEL,
			name: buttonGroup,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			},
		}).component();

		const offlineDescription = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_DESCRIPTION,
			CSSStyles: {
				'font-size': '13px',
				'margin': '0 0 10px 20px'
			}
		}).component();


		this._disposables.push(offlineButton.onDidChangeCheckedState((e) => {
			if (e) {
				this.migrationStateModel._databaseBackup.migrationMode = MigrationMode.OFFLINE;
			}
		}));

		const flexContainer = this._view.modelBuilder.flexContainer().withItems(
			[
				onlineButton,
				onlineDescription,
				offlineButton,
				offlineDescription
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return {
			component: flexContainer
		};
	}
}
