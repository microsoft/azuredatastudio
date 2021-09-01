/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationMode, MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import * as styles from '../constants/styles';

export class MigrationModePage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private originalMigrationMode!: MigrationMode;
	private _disposables: vscode.Disposable[] = [];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.DATABASE_BACKUP_MIGRATION_MODE_LABEL, 'MigrationModePage'), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		const pageDescription = {
			title: '',
			component: view.modelBuilder.text().withProps({
				value: constants.DATABASE_BACKUP_MIGRATION_MODE_DESCRIPTION,
				CSSStyles: {
					...styles.bodyCSS,
					'margin': '0'
				}
			}).component()
		};

		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					pageDescription,
					this.migrationModeContainer(),
				]
			).withProps({
				CSSStyles: {
					'padding-top': '0'
				}
			}).component();

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));
		await view.initializeModel(form);
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
				...styles.bodyCSS,
				'margin-top': '8px'
			},
			checked: true
		}).component();

		const onlineDescription = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_MIGRATION_MODE_ONLINE_DESCRIPTION,
			CSSStyles: {
				...styles.noteCSS,
				'margin-left': '20px'
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
				...styles.bodyCSS,
				'margin-top': '8px'
			},
		}).component();

		const offlineDescription = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_DESCRIPTION,
			CSSStyles: {
				...styles.noteCSS,
				'margin-left': '20px'
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
