/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../models/strings';

export class DatabaseBackupPage extends MigrationWizardPage {

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.DATABASE_BACKUP_PAGE_TITLE), migrationStateModel);
		this.wizardPage.description = constants.DATABASE_BACKUP_PAGE_DESCRIPTION;
	}
	protected async registerContent(view: azdata.ModelView): Promise<void> {
		const form = view.modelBuilder.formContainer().withFormItems(
			[
				this.createBackupLocationComponent(view)
			]
		);
		await view.initializeModel(form.component());
		return;
	}

	private createBackupLocationComponent(view: azdata.ModelView): azdata.FormComponent {
		const buttonGroup = 'networkContainer';

		const networkShareButton = view.modelBuilder.radioButton().withProps({
			name: buttonGroup,
			label: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL,
		}).component();

		const blobContainerButton = view.modelBuilder.radioButton().withProps({
			name: buttonGroup,
			label: constants.DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL,
		}).component();

		const fileShareButton = view.modelBuilder.radioButton().withProps({
			name: buttonGroup,
			label: constants.DATABASE_BACKUP_NC_FILE_SHARE_RADIO_LABEL,
		}).component();

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				networkShareButton,
				blobContainerButton,
				fileShareButton
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return {
			title: '',
			component: flexContainer
		};
	}



	public onPageEnter(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	public onPageLeave(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	protected handleStateChange(e: StateChangeEvent): Promise<void> {
		throw new Error('Method not implemented.');
	}

}
