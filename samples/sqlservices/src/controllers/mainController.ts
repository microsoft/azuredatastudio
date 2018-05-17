/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as Utils from '../utils';
import * as vscode from 'vscode';
import SplitPropertiesPanel from './splitPropertiesPanel';

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
		this.registerSqlServicesModelView();
		this.registerSplitPanelModelView();

		sqlops.tasks.registerTask('sqlservices.clickTask', (profile) => {
			vscode.window.showInformationMessage(`Clicked from profile ${profile.serverName}.${profile.databaseName}`);
		});

		vscode.commands.registerCommand('mssql.openDialog', () =>  {
			this.openDialog();
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
			})
			.component();
			let inputBox2 = view.modelBuilder.inputBox()
			.component();

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
				inputBox2.value=f.toString();
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

            //width: 300
			}).component();
			let flexRadioButtonsModel = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column',
					alignItems: 'left',
					justifyContent: 'space-evenly',
					height: 50
			}).withItems([
				radioButton, radioButton2]
				, { flex: '1 1 50%' }).component();
			let formModel = view.modelBuilder.formContainer()
			.withFormItems([{
						component: inputBox,
						title: 'Backup name'
				}, {
						component: inputBox2,
						title: 'Recovery model'
				}, {
						component:dropdown,
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
						horizontal:false,
						width: 500,
						componentWidth: 400
							}).component();
			await view.initializeModel(formModel);
		});

		sqlops.window.modelviewdialog.openDialog(dialog);
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

