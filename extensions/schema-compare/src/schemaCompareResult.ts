/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { SchemaCompareOptionsDialog } from './dialogs/schemaCompareOptionsDialog';
import { Telemetry } from './telemetry';
import { getTelemetryErrorType } from './utils';
import { isNullOrUndefined } from 'util';
const localize = nls.loadMessageBundle();
const diffEditorTitle = localize('schemaCompare.CompareDetailsTitle', 'Compare Details');
const applyConfirmation = localize('schemaCompare.ApplyConfirmation', 'Are you sure you want to update the target?');
const reCompareToRefeshMessage = localize('schemaCompare.RecompareToRefresh', 'Press Compare to refresh the comparison.');
const generateScriptEnabledMessage = localize('schemaCompare.generateScriptEnabledButton', 'Generate script to deploy changes to target');
const generateScriptNoChangesMessage = localize('schemaCompare.generateScriptNoChanges', 'No changes to script');
const applyEnabledMessage = localize('schemaCompare.applyButtonEnabledTitle', 'Apply changes to target');
const applyNoChangesMessage = localize('schemaCompare.applyNoChanges', 'No changes to apply');
// Do not localize this, this is used to decide the icon for the editor.
// TODO : In future icon should be decided based on language id (scmp) and not resource name
const schemaCompareResourceName = 'Schema Compare';


export class SchemaCompareResult {
	private differencesTable: azdata.TableComponent;
	private loader: azdata.LoadingComponent;
	private startText: azdata.TextComponent;
	private waitText: azdata.TextComponent;
	private editor: azdata.workspace.ModelViewEditor;
	private diffEditor: azdata.DiffEditorComponent;
	private splitView: azdata.SplitViewContainer;
	private flexModel: azdata.FlexContainer;
	private noDifferencesLabel: azdata.TextComponent;
	private sourceTargetFlexLayout: azdata.FlexContainer;
	private switchButton: azdata.ButtonComponent;
	private compareButton: azdata.ButtonComponent;
	private cancelCompareButton: azdata.ButtonComponent;
	private optionsButton: azdata.ButtonComponent;
	private generateScriptButton: azdata.ButtonComponent;
	private applyButton: azdata.ButtonComponent;
	private SchemaCompareActionMap: Map<Number, string>;
	private operationId: string;
	private comparisonResult: azdata.SchemaCompareResult;
	private sourceNameComponent: azdata.TableComponent;
	private targetNameComponent: azdata.TableComponent;
	private deploymentOptions: azdata.DeploymentOptions;
	private schemaCompareOptionDialog: SchemaCompareOptionsDialog;
	private tablelistenersToDispose: vscode.Disposable[] = [];
	private originalSourceExcludes = new Map<string, azdata.DiffEntry>();
	private originalTargetExcludes = new Map<string, azdata.DiffEntry>();
	private sourceTargetSwitched = false;

