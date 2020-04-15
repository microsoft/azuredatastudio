/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as Utils from '../utils';
import * as vscode from 'vscode';
import SplitPropertiesPanel from './splitPropertiesPanel';
import * as fs from 'fs';
import * as path from 'path';
import { TreeNode, TreeDataProvider } from './treeDataProvider';
import * as dashboard from './modelViewDashboard';

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

		azdata.tasks.registerTask('sqlservices.clickTask', (profile) => {
			vscode.window.showInformationMessage(`Clicked from profile ${profile.serverName}.${profile.databaseName}`);
		});

		vscode.commands.registerCommand('sqlservices.openDialog', () => {
			this.openDialog();
		});

		vscode.commands.registerCommand('sqlservices.openConnectionDialog', async () => {
			let connection = await azdata.connection.openConnectionDialog();
			if (connection) {
				console.info('Connection Opened: ' + connection.options['server']);
			}
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

		vscode.commands.registerCommand('sqlservices.openModelViewDashboard', () => {
			dashboard.openModelViewDashboard(this.context);
		});

		return Promise.resolve(true);
	}

	private async getTab3Content(view: azdata.ModelView): Promise<void> {
		let treeData = {
			label: '1',
			children: [
				{
					label: '11',
					id: '11',
					children: [
						{
							label: '111',
							id: '111',
							checked: false
						},
						{
							label: '112',
							id: '112',
							children: [
								{
									label: '1121',
									id: '1121',
									checked: true
								},
								{
									label: '1122',
									id: '1122',
									checked: false
								}
							]
						}
					]
				},
				{
					label: '12',
					id: '12',
					checked: true
				}
			],
			id: '1'
		};
		let root = TreeNode.createTree(treeData);

		let treeDataProvider = new TreeDataProvider(root);

		let tree: azdata.TreeComponent<TreeNode> = view.modelBuilder.tree<TreeNode>().withProperties({
			'withCheckbox': true
		}).component();
		let treeView = tree.registerDataProvider(treeDataProvider);
		treeView.onNodeCheckedChanged(item => {
			if (item && item.element) {
				item.element.changeNodeCheckedState(item.checked);
			}
		});
		treeView.onDidChangeSelection(selectedNodes => {
			if (selectedNodes && selectedNodes.selection) {
				selectedNodes.selection.forEach(node => {
					console.info('tree node selected: ' + node.label);
				});
			}
		});
		let formModel = view.modelBuilder.formContainer()
			.withFormItems([{
				component: tree,
				title: 'Tree'
			}], {
				horizontal: false,
				componentWidth: 800,
				componentHeight: 800
			}).component();
		let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
		formWrapper.loading = false;

		await view.initializeModel(formWrapper);
	}
	private async getTabContent(view: azdata.ModelView, customButton1: azdata.window.Button, customButton2: azdata.window.Button, componentWidth: number | string
	): Promise<void> {
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
			console.info('inputBox.enabled ' + inputBox.enabled);
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
			console.info('dropdown change ' + dropdown.value.toString());
		});
		let radioButton = view.modelBuilder.radioButton()
			.withProperties({
				value: 'option1',
				name: 'radioButtonOptions',
				label: 'Option 1',
				checked: true
				// width: 300
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
					valueType: azdata.DeclarativeDataType.string,
					width: '20px',
					isReadOnly: true
				}, {
					displayName: 'Column 2',
					valueType: azdata.DeclarativeDataType.string,
					width: '100px',
					isReadOnly: false
				}, {
					displayName: 'Column 3',
					valueType: azdata.DeclarativeDataType.boolean,
					width: '20px',
					isReadOnly: false
				}, {
					displayName: 'Column 4',
					valueType: azdata.DeclarativeDataType.category,
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
				height: 150
			}).withItems([
				radioButton, groupModel1, radioButton2]
				, { flex: '1 1 50%' }).component();
		let formItemLayout = {
			horizontal: false,
			componentWidth: componentWidth
		};
		let formBuilder = view.modelBuilder.formContainer()
			.withFormItems([{
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
			}], formItemLayout);
		let groupItems = {
			components: [{
				component: table,
				title: 'Table'
			}, {
				component: listBox,
				title: 'List Box'
			}], title: 'group'
		};
		formBuilder.addFormItem(groupItems, formItemLayout);

		formBuilder.insertFormItem({
			component: inputBoxWrapper,
			title: 'Backup name'
		}, 0, formItemLayout);
		formBuilder.insertFormItem({
			component: inputBox2,
			title: 'Recovery model'
		}, 1, formItemLayout);
		formBuilder.insertFormItem({
			component: dropdown,
			title: 'Backup type'
		}, 2, formItemLayout);
		let formModel = formBuilder.component();
		let inputBox6 = view.modelBuilder.inputBox().component();
		inputBox6.onTextChanged(e => {
			console.info('textbox6 changed: ' + inputBox6.value);
		});
		radioButton.onDidClick(() => {
			inputBox.value = radioButton.value;
			groupModel1.enabled = true;

			formBuilder.insertFormItem({
				component: dropdown,
				title: 'Backup type'
			}, 2, formItemLayout);
			flexRadioButtonsModel.addItem(inputBox6, { flex: '1 1 50%' });
			formBuilder.addFormItem(groupItems, formItemLayout);
		});

		radioButton2.onDidClick(() => {
			inputBox.value = radioButton.value;
			groupModel1.enabled = false;
			formBuilder.removeFormItem({
				component: dropdown,
				title: 'Backup type'
			});
			flexRadioButtonsModel.removeItem(inputBox6);
			formBuilder.removeFormItem(groupItems);
		});
		let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
		formWrapper.loading = false;
		customButton2.onClick(() => {
			formWrapper.loading = true;
			setTimeout(() => formWrapper.loading = false, 5000);
		});
		await view.initializeModel(formWrapper);
	}

	private openDialog(): void {
		let dialog = azdata.window.createModelViewDialog('Test dialog');
		let tab1 = azdata.window.createTab('Test tab 1');

		let tab2 = azdata.window.createTab('Test tab 2');
		let tab3 = azdata.window.createTab('Test tab 3');
		tab2.content = 'sqlservices';
		dialog.content = [tab1, tab2, tab3];
		dialog.okButton.onClick(() => console.log('ok clicked!'));
		dialog.cancelButton.onClick(() => console.log('cancel clicked!'));
		dialog.okButton.label = 'ok';
		dialog.cancelButton.label = 'no';
		let customButton1 = azdata.window.createButton('Load name');
		customButton1.onClick(() => console.log('button 1 clicked!'));
		let customButton2 = azdata.window.createButton('Load all');
		customButton2.onClick(() => console.log('button 2 clicked!'));
		dialog.customButtons = [customButton1, customButton2];
		tab1.registerContent(async (view) => {
			await this.getTabContent(view, customButton1, customButton2, 400);
		});

		tab3.registerContent(async (view) => {
			await this.getTab3Content(view);
		});
		azdata.window.openDialog(dialog);
	}

	private openWizard(): void {
		let wizard = azdata.window.createWizard('Test wizard');
		let page1 = azdata.window.createWizardPage('First wizard page');
		let page2 = azdata.window.createWizardPage('Second wizard page');
		page2.content = 'sqlservices';
		let customButton1 = azdata.window.createButton('Load name');
		customButton1.onClick(() => console.log('button 1 clicked!'));
		let customButton2 = azdata.window.createButton('Load all');
		customButton2.onClick(() => console.log('button 2 clicked!'));
		wizard.customButtons = [customButton1, customButton2];
		page1.registerContent(async (view) => {
			await this.getTabContent(view, customButton1, customButton2, 800);
		});

		wizard.registerOperation({
			displayName: 'test task',
			description: 'task description',
			isCancelable: true,
			connection: undefined,
			operation: op => {
				op.updateStatus(azdata.TaskStatus.InProgress);
				op.updateStatus(azdata.TaskStatus.InProgress, 'Task is running');
				setTimeout(() => {
					op.updateStatus(azdata.TaskStatus.Succeeded);
				}, 5000);
			}
		});
		wizard.pages = [page1, page2];
		wizard.open();
	}

	private openEditor(): void {
		let editor = azdata.workspace.createModelViewEditor('Test Model View');
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
		let editor = azdata.workspace.createModelViewEditor('Editor webview', { retainContextWhenHidden: true });
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

			let editor1 = view.modelBuilder.editor()
				.withProperties({
					content: 'select * from sys.tables'
				})
				.component();

			let editor2 = view.modelBuilder.editor()
				.withProperties({
					content: 'print("Hello World !")',
					languageMode: 'python'
				})
				.component();

			let flexModel = view.modelBuilder.flexContainer().component();
			flexModel.addItem(editor1, { flex: '1' });
			flexModel.addItem(editor2, { flex: '1' });
			flexModel.setLayout({
				flexFlow: 'column',
				alignItems: 'stretch',
				height: '100%'
			});

			view.onClosed((params) => {
				vscode.window.showInformationMessage('editor1: language: ' + editor1.languageMode + ' Content1: ' + editor1.content);
				vscode.window.showInformationMessage('editor2: language: ' + editor2.languageMode + ' Content2: ' + editor2.content);
			});
			await view.initializeModel(flexModel);
		});
		editor.openEditor();
	}

	private openEditorWithWebview2(): void {
		let editor = azdata.workspace.createModelViewEditor('Editor webview2', { retainContextWhenHidden: true });
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
					iconPath: runIcon,
					title: 'Run title'
				}).component();

			let monitorLightPath = vscode.Uri.file(path.join(__dirname, '..', 'media', 'monitor.svg'));
			let monitorIcon = {
				light: monitorLightPath,
				dark: path.join(__dirname, '..', 'media', 'monitor_inverse.svg')
			};

			let monitorButton = view.modelBuilder.button()
				.withProperties({
					label: 'Monitor',
					iconPath: monitorIcon,
					title: 'Monitor title'
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
		azdata.ui.registerModelViewProvider('sqlservices', async (view) => {
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
								.withProperties<azdata.CardProperties>({
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
								.withProperties<azdata.CardProperties>({
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
		azdata.ui.registerModelViewProvider('splitPanel', async (view) => {
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

