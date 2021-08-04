/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationSourceAuthenticationType, MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { createLabelTextComponent, createHeadingTextComponent, WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';

export class SqlSourceConfigurationPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _usernameInput!: azdata.InputBoxComponent;
	private _password!: azdata.InputBoxComponent;
	private _disposables: vscode.Disposable[] = [];

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

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));

		await view.initializeModel(form.component());
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
	}
	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private async createSourceCredentialContainer(): Promise<azdata.FormComponent> {

		const connectionProfile = await this.migrationStateModel.getSourceConnectionProfile();
		const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>((await this.migrationStateModel.getSourceConnectionProfile()).providerId, azdata.DataProviderType.QueryProvider);
		const query = 'select SUSER_NAME()';
		const results = await queryProvider.runQueryAndReturn(await (azdata.connection.getUriForConnection(this.migrationStateModel.sourceConnectionId)), query);
		const username = results.rows[0][0].displayValue;
		this.migrationStateModel._authenticationType = connectionProfile.authenticationType === 'SqlLogin' ? MigrationSourceAuthenticationType.Sql : connectionProfile.authenticationType === 'Integrated' ? MigrationSourceAuthenticationType.Integrated : undefined!;

		const sourceCredText = createHeadingTextComponent(this._view, constants.SOURCE_CREDENTIALS);

		const enterYourCredText = createLabelTextComponent(
			this._view,
			constants.ENTER_YOUR_SQL_CREDS,
			{
				'width': '600px',
				'font-size': '13px',
			}
		);

		const serverLabel = this._view.modelBuilder.text().withProps({
			value: constants.SERVER,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold',
			}
		}).component();

		const server = this._view.modelBuilder.inputBox().withProps({
			value: connectionProfile.serverName,
			enabled: false,
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		const authenticationTypeLable = this._view.modelBuilder.text().withProps({
			value: constants.AUTHENTICATION_TYPE,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold',
			}
		}).component();

		const authenticationTypeInput = this._view.modelBuilder.inputBox().withProps({
			value: this.migrationStateModel._authenticationType === MigrationSourceAuthenticationType.Sql ? 'SQL Login' : 'Windows Authentication',
			enabled: false,
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		const usernameLable = this._view.modelBuilder.text().withProps({
			value: constants.USERNAME,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold',
			}
		}).component();
		this._usernameInput = this._view.modelBuilder.inputBox().withProps({
			value: username,
			required: true,
			enabled: false,
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();
		this._disposables.push(this._usernameInput.onTextChanged(value => {
			this.migrationStateModel._sqlServerUsername = value;
		}));

		const passwordLabel = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold',
			}
		}).component();
		this._password = this._view.modelBuilder.inputBox().withProps({
			value: (await azdata.connection.getCredentials(this.migrationStateModel.sourceConnectionId)).password,
			required: true,
			inputType: 'password',
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();
		this._disposables.push(this._password.onTextChanged(value => {
			this.migrationStateModel._sqlServerPassword = value;
		}));

		const container = this._view.modelBuilder.flexContainer().withItems(
			[
				sourceCredText,
				enterYourCredText,
				serverLabel,
				server,
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