	constructor(private sourceName: string, private targetName: string, private sourceEndpointInfo: azdata.SchemaCompareEndpointInfo, private targetEndpointInfo: azdata.SchemaCompareEndpointInfo) {
		this.SchemaCompareActionMap = new Map<Number, string>();
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Delete] = localize('schemaCompare.deleteAction', 'Delete');
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Change] = localize('schemaCompare.changeAction', 'Change');
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Add] = localize('schemaCompare.addAction', 'Add');

		this.editor = azdata.workspace.createModelViewEditor(localize('schemaCompare.Title', 'Schema Compare'), { retainContextWhenHidden: true, supportsSave: true, resourceName: schemaCompareResourceName });
		this.GetDefaultDeploymentOptions();

		this.editor.registerContent(async view => {

			this.differencesTable = view.modelBuilder.table().withProperties({
				data: [],
				height: 300
			}).component();

			this.diffEditor = view.modelBuilder.diffeditor().withProperties({
				contentLeft: os.EOL,
				contentRight: os.EOL,
				height: 500,
				title: diffEditorTitle
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
			this.createCancelButton(view);
			this.createGenerateScriptButton(view);
			this.createApplyButton(view);
			this.createOptionsButton(view);
			this.resetButtons(true);

			let toolBar = view.modelBuilder.toolbarContainer();
			toolBar.addToolbarItems([{
				component: this.compareButton
			}, {
				component: this.cancelCompareButton
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
				value: localize('schemaCompare.sourceLabel', 'Source'),
				CSSStyles: { 'margin-bottom': '0px' }
			}).component();

			let targetLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.targetLabel', 'Target'),
				CSSStyles: { 'margin-bottom': '0px' }
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
			this.waitText = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.waitText', 'Initializing Comparison. This might take a moment.')
			}).component();

			this.startText = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.startText', 'Press Compare to start Schema Comparison.')
			}).component();

			this.noDifferencesLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.noDifferences', 'No schema differences were found.')
			}).component();

			this.flexModel = view.modelBuilder.flexContainer().component();
			this.flexModel.addItem(toolBar.component(), { flex: 'none' });
			this.flexModel.addItem(sourceTargetLabels, { flex: 'none' });
			this.flexModel.addItem(this.sourceTargetFlexLayout, { flex: 'none' });
			this.flexModel.addItem(this.startText, { CSSStyles: { 'margin': 'auto' } });

			this.flexModel.setLayout({
				flexFlow: 'column',
				height: '100%'
			});

			await view.initializeModel(this.flexModel);
		});
	}

	public start(): void {
		this.editor.openEditor();
	}

	// only for test
	public getComparisonResult(): azdata.SchemaCompareResult {
		return this.comparisonResult;
	}

	// only for test
	public getDeploymentOptions(): azdata.DeploymentOptions {
		return this.deploymentOptions;
	}

	public async execute(): Promise<void> {
		if (this.schemaCompareOptionDialog && this.schemaCompareOptionDialog.deploymentOptions) {
			// take updates if any
			this.deploymentOptions = this.schemaCompareOptionDialog.deploymentOptions;
		}
		Telemetry.sendTelemetryEvent('SchemaComparisonStarted');
		const service = await SchemaCompareResult.getService('MSSQL');
		if (!this.operationId) {
			// create once per page
			this.operationId = generateGuid();
		}
		this.comparisonResult = await service.schemaCompare(this.operationId, this.sourceEndpointInfo, this.targetEndpointInfo, azdata.TaskExecutionMode.execute, this.deploymentOptions);
		if (!this.comparisonResult || !this.comparisonResult.success) {
			Telemetry.sendTelemetryEventForError('SchemaComparisonFailed', {
				'errorType': getTelemetryErrorType(this.comparisonResult.errorMessage),
				'operationId': this.comparisonResult.operationId
			});
			vscode.window.showErrorMessage(localize('schemaCompare.compareErrorMessage', "Schema Compare failed: {0}", this.comparisonResult.errorMessage ? this.comparisonResult.errorMessage : 'Unknown'));
			return;
		}
		Telemetry.sendTelemetryEvent('SchemaComparisonFinished', {
			'endTime': Date.now().toString(),
			'operationId': this.comparisonResult.operationId
		});

		let data = this.getAllDifferences(this.comparisonResult.differences);

		this.differencesTable.updateProperties({
			data: data,
			columns: [
				{
					value: localize('schemaCompare.typeColumn', 'Type'),
					toolTip: localize('schemaCompare.typeColumn', 'Type'),
					cssClass: 'align-with-header',
					width: 50
				},
				{
					value: localize('schemaCompare.sourceNameColumn', 'Source Name'),
					toolTip: localize('schemaCompare.sourceNameColumn', 'Source Name'),
					cssClass: 'align-with-header',
					width: 90
				},
				{
					value: localize('schemaCompare.includeColumnName', 'Include'),
					toolTip: localize('schemaCompare.includeColumnName', 'Include'),
					cssClass: 'align-with-header',
					width: 60,
					type: azdata.ColumnType.checkBox,
					options: { actionOnCheckbox: azdata.ActionOnCellCheckboxCheck.customAction }
				},
				{
					value: localize('schemaCompare.actionColumn', 'Action'),
					toolTip: localize('schemaCompare.actionColumn', 'Action'),
					cssClass: 'align-with-header',
					width: 30
				},
				{
					value: localize('schemaCompare.targetNameColumn', 'Target Name'),
					toolTip: localize('schemaCompare.targetNameColumn', 'Target Name'),
					cssClass: 'align-with-header',
					width: 150
				}
			],
		});

		this.splitView.addItem(this.differencesTable);
		this.splitView.addItem(this.diffEditor);
		this.splitView.setLayout({
			orientation: 'vertical',
			splitViewHeight: 800
		});

		this.flexModel.removeItem(this.loader);
		this.flexModel.removeItem(this.waitText);
		this.switchButton.enabled = true;
		this.compareButton.enabled = true;
		this.optionsButton.enabled = true;
		this.cancelCompareButton.enabled = false;

		if (this.comparisonResult.differences.length > 0) {
			this.flexModel.addItem(this.splitView, { CSSStyles: { 'overflow': 'hidden' } });

			// only enable generate script button if the target is a db
			if (this.targetEndpointInfo.endpointType === azdata.SchemaCompareEndpointType.Database) {
				this.generateScriptButton.enabled = true;
				this.applyButton.enabled = true;
			} else {
				this.generateScriptButton.title = localize('schemaCompare.generateScriptButtonDisabledTitle', 'Generate script is enabled when the target is a database');
				this.applyButton.title = localize('schemaCompare.applyButtonDisabledTitle', 'Apply is enabled when the target is a database');
			}
		} else {
			this.flexModel.addItem(this.noDifferencesLabel, { CSSStyles: { 'margin': 'auto' } });
		}

		// explicitly exclude things that were excluded in previous compare
		const thingsToExclude = this.sourceTargetSwitched ? this.originalTargetExcludes : this.originalSourceExcludes;
		if (thingsToExclude) {
			thingsToExclude.forEach(item => {
				service.schemaCompareIncludeExcludeNode(this.comparisonResult.operationId, item, false, azdata.TaskExecutionMode.execute);
			});

			// disable apply and generate script buttons if no changes are included
			if (thingsToExclude.size === this.comparisonResult.differences.length) {
				this.setButtonStatesForNoChanges(false);
			}
		}

		let sourceText = '';
		let targetText = '';
		this.tablelistenersToDispose.push(this.differencesTable.onRowSelected(() => {
			let difference = this.comparisonResult.differences[this.differencesTable.selectedRows[0]];
			if (difference !== undefined) {
				sourceText = this.getFormattedScript(difference, true);
				targetText = this.getFormattedScript(difference, false);

				this.diffEditor.updateProperties({
					contentLeft: sourceText,
					contentRight: targetText,
					title: diffEditorTitle
				});
			}
		}));
		this.tablelistenersToDispose.push(this.differencesTable.onCellAction(async (rowState) => {
			let checkboxState = <azdata.ICheckboxCellActionEventArgs>rowState;
			if (checkboxState) {
				let diff = this.comparisonResult.differences[checkboxState.row];
				await service.schemaCompareIncludeExcludeNode(this.comparisonResult.operationId, diff, checkboxState.checked, azdata.TaskExecutionMode.execute);
				this.saveExcludeState(checkboxState);
			}
		}));
	}

	// save state based on source name if present otherwise target name (parity with SSDT)
	private saveExcludeState(rowState: azdata.ICheckboxCellActionEventArgs) {
		if (rowState) {
			let diff = this.comparisonResult.differences[rowState.row];
			let key = (diff.sourceValue && diff.sourceValue.length > 0) ? this.createName(diff.sourceValue) : this.createName(diff.targetValue);
			if (key) {
				if (!this.sourceTargetSwitched) {
					this.originalSourceExcludes.delete(key);
					if (!rowState.checked) {
						this.originalSourceExcludes.set(key, diff);
						if (this.originalSourceExcludes.size === this.comparisonResult.differences.length) {
							this.setButtonStatesForNoChanges(false);
						}
					}
					else {
						this.setButtonStatesForNoChanges(true);
					}
				}
				else {
					this.originalTargetExcludes.delete(key);
					if (!rowState.checked) {
						this.originalTargetExcludes.set(key, diff);
						if (this.originalTargetExcludes.size === this.comparisonResult.differences.length) {
							this.setButtonStatesForNoChanges(false);
						}
						else {
							this.setButtonStatesForNoChanges(true);
						}
					}
				}
			}
		}
	}

	private shouldDiffBeIncluded(diff: azdata.DiffEntry): boolean {
		let key = (diff.sourceValue && diff.sourceValue.length > 0) ? this.createName(diff.sourceValue) : this.createName(diff.targetValue);
		if (key) {
			if (this.sourceTargetSwitched === true && this.originalTargetExcludes.has(key)) {
				this.originalTargetExcludes[key] = diff;
				return false;
			}
			if (this.sourceTargetSwitched === false && this.originalSourceExcludes.has(key)) {
				this.originalSourceExcludes[key] = diff;
				return false;
			}
			return true;
		}
		return true;
	}

	private getAllDifferences(differences: azdata.DiffEntry[]): string[][] {
		let data = [];
		if (differences) {
			differences.forEach(difference => {
				if (difference.differenceType === azdata.SchemaDifferenceType.Object) {
					if ((difference.sourceValue !== null && difference.sourceValue.length > 0) || (difference.targetValue !== null && difference.targetValue.length > 0)) {
						let state: boolean = this.shouldDiffBeIncluded(difference);
						data.push([difference.name, this.createName(difference.sourceValue), state, this.SchemaCompareActionMap[difference.updateAction], this.createName(difference.targetValue)]);
					}
				}
			});
		}

		return data;
	}

	private createName(nameParts: string[]): string {
		if (isNullOrUndefined(nameParts) || nameParts.length === 0) {
			return '';
		}
		return nameParts.join('.');
	}

	private getFormattedScript(diffEntry: azdata.DiffEntry, getSourceScript: boolean): string {
		// if there is no entry, the script has to be \n because an empty string shows up as a difference but \n doesn't
		if ((getSourceScript && diffEntry.sourceScript === null)
			|| (!getSourceScript && diffEntry.targetScript === null)) {
			return '\n';
		}

		let script = this.getAggregatedScript(diffEntry, getSourceScript);
		return script;
	}

	private getAggregatedScript(diffEntry: azdata.DiffEntry, getSourceScript: boolean): string {
		let script = '';
		if (diffEntry !== null) {
			let diffEntryScript = getSourceScript ? diffEntry.sourceScript : diffEntry.targetScript;
			if (diffEntryScript) {
				// add a blank line between each statement
				script += diffEntryScript + '\n\n';
			}

			diffEntry.children.forEach(child => {
				let childScript = this.getAggregatedScript(child, getSourceScript);
				script += childScript;
			});
		}
		return script;
	}

	public startCompare(): void {
		this.flexModel.removeItem(this.splitView);
		this.flexModel.removeItem(this.noDifferencesLabel);
		this.flexModel.removeItem(this.startText);
		this.flexModel.addItem(this.loader, { CSSStyles: { 'margin-top': '30px' } });
		this.flexModel.addItem(this.waitText, { CSSStyles: { 'margin-top': '30px', 'align-self': 'center' } });
		this.diffEditor.updateProperties({
			contentLeft: os.EOL,
			contentRight: os.EOL,
			title: diffEditorTitle
		});

		this.differencesTable.selectedRows = null;
		if (this.tablelistenersToDispose) {
			this.tablelistenersToDispose.forEach(x => x.dispose());
		}
		this.resetButtons(false);
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
			this.startCompare();
		});
	}

	private createCancelButton(view: azdata.ModelView): void {
		this.cancelCompareButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.cancelCompareButton', 'Stop'),
			iconPath: {
				light: path.join(__dirname, 'media', 'stop.svg'),
				dark: path.join(__dirname, 'media', 'stop-inverse.svg')
			},
			title: localize('schemaCompare.cancelCompareButtonTitle', 'Stop')
		}).component();

		this.cancelCompareButton.onDidClick(async (click) => {
			await this.cancelCompare();
		});
	}

	private async cancelCompare() {

		Telemetry.sendTelemetryEvent('SchemaCompareCancelStarted', {
			'startTime:': Date.now().toString(),
			'operationId': this.operationId
		});

		// clean the pane
		this.flexModel.removeItem(this.loader);
		this.flexModel.removeItem(this.waitText);
		this.flexModel.addItem(this.startText, { CSSStyles: { 'margin': 'auto' } });
		this.resetButtons(true);

		// cancel compare
		if (this.operationId) {
			const service = await SchemaCompareResult.getService('MSSQL');
			const result = await service.schemaCompareCancel(this.operationId);

			if (!result || !result.success) {
				Telemetry.sendTelemetryEvent('SchemaCompareCancelFailed', {
					'errorType': getTelemetryErrorType(result.errorMessage),
					'operationId': this.operationId
				});
				vscode.window.showErrorMessage(
					localize('schemaCompare.cancelErrorMessage', "Cancel schema compare failed: '{0}'", (result && result.errorMessage) ? result.errorMessage : 'Unknown'));
			}
			Telemetry.sendTelemetryEvent('SchemaCompareCancelEnded', {
				'endTime:': Date.now().toString(),
				'operationId': this.operationId
			});
		}
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
			Telemetry.sendTelemetryEvent('SchemaCompareGenerateScriptStarted', {
				'startTime:': Date.now().toString(),
				'operationId': this.comparisonResult.operationId
			});
			const service = await SchemaCompareResult.getService('MSSQL');
			const result = await service.schemaCompareGenerateScript(this.comparisonResult.operationId, this.targetEndpointInfo.serverName, this.targetEndpointInfo.databaseName, azdata.TaskExecutionMode.script);
			if (!result || !result.success) {
				Telemetry.sendTelemetryEvent('SchemaCompareGenerateScriptFailed', {
					'errorType': getTelemetryErrorType(result.errorMessage),
					'operationId': this.comparisonResult.operationId
				});
				vscode.window.showErrorMessage(
					localize('schemaCompare.generateScriptErrorMessage', "Generate script failed: '{0}'", (result && result.errorMessage) ? result.errorMessage : 'Unknown'));
			}
			Telemetry.sendTelemetryEvent('SchemaCompareGenerateScriptEnded', {
				'endTime:': Date.now().toString(),
				'operationId': this.comparisonResult.operationId
			});
		});
	}

	private createOptionsButton(view: azdata.ModelView) {
		this.optionsButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.optionsButton', 'Options'),
			iconPath: {
				light: path.join(__dirname, 'media', 'options.svg'),
				dark: path.join(__dirname, 'media', 'options-inverse.svg')
			},
			title: localize('schemaCompare.optionsButtonTitle', 'Options')
		}).component();

		this.optionsButton.onDidClick(async (click) => {
			Telemetry.sendTelemetryEvent('SchemaCompareOptionsOpened', {
				'operationId': this.comparisonResult.operationId
			});
			//restore options from last time
			if (this.schemaCompareOptionDialog && this.schemaCompareOptionDialog.deploymentOptions) {
				this.deploymentOptions = this.schemaCompareOptionDialog.deploymentOptions;
			}
			// create fresh every time
			this.schemaCompareOptionDialog = new SchemaCompareOptionsDialog(this.deploymentOptions, this);
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

		// need only yes button - since the modal dialog has a default cancel
		const yesString = localize('schemaCompare.ApplyYes', 'Yes');
		this.applyButton.onDidClick(async (click) => {

			vscode.window.showWarningMessage(applyConfirmation, { modal: true }, yesString).then(async (result) => {
				if (result === yesString) {
					Telemetry.sendTelemetryEvent('SchemaCompareApplyStarted', {
						'startTime': Date.now().toString(),
						'operationId': this.comparisonResult.operationId
					});

					// disable apply and generate script buttons because the results are no longer valid after applying the changes
					this.generateScriptButton.enabled = false;
					this.generateScriptButton.title = reCompareToRefeshMessage;
					this.applyButton.enabled = false;
					this.applyButton.title = reCompareToRefeshMessage;

					const service = await SchemaCompareResult.getService('MSSQL');
					const result = await service.schemaComparePublishChanges(this.comparisonResult.operationId, this.targetEndpointInfo.serverName, this.targetEndpointInfo.databaseName, azdata.TaskExecutionMode.execute);
					if (!result || !result.success) {
						Telemetry.sendTelemetryEvent('SchemaCompareApplyFailed', {
							'errorType': getTelemetryErrorType(result.errorMessage),
							'operationId': this.comparisonResult.operationId
						});
						vscode.window.showErrorMessage(
							localize('schemaCompare.updateErrorMessage', "Schema Compare Apply failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));

						// reenable generate script and apply buttons if apply failed
						this.generateScriptButton.enabled = true;
						this.generateScriptButton.title = generateScriptEnabledMessage;
						this.applyButton.enabled = true;
						this.applyButton.title = applyEnabledMessage;
					}
					Telemetry.sendTelemetryEvent('SchemaCompareApplyEnded', {
						'endTime': Date.now().toString(),
						'operationId': this.comparisonResult.operationId
					});
				}
			});
		});
	}

	private resetButtons(beforeCompareStart: boolean): void {
		if (beforeCompareStart) {
			this.compareButton.enabled = true;
			this.optionsButton.enabled = true;
			this.switchButton.enabled = true;
			this.cancelCompareButton.enabled = false;
		}
		else {
			this.compareButton.enabled = false;
			this.optionsButton.enabled = false;
			this.switchButton.enabled = false;
			this.cancelCompareButton.enabled = true;
		}
		this.generateScriptButton.enabled = false;
		this.applyButton.enabled = false;
		this.generateScriptButton.title = generateScriptEnabledMessage;
		this.applyButton.title = applyEnabledMessage;
	}

	private createSwitchButton(view: azdata.ModelView): void {
		this.switchButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.switchDirectionButton', 'Switch direction'),
			iconPath: {
				light: path.join(__dirname, 'media', 'switch-directions.svg'),
				dark: path.join(__dirname, 'media', 'switch-directions-inverse.svg')
			},
			title: localize('schemaCompare.switchButtonTitle', 'Switch source and target')
		}).component();

		this.switchButton.onDidClick(async (click) => {
			Telemetry.sendTelemetryEvent('SchemaCompareSwitch');

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

			// remember that source target have been toggled
			this.sourceTargetSwitched = this.sourceTargetSwitched ? false : true;
			this.startCompare();
		});
	}

	private setButtonStatesForNoChanges(enableButtons: boolean): void {
		// generate script and apply can only be enabled if the target is a database
		if (this.targetEndpointInfo.endpointType === azdata.SchemaCompareEndpointType.Database) {
			this.applyButton.enabled = enableButtons;
			this.generateScriptButton.enabled = enableButtons;
			this.applyButton.title = enableButtons ? applyEnabledMessage : applyNoChangesMessage;
			this.generateScriptButton.title = enableButtons ? generateScriptEnabledMessage : generateScriptNoChangesMessage;
		}
	}

	private static async getService(providerName: string): Promise<azdata.SchemaCompareServicesProvider> {
		let service = azdata.dataprotocol.getProvider<azdata.SchemaCompareServicesProvider>(providerName, azdata.DataProviderType.SchemaCompareServicesProvider);
		return service;
	}

	private async GetDefaultDeploymentOptions(): Promise<void> {
		// Same as dacfx default options
		const service = await SchemaCompareResult.getService('MSSQL');
		let result = await service.schemaCompareGetDefaultOptions();
		this.deploymentOptions = result.defaultDeploymentOptions;
	}
}

// Borrowed as is from other extensions
// TODO : figure out if any inbuilt alternative is available
export function generateGuid(): string {
	let hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
	// c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
	let oct: string = '';
	let tmp: number;
	/* tslint:disable:no-bitwise */
	for (let a: number = 0; a < 4; a++) {
		tmp = (4294967296 * Math.random()) | 0;
		oct += hexValues[tmp & 0xF] +
			hexValues[tmp >> 4 & 0xF] +
			hexValues[tmp >> 8 & 0xF] +
			hexValues[tmp >> 12 & 0xF] +
			hexValues[tmp >> 16 & 0xF] +
			hexValues[tmp >> 20 & 0xF] +
			hexValues[tmp >> 24 & 0xF] +
			hexValues[tmp >> 28 & 0xF];
	}

	// 'Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively'
	let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
	return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
	/* tslint:enable:no-bitwise */
}