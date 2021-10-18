/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { azureResource } from 'azureResource';
import { EventEmitter } from 'events';
import { createResourceGroup } from '../../api/azure';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';

export class CreateResourceGroupDialog {
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _creationEvent: EventEmitter = new EventEmitter;
	private _disposables: vscode.Disposable[] = [];

	constructor(private _azureAccount: azdata.Account, private _subscription: azureResource.AzureResourceSubscription, private _location: string) {
		this._dialogObject = azdata.window.createModelViewDialog(
			'',
			'CreateResourceGroupDialog',
			550,
			'callout',
			'below',
			false,
			true,
			<azdata.window.IDialogProperties>{
				height: 20,
				width: 20,
				xPos: 0,
				yPos: 0
			}
		);
	}

	async initialize(): Promise<azureResource.AzureResourceResourceGroup> {
		let tab = azdata.window.createTab('sql.migration.CreateResourceGroupDialog');
		await tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;

			const resourceGroupDescription = view.modelBuilder.text().withProps({
				value: constants.RESOURCE_GROUP_DESCRIPTION,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin-bottom': '8px'
				}
			}).component();
			const nameLabel = view.modelBuilder.text().withProps({
				value: constants.NAME,
				CSSStyles: {
					...styles.LABEL_CSS
				}
			}).component();

			const resourceGroupName = view.modelBuilder.inputBox().withProps({
				ariaLabel: constants.NAME_OF_NEW_RESOURCE_GROUP
			}).withValidation(c => {
				let valid = false;
				if (c.value!.length > 0 && c.value!.length <= 90 && /^[-\w\._\(\)]+$/.test(c.value!)) {
					valid = true;
				}
				okButton.enabled = valid;
				return valid;
			}).component();

			this._disposables.push(resourceGroupName.onTextChanged(async e => {
				await errorBox.updateCssStyles({
					'display': 'none'
				});
			}));

			const okButton = view.modelBuilder.button().withProps({
				label: constants.OK,
				width: '80px',
				enabled: false
			}).component();

			this._disposables.push(okButton.onDidClick(async e => {
				await errorBox.updateCssStyles({
					'display': 'none'
				});
				okButton.enabled = false;
				cancelButton.enabled = false;
				loading.loading = true;
				try {
					const resourceGroup = await createResourceGroup(this._azureAccount, this._subscription, resourceGroupName.value!, this._location);
					this._creationEvent.emit('done', resourceGroup);
				} catch (e) {
					await errorBox.updateCssStyles({
						'display': 'inline'
					});
					errorBox.text = e.toString();
					cancelButton.enabled = true;
					await resourceGroupName.validate();
				} finally {
					loading.loading = false;
				}
			}));

			const cancelButton = view.modelBuilder.button().withProps({
				label: constants.CANCEL,
				width: '80px'
			}).component();

			this._disposables.push(cancelButton.onDidClick(e => {
				this._creationEvent.emit('done', undefined);
			}));

			const loading = view.modelBuilder.loadingComponent().withProps({
				loading: false,
				loadingText: constants.CREATING_RESOURCE_GROUP,
				loadingCompletedText: constants.RESOURCE_GROUP_CREATED
			}).component();


			const buttonContainer = view.modelBuilder.flexContainer().withProps({
				CSSStyles: {
					'margin-top': '5px'
				}
			}).component();

			buttonContainer.addItem(okButton, {
				flex: '0',
				CSSStyles: {
					'width': '80px'
				}
			});

			buttonContainer.addItem(cancelButton, {
				flex: '0',
				CSSStyles: {
					'margin-left': '8px',
					'width': '80px'
				}
			});

			buttonContainer.addItem(loading, {
				flex: '0',
				CSSStyles: {
					'margin-left': '8px'
				}
			});

			const errorBox = this._view.modelBuilder.infoBox().withProps({
				style: 'error',
				text: '',
				CSSStyles: {
					'display': 'none'
				}
			}).component();

			const container = this._view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column'
			}).withItems([
				resourceGroupDescription,
				nameLabel,
				resourceGroupName,
				errorBox,
				buttonContainer
			]).component();

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: container
					}
				],
				{
					horizontal: false
				}
			);
			const form = formBuilder.withLayout({ width: '100%' }).withProps({
				CSSStyles: {
					'padding': '0px !important'
				}
			}).component();

			this._disposables.push(this._view.onClosed(e => {
				this._disposables.forEach(
					d => { try { d.dispose(); } catch { } });
			}));

			return view.initializeModel(form).then(async v => {
				await resourceGroupName.focus();
			});
		});
		this._dialogObject.okButton.label = constants.APPLY;
		this._dialogObject.content = [tab];
		azdata.window.openDialog(this._dialogObject);

		return new Promise((resolve) => {
			this._creationEvent.once('done', async (resourceGroup: azureResource.AzureResourceResourceGroup) => {
				azdata.window.closeDialog(this._dialogObject);
				resolve(resourceGroup);
			});
		});
	}
}
