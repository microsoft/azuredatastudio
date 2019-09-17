/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as mssql from '../../mssql';
import { SchemaCompareOptionsDialog } from './dialogs/schemaCompareOptionsDialog';
import { Telemetry } from './telemetry';
import { getTelemetryErrorType, getEndpointName, verifyConnectionAndGetOwnerUri } from './utils';
import { SchemaCompareDialog } from './dialogs/schemaCompareDialog';
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

enum ResetButtonState {
	noSourceTarget,
	beforeCompareStart,
	comparing,
	afterCompareComplete
}

export class SchemaCompareMainWindow {
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
	private openScmpButton: azdata.ButtonComponent;
	private selectSourceButton: azdata.ButtonComponent;
	private selectTargetButton: azdata.ButtonComponent;
	private saveScmpButton: azdata.ButtonComponent;
	private SchemaCompareActionMap: Map<Number, string>;
	private operationId: string;
	private comparisonResult: mssql.SchemaCompareResult;
	private sourceNameComponent: azdata.TableComponent;
	private targetNameComponent: azdata.TableComponent;
	private deploymentOptions: mssql.DeploymentOptions;
	private schemaCompareOptionDialog: SchemaCompareOptionsDialog;
	private tablelistenersToDispose: vscode.Disposable[] = [];
	private originalSourceExcludes = new Map<string, mssql.DiffEntry>();
	private originalTargetExcludes = new Map<string, mssql.DiffEntry>();
	private sourceTargetSwitched = false;
	private sourceName: string;
	private targetName: string;
	private scmpSourceExcludes: mssql.SchemaCompareObjectId[];
	private scmpTargetExcludes: mssql.SchemaCompareObjectId[];

	public sourceEndpointInfo: mssql.SchemaCompareEndpointInfo;
	public targetEndpointInfo: mssql.SchemaCompareEndpointInfo;

	constructor(private schemaCompareService?: mssql.ISchemaCompareService) {
		this.SchemaCompareActionMap = new Map<Number, string>();
		this.SchemaCompareActionMap[mssql.SchemaUpdateAction.Delete] = localize('schemaCompare.deleteAction', 'Delete');
		this.SchemaCompareActionMap[mssql.SchemaUpdateAction.Change] = localize('schemaCompare.changeAction', 'Change');
		this.SchemaCompareActionMap[mssql.SchemaUpdateAction.Add] = localize('schemaCompare.addAction', 'Add');

		this.editor = azdata.workspace.createModelViewEditor(localize('schemaCompare.Title', 'Schema Compare'), { retainContextWhenHidden: true, supportsSave: true, resourceName: schemaCompareResourceName });
	}

	public async start(context: any) {
		// if schema compare was launched from a db, set that as the source
		let profile = context ? <azdata.IConnectionProfile>context.connectionProfile : undefined;
		if (profile) {
			let ownerUri = await azdata.connection.getUriForConnection((profile.id));
			this.sourceEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				serverDisplayName: `${profile.serverName} ${profile.userName}`,
				serverName: profile.serverName,
				databaseName: profile.databaseName,
				ownerUri: ownerUri,
				packageFilePath: '',
				connectionDetails: undefined
			};
		}

