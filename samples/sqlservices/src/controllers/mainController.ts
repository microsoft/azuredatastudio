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

		vscode.commands.registerCommand('sqlservices.openEditorWithWebView2', () => {
			this.openEditorWithWebview2();
		});

		vscode.commands.registerCommand('sqlservices.openWizard', () => {
			this.openWizard();
		});

		return Promise.resolve(true);
	}

	private async getTabContent(view: sqlops.ModelView, customButton1: sqlops.window.modelviewdialog.Button, customButton2: sqlops.window.modelviewdialog.Button, componentWidth: number | string): Promise<void> {
		let inputBox = view.modelBuilder.inputBox()
		.withProperties({
			multiline: true,
			height: 100
		}).component();
		let inputBoxWrapper = view.modelBuilder.loadingComponent().withItem(inputBox).component();
		inputBoxWrapper.loading = false;
		customButton1.onClick(() => {
			inputBoxWrapper.loading = true;
			setTimeout(() => inputBoxWrapper.loading = false, 5000);
		});
		let inputBox2 = view.modelBuilder.inputBox().component();
		let backupFilesInputBox = view.modelBuilder.inputBox().component();

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
			backupFilesInputBox.value = 'Button clicked';
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
			inputBox.value = dropdown.value.toString();
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
		let table = view.modelBuilder.table().withProperties({
			data: [
				['1', '2', '2'],
				['4', '5', '6'],
				['7', '8', '9']
			], columns: ['c1', 'c2', 'c3'],
			height: 250,
			selectedRows: [0]
		}).component();
		table.onRowSelected(e => {
			// TODO:
		});
		let listBox = view.modelBuilder.listBox().withProperties({
			values: ['1', '2', '3'],
			selectedRow: 2
		}).component();

		let declarativeTable = view.modelBuilder.declarativeTable()
		.withProperties({
			columns: [{
					displayName: 'Column 1',
					valueType: sqlops.DeclarativeDataType.string,
					width: '20px',
					isReadOnly: true
				}, {
					displayName: 'Column 2',
					valueType: sqlops.DeclarativeDataType.string,
					width: '100px',
					isReadOnly: false
				}, {
					displayName: 'Column 3',
					valueType: sqlops.DeclarativeDataType.boolean,
					width: '20px',
					isReadOnly: false
				}, {
					displayName: 'Column 4',
					valueType: sqlops.DeclarativeDataType.category,
					isReadOnly: false,
					width: '120px',
					categoryValues: [
						{ name: 'options1', displayName: 'option 1' },
						{ name: 'options2', displayName: 'option 2' }
					]
				}
			],
			data: [
				['Data00', 'Data01', false, 'options2'],
				['Data10', 'Data11', true, 'options1']
			]
		}).component();

		declarativeTable.onDataChanged(e => {
			inputBox2.value = e.row.toString() + ' ' + e.column.toString() + ' ' + e.value.toString();
			inputBox3.value = declarativeTable.data[e.row][e.column];
		});

		let flexRadioButtonsModel = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				alignItems: 'left',
				height: 150
			}).withItems([
				radioButton, groupModel1, radioButton2]
			, { flex: '1 1 50%' }).component();
		let formModel = view.modelBuilder.formContainer()
			.withFormItems([{
				component: inputBoxWrapper,
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
				component: backupFilesInputBox,
				title: 'Backup files',
				actions: [button, button3]
			}, {
				component: flexRadioButtonsModel,
				title: 'Options'
			}, {
				component: declarativeTable,
				title: 'Declarative Table'
			}, {
				component: table,
				title: 'Table'
			}, {
				component: listBox,
				title: 'List Box'
			}], {
				horizontal: false,
				componentWidth: componentWidth
			}).component();
		let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
		formWrapper.loading = false;
		customButton2.onClick(() => {
			formWrapper.loading = true;
			setTimeout(() => formWrapper.loading = false, 5000);
		});
		await view.initializeModel(formWrapper);
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
		let customButton1 = sqlops.window.modelviewdialog.createButton('Load name');
		customButton1.onClick(() => console.log('button 1 clicked!'));
		let customButton2 = sqlops.window.modelviewdialog.createButton('Load all');
		customButton2.onClick(() => console.log('button 2 clicked!'));
		dialog.customButtons = [customButton1, customButton2];
		tab1.registerContent(async (view) => {
			await this.getTabContent(view, customButton1, customButton2, 400);
		});
		sqlops.window.modelviewdialog.openDialog(dialog);
	}

	private openWizard(): void {
		let wizard = sqlops.window.modelviewdialog.createWizard('Test wizard');
		let page1 = sqlops.window.modelviewdialog.createWizardPage('First wizard page');
		let page2 = sqlops.window.modelviewdialog.createWizardPage('Second wizard page');
		page2.content = 'sqlservices';
		let customButton1 = sqlops.window.modelviewdialog.createButton('Load name');
		customButton1.onClick(() => console.log('button 1 clicked!'));
		let customButton2 = sqlops.window.modelviewdialog.createButton('Load all');
		customButton2.onClick(() => console.log('button 2 clicked!'));
		wizard.customButtons = [customButton1, customButton2];
		page1.registerContent(async (view) => {
			await this.getTabContent(view, customButton1, customButton2, 800);
		});
		wizard.pages = [page1, page2];
		wizard.open();
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
		let editor = sqlops.workspace.createModelViewEditor('Editor webview', { retainContextWhenHidden: true });
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

	private openEditorWithWebview2(): void {
		let editor = sqlops.workspace.createModelViewEditor('Editor webview2', { retainContextWhenHidden: true });
		editor.registerContent(async view => {

			let inputBox = view.modelBuilder.inputBox().component();
			let dropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: 'aa',
					values: ['aa', 'bb', 'cc']
				})
				.component();
			let runIcon = path.join(__dirname, '..', 'media', 'start.svg');
			let runButton = view.modelBuilder.button()
				.withProperties({
					label: 'Run',
					iconPath: runIcon
				}).component();

			let monitorLightPath = vscode.Uri.file(path.join(__dirname, '..', 'media', 'monitor.svg'));
			let monitorIcon = {
				light: monitorLightPath,
				dark: path.join(__dirname, '..', 'media', 'monitor_inverse.svg') };

			let monitorButton = view.modelBuilder.button()
					.withProperties({
						label: 'Monitor',
						iconPath: monitorIcon
					}).component();
			let toolbarModel = view.modelBuilder.toolbarContainer()
				.withToolbarItems([{
					component: inputBox,
					title: 'User name:'
				}, {
					component: dropdown,
					title: 'favorite:'
				}, {
					component: runButton
				}, {
					component: monitorButton
				}]).component();


			let webview = view.modelBuilder.webView()
				.component();

			let flexModel = view.modelBuilder.flexContainer().component();
			flexModel.addItem(toolbarModel, { flex: '0' });
			flexModel.addItem(webview, { flex: '1' });
			flexModel.setLayout({
				flexFlow: 'column',
				alignItems: 'stretch',
				height: '100%'
			});

			let templateValues = { url: 'http://whoisactive.com/docs/' };
			Utils.renderTemplateHtml(path.join(__dirname, '..'), 'templateTab.html', templateValues)
				.then(html => {
					webview.html = html;
				});

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

