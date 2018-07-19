/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { CreateSessionData } from '../data/createSessionData';

const localize = nls.loadMessageBundle();

export class CreateSessionDialog {

	// Top level
	private readonly DialogTitle: string = localize('createSessionDialog.newSession', 'New Session');
	//private readonly OkButtonText: string = localize('newSessionDialog.ok', 'OK');
	private readonly CancelButtonText: string = localize('createSessionDialog.cancel', 'Cancel');
	private readonly CreateButtonText: string = localize('createSessionDialog.create', 'Create');
	private readonly DialogTitleText: string = localize('createSessionDialog.title', 'Create New Profiler Session');

	// UI Components
	private dialog: sqlops.window.modelviewdialog.Dialog;
	private templatesBox: sqlops.ListBoxComponent;
	private sessionNameBox: sqlops.InputBoxComponent;

	private model: CreateSessionData;
	private onCreate: (templateName: string, sessionName: string) => void;

	private _onSuccess: vscode.EventEmitter<CreateSessionData> = new vscode.EventEmitter<CreateSessionData>();
	public readonly onSuccess: vscode.Event<CreateSessionData> = this._onSuccess.event;


	constructor(ownerUri: string, templates: string[], handler: (templateName: string, sessionName: string) => void) {
		this.model = new CreateSessionData(ownerUri, templates);
		this.onCreate = handler;
	}

	public async showDialog() {
		await this.model.initialize();
		this.dialog = sqlops.window.modelviewdialog.createDialog(this.DialogTitle);
		this.initializeContent();
		this.dialog.okButton.onClick(async () => await this.execute());
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.okButton.label = this.CreateButtonText;
		this.dialog.cancelButton.label = this.CancelButtonText;

		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}

	private initializeContent() {
		this.dialog.registerContent(async view => {
			this.templatesBox = view.modelBuilder.listBox()
				.withProperties({
					values: []
				}).component();

			this.sessionNameBox = view.modelBuilder.inputBox()
				.withProperties({
					required: true,
					placeHolder: 'session name',
					multiline: false
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					components: [{
						component: this.templatesBox,
						title: 'Select a session template:'
					},
					{
						component: this.sessionNameBox,
						title: 'Enter session name:'
					}],
					title: this.DialogTitleText
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);

			if (this.model.templates) {
				this.templatesBox.values = this.model.templates;
			}
			this.sessionNameBox.onTextChanged(() => {
				if (this.sessionNameBox.value.length > 0) {
					this.model.sessionName = this.sessionNameBox.value;
					this.dialog.okButton.enabled = true;
				}
				else{
					this.dialog.okButton.enabled = false;
				}
			});
		});
	}

	private async createSession(): Promise<void> {
		let currentConnection = await sqlops.connection.getCurrentConnection();
		console.log("Got current connection");
		let profilerService = sqlops.dataprotocol.getProvider<sqlops.ProfilerProvider>(currentConnection.providerName, sqlops.DataProviderType.ProfilerProvider);
		console.log("Got profiler service");
		profilerService.startSession('test', this.model.sessionName).then(() =>{
			console.log("In callback");
		});
	}

	private async execute() {
		this.updateModel();
		await this.model.save();
		await this.createSession();
	}

	private async cancel() {
	}

	private updateModel() {
		let selectedRow = this.templatesBox.selectedRow;
		if (selectedRow) {
			this.model.selectedTemplate= this.model.templates[selectedRow];
		}
	}
}