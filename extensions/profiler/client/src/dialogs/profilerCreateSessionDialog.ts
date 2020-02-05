/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { CreateSessionData } from '../data/createSessionData';

const localize = nls.loadMessageBundle();

export class CreateSessionDialog {
	// Top level
	private readonly CancelButtonText: string = localize('createSessionDialog.cancel', "Cancel");
	private readonly CreateButtonText: string = localize('createSessionDialog.create', "Start");
	private readonly DialogTitleText: string = localize('createSessionDialog.title', "Start New Profiler Session");

	// UI Components
	private dialog: azdata.window.Dialog;
	private templatesBox: azdata.DropDownComponent;
	private sessionNameBox: azdata.InputBoxComponent;

	private model: CreateSessionData;
	private readonly _providerType: string;

	private _onSuccess: vscode.EventEmitter<CreateSessionData> = new vscode.EventEmitter<CreateSessionData>();
	public readonly onSuccess: vscode.Event<CreateSessionData> = this._onSuccess.event;


	constructor(ownerUri: string, providerType: string, templates: Array<azdata.ProfilerSessionTemplate>) {
		if (typeof (templates) === 'undefined' || templates === null) {
			throw new Error(localize('createSessionDialog.templatesInvalid', "Invalid templates list, cannot open dialog"));
		}
		if (typeof (ownerUri) === 'undefined' || ownerUri === null) {
			throw new Error(localize('createSessionDialog.dialogOwnerInvalid', "Invalid dialog owner, cannot open dialog"));
		}
		if (typeof (providerType) === 'undefined' || providerType === null) {
			throw new Error(localize('createSessionDialog.invalidProviderType', "Invalid provider type, cannot open dialog"));
		}
		this._providerType = providerType;
		this.model = new CreateSessionData(ownerUri, templates);
	}

	public async showDialog(): Promise<void> {
		this.dialog = azdata.window.createModelViewDialog(this.DialogTitleText);
		this.initializeContent();
		this.dialog.okButton.onClick(() => this.execute());
		this.dialog.cancelButton.onClick(() => { });
		this.dialog.okButton.label = this.CreateButtonText;
		this.dialog.cancelButton.label = this.CancelButtonText;

		azdata.window.openDialog(this.dialog);
	}

	private initializeContent(): void {
		this.dialog.registerContent(async view => {
			this.templatesBox = view.modelBuilder.dropDown()
				.withProperties({
					values: []
				}).component();

			this.sessionNameBox = view.modelBuilder.inputBox()
				.withProperties({
					required: true,
					multiline: false,
					value: ''
				}).component();

			this.templatesBox.onValueChanged(() => {
				this.updateSessionName();
			});

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					components: [{
						component: this.templatesBox,
						title: localize('createSessionDialog.selectTemplates', "Select session template:")
					},
					{
						component: this.sessionNameBox,

						title: localize('createSessionDialog.enterSessionName', "Enter session name:")
					}],
					title: ''
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);

			if (this.model.templates) {
				this.templatesBox.values = this.model.getTemplateNames();
				this.updateSessionName();
			}

			this.sessionNameBox.onTextChanged(() => {
				if (this.sessionNameBox.value.length > 0) {
					this.model.sessionName = this.sessionNameBox.value;
					this.dialog.okButton.enabled = true;
				} else {
					this.dialog.okButton.enabled = false;
				}
			});
		});
	}

	private updateSessionName() {
		if (this.templatesBox.value) {
			this.sessionNameBox.value = `ADS_${this.templatesBox.value.toString()}`;
		}
	}

	private async execute(): Promise<void> {
		let profilerService = azdata.dataprotocol.getProvider<azdata.ProfilerProvider>(this._providerType, azdata.DataProviderType.ProfilerProvider);

		let name = this.sessionNameBox.value;
		let selected = this.templatesBox.value.toString();
		let temp = this.model.selectTemplate(selected);
		profilerService.createSession(this.model.ownerUri, this.sessionNameBox.value, temp).then(() => {
		}, (error) => {
			const message = error && error.message ? error.message : localize('createSessionDialog.createSessionFailed', "Failed to create a session");
			vscode.window.showErrorMessage(message);
		});
	}
}
