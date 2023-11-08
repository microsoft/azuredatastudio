/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as localizedConstants from './localizedConstants';
import { DialogBase } from './dialogBase';
import { getErrorMessage } from '../utils';
import { providerId } from '../constants';

export interface ScriptableDialogOptions {
	/**
	 * The width of the dialog, defaults to narrow if not set
	 */
	width?: azdata.window.DialogWidth;
	/**
	 * The object explorer context in which this dialog was opened.
	 */
	objectExplorerContext?: azdata.ObjectExplorerContext;
}

/**
 * Base class for a scriptable dialog - that is a dialog that has a "Script" button which will
 * open a new editor with the generated script when clicked. This also includes a "Help" button
 * to open up a given URL when clicked.
 */
export abstract class ScriptableDialogBase<OptionsType extends ScriptableDialogOptions> extends DialogBase<void> {
	private _helpButton: azdata.window.Button;
	private _scriptButton: azdata.window.Button;

	constructor(title: string, name: string, protected readonly options: OptionsType) {
		super(title, name, options.width || 'narrow', 'flyout'
		);
		this._helpButton = azdata.window.createButton(localizedConstants.HelpText, 'left');
		this.disposables.push(this._helpButton.onClick(async () => {
			await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(this.helpUrl));
		}));
		this._scriptButton = azdata.window.createButton(localizedConstants.ScriptText, 'left');
		this.disposables.push(this._scriptButton.onClick(async () => { await this.onScriptButtonClick(); }));
		this.dialogObject.customButtons = [this._helpButton, this._scriptButton];
	}

	/**
	 * Called after initializeData to initialize the UI components of the dialog.
	 */
	protected abstract initializeUI(): Promise<void>;

	/**
	 * Called before initializeUI to initialize the data for the dialog.
	 */
	protected abstract initializeData(): Promise<void>;

	/**
	 * The URL to open when the Help button is clicked
	 */
	protected abstract get helpUrl(): string;

	/**
	 * Whether the dialog is currently dirty, which will control what buttons are enabled.
	 */
	protected abstract get isDirty(): boolean;

	protected override onFormFieldChange(): void {
		this.updateScriptButtonState();
		this.dialogObject.okButton.enabled = this.isDirty;
	}

	protected override async initialize(): Promise<void> {
		await this.initializeData();
		await this.initializeUI();
		this.disposables.push(this.modelView.onValidityChanged(() => {
			this.updateScriptButtonState();
		}));
	}

	protected override updateLoadingStatus(isLoading: boolean, loadingText?: string, loadingCompletedText?: string): void {
		super.updateLoadingStatus(isLoading, loadingText, loadingCompletedText);
		this._helpButton.enabled = !isLoading;
		this.dialogObject.okButton.enabled = this._scriptButton.enabled = isLoading ? false : this.isDirty;
	}

	/**
	 * Whether this dialog will open its own query editor when the script button is clicked. (like for Backup & Restore)
	 */
	protected get opensEditorSeparately(): boolean {
		return false;
	}

	/**
	 * Called when the script button is clicked, returns the script that will be opened up in a new editor.
	 */
	protected abstract generateScript(): Promise<string>;

	private async onScriptButtonClick(): Promise<void> {
		this.updateLoadingStatus(true, localizedConstants.GeneratingScriptText, localizedConstants.GeneratingScriptCompletedText);
		try {
			const isValid = await this.runValidation();
			if (!isValid) {
				return;
			}
			let message = localizedConstants.ScriptGeneratedText;
			const script = await this.generateScript();
			if (!this.opensEditorSeparately) {
				if (script) {
					let doc = await azdata.queryeditor.openQueryDocument({ content: script }, providerId);
					if (this.options.objectExplorerContext?.connectionProfile) {
						let profile = this.options.objectExplorerContext?.connectionProfile;
						let convertedProfile: azdata.connection.ConnectionProfile = {
							providerId: profile.providerName,
							connectionId: profile.id,
							connectionName: profile.connectionName,
							serverName: profile.serverName,
							databaseName: profile.databaseName,
							userName: profile.userName,
							password: profile.password,
							authenticationType: profile.authenticationType,
							savePassword: profile.savePassword,
							groupFullName: profile.groupFullName,
							groupId: profile.groupId,
							saveProfile: profile.savePassword,
							azureTenantId: profile.azureTenantId,
							options: profile.options
						};
						await doc.connect(convertedProfile);
					}
				} else {
					message = localizedConstants.NoActionScriptedMessage;
				}
			}
			this.dialogObject.message = {
				text: message,
				level: azdata.window.MessageLevel.Information
			};
		} catch (err) {
			this.dialogObject.message = {
				text: localizedConstants.scriptError(getErrorMessage(err)),
				level: azdata.window.MessageLevel.Error
			};
		} finally {
			this.updateLoadingStatus(false, localizedConstants.GeneratingScriptText, localizedConstants.GeneratingScriptCompletedText);
		}
	}

	private updateScriptButtonState(): void {
		this._scriptButton.enabled = this.isDirty && this.modelView.valid;
	}
}
