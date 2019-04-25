/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as os from 'os';
import { SchemaCompareOptionsDialog } from './dialogs/schemaCompareOptionsDialog';
import * as path from 'path';
const localize = nls.loadMessageBundle();

export class SchemaCompareResult {
	private differencesTable: azdata.TableComponent;
	private diffViewTopPane: azdata.FlexContainer;
	private includeComponent: azdata.TableComponent;
	private checkboxList: azdata.FlexContainer;
	private checkBoxes: azdata.CheckBoxComponent[] = [];
	private lastCheckBoxes: azdata.CheckBoxComponent[] = [];
	private loader: azdata.LoadingComponent;
	private editor: azdata.workspace.ModelViewEditor;
	private diffEditor: azdata.DiffEditorComponent;
	private splitView: azdata.SplitViewContainer;
	private flexModel: azdata.FlexContainer;
	private noDifferencesLabel: azdata.TextComponent;
	private sourceTargetFlexLayout: azdata.FlexContainer;
	private switchButton: azdata.ButtonComponent;
	private compareButton: azdata.ButtonComponent;
	private optionsButton: azdata.ButtonComponent;
	private generateScriptButton: azdata.ButtonComponent;
	private applyButton: azdata.ButtonComponent;
	private SchemaCompareActionMap: Map<Number, string>;
	private comparisonResult: azdata.SchemaCompareResult;
	private lastComparisonResult: azdata.SchemaCompareResult;
	private sourceNameComponent: azdata.TableComponent;
	private targetNameComponent: azdata.TableComponent;
	private deploymentOptions: azdata.DeploymentOptions;
	private schemaCompareOptionDialog: SchemaCompareOptionsDialog;
	private viewModel: azdata.ModelView;

	constructor(private sourceName: string, private targetName: string, private sourceEndpointInfo: azdata.SchemaCompareEndpointInfo, private targetEndpointInfo: azdata.SchemaCompareEndpointInfo) {
		this.SchemaCompareActionMap = new Map<Number, string>();
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Delete] = localize('schemaCompare.deleteAction', 'Delete');
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Change] = localize('schemaCompare.changeAction', 'Change');
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Add] = localize('schemaCompare.addAction', 'Add');

		this.editor = azdata.workspace.createModelViewEditor(localize('schemaCompare.Title', 'Schema Compare'), { retainContextWhenHidden: true, supportsSave: true });
		this.GetDefaultDeploymentOptions();

		this.editor.registerContent(async view => {

			this.viewModel = view;
			this.differencesTable = view.modelBuilder.table().withProperties({
				data: [],
				height: 300
			}).component();

			this.diffViewTopPane = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'row'
			}).withProperties({
				alignItems: 'stretch',
				horizontal: true
			}).component();

			this.checkboxList = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column'
			}).component();

			this.includeComponent = view.modelBuilder.table().withProperties({
				data: [],
				height: 28,
			}).component();

			this.diffEditor = view.modelBuilder.diffeditor().withProperties({
				contentLeft: os.EOL,
				contentRight: os.EOL,
				height: 500,
				title: localize('schemaCompare.ObjectDefinitionsTitle', 'Object Definitions')
			}).component();

			this.splitView = view.modelBuilder.splitViewContainer().component();

			let sourceTargetLabels = view.modelBuilder.flexContainer()
				.withProperties({
					alignItems: 'stretch',
					horizontal: true
				}).component();

			this.sourceTargetFlexLayout = view.modelBuilder.flexContainer()
				.withProperties({
					alignItems: 'stretch',
					horizontal: true
				}).component();

			this.createSwitchButton(view);
			this.createCompareButton(view);
			this.createGenerateScriptButton(view);
			this.createApplyButton(view);
			this.createOptionsButton(view);
			this.resetButtons();

			let toolBar = view.modelBuilder.toolbarContainer();
			toolBar.addToolbarItems([{
				component: this.compareButton
			}, {
				component: this.generateScriptButton
			}, {
				component: this.applyButton
			}, {
				component: this.optionsButton,
				toolbarSeparatorAfter: true
			}, {
				component: this.switchButton
			}]);

			let sourceLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.sourceLabel', 'Source')
			}).component();

			let targetLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.targetLabel', 'Target')
			}).component();

			let arrowLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.switchLabel', '➔')
			}).component();

			this.sourceNameComponent = view.modelBuilder.table().withProperties({
				columns: [
					{
						value: sourceName,
						headerCssClass: 'no-borders',
						toolTip: sourceName
					},
				]
			}).component();

			this.targetNameComponent = view.modelBuilder.table().withProperties({
				columns: [
					{
						value: targetName,
						headerCssClass: 'no-borders',
						toolTip: targetName
					},
				]
			}).component();

			sourceTargetLabels.addItem(sourceLabel, { CSSStyles: { 'width': '55%', 'margin-left': '15px', 'font-size': 'larger', 'font-weight': 'bold' } });
			sourceTargetLabels.addItem(targetLabel, { CSSStyles: { 'width': '45%', 'font-size': 'larger', 'font-weight': 'bold' } });
			this.sourceTargetFlexLayout.addItem(this.sourceNameComponent, { CSSStyles: { 'width': '45%', 'height': '25px', 'margin-top': '10px', 'margin-left': '15px' } });
			this.sourceTargetFlexLayout.addItem(arrowLabel, { CSSStyles: { 'width': '10%', 'font-size': 'larger', 'text-align-last': 'center' } });
			this.sourceTargetFlexLayout.addItem(this.targetNameComponent, { CSSStyles: { 'width': '45%', 'height': '25px', 'margin-top': '10px', 'margin-left': '15px' } });

			this.loader = view.modelBuilder.loadingComponent().component();
			this.noDifferencesLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.noDifferences', 'No schema differences were found')
			}).component();

			this.flexModel = view.modelBuilder.flexContainer().component();
			this.flexModel.addItem(toolBar.component(), { flex: 'none' });
			this.flexModel.addItem(sourceTargetLabels, { flex: 'none' });
			this.flexModel.addItem(this.sourceTargetFlexLayout, { flex: 'none' });
			this.flexModel.addItem(this.loader, { CSSStyles: { 'margin-top': '30px' } });
			this.flexModel.setLayout({
				flexFlow: 'column',
				height: '100%'
			});

			await view.initializeModel(this.flexModel);
		});
	}

	public start(): void {
		this.editor.openEditor();
		this.execute();
	}

	private async execute(): Promise<void> {
		if (this.schemaCompareOptionDialog && this.schemaCompareOptionDialog.deploymentOptions) {
			// take updates if any
			this.deploymentOptions = this.schemaCompareOptionDialog.deploymentOptions;
		}

		let service = await SchemaCompareResult.getService('MSSQL');
		this.comparisonResult = await service.schemaCompare(this.sourceEndpointInfo, this.targetEndpointInfo, azdata.TaskExecutionMode.execute, this.deploymentOptions);
		if (!this.comparisonResult || !this.comparisonResult.success) {
			vscode.window.showErrorMessage(localize('schemaCompare.compareErrorMessage', "Schema Compare failed: {0}", this.comparisonResult.errorMessage ? this.comparisonResult.errorMessage : 'Unknown'));
			return;
		}

		let data = this.getAllDifferences(this.comparisonResult.differences);

		this.differencesTable.updateProperties({
			data: data,
			columns: [
				{
					value: localize('schemaCompare.typeColumn', 'Type'),
					cssClass: 'align-with-header',
					width: 50
				},
				{
					value: localize('schemaCompare.sourceNameColumn', 'Target Name'),
					cssClass: 'align-with-header',
					width: 90
				},
				{
					value: localize('schemaCompare.actionColumn', 'Action'),
					cssClass: 'align-with-header',
					width: 30
				},
				{
					value: localize('schemaCompare.targetNameColumn', 'Source Name'),
					cssClass: 'align-with-header',
					width: 150
				}]
		});

		this.includeComponent.updateProperties({
			data: [],
			columns: [
				{
					value: localize('schemaCompare.Include', 'Include'),
					cssClass: 'center-align',
					width: 25
				}
			]
		});

		this.checkboxList.clearItems();
		this.checkboxList.addItem(this.includeComponent);
		this.checkBoxes.forEach(box => this.checkboxList.addItem(box, { CSSStyles: { 'height': '24px', 'border-bottom': '1px #BDBDBD solid', 'border-right': '1px #BDBDBD dotted' } }));
		this.diffViewTopPane.addItem(this.checkboxList, { CSSStyles: { 'margin-left': '10px', 'width': '4%' } });
		this.diffViewTopPane.addItem(this.differencesTable, { CSSStyles: { 'width': '96%' } });

		this.splitView.addItem(this.diffViewTopPane);
		this.splitView.addItem(this.diffEditor);
		this.splitView.setLayout({
			orientation: 'vertical',
			splitViewHeight: 800
		});

		this.flexModel.removeItem(this.loader);
		this.switchButton.enabled = true;
		this.compareButton.enabled = true;
		this.optionsButton.enabled = true;

		if (this.comparisonResult.differences.length > 0) {
			this.flexModel.addItem(this.splitView);

			// only enable generate script button if the target is a db
			if (this.targetEndpointInfo.endpointType === azdata.SchemaCompareEndpointType.database) {
				this.generateScriptButton.enabled = true;
				this.applyButton.enabled = true;
			} else {
				this.generateScriptButton.title = localize('schemaCompare.generateScriptButtonDisabledTitle', 'Generate script is enabled when the target is a database');
				this.applyButton.title = localize('schemaCompare.applyButtonDisabledTitle', 'Apply is enabled when the target is a database');
			}
		} else {
			this.flexModel.addItem(this.noDifferencesLabel, { CSSStyles: { 'margin': 'auto' } });
		}

		let sourceText = '';
		let targetText = '';
		this.differencesTable.onRowSelected(() => {
			let difference = this.comparisonResult.differences[this.differencesTable.selectedRows[0]];
			if (difference !== undefined) {
				sourceText = difference.sourceScript === null ? '\n' : this.getAggregatedScript(difference, true);
				targetText = difference.targetScript === null ? '\n' : this.getAggregatedScript(difference, false);

				this.diffEditor.updateProperties({
					contentLeft: sourceText,
					contentRight: targetText,
					title: localize('schemaCompare.ObjectDefinitionsTitle', 'Object Definitions')
				});
			}
		});
	}

	private getAllDifferences(differences: azdata.DiffEntry[]): string[][] {
		let data = [];
		this.checkBoxes = [];
		if (differences) {
			differences.forEach(difference => {
				if (difference.differenceType === azdata.SchemaDifferenceType.Object) {
					if (difference.sourceValue !== null || difference.targetValue !== null) {
						let checkbox: azdata.CheckBoxComponent = this.viewModel.modelBuilder.checkBox().withProperties({
							checked: this.populateFromState(difference)
						}).component();

						checkbox.onChanged(async () => {
							if (checkbox.checked) {
								let service = await SchemaCompareResult.getService('MSSQL');
								let result = await service.schemaCompareIncludeExcludeNode(this.comparisonResult.operationId, difference, true, azdata.TaskExecutionMode.execute);
								if (!result || !result.success) {
									vscode.window.showErrorMessage(
										localize('schemaCompare.includeNodeErrorMessage', "Include Node failed. Reason: '{0}'", (result && result.errorMessage) ? result.errorMessage : 'Unknown'));
								}
							}
							else {
								let service = await SchemaCompareResult.getService('MSSQL');
								let result = await service.schemaCompareIncludeExcludeNode(this.comparisonResult.operationId, difference, false, azdata.TaskExecutionMode.execute);
								if (!result || !result.success) {
									vscode.window.showErrorMessage(
										localize('schemaCompare.excludeNodeErrorMessage', "Exclude Node failed. Reason: '{0}'", (result && result.errorMessage) ? result.errorMessage : 'Unknown'));
								}
							}
						});
						this.checkBoxes.push(checkbox);
						data.push([difference.name, difference.sourceValue, this.SchemaCompareActionMap[difference.updateAction], difference.targetValue]);
					}
				}
			});
		}

		return data;
	}

	private getAggregatedScript(diffEntry: azdata.DiffEntry, getSourceScript: boolean): string {
		let script = '';
		if (diffEntry !== null) {
			script += getSourceScript ? diffEntry.sourceScript : diffEntry.targetScript;
			diffEntry.children.forEach(child => {
				let childScript = this.getAggregatedScript(child, getSourceScript);
				if (childScript !== 'null') {
					script += childScript;
				}
			});
		}
		return script;
	}

	private populateFromState(diffEntry: azdata.DiffEntry): boolean {
		if (!this.lastComparisonResult || !this.lastCheckBoxes) {
			return true;
		}
		let lastIndex = this.lastComparisonResult.differences.findIndex(x => x.sourceValue === diffEntry.sourceValue && x.targetValue === diffEntry.targetValue && x.name === diffEntry.name);
		if (lastIndex === -1 || lastIndex >= this.lastCheckBoxes.length) {
			// couldnt find the change or the check box corresponsing to it
			return true;
		}
		return this.lastCheckBoxes[lastIndex].checked;
	}

	private reExecute(): void {
		this.flexModel.removeItem(this.splitView);
		this.flexModel.removeItem(this.noDifferencesLabel);
		this.flexModel.addItem(this.loader, { CSSStyles: { 'margin-top': '30px' } });
		this.diffEditor.updateProperties({
			contentLeft: os.EOL,
			contentRight: os.EOL
		});
		this.differencesTable.selectedRows = null;
		this.resetButtons();

		this.lastCheckBoxes = this.checkBoxes;
		this.lastComparisonResult = this.comparisonResult; //To populate state related UX

		this.execute();
	}

	private createCompareButton(view: azdata.ModelView): void {
		this.compareButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.compareButton', 'Compare'),
			iconPath: {
				light: path.join(__dirname, 'media', 'compare.svg'),
				dark: path.join(__dirname, 'media', 'compare-inverse.svg')
			},
			title: localize('schemaCompare.compareButtonTitle', 'Compare')
		}).component();

		this.compareButton.onDidClick(async (click) => {
			this.reExecute();
		});
	}

	private createGenerateScriptButton(view: azdata.ModelView): void {
		this.generateScriptButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.generateScriptButton', 'Generate script'),
			iconPath: {
				light: path.join(__dirname, 'media', 'generate-script.svg'),
				dark: path.join(__dirname, 'media', 'generate-script-inverse.svg')
			},
		}).component();

		this.generateScriptButton.onDidClick(async (click) => {
			// get file path
			let now = new Date();
			let datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes() + '-' + now.getSeconds();
			let defaultFilePath = path.join(os.homedir(), this.targetName + '_Update_' + datetime + '.sql');
			let fileUri = await vscode.window.showSaveDialog(
				{
					defaultUri: vscode.Uri.file(defaultFilePath),
					saveLabel: localize('schemaCompare.saveFile', 'Save'),
					filters: {
						'SQL Files': ['sql'],
					}
				}
			);

			if (!fileUri) {
				return;
			}

			let service = await SchemaCompareResult.getService('MSSQL');
			let result = await service.schemaCompareGenerateScript(this.comparisonResult.operationId, this.targetEndpointInfo.databaseName, fileUri.fsPath, azdata.TaskExecutionMode.execute);
			if (!result || !result.success) {
				vscode.window.showErrorMessage(
					localize('schemaCompare.generateScriptErrorMessage', "Generate script failed: '{0}'", (result && result.errorMessage) ? result.errorMessage : 'Unknown'));
			}
		});
	}

	private createOptionsButton(view: azdata.ModelView) {
		this.optionsButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.optionsButton', 'Options'),
			iconPath: {
				light: path.join(__dirname, 'media', 'options.svg'),
				dark: path.join(__dirname, 'media', 'options_reverse.svg')
			},
			title: localize('schemaCompare.optionsButtonTitle', 'Options')
		}).component();

		this.optionsButton.onDidClick(async (click) => {
			//restore options from last time
			if (this.schemaCompareOptionDialog && this.schemaCompareOptionDialog.deploymentOptions) {
				this.deploymentOptions = this.schemaCompareOptionDialog.deploymentOptions;
			}
			// create fresh every time
			this.schemaCompareOptionDialog = new SchemaCompareOptionsDialog(this.deploymentOptions);
			await this.schemaCompareOptionDialog.openDialog();
		});
	}

	private createApplyButton(view: azdata.ModelView) {

		this.applyButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.updateButton', 'Apply'),
			iconPath: {
				light: path.join(__dirname, 'media', 'start.svg'),
				dark: path.join(__dirname, 'media', 'start-inverse.svg')
			},
		}).component();

		this.applyButton.onDidClick(async (click) => {
			let service = await SchemaCompareResult.getService('MSSQL');
			let result = await service.schemaComparePublishChanges(this.comparisonResult.operationId, this.targetEndpointInfo.serverName, this.targetEndpointInfo.databaseName, azdata.TaskExecutionMode.execute);
			if (!result || !result.success) {
				vscode.window.showErrorMessage(
					localize('schemaCompare.updateErrorMessage', "Schema Compare Apply failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
			}
		});
	}

	private resetButtons(): void {
		this.compareButton.enabled = false;
		this.optionsButton.enabled = false;
		this.switchButton.enabled = false;
		this.generateScriptButton.enabled = false;
		this.applyButton.enabled = false;
		this.generateScriptButton.title = localize('schemaCompare.generateScriptEnabledButton', 'Generate script to deploy changes to target');
		this.applyButton.title = localize('schemaCompare.applyButtonEnabledTitle', 'Apply changes to target');
	}

	private createSwitchButton(view: azdata.ModelView): void {
		let swapIcon = path.join(__dirname, 'media', 'switch-directions.svg');

		this.switchButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.switchDirectionButton', 'Switch direction'),
			iconPath: {
				light: path.join(__dirname, 'media', 'switch-directions.svg'),
				dark: path.join(__dirname, 'media', 'switch-directions-inverse.svg')
			},
			title: localize('schemaCompare.switchButtonTitle', 'Switch source and target')
		}).component();

		this.switchButton.onDidClick(async (click) => {
			// switch source and target
			[this.sourceEndpointInfo, this.targetEndpointInfo] = [this.targetEndpointInfo, this.sourceEndpointInfo];
			[this.sourceName, this.targetName] = [this.targetName, this.sourceName];

			this.sourceNameComponent.updateProperties({
				columns: [
					{
						value: this.sourceName,
						headerCssClass: 'no-borders',
						toolTip: this.sourceName
					},
				]
			});

			this.targetNameComponent.updateProperties({
				columns: [
					{
						value: this.targetName,
						headerCssClass: 'no-borders',
						toolTip: this.targetName
					},
				]
			});

			this.reExecute();
		});
	}

	private static async getService(providerName: string): Promise<azdata.SchemaCompareServicesProvider> {
		let service = azdata.dataprotocol.getProvider<azdata.SchemaCompareServicesProvider>(providerName, azdata.DataProviderType.SchemaCompareServicesProvider);
		return service;
	}

	private async GetDefaultDeploymentOptions(): Promise<void> {
		// Same as dacfx default options
		let service = await SchemaCompareResult.getService('MSSQL');
		let result = await service.schemaCompareGetDefaultOptions();
		this.deploymentOptions = result.defaultDeploymentOptions;
	}
}