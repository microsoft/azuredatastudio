/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as os from 'os';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { createLabelTextComponent, createHeadingTextComponent } from './wizardController';

export class SqlSourceConfigurationPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.SOURCE_CONFIGURATION, 'MigrationModePage'), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;
		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					await this.createSourceCredentialContainer(),
				]
			);
		await view.initializeModel(form.component());
	}

	public async onPageEnter(): Promise<void> {
	}
	public async onPageLeave(): Promise<void> {
	}
	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private async createSourceCredentialContainer(): Promise<azdata.FormComponent> {

		const connectionProfile = await this.migrationStateModel.getSourceConnectionProfile();

		let username;
		switch (connectionProfile.authenticationType) {
			case 'SqlLogin':
				username = connectionProfile.userName;
				this.migrationStateModel._authenticationType = 'SqlAuthentication';
				break;
			case 'Integrated':
				username = os.userInfo().username;
				this.migrationStateModel._authenticationType = 'WindowsAuthentication';
				break;
			default:
				username = '';
		}

		const sourceCredText = createHeadingTextComponent(this._view, constants.SOURCE_CREDENTIALS);

		const enterYourCredText = createLabelTextComponent(
			this._view,
			constants.ENTER_YOUR_SQL_CREDS(connectionProfile.serverName),
			{
				'width': '400px'
			}
		);

		const usernameLable = this._view.modelBuilder.text().withProps({
			value: constants.USERNAME,
			requiredIndicator: true
		}).component();
		const usernameInput = this._view.modelBuilder.inputBox().withProps({
			value: username,
			required: true
		}).component();
		usernameInput.onTextChanged(value => {
			this.migrationStateModel._sqlServerUsername = value;
		});

		const passwordLabel = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL,
			requiredIndicator: true
		}).component();
		const passwordInput = this._view.modelBuilder.inputBox().withProps({
			value: (await azdata.connection.getCredentials(this.migrationStateModel.sourceConnectionId)).password,
			required: true,
			inputType: 'password'
		}).component();
		passwordInput.onTextChanged(value => {
			this.migrationStateModel._sqlServerPassword = value;
		});

		const container = this._view.modelBuilder.flexContainer().withItems(
			[
				sourceCredText,
				enterYourCredText,
				usernameLable,
				usernameInput,
				passwordLabel,
				passwordInput
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return {
			component: container
		};
	}
}
