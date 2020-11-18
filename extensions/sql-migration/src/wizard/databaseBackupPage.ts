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
				this.createBackupLocationComponent(view),
				{
					title: '',
					component: this.networkShareContainer(view)
				},
				{
					title: '',
					component: this.blobContainer(view)
				},
				{
					title: '',
					component: this.fileShareContainer(view)
				},
				this.migrationCutoverContainer(view),
				this.emailNotificationContainer(view),
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

	private fileShareContainer(view: azdata.ModelView): azdata.FlexContainer {

		const subscriptionLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_FILE_SHARE_SUBSCRIPTION_LABEL,
			requiredIndicator: true,
		}).component();
		const subscriptionDropdown = view.modelBuilder.dropDown().withProps({
		}).component();

		const storageAccountLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_FILE_SHARE_STORAGE_ACCOUNT_LABEL,
			requiredIndicator: true,
		}).component();
		const storageAccountDropdown = view.modelBuilder.dropDown().withProps({
		}).component();

		const fileShareLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_FILE_SHARE_LABEL,
			requiredIndicator: true,
		}).component();
		const fileShareDropdown = view.modelBuilder.dropDown().withProps({
		}).component();


		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				subscriptionLabel,
				subscriptionDropdown,
				storageAccountLabel,
				storageAccountDropdown,
				fileShareLabel,
				fileShareDropdown
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return flexContainer;
	}

	private blobContainer(view: azdata.ModelView): azdata.FlexContainer {
		const subscriptionLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_LABEL,
			requiredIndicator: true,
		}).component();
		const subscriptionDropdown = view.modelBuilder.dropDown().withProps({
		}).component();

		const storageAccountLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_LABEL,
			requiredIndicator: true,
		}).component();
		const storageAccountDropdown = view.modelBuilder.dropDown().withProps({
		}).component();

		const containerLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_CONTAINER_LABEL,
			requiredIndicator: true,
		}).component();
		const containerDropdown = view.modelBuilder.dropDown().withProps({
		}).component();

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				subscriptionLabel,
				subscriptionDropdown,
				storageAccountLabel,
				storageAccountDropdown,
				containerLabel,
				containerDropdown
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return flexContainer;
	}

	private networkShareContainer(view: azdata.ModelView): azdata.FlexContainer {
		const networkShareHelpText = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_HELP_TEXT,
		}).component();

		const networkShareLocationLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_LOCATION_LABEL,
			requiredIndicator: true,
		}).component();
		const networkShareLocationText = view.modelBuilder.inputBox().withProps({
			placeHolder: '\\\\Servername.domainname.com\\Backupfolder'
		}).component();

		const windowsUserAccountLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_LABEL,
			requiredIndicator: true,
		}).component();
		const windowsUserAccountText = view.modelBuilder.inputBox().withProps({
			placeHolder: 'Domain\\username'
		}).component();

		const passwordLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL,
			requiredIndicator: true,
		}).component();
		const passwordText = view.modelBuilder.inputBox().withProps({
			placeHolder: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_PLACEHOLDER
		}).component();

		const azureAccountHelpText = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HELP,
		}).component();

		const subscriptionLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_SUBSCRIPTION_LABEL,
			requiredIndicator: true,
		}).component();
		const subscriptionDropdown = view.modelBuilder.dropDown().withProps({
		}).component();

		const storageAccountLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_NETWORK_STORAGE_ACCOUNT_LABEL,
			requiredIndicator: true,
		}).component();
		const storageAccountDropdown = view.modelBuilder.dropDown().withProps({
		}).component();

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				networkShareHelpText,
				networkShareLocationLabel,
				networkShareLocationText,
				windowsUserAccountLabel,
				windowsUserAccountText,
				passwordLabel,
				passwordText,
				azureAccountHelpText,
				subscriptionLabel,
				subscriptionDropdown,
				storageAccountLabel,
				storageAccountDropdown
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return flexContainer;
	}

	private emailNotificationContainer(view: azdata.ModelView): azdata.FormComponent {
		const emailCheckbox = view.modelBuilder.checkBox().withProps({
			label: constants.DATABASE_BACKUP_EMAIL_NOTIFICATION_CHECKBOX_LABEL
		}).component();

		return {
			title: constants.DATABASE_BACKUP_EMAIL_NOTIFICATION_LABEL,
			component: emailCheckbox
		};
	}

	private migrationCutoverContainer(view: azdata.ModelView): azdata.FormComponent {
		const description = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_MIGRATION_CUTOVER_DESCRIPTION
		}).component();

		const buttonGroup = 'cutoverContainer';

		const automaticButton = view.modelBuilder.radioButton().withProps({
			label: constants.DATABASE_BACKUP_MIGRATION_CUTOVER_AUTOMATIC_LABEL,
			name: buttonGroup
		}).component();

		const manualButoon = view.modelBuilder.radioButton().withProps({
			label: constants.DATABASE_BACKUP_MIGRATION_CUTOVER_MANUAL_LABEL,
			name: buttonGroup
		}).component();

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				description,
				automaticButton,
				manualButoon
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return {
			title: constants.DATABASE_BACKUP_MIGRATION_CUTOVER_LABEL,
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
