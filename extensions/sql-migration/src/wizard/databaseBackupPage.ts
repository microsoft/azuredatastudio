/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import { getStorageAccountAccessKeys } from '../api/azure';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationCutover, MigrationStateModel, NetworkContainerType, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../models/strings';

export class DatabaseBackupPage extends MigrationWizardPage {

	private _networkShareContainer!: azdata.FlexContainer;
	private _networkShareContainerSubscriptionDropdown!: azdata.DropDownComponent;
	private _networkShareContainerStorageAccountDropdown!: azdata.DropDownComponent;
	private _networkShareLocationText!: azdata.InputBoxComponent;
	private _windowsUserAccountText!: azdata.InputBoxComponent;
	private _passwordText!: azdata.InputBoxComponent;

	private _blobContainer!: azdata.FlexContainer;
	private _blobContainerSubscriptionDropdown!: azdata.DropDownComponent;
	private _blobContainerStorageAccountDropdown!: azdata.DropDownComponent;
	private _blobContainerBlobDropdown!: azdata.DropDownComponent;

	private _fileShareContainer!: azdata.FlexContainer;
	private _fileShareSubscriptionDropdown!: azdata.DropDownComponent;
	private _fileShareStorageAccountDropdown!: azdata.DropDownComponent;
	private _fileShareFileShareDropdown!: azdata.DropDownComponent;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.DATABASE_BACKUP_PAGE_TITLE), migrationStateModel);
		this.wizardPage.description = constants.DATABASE_BACKUP_PAGE_DESCRIPTION;
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {

		this._networkShareContainer = this.createNetworkShareContainer(view);
		this._blobContainer = this.createBlobContainer(view);
		this._fileShareContainer = this.createFileShareContainer(view);

		const networkContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			this._networkShareContainer,
			this._blobContainer,
			this._fileShareContainer
		]).component();

		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					this.createBackupLocationComponent(view),
					{
						title: '',
						component: networkContainer
					},
					this.migrationModeContainer(view),
				]
			);
		await view.initializeModel(form.component());
	}

	private createBackupLocationComponent(view: azdata.ModelView): azdata.FormComponent {
		const buttonGroup = 'networkContainer';

		const networkShareButton = view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL
			}).component();

		networkShareButton.onDidChangeCheckedState((e) => {
			if (e) {
				this.toggleNetworkContainerFields(NetworkContainerType.NETWORK_SHARE);
			}
		});

		const blobContainerButton = view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL,
			}).component();

		blobContainerButton.onDidChangeCheckedState((e) => {
			if (e) {
				this.toggleNetworkContainerFields(NetworkContainerType.BLOB_CONTAINER);
			}
		});

		const fileShareButton = view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_FILE_SHARE_RADIO_LABEL,
			}).component();

		fileShareButton.onDidChangeCheckedState((e) => {
			if (e) {
				this.toggleNetworkContainerFields(NetworkContainerType.FILE_SHARE);
			}
		});

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

	private createFileShareContainer(view: azdata.ModelView): azdata.FlexContainer {

		const subscriptionLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_FILE_SHARE_SUBSCRIPTION_LABEL,
			requiredIndicator: true,
		}).component();
		this._fileShareSubscriptionDropdown = view.modelBuilder.dropDown().withProps({
			required: true,
		}).component();
		this._fileShareSubscriptionDropdown.onValueChanged(async (value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.subscription = this.migrationStateModel.getSubscription(value.index);
				this.migrationStateModel._databaseBackup.storageAccount = undefined!;
				await this.loadFileShareStorageDropdown();
			}
		});

		const storageAccountLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_FILE_SHARE_STORAGE_ACCOUNT_LABEL,
				requiredIndicator: true,
			}).component();
		this._fileShareStorageAccountDropdown = view.modelBuilder.dropDown()
			.withProps({
				required: true
			}).component();
		this._fileShareStorageAccountDropdown.onValueChanged(async (value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.storageAccount = this.migrationStateModel.getStorageAccount(value.index);
				this.migrationStateModel._databaseBackup.fileShare = undefined!;
				await this.loadFileShareDropdown();
			}
		});

		const fileShareLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_FILE_SHARE_LABEL,
				requiredIndicator: true,
			}).component();
		this._fileShareFileShareDropdown = view.modelBuilder.dropDown()
			.withProps({
				required: true
			}).component();
		this._fileShareFileShareDropdown.onValueChanged((value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.fileShare = this.migrationStateModel.getFileShare(value.index);
			}
		});


		const flexContainer = view.modelBuilder.flexContainer()
			.withItems(
				[
					subscriptionLabel,
					this._fileShareSubscriptionDropdown,
					storageAccountLabel,
					this._fileShareStorageAccountDropdown,
					fileShareLabel,
					this._fileShareFileShareDropdown
				]
			).withLayout({
				flexFlow: 'column'
			}).withProps({
				display: 'none'
			}).component();

		return flexContainer;
	}

	private createBlobContainer(view: azdata.ModelView): azdata.FlexContainer {
		const subscriptionLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_LABEL,
				requiredIndicator: true,
			}).component();
		this._blobContainerSubscriptionDropdown = view.modelBuilder.dropDown()
			.withProps({
				required: true
			}).component();
		this._blobContainerSubscriptionDropdown.onValueChanged(async (value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.subscription = this.migrationStateModel.getSubscription(value.index);
				this.migrationStateModel._databaseBackup.storageAccount = undefined!;
				await this.loadblobStorageDropdown();
			}
		});

		const storageAccountLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_LABEL,
				requiredIndicator: true,
			}).component();
		this._blobContainerStorageAccountDropdown = view.modelBuilder.dropDown()
			.withProps({
				required: true
			}).component();
		this._blobContainerStorageAccountDropdown.onValueChanged(async (value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.storageAccount = this.migrationStateModel.getStorageAccount(value.index);
				this.migrationStateModel._databaseBackup.blobContainer = undefined!;
				await this.loadBlobContainerDropdown();
			}
		});

		const containerLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_CONTAINER_LABEL,
			requiredIndicator: true,
		}).component();
		this._blobContainerBlobDropdown = view.modelBuilder.dropDown()
			.withProps({
				required: true
			}).component();
		this._blobContainerBlobDropdown.onValueChanged((value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.blobContainer = this.migrationStateModel.getBlobContainer(value.index);
			}
		});

		const flexContainer = view.modelBuilder.flexContainer()
			.withItems(
				[
					subscriptionLabel,
					this._blobContainerSubscriptionDropdown,
					storageAccountLabel,
					this._blobContainerStorageAccountDropdown,
					containerLabel,
					this._blobContainerBlobDropdown
				]
			).withLayout({
				flexFlow: 'column'
			}).withProps({
				display: 'none'
			}).component();

		return flexContainer;
	}

	private createNetworkShareContainer(view: azdata.ModelView): azdata.FlexContainer {
		const networkShareHelpText = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_HELP_TEXT,
			}).component();

		const networkShareLocationLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_LOCATION_LABEL,
				requiredIndicator: true,
			}).component();
		this._networkShareLocationText = view.modelBuilder.inputBox()
			.withProps({
				placeHolder: '\\\\Servername.domainname.com\\Backupfolder',
				required: true,
				validationErrorMessage: constants.INVALID_NETWORK_SHARE_LOCATION
			})
			.withValidation((component) => {
				if (this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.NETWORK_SHARE) {
					if (component.value) {
						if (!/(?<=\\\\)[^\\]*/.test(component.value)) {
							return false;
						}
					}
				}
				return true;
			}).component();
		this._networkShareLocationText.onTextChanged((value) => {
			this.migrationStateModel._databaseBackup.networkShareLocation = value;
		});

		const windowsUserAccountLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_LABEL,
				requiredIndicator: true,
			}).component();
		this._windowsUserAccountText = view.modelBuilder.inputBox()
			.withProps({
				placeHolder: 'Domain\\username',
				required: true,
				validationErrorMessage: constants.INVALID_USER_ACCOUNT
			})
			.withValidation((component) => {
				if (this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.NETWORK_SHARE) {
					if (component.value) {
						if (!/(?<=\\).*$/.test(component.value)) {
							return false;
						}
					}
				}
				return true;
			}).component();
		this._windowsUserAccountText.onTextChanged((value) => {
			this.migrationStateModel._databaseBackup.windowsUser = value;
		});

		const passwordLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL,
				requiredIndicator: true,
			}).component();
		this._passwordText = view.modelBuilder.inputBox()
			.withProps({
				placeHolder: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_PLACEHOLDER,
				inputType: 'password',
				required: true
			}).component();
		this._passwordText.onTextChanged((value) => {
			this.migrationStateModel._databaseBackup.password = value;
		});

		const azureAccountHelpText = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HELP,
			}).component();

		const subscriptionLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_SUBSCRIPTION_LABEL,
				requiredIndicator: true,
			}).component();
		this._networkShareContainerSubscriptionDropdown = view.modelBuilder.dropDown()
			.withProps({
				required: true
			}).component();
		this._networkShareContainerSubscriptionDropdown.onValueChanged(async (value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.subscription = this.migrationStateModel.getSubscription(value.index);
				this.migrationStateModel._databaseBackup.storageAccount = undefined!;
				await this.loadNetworkShareStorageDropdown();
			}
		});

		const storageAccountLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_NETWORK_STORAGE_ACCOUNT_LABEL,
				requiredIndicator: true,
			}).component();
		this._networkShareContainerStorageAccountDropdown = view.modelBuilder.dropDown()
			.withProps({
				required: true
			}).component();
		this._networkShareContainerStorageAccountDropdown.onValueChanged((value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.storageAccount = this.migrationStateModel.getStorageAccount(value.index);
			}
		});

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				networkShareHelpText,
				networkShareLocationLabel,
				this._networkShareLocationText,
				windowsUserAccountLabel,
				this._windowsUserAccountText,
				passwordLabel,
				this._passwordText,
				azureAccountHelpText,
				subscriptionLabel,
				this._networkShareContainerSubscriptionDropdown,
				storageAccountLabel,
				this._networkShareContainerStorageAccountDropdown
			]
		).withLayout({
			flexFlow: 'column'
		}).withProps({
			display: 'none'
		}).component();

		return flexContainer;
	}

	private migrationModeContainer(view: azdata.ModelView): azdata.FormComponent {
		const description = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_MIGRATION_MODE_DESCRIPTION
		}).component();

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
				this.migrationStateModel._databaseBackup.migrationCutover = MigrationCutover.OFFLINE;
			}
		});

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				description,
				onlineButton,
				offlineButton
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return {
			title: constants.DATABASE_BACKUP_MIGRATION_MODE_LABEL,
			component: flexContainer
		};
	}

	public async onPageEnter(): Promise<void> {
		await this.getSubscriptionValues();
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			const errors: string[] = [];

			switch (this.migrationStateModel._databaseBackup.networkContainerType) {
				case NetworkContainerType.NETWORK_SHARE:
					if ((<azdata.CategoryValue>this._networkShareContainerSubscriptionDropdown.value).displayName === constants.NO_SUBSCRIPTIONS_FOUND) {
						errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
					}
					if ((<azdata.CategoryValue>this._networkShareContainerStorageAccountDropdown.value).displayName === constants.NO_STORAGE_ACCOUNT_FOUND) {
						errors.push(constants.INVALID_STORAGE_ACCOUNT_ERROR);
					}
					break;
				case NetworkContainerType.BLOB_CONTAINER:
					if ((<azdata.CategoryValue>this._blobContainerSubscriptionDropdown.value).displayName === constants.NO_SUBSCRIPTIONS_FOUND) {
						errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
					}
					if ((<azdata.CategoryValue>this._blobContainerStorageAccountDropdown.value).displayName === constants.NO_STORAGE_ACCOUNT_FOUND) {
						errors.push(constants.INVALID_STORAGE_ACCOUNT_ERROR);
					}
					if ((<azdata.CategoryValue>this._blobContainerBlobDropdown.value).displayName === constants.NO_BLOBCONTAINERS_FOUND) {
						errors.push(constants.INVALID_BLOBCONTAINER_ERROR);
					}
					break;
				case NetworkContainerType.FILE_SHARE:
					if ((<azdata.CategoryValue>this._fileShareSubscriptionDropdown.value).displayName === constants.NO_SUBSCRIPTIONS_FOUND) {
						errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
					}
					if ((<azdata.CategoryValue>this._fileShareStorageAccountDropdown.value).displayName === constants.NO_STORAGE_ACCOUNT_FOUND) {
						errors.push(constants.INVALID_STORAGE_ACCOUNT_ERROR);
					}
					if ((<azdata.CategoryValue>this._fileShareFileShareDropdown.value).displayName === constants.NO_FILESHARES_FOUND) {
						errors.push(constants.INVALID_FILESHARE_ERROR);
					}
					break;
			}

			this.wizard.message = {
				text: errors.join(EOL),
				level: azdata.window.MessageLevel.Error
			};
			if (errors.length > 0) {
				return false;
			}
			return true;
		});
	}

	public async onPageLeave(): Promise<void> {
		this.migrationStateModel._databaseBackup.storageKey = (await getStorageAccountAccessKeys(this.migrationStateModel._azureAccount, this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.storageAccount)).keyName1;
		console.log(this.migrationStateModel._databaseBackup);
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private toggleNetworkContainerFields(containerType: NetworkContainerType): void {
		this.migrationStateModel._databaseBackup.networkContainerType = containerType;
		this._fileShareContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.FILE_SHARE) ? 'inline' : 'none' });
		this._blobContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.BLOB_CONTAINER) ? 'inline' : 'none' });
		this._networkShareContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.NETWORK_SHARE) ? 'inline' : 'none' });
		this._networkShareLocationText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this._windowsUserAccountText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this._passwordText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});

		this._networkShareLocationText.validate();
		this._windowsUserAccountText.validate();
		this._passwordText.validate();
		this._networkShareContainerSubscriptionDropdown.validate();
		this._networkShareContainerStorageAccountDropdown.validate();
		this._blobContainerSubscriptionDropdown.validate();
		this._blobContainerStorageAccountDropdown.validate();
		this._blobContainerBlobDropdown.validate();
		this._fileShareSubscriptionDropdown.validate();
		this._fileShareStorageAccountDropdown.validate();
		this._fileShareFileShareDropdown.validate();

	}

	private async getSubscriptionValues(): Promise<void> {
		if (!this.migrationStateModel._databaseBackup.subscription) {
			this._networkShareContainerSubscriptionDropdown.loading = true;
			this._fileShareSubscriptionDropdown.loading = true;
			this._blobContainerSubscriptionDropdown.loading = true;
			try {
				const subscriptionDropdownValues = await this.migrationStateModel.getSubscriptionsDropdownValues();
				this._fileShareSubscriptionDropdown.values = subscriptionDropdownValues;
				this._networkShareContainerSubscriptionDropdown.values = subscriptionDropdownValues;
				this._blobContainerSubscriptionDropdown.values = subscriptionDropdownValues;
			} catch (error) {
				console.log(error);
			} finally {
				this._networkShareContainerSubscriptionDropdown.loading = false;
				this._fileShareSubscriptionDropdown.loading = false;
				this._blobContainerSubscriptionDropdown.loading = false;
			}
		}
	}

	private async loadNetworkShareStorageDropdown(): Promise<void> {
		if (!this.migrationStateModel._databaseBackup.storageAccount) {
			this._networkShareContainerStorageAccountDropdown.loading = true;
			try {
				this._networkShareContainerStorageAccountDropdown.values = await this.migrationStateModel.getStorageAccountValues(this.migrationStateModel._databaseBackup.subscription);
			} catch (error) {
				console.log(error);
			} finally {
				this._networkShareContainerStorageAccountDropdown.loading = false;
			}
		}
	}

	private async loadFileShareStorageDropdown(): Promise<void> {
		if (!this.migrationStateModel._databaseBackup.storageAccount) {
			this._fileShareStorageAccountDropdown.loading = true;
			this._fileShareFileShareDropdown.loading = true;
			try {
				this._fileShareStorageAccountDropdown.values = await this.migrationStateModel.getStorageAccountValues(this.migrationStateModel._databaseBackup.subscription);
			} catch (error) {
				console.log(error);
			} finally {
				this._fileShareStorageAccountDropdown.loading = false;
				this._fileShareFileShareDropdown.loading = false;
			}
		}
	}

	private async loadblobStorageDropdown(): Promise<void> {
		if (!this.migrationStateModel._databaseBackup.storageAccount) {
			this._blobContainerStorageAccountDropdown.loading = true;
			this._blobContainerBlobDropdown.loading = true;
			try {
				this._blobContainerStorageAccountDropdown.values = await this.migrationStateModel.getStorageAccountValues(this.migrationStateModel._databaseBackup.subscription);
			} catch (error) {
				console.log(error);
			} finally {
				this._blobContainerStorageAccountDropdown.loading = false;
				this._blobContainerBlobDropdown.loading = true;

			}
		}
	}

	private async loadFileShareDropdown(): Promise<void> {
		if (!this.migrationStateModel._fileShares) {
			this._fileShareFileShareDropdown.loading = true;
			try {
				this._fileShareFileShareDropdown.values = await this.migrationStateModel.getFileShareValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.storageAccount);
			} catch (error) {
				console.log(error);
			} finally {
				this._fileShareFileShareDropdown.loading = false;
			}
		}
	}

	private async loadBlobContainerDropdown(): Promise<void> {
		if (!this.migrationStateModel._blobContainers) {
			this._blobContainerBlobDropdown.loading = true;
			try {
				this._blobContainerBlobDropdown.values = await this.migrationStateModel.getBlobContainerValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.storageAccount);
			} catch (error) {
				console.log(error);
			} finally {
				this._blobContainerBlobDropdown.loading = false;
			}
		}
	}
}