		this.editor.registerContent(async view => {
			this.differencesTable = view.modelBuilder.table().withProperties({
				data: [],
				height: 300,
				title: localize('schemaCompare.differencesTableTitle', "Comparison between Source and Target")
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
			this.createOpenScmpButton(view);
			this.createSaveScmpButton(view);
			this.createSourceAndTargetButtons(view);
			this.resetButtons(ResetButtonState.noSourceTarget);

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
				component: this.switchButton,
				toolbarSeparatorAfter: true
			}, {
				component: this.openScmpButton
			}, {
				component: this.saveScmpButton
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

			this.sourceName = getEndpointName(this.sourceEndpointInfo);
			this.targetName = ' ';
			this.sourceNameComponent = view.modelBuilder.table().withProperties({
				columns: [
					{
						value: this.sourceName,
						headerCssClass: 'no-borders',
						toolTip: this.sourceName
					},
				]
			}).component();

			this.targetNameComponent = view.modelBuilder.table().withProperties({
				columns: [
					{
						value: this.targetName,
						headerCssClass: 'no-borders',
						toolTip: this.targetName
					},
				]
			}).component();

			sourceTargetLabels.addItem(sourceLabel, { CSSStyles: { 'width': '55%', 'margin-left': '15px', 'font-size': 'larger', 'font-weight': 'bold' } });
			sourceTargetLabels.addItem(targetLabel, { CSSStyles: { 'width': '45%', 'font-size': 'larger', 'font-weight': 'bold' } });
			this.sourceTargetFlexLayout.addItem(this.sourceNameComponent, { CSSStyles: { 'width': '40%', 'height': '25px', 'margin-top': '10px', 'margin-left': '15px' } });
			this.sourceTargetFlexLayout.addItem(this.selectSourceButton, { CSSStyles: { 'margin-top': '10px' } });
			this.sourceTargetFlexLayout.addItem(arrowLabel, { CSSStyles: { 'width': '10%', 'font-size': 'larger', 'text-align-last': 'center' } });
			this.sourceTargetFlexLayout.addItem(this.targetNameComponent, { CSSStyles: { 'width': '40%', 'height': '25px', 'margin-top': '10px', 'margin-left': '15px' } });
			this.sourceTargetFlexLayout.addItem(this.selectTargetButton, { CSSStyles: { 'margin-top': '10px' } });

			this.loader = view.modelBuilder.loadingComponent().component();
			this.waitText = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.waitText', 'Initializing Comparison. This might take a moment.')
			}).component();

			this.startText = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.startText', 'To compare two schemas, first select a source schema and target schema, then press Compare.')
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

		await this.GetDefaultDeploymentOptions();
		this.editor.openEditor();
	}

	// update source and target name to display
	public updateSourceAndTarget() {
		this.sourceName = getEndpointName(this.sourceEndpointInfo);
		this.targetName = getEndpointName(this.targetEndpointInfo);

		this.sourceNameComponent.updateProperty('columns', [
			{
				value: this.sourceName,
				headerCssClass: 'no-borders',
				toolTip: this.sourceName
			},
		]);
		this.targetNameComponent.updateProperty('columns', [
			{
				value: this.targetName,
				headerCssClass: 'no-borders',
				toolTip: this.targetName
			},
		]);

		// reset buttons to before comparison state
		this.resetButtons(ResetButtonState.beforeCompareStart);
	}

	// only for test
	public getComparisonResult(): mssql.SchemaCompareResult {
		return this.comparisonResult;
	}

	// only for test
	public getDeploymentOptions(): mssql.DeploymentOptions {
		return this.deploymentOptions;
	}

	public setDeploymentOptions(deploymentOptions: mssql.DeploymentOptions): void {
		this.deploymentOptions = deploymentOptions;
	}

	public async execute(): Promise<void> {
		Telemetry.sendTelemetryEvent('SchemaComparisonStarted');
		const service = await this.getService();
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
					cssClass: 'align-with-header',
					width: 50
				},
				{
					value: localize('schemaCompare.sourceNameColumn', 'Source Name'),
					cssClass: 'align-with-header',
					width: 90
				},
				{
					value: localize('schemaCompare.includeColumnName', 'Include'),
					cssClass: 'align-with-header',
					width: 60,
					type: azdata.ColumnType.checkBox,
					options: { actionOnCheckbox: azdata.ActionOnCellCheckboxCheck.customAction }
				},
				{
					value: localize('schemaCompare.actionColumn', 'Action'),
					cssClass: 'align-with-header',
					width: 30
				},
				{
					value: localize('schemaCompare.targetNameColumn', 'Target Name'),
					cssClass: 'align-with-header',
					width: 150
				}
			],
			CSSStyles: { 'left': '15px' },
			width: '98%'
		});

		this.splitView.addItem(this.differencesTable);
		this.splitView.addItem(this.diffEditor);
		this.splitView.setLayout({
			orientation: 'vertical',
			splitViewHeight: 800
		});

		this.flexModel.removeItem(this.loader);
		this.flexModel.removeItem(this.waitText);
		this.resetButtons(ResetButtonState.afterCompareComplete);

		if (this.comparisonResult.differences.length > 0) {
			this.flexModel.addItem(this.splitView, { CSSStyles: { 'overflow': 'hidden' } });

			// only enable generate script button if the target is a db
			if (this.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
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
					this.removeExcludeEntry(this.scmpSourceExcludes, key);

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
					this.removeExcludeEntry(this.scmpTargetExcludes, key);

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

	private shouldDiffBeIncluded(diff: mssql.DiffEntry): boolean {
		let key = (diff.sourceValue && diff.sourceValue.length > 0) ? this.createName(diff.sourceValue) : this.createName(diff.targetValue);
		if (key) {
			if (this.sourceTargetSwitched === true
				&& (this.originalTargetExcludes.has(key) || this.hasExcludeEntry(this.scmpTargetExcludes, key))) {
				this.originalTargetExcludes.set(key, diff);
				return false;
			}
			if (this.sourceTargetSwitched === false
				&& (this.originalSourceExcludes.has(key) || this.hasExcludeEntry(this.scmpSourceExcludes, key))) {
				this.originalSourceExcludes.set(key, diff);
				return false;
			}
			return true;
		}
		return true;
	}

	private hasExcludeEntry(collection: mssql.SchemaCompareObjectId[], entryName: string): boolean {
		let found = false;
		if (collection) {
			const index = collection.findIndex(e => this.createName(e.nameParts) === entryName);
			found = index !== -1;
		}
		return found;
	}

	private removeExcludeEntry(collection: mssql.SchemaCompareObjectId[], entryName: string) {
		if (collection) {
			console.error('removing ' + entryName);
			const index = collection.findIndex(e => this.createName(e.nameParts) === entryName);
			collection.splice(index, 1);
		}
	}

	private getAllDifferences(differences: mssql.DiffEntry[]): string[][] {
		let data = [];
		let finalDifferences: mssql.DiffEntry[] = [];
		if (differences) {
			differences.forEach(difference => {
				if (difference.differenceType === mssql.SchemaDifferenceType.Object) {
					if ((difference.sourceValue !== null && difference.sourceValue.length > 0) || (difference.targetValue !== null && difference.targetValue.length > 0)) {
						finalDifferences.push(difference); // Add only non-null changes to ensure index does not mismatch between dictionay and UI - #6234
						let state: boolean = this.shouldDiffBeIncluded(difference);
						data.push([difference.name, this.createName(difference.sourceValue), state, this.SchemaCompareActionMap[difference.updateAction], this.createName(difference.targetValue)]);
					}
				}
			});
		}
		this.comparisonResult.differences = finalDifferences;
		return data;
	}

	private createName(nameParts: string[]): string {
		if (isNullOrUndefined(nameParts) || nameParts.length === 0) {
			return '';
		}
		return nameParts.join('.');
	}

	private getFormattedScript(diffEntry: mssql.DiffEntry, getSourceScript: boolean): string {
		// if there is no entry, the script has to be \n because an empty string shows up as a difference but \n doesn't
		if ((getSourceScript && diffEntry.sourceScript === null)
			|| (!getSourceScript && diffEntry.targetScript === null)) {
			return '\n';
		}

		let script = this.getAggregatedScript(diffEntry, getSourceScript);
		return script;
	}

	private getAggregatedScript(diffEntry: mssql.DiffEntry, getSourceScript: boolean): string {
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
		this.resetButtons(ResetButtonState.comparing);
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
		this.resetButtons(ResetButtonState.beforeCompareStart);

		// cancel compare
		if (this.operationId) {
			const service = await this.getService();
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
			const service = await this.getService();
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
			Telemetry.sendTelemetryEvent('SchemaCompareOptionsOpened');

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
					this.setButtonsForRecompare();

					const service = await this.getService();
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

	private resetButtons(resetButtonState: ResetButtonState): void {
		switch (resetButtonState) {
			case (ResetButtonState.noSourceTarget): {
				this.compareButton.enabled = false;
				this.optionsButton.enabled = false;
				this.switchButton.enabled = this.sourceEndpointInfo ? true : false; // allows switching if the source is set
				this.openScmpButton.enabled = true;
				this.cancelCompareButton.enabled = false;
				this.selectSourceButton.enabled = true;
				this.selectTargetButton.enabled = true;
				break;
			}
			// Before start and after complete are same functionally. Adding two enum values for clarity.
			case (ResetButtonState.beforeCompareStart):
			case (ResetButtonState.afterCompareComplete): {
				this.compareButton.enabled = true;
				this.optionsButton.enabled = true;
				this.switchButton.enabled = true;
				this.openScmpButton.enabled = true;
				this.saveScmpButton.enabled = true;
				this.cancelCompareButton.enabled = false;
				this.selectSourceButton.enabled = true;
				this.selectTargetButton.enabled = true;
				break;
			}
			case (ResetButtonState.comparing): {
				this.compareButton.enabled = false;
				this.optionsButton.enabled = false;
				this.switchButton.enabled = false;
				this.openScmpButton.enabled = false;
				this.cancelCompareButton.enabled = true;
				this.selectSourceButton.enabled = false;
				this.selectTargetButton.enabled = false;
				break;
			}
		}

		// Set generate script and apply to false because specific values depend on result and are set separately
		this.generateScriptButton.enabled = false;
		this.applyButton.enabled = false;
		this.generateScriptButton.title = generateScriptEnabledMessage;
		this.applyButton.title = applyEnabledMessage;
	}

	public setButtonsForRecompare(): void {
		this.generateScriptButton.enabled = false;
		this.applyButton.enabled = false;
		this.generateScriptButton.title = reCompareToRefeshMessage;
		this.applyButton.title = reCompareToRefeshMessage;
	}

	// reset state afer loading an scmp
	private resetForNewCompare(): void {
		this.resetButtons(ResetButtonState.beforeCompareStart);
		this.flexModel.removeItem(this.splitView);
		this.flexModel.removeItem(this.noDifferencesLabel);
		this.flexModel.addItem(this.startText, { CSSStyles: { 'margin': 'auto' } });
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

			// only compare if both source and target are set
			if (this.sourceEndpointInfo && this.targetEndpointInfo) {
				this.startCompare();
			}
		});
	}

	private createSourceAndTargetButtons(view: azdata.ModelView): void {
		this.selectSourceButton = view.modelBuilder.button().withProperties({
			label: '•••',
			title: localize('schemaCompare.sourceButtonTitle', "Select Source"),
			ariaLabel: localize('schemaCompare.sourceButtonTitle', "Select Source")
		}).component();

		this.selectSourceButton.onDidClick(() => {
			Telemetry.sendTelemetryEvent('SchemaCompareSelectSource');
			let dialog = new SchemaCompareDialog(this);
			dialog.openDialog();
		});

		this.selectTargetButton = view.modelBuilder.button().withProperties({
			label: '•••',
			title: localize('schemaCompare.targetButtonTitle', "Select Target"),
			ariaLabel: localize('schemaCompare.targetButtonTitle', "Select Target")
		}).component();

		this.selectTargetButton.onDidClick(() => {
			Telemetry.sendTelemetryEvent('SchemaCompareSelectTarget');
			let dialog = new SchemaCompareDialog(this);
			dialog.openDialog();
		});
	}

	private createOpenScmpButton(view: azdata.ModelView) {
		this.openScmpButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.openScmpButton', 'Open .scmp file'),
			iconPath: {
				light: path.join(__dirname, 'media', 'open-scmp.svg'),
				dark: path.join(__dirname, 'media', 'open-scmp-inverse.svg')
			},
			title: localize('schemaCompare.openScmpButtonTitle', 'Load source, target, and options saved in an .scmp file')
		}).component();

		this.openScmpButton.onDidClick(async (click) => {
			Telemetry.sendTelemetryEvent('SchemaCompareOpenScmpStarted');
			const rootPath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].name : os.homedir();
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(rootPath),
					openLabel: localize('schemaCompare.openFile', 'Open'),
					filters: {
						'scmp Files': ['scmp'],
					}
				}
			);

			if (!fileUris || fileUris.length === 0) {
				return;
			}

			let fileUri = fileUris[0];
			const service = await this.getService();
			let startTime = Date.now();
			const result = await service.schemaCompareOpenScmp(fileUri.fsPath);
			if (!result || !result.success) {
				Telemetry.sendTelemetryEvent('SchemaCompareOpenScmpFailed', {
					'errorType': getTelemetryErrorType(result.errorMessage)
				});
				vscode.window.showErrorMessage(
					localize('schemaCompare.openScmpErrorMessage', "Open scmp failed: '{0}'", (result && result.errorMessage) ? result.errorMessage : 'Unknown'));
				return;
			}

			if (result.sourceEndpointInfo && result.sourceEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
				// only set endpoint info if able to connect to the database
				const ownerUri = await verifyConnectionAndGetOwnerUri(result.sourceEndpointInfo);
				if (ownerUri) {
					this.sourceEndpointInfo = result.sourceEndpointInfo;
					this.sourceEndpointInfo.ownerUri = ownerUri;
				}
			} else {
				// need to do this instead of just setting it to the result.sourceEndpointInfo because some fields are null which will cause an error when sending the compare request
				this.sourceEndpointInfo = {
					endpointType: mssql.SchemaCompareEndpointType.Dacpac,
					serverDisplayName: '',
					serverName: '',
					databaseName: '',
					ownerUri: '',
					packageFilePath: result.sourceEndpointInfo.packageFilePath,
					connectionDetails: undefined
				};
			}

			if (result.targetEndpointInfo && result.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
				const ownerUri = await verifyConnectionAndGetOwnerUri(result.targetEndpointInfo);
				if (ownerUri) {
					this.targetEndpointInfo = result.targetEndpointInfo;
					this.targetEndpointInfo.ownerUri = ownerUri;
				}
			} else {
				// need to do this instead of just setting it to the result.targetEndpointInfo because some fields are null which will cause an error when sending the compare request
				this.targetEndpointInfo = {
					endpointType: mssql.SchemaCompareEndpointType.Dacpac,
					serverDisplayName: '',
					serverName: '',
					databaseName: '',
					ownerUri: '',
					packageFilePath: result.targetEndpointInfo.packageFilePath,
					connectionDetails: undefined
				};
			}

			this.updateSourceAndTarget();
			this.setDeploymentOptions(result.deploymentOptions);
			this.scmpSourceExcludes = result.excludedSourceElements;
			this.scmpTargetExcludes = result.excludedTargetElements;
			this.sourceTargetSwitched = result.originalTargetName !== this.targetEndpointInfo.databaseName;

			// clear out any old results
			this.resetForNewCompare();

			Telemetry.sendTelemetryEvent('SchemaCompareOpenScmpEnded', {
				'elapsedTime:': (Date.now() - startTime).toString()
			});
		});
	}

	private createSaveScmpButton(view: azdata.ModelView): void {
		this.saveScmpButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.saveScmpButton', 'Save .scmp file'),
			iconPath: {
				light: path.join(__dirname, 'media', 'save-scmp.svg'),
				dark: path.join(__dirname, 'media', 'save-scmp-inverse.svg')
			},
			title: localize('schemaCompare.saveScmpButtonTitle', 'Save source and target, options, and excluded elements'),
			enabled: false
		}).component();

		this.saveScmpButton.onDidClick(async (click) => {
			const rootPath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].name : os.homedir();
			const filePath = await vscode.window.showSaveDialog(
				{
					defaultUri: vscode.Uri.file(rootPath),
					saveLabel: localize('schemaCompare.saveFile', 'Save'),
					filters: {
						'scmp Files': ['scmp'],
					}
				}
			);

			if (!filePath) {
				return;
			}

			// convert include/exclude maps to arrays of object ids
			let sourceExcludes: mssql.SchemaCompareObjectId[] = this.convertExcludesToObjectIds(this.originalSourceExcludes);
			let targetExcludes: mssql.SchemaCompareObjectId[] = this.convertExcludesToObjectIds(this.originalTargetExcludes);

			let startTime = Date.now();
			Telemetry.sendTelemetryEvent('SchemaCompareSaveScmp');
			const service = await this.getService();
			const result = await service.schemaCompareSaveScmp(this.sourceEndpointInfo, this.targetEndpointInfo, azdata.TaskExecutionMode.execute, this.deploymentOptions, filePath.fsPath, sourceExcludes, targetExcludes);
			if (!result || !result.success) {
				Telemetry.sendTelemetryEvent('SchemaCompareSaveScmpFailed', {
					'errorType': getTelemetryErrorType(result.errorMessage),
					'operationId': this.comparisonResult.operationId
				});
				vscode.window.showErrorMessage(
					localize('schemaCompare.saveScmpErrorMessage', "Save scmp failed: '{0}'", (result && result.errorMessage) ? result.errorMessage : 'Unknown'));
			}

			Telemetry.sendTelemetryEvent('SchemaCompareSaveScmpEnded', {
				'elapsedTime:': (Date.now() - startTime).toString(),
				'operationId': this.comparisonResult.operationId
			});
		});
	}

	/**
	 * Converts excluded diff entries into object ids which are needed to save them in an scmp
	*/
	private convertExcludesToObjectIds(excludedDiffEntries: Map<string, mssql.DiffEntry>): mssql.SchemaCompareObjectId[] {
		let result = [];
		excludedDiffEntries.forEach((value: mssql.DiffEntry) => {
			result.push({
				nameParts: value.sourceValue ? value.sourceValue : value.targetValue,
				sqlObjectType: `Microsoft.Data.Tools.Schema.Sql.SchemaModel.${value.name}`
			});
		});

		return result;
	}

	private setButtonStatesForNoChanges(enableButtons: boolean): void {
		// generate script and apply can only be enabled if the target is a database
		if (this.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
			this.applyButton.enabled = enableButtons;
			this.generateScriptButton.enabled = enableButtons;
			this.applyButton.title = enableButtons ? applyEnabledMessage : applyNoChangesMessage;
			this.generateScriptButton.title = enableButtons ? generateScriptEnabledMessage : generateScriptNoChangesMessage;
		}
	}

	private async getService(): Promise<mssql.ISchemaCompareService> {
		if (isNullOrUndefined(this.schemaCompareService)) {
			this.schemaCompareService = (vscode.extensions.getExtension(mssql.extension.name).exports as mssql.IExtension).schemaCompare;
		}
		return this.schemaCompareService;
	}

	private async GetDefaultDeploymentOptions(): Promise<void> {
		// Same as dacfx default options
		const service = await this.getService();
		let result = await service.schemaCompareGetDefaultOptions();
		this.setDeploymentOptions(result.defaultDeploymentOptions);
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
