/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as Utils from '../utils';
import * as vscode from 'vscode';
import SplitPropertiesPanel from './splitPropertiesPanel';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {

	constructor(protected context: vscode.ExtensionContext) {

	}

	// PUBLIC METHODS //////////////////////////////////////////////////////

	public dispose(): void {
		this.deactivate();
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
		Utils.logDebug('Main controller deactivated');
	}

	public activate(): Promise<boolean> {
		const buttonHtml = fs.readFileSync(path.join(__dirname, 'button.html')).toString();
		const counterHtml = fs.readFileSync(path.join(__dirname, 'counter.html')).toString();
		this.registerSqlServicesModelView();
		this.registerSplitPanelModelView();

		sqlops.tasks.registerTask('sqlservices.clickTask', (profile) => {
			vscode.window.showInformationMessage(`Clicked from profile ${profile.serverName}.${profile.databaseName}`);
		});

		vscode.commands.registerCommand('sqlservices.openDialog', () => {
			this.openDialog();
		});

		vscode.commands.registerCommand('sqlservices.openEditor', () => {
			this.openEditor();
		});

		vscode.commands.registerCommand('sqlservices.openEditorWithWebView', () => {
			this.openEditorWithWebview(buttonHtml, counterHtml);
		});

		return Promise.resolve(true);
	}

	private openDialog(): void {
		let dialog = sqlops.window.modelviewdialog.createDialog('Test dialog');
		let tab1 = sqlops.window.modelviewdialog.createTab('Test tab 1');

		let tab2 = sqlops.window.modelviewdialog.createTab('Test tab 2');
		tab2.content = 'sqlservices';
		dialog.content = [tab1, tab2];
		dialog.okButton.onClick(() => console.log('ok clicked!'));
		dialog.cancelButton.onClick(() => console.log('cancel clicked!'));
		dialog.okButton.label = 'ok';
		dialog.cancelButton.label = 'no';
		let customButton1 = sqlops.window.modelviewdialog.createButton('Test button 1');
		customButton1.onClick(() => console.log('button 1 clicked!'));
		let customButton2 = sqlops.window.modelviewdialog.createButton('Test button 2');
		customButton2.onClick(() => console.log('button 2 clicked!'));
		dialog.customButtons = [customButton1, customButton2];
		tab1.registerContent(async (view) => {
			let inputBox = view.modelBuilder.inputBox()
				.withProperties({
					//width: 300
				}).component();
			let inputBox2 = view.modelBuilder.inputBox().component();

			let checkbox = view.modelBuilder.checkBox()
				.withProperties({
					label: 'Copy-only backup'
				})
				.component();
			checkbox.onChanged(e => {
				console.info("inputBox.enabled " + inputBox.enabled);
				inputBox.enabled = !inputBox.enabled;
			});
			let button = view.modelBuilder.button()
				.withProperties({
					label: '+'
				}).component();
			let button3 = view.modelBuilder.button()
				.withProperties({
					label: '-'

				}).component();
			let button2 = view.modelBuilder.button()
				.component();
			button.onDidClick(e => {
				inputBox2.value = 'Button clicked';
			});
			let dropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: 'Full',
					values: ['Full', 'Differential', 'Transaction Log']
				})
				.component();
			let f = 0;
			inputBox.onTextChanged((params) => {
				vscode.window.showInformationMessage(inputBox.value);
				f = f + 1;
				inputBox2.value = f.toString();
			});
			dropdown.onValueChanged((params) => {
				vscode.window.showInformationMessage(inputBox2.value);
				inputBox.value = dropdown.value;
			});
			let radioButton = view.modelBuilder.radioButton()
				.withProperties({
					value: 'option1',
					name: 'radioButtonOptions',
					label: 'Option 1',
					checked: true
					//width: 300
				}).component();
			let radioButton2 = view.modelBuilder.radioButton()
				.withProperties({
					value: 'option2',
					name: 'radioButtonOptions',
					label: 'Option 2'
				}).component();
			let inputBox3 = view.modelBuilder.inputBox().component();
			let inputBox4 = view.modelBuilder.inputBox().component();
			let form2Model = view.modelBuilder.formContainer()
				.withFormItems([{
					component: inputBox3,
					title: 'inputBox3'
				}, {
					component: inputBox4,
					title: 'inputBox4'
				}], {
					horizontal: true
				}).component();
			let groupModel1 = view.modelBuilder.groupContainer()
				.withLayout({
				}).withItems([
					form2Model
				]).component();
			radioButton.onDidClick(() => {
				inputBox.value = radioButton.value;
				groupModel1.enabled = true;
			});
			radioButton2.onDidClick(() => {
				inputBox.value = radioButton.value;
				groupModel1.enabled = false;
			});

			let flexRadioButtonsModel = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column',
					alignItems: 'left',
					height: 50
				}).withItems([
					radioButton, groupModel1, radioButton2]
				, { flex: '1 1 50%' }).component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: inputBox,
					title: 'Backup name'
				}, {
					component: inputBox2,
					title: 'Recovery model'
				}, {
					component: dropdown,
					title: 'Backup type'
				}, {
					component: checkbox,
					title: ''
				}, {
					component: inputBox2,
					title: 'Backup files',
					actions: [button, button3]
				}, {
					component: flexRadioButtonsModel,
					title: 'Options'
				}], {
					horizontal: false,
					componentWidth: 400
				}).component();
			await view.initializeModel(formModel);
		});

		sqlops.window.modelviewdialog.openDialog(dialog);
	}

	private openEditor(): void {
		let editor = sqlops.workspace.createModelViewEditor('Test Model View');
		editor.registerContent(async view => {
			let inputBox = view.modelBuilder.inputBox()
				.withValidation(component => component.value !== 'valid')
				.component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: inputBox,
					title: 'Enter anything but "valid"'
				}]).component();
			view.onClosed((params) => {
				vscode.window.showInformationMessage('The model view editor is closed.');
			});
			await view.initializeModel(formModel);
		});
		editor.openEditor();
	}

	private openEditorWithWebview(html1: string, html2: string): void {
		let editor = sqlops.workspace.createModelViewEditor('Editor view1', { retainContextWhenHidden: true });
		editor.registerContent(async view => {
			let count = 0;
			let webview1 = view.modelBuilder.webView()
				.withProperties({
					html: html1
				})
				.component();
			let webview2 = view.modelBuilder.webView()
				.withProperties({
					html: html2
				})
				.component();
			webview1.onMessage((params) => {
				count++;
				webview2.message = count;
			});

			let flexModel = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column',
					alignItems: 'flex-start',
					height: 500
				}).withItems([
					webview1, webview2
				], { flex: '1 1 50%' })
				.component();
			await view.initializeModel(flexModel);
		});
		editor.openEditor();
	}

	private registerSqlServicesModelView(): void {
		sqlops.ui.registerModelViewProvider('sqlservices', async (view) => {
			let flexModel = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'row',
					alignItems: 'center'
				}).withItems([
					// 1st child panel with N cards
					view.modelBuilder.flexContainer()
						.withLayout({
							flexFlow: 'column',
							alignItems: 'center',
							justifyContent: 'center'
						})
						.withItems([
							view.modelBuilder.card()
								.withProperties<sqlops.CardProperties>({
									label: 'label1',
									value: 'value1',
									actions: [{ label: 'action' }]
								})
								.component()
						]).component(),
					// 2nd child panel with N cards
					view.modelBuilder.flexContainer()
						.withLayout({ flexFlow: 'column' })
						.withItems([
							view.modelBuilder.card()
								.withProperties<sqlops.CardProperties>({
									label: 'label2',
									value: 'value2',
									actions: [{ label: 'action' }]
								})
								.component()
						]).component()
				], { flex: '1 1 50%' })
				.component();
			await view.initializeModel(flexModel);
		});
	}

	private registerSplitPanelModelView(): void {
		sqlops.ui.registerModelViewProvider('splitPanel', async (view) => {
			let numPanels = 3;
			let splitPanel = new SplitPropertiesPanel(view, numPanels);
			await view.initializeModel(splitPanel.modelBase);

			// Add a bunch of cards after an initial timeout
			setTimeout(async () => {

				for (let i = 0; i < 10; i++) {
					let panel = i % numPanels;
					let card = view.modelBuilder.card().component();
					card.label = `label${i.toString()}`;

					splitPanel.addItem(card, panel);
				}

			}, 0);

		});
	}
}

