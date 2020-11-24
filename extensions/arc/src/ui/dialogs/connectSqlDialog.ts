/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import { InitializingComponent } from '../components/initializingComponent';

export abstract class ConnectToSqlDialog extends InitializingComponent {
	protected modelBuilder!: azdata.ModelBuilder;

	protected serverNameInputBox!: azdata.InputBoxComponent;
	protected usernameInputBox!: azdata.InputBoxComponent;
	protected passwordInputBox!: azdata.InputBoxComponent;
	protected rememberPwCheckBox!: azdata.CheckBoxComponent;

	protected _completionPromise = new Deferred<azdata.IConnectionProfile | undefined>();

	constructor() {
		super();
	}

	public showDialog(dialogTitle: string, connectionProfile?: azdata.IConnectionProfile): azdata.window.Dialog {
		const dialog = azdata.window.createModelViewDialog(dialogTitle);
		dialog.cancelButton.onClick(() => this.handleCancel());
		dialog.registerContent(async view => {
			this.modelBuilder = view.modelBuilder;

			this.serverNameInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					value: connectionProfile?.serverName,
					enabled: false
				}).component();
			this.usernameInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					value: connectionProfile?.userName
				}).component();
			this.passwordInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					inputType: 'password',
					value: connectionProfile?.password
				})
				.component();
			this.rememberPwCheckBox = this.modelBuilder.checkBox()
				.withProperties<azdata.CheckBoxProperties>({
					label: loc.rememberPassword,
					checked: connectionProfile?.savePassword
				}).component();

			let formModel = this.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: this.serverNameInputBox,
							title: loc.serverEndpoint,
							required: true
						}, {
							component: this.usernameInputBox,
							title: loc.username,
							required: true
						}, {
							component: this.passwordInputBox,
							title: loc.password,
							required: true
						}, {
							component: this.rememberPwCheckBox,
							title: ''
						}
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			this.serverNameInputBox.focus();
			this.initialized = true;
		});

		dialog.registerCloseValidator(async () => await this.validate());
		dialog.okButton.label = loc.connect;
		dialog.cancelButton.label = loc.cancel;
		azdata.window.openDialog(dialog);
		return dialog;
	}

	public async abstract validate(): Promise<boolean>;

	private handleCancel(): void {
		this._completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<azdata.IConnectionProfile | undefined> {
		return this._completionPromise.promise;
	}
}
