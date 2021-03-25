/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as os from 'os';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationSourceAuthenticationType, MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { createLabelTextComponent, createHeadingTextComponent } from './wizardController';

export class SqlSourceConfigurationPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _usernameInput!: azdata.InputBoxComponent;
	private _password!: azdata.InputBoxComponent;

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
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
	}
	public async onPageLeave(): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private async createSourceCredentialContainer(): Promise<azdata.FormComponent> {

		const connectionProfile = await this.migrationStateModel.getSourceConnectionProfile();

		let username;
		switch (connectionProfile.authenticationType) {
			case 'SqlLogin':
				username = connectionProfile.userName;
				this.migrationStateModel._authenticationType = MigrationSourceAuthenticationType.Sql;
				break;
			case 'Integrated':
				if (process.env.USERDOMAIN && process.env.USERNAME) {
					username = process.env.USERDOMAIN + '\\' + process.env.USERNAME;
				} else {
					username = os.userInfo().username;
				}
				this.migrationStateModel._authenticationType = MigrationSourceAuthenticationType.Integrated;
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

		const authenticationTypeLable = this._view.modelBuilder.text().withProps({
			value: constants.AUTHENTICATION_TYPE
		}).component();

		const authenticationTypeInput = this._view.modelBuilder.inputBox().withProps({
			value: this.migrationStateModel._authenticationType === MigrationSourceAuthenticationType.Sql ? 'SQL Login' : 'Windows Authentication',
			enabled: false
		}).component();

		const usernameLable = this._view.modelBuilder.text().withProps({
			value: constants.USERNAME,
			requiredIndicator: true
		}).component();
		this._usernameInput = this._view.modelBuilder.inputBox().withProps({
			value: username,
			required: true,
			enabled: false
		}).component();
		this._usernameInput.onTextChanged(value => {
			this.migrationStateModel._sqlServerUsername = value;
		});

		const passwordLabel = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL,
			requiredIndicator: true
		}).component();
		this._password = this._view.modelBuilder.inputBox().withProps({
			value: (await azdata.connection.getCredentials(this.migrationStateModel.sourceConnectionId)).password,
			required: true,
			inputType: 'password'
		}).component();
		this._password.onTextChanged(value => {
			this.migrationStateModel._sqlServerPassword = value;
		});

		const container = this._view.modelBuilder.flexContainer().withItems(
			[
				sourceCredText,
				enterYourCredText,
				authenticationTypeLable,
				authenticationTypeInput,
				usernameLable,
				this._usernameInput,
				passwordLabel,
				this._password
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return {
			component: container
		};
	}
}
