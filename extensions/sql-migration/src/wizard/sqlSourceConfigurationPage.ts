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
	private _progressContainer!: azdata.FlexContainer;
	private _assessmentComponent!: azdata.FlexContainer;
	private _assessmentProgress!: azdata.TextComponent;
	private _assessmentInfo!: azdata.TextComponent;
	private _rbgLoader!: azdata.LoadingComponent;

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
		this._assessmentComponent = this._view.modelBuilder.flexContainer().withLayout({
			height: '100%',
			flexFlow: 'column'
		}).component();

		this._assessmentComponent.addItem(this.createAssessmentProgress(), { flex: '1 1 auto' });
		this._assessmentComponent.addItem(this.createAssessmentInfo(), { flex: '1 1 auto' });
		await view.initializeModel(this._assessmentComponent);
	}

	public async onPageEnter(): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
	}


	public async onPageLeave(): Promise<void> {
		await this.runAssessments();
		await this._view.initializeModel(this._assessmentComponent);
		// if (this._rbgLoader.loading === false) {
		// 	this.wizard.registerNavigationValidator((pageChangeInfo) => {
		// 		return true;
		// 	});
		// }
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

	private createAssessmentProgress(): azdata.FlexContainer {

		this._rbgLoader = this._view.modelBuilder.loadingComponent().component();
		this._assessmentProgress = this._view.modelBuilder.text().withProps({
			value: constants.ASSESSMENT_IN_PROGRESS,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'width': '200px',
				'font-weight': '600',
				'margin': '8px 35px 5px 0px'
			}
		}).component();

		this._progressContainer = this._view.modelBuilder.flexContainer().withLayout({
			height: '100%',
			flexFlow: 'row'
		}).withItems([
			this._assessmentProgress,
			this._rbgLoader
		]).component();

		return this._progressContainer;
	}

	private createAssessmentInfo(): azdata.TextComponent {
		this._assessmentInfo = this._view.modelBuilder.text().withProps({
			value: constants.ASSESSMENT_IN_PROGRESS_CONTENT,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'width': '200px',
				'font-weight': '600',
				'margin': '8px 35px 5px 0px'
			}
		}).component();
		return this._assessmentInfo;
	}


	private async runAssessments(): Promise<void> {
		this._rbgLoader.loading = true;
		const serverName = (await this.migrationStateModel.getSourceConnectionProfile()).serverName;
		try {
			await this.migrationStateModel.getServerAssessments();
		} catch (e) {
			console.log(e);
		}
		this._assessmentProgress.value = constants.ASSESSMENT_COMPLETED(serverName);
		this._rbgLoader.loading = false;
	}
}
