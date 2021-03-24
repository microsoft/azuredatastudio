/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationCutover, MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';

export class MigrationModePage extends MigrationWizardPage {
	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.DATABASE_BACKUP_MIGRATION_MODE_LABEL, 'MigrationModePage'), migrationStateModel);
		this.wizardPage.description = constants.DATABASE_BACKUP_MIGRATION_MODE_DESCRIPTION;
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					this.migrationModeContainer(view),
				]
			);
		await view.initializeModel(form.component());
	}

	public async onPageEnter(): Promise<void> {
		this.wizard.registerNavigationValidator((e) => {
			return true;
		});
	}
	public async onPageLeave(): Promise<void> {
		this.wizard.registerNavigationValidator((e) => {
			return true;
		});
	}
	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private migrationModeContainer(view: azdata.ModelView): azdata.FormComponent {
		const buttonGroup = 'cutoverContainer';

		const onlineButton = view.modelBuilder.radioButton().withProps({
			label: constants.DATABASE_BACKUP_MIGRATION_MODE_ONLINE_LABEL,
			name: buttonGroup,
			checked: true
		}).component();

		this.migrationStateModel._databaseBackup.migrationCutover = MigrationCutover.ONLINE;

		onlineButton.onDidChangeCheckedState((e) => {
			if (e) {
				this.migrationStateModel._databaseBackup.migrationCutover = MigrationCutover.ONLINE;
			}
		});

		const offlineButton = view.modelBuilder.radioButton().withProps({
			label: constants.DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_LABEL,
			name: buttonGroup
		}).component();

		offlineButton.onDidChangeCheckedState((e) => {
			if (e) {
				vscode.window.showInformationMessage('Feature coming soon');
				onlineButton.checked = true;
				//this.migrationStateModel._databaseBackup.migrationCutover = MigrationCutover.OFFLINE; TODO: Enable when offline mode is supported.
			}
		});

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				onlineButton,
				offlineButton
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return {
			component: flexContainer
		};
	}
}
