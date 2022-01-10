/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as sqldbproj from 'sqldbproj';
import * as mssql from '../../mssql';
import * as loc from './localizedConstants';
import { SchemaCompareOptionsDialog } from './dialogs/schemaCompareOptionsDialog';
import { TelemetryReporter, TelemetryViews } from './telemetry';
import { getTelemetryErrorType, getEndpointName, verifyConnectionAndGetOwnerUri, getRootPath, getSchemaCompareEndpointString, getDataWorkspaceExtensionApi } from './utils';
import { SchemaCompareDialog } from './dialogs/schemaCompareDialog';
import { isNullOrUndefined } from 'util';

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
	protected switchButton: azdata.ButtonComponent;
	protected compareButton: azdata.ButtonComponent;
	protected cancelCompareButton: azdata.ButtonComponent;
	protected optionsButton: azdata.ButtonComponent;
	protected generateScriptButton: azdata.ButtonComponent;
	protected applyButton: azdata.ButtonComponent;
	protected openScmpButton: azdata.ButtonComponent;
	protected selectSourceButton: azdata.ButtonComponent;
	protected selectTargetButton: azdata.ButtonComponent;
	protected saveScmpButton: azdata.ButtonComponent;
	private SchemaCompareActionMap: Map<Number, string>;
	private operationId: string;
	protected comparisonResult: mssql.SchemaCompareResult;
	private sourceNameComponent: azdata.InputBoxComponent;
	private targetNameComponent: azdata.InputBoxComponent;
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
	private diffEntryRowMap = new Map<string, number>();
	private showIncludeExcludeWaitingMessage: boolean = true;

	public sourceEndpointInfo: mssql.SchemaCompareEndpointInfo;
	public targetEndpointInfo: mssql.SchemaCompareEndpointInfo;

	public promise;

	public schemaCompareDialog: SchemaCompareDialog;

	constructor(private schemaCompareService?: mssql.ISchemaCompareService, private extensionContext?: vscode.ExtensionContext, private view?: azdata.ModelView) {
		this.SchemaCompareActionMap = new Map<Number, string>();
		this.SchemaCompareActionMap[mssql.SchemaUpdateAction.Delete] = loc.deleteAction;
		this.SchemaCompareActionMap[mssql.SchemaUpdateAction.Change] = loc.changeAction;
		this.SchemaCompareActionMap[mssql.SchemaUpdateAction.Add] = loc.addAction;

		this.editor = azdata.workspace.createModelViewEditor(loc.SchemaCompareLabel, { retainContextWhenHidden: true, supportsSave: true, resourceName: schemaCompareResourceName }, 'SchemaCompareEditor');
	}

	// schema compare can get started with four contexts for the source:
	// 1. undefined
	// 2. connection profile
	// 3. dacpac
	// 4. project
	public async start(sourceContext: any, targetContext: mssql.SchemaCompareEndpointInfo = undefined, comparisonResult: mssql.SchemaCompareResult = undefined): Promise<void> {
		let source: mssql.SchemaCompareEndpointInfo;
		let target: mssql.SchemaCompareEndpointInfo;

		const targetIsSetAsProject: boolean = targetContext && targetContext.endpointType === mssql.SchemaCompareEndpointType.Project;

		// if schema compare was launched from a db or a connection profile, set that as the source
		let profile: azdata.IConnectionProfile;

		if (targetIsSetAsProject) {
			profile = sourceContext;
			target = targetContext;
		} else {
			profile = sourceContext ? <azdata.IConnectionProfile>sourceContext.connectionProfile : undefined;
		}

		let sourceDacpac = undefined;
		let sourceProject = undefined;

		if (!profile && sourceContext as string && (sourceContext as string).endsWith('.dacpac')) {
			sourceDacpac = sourceContext as string;
		} else if (!profile) {
			sourceProject = sourceContext as string;
		}

		if (profile) {
			let ownerUri = await azdata.connection.getUriForConnection((profile.id));
			let usr = profile.userName;
			if (!usr) {
				usr = loc.defaultText;
			}

			source = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				serverDisplayName: `${profile.serverName} (${usr})`,
				serverName: profile.serverName,
				databaseName: profile.databaseName,
				ownerUri: ownerUri,
				packageFilePath: '',
				connectionDetails: undefined,
				connectionName: profile.connectionName,
				projectFilePath: '',
				targetScripts: [],
				dataSchemaProvider: '',
				folderStructure: ''
			};
		} else if (sourceDacpac) {
			source = {
				endpointType: mssql.SchemaCompareEndpointType.Dacpac,
				serverDisplayName: '',
				serverName: '',
				databaseName: '',
				ownerUri: '',
				packageFilePath: sourceDacpac,
				connectionDetails: undefined,
				projectFilePath: '',
				targetScripts: [],
				dataSchemaProvider: '',
				folderStructure: ''
			};
		} else if (sourceProject) {
			source = {
				endpointType: mssql.SchemaCompareEndpointType.Project,
				packageFilePath: '',
				serverDisplayName: '',
				serverName: '',
				databaseName: '',
				ownerUri: '',
				connectionDetails: undefined,
				projectFilePath: sourceProject,
				targetScripts: [],
				dataSchemaProvider: undefined,
				folderStructure: ''
			};
		}

		await this.launch(source, target, false, comparisonResult);
	}

	/**
	 * Primary functional entrypoint for opening the schema comparison window, and optionally running it.
	 * @param source
	 * @param target
	 * @param runComparison whether to immediately run the schema comparison.  Requires both source and target to be specified.  Cannot be true when comparisonResult is set.
	 * @param comparisonResult a pre-computed schema comparison result to display.  Cannot be set when runComparison is true.
	 */
	public async launch(source: mssql.SchemaCompareEndpointInfo | undefined, target: mssql.SchemaCompareEndpointInfo | undefined, runComparison: boolean = false, comparisonResult: mssql.SchemaCompareResult | undefined): Promise<void> {
		if (runComparison && comparisonResult) {
			throw new Error('Cannot both pass a comparison result and request a new comparison be run.');
		}

		this.sourceEndpointInfo = source;
		this.targetEndpointInfo = target;

		await this.GetDefaultDeploymentOptions();
		await Promise.all([
			this.registerContent(),
			this.editor.openEditor()
		]);

		if (comparisonResult) {
			await this.execute(comparisonResult);
		} else if (runComparison) {
			if (!source || !target) {
				throw new Error('source and target must both be set when runComparison is true.');
			}

			await this.startCompare();
		}
	}

	private async registerContent(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.editor.registerContent(async (view) => {
				if (isNullOrUndefined(this.view)) {
					this.view = view;
				}

				this.differencesTable = this.view.modelBuilder.table().withProps({
					data: [],
					title: loc.differencesTableTitle,
					columns: []
				}).component();

				this.diffEditor = this.view.modelBuilder.diffeditor().withProperties({
					contentLeft: os.EOL,
					contentRight: os.EOL,
					height: 500,
					title: loc.diffEditorTitle
				}).component();

				this.splitView = this.view.modelBuilder.splitViewContainer().component();

				let sourceTargetLabels = this.view.modelBuilder.flexContainer().component();

				this.sourceTargetFlexLayout = this.view.modelBuilder.flexContainer().component();

				this.createSwitchButton();
				this.createCompareButton();
				this.createCancelButton();
				this.createGenerateScriptButton();
				this.createApplyButton();
				this.createOptionsButton();
				this.createOpenScmpButton();
				this.createSaveScmpButton();
				this.createSourceAndTargetButtons();

				this.sourceName = getEndpointName(this.sourceEndpointInfo);
				this.targetName = getEndpointName(this.targetEndpointInfo);

				this.sourceNameComponent = this.view.modelBuilder.inputBox().withProps({
					value: this.sourceName,
					title: this.sourceName,
					enabled: false
				}).component();

				this.targetNameComponent = this.view.modelBuilder.inputBox().withProps({
					value: this.targetName,
					title: this.targetName,
					enabled: false
				}).component();

				this.resetButtons(ResetButtonState.noSourceTarget);

				let toolBar = this.view.modelBuilder.toolbarContainer();
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

				let sourceLabel = this.view.modelBuilder.text().withProps({
					value: loc.sourceTitle,
					CSSStyles: { 'margin-bottom': '0px' }
				}).component();

				let targetLabel = this.view.modelBuilder.text().withProps({
					value: loc.targetTitle,
					CSSStyles: { 'margin-bottom': '0px' }
				}).component();

				let arrowLabel = this.view.modelBuilder.text().withProps({
					value: '➔'
				}).component();

				sourceTargetLabels.addItem(sourceLabel, { CSSStyles: { 'width': '55%', 'margin-left': '15px', 'font-size': 'larger', 'font-weight': 'bold' } });
				sourceTargetLabels.addItem(targetLabel, { CSSStyles: { 'width': '45%', 'font-size': 'larger', 'font-weight': 'bold' } });
				this.sourceTargetFlexLayout.addItem(this.sourceNameComponent, { CSSStyles: { 'width': '40%', 'height': '25px', 'margin-top': '10px', 'margin-left': '15px', 'margin-right': '10px' } });
				this.sourceTargetFlexLayout.addItem(this.selectSourceButton, { CSSStyles: { 'margin-top': '10px' } });
				this.sourceTargetFlexLayout.addItem(arrowLabel, { CSSStyles: { 'width': '10%', 'font-size': 'larger', 'text-align-last': 'center' } });
				this.sourceTargetFlexLayout.addItem(this.targetNameComponent, { CSSStyles: { 'width': '40%', 'height': '25px', 'margin-top': '10px', 'margin-left': '15px', 'margin-right': '10px' } });
				this.sourceTargetFlexLayout.addItem(this.selectTargetButton, { CSSStyles: { 'margin-top': '10px' } });

				this.loader = this.view.modelBuilder.loadingComponent().component();
				this.waitText = this.view.modelBuilder.text().withProps({
					value: loc.waitText
				}).component();

				this.startText = this.view.modelBuilder.text().withProps({
					value: loc.startText
				}).component();

				this.noDifferencesLabel = this.view.modelBuilder.text().withProps({
					value: loc.noDifferencesText
				}).component();

				this.flexModel = this.view.modelBuilder.flexContainer().component();
				this.flexModel.addItem(toolBar.component(), { flex: 'none' });
				this.flexModel.addItem(sourceTargetLabels, { flex: 'none' });
				this.flexModel.addItem(this.sourceTargetFlexLayout, { flex: 'none' });
				this.flexModel.addItem(this.startText, { CSSStyles: { 'margin': 'auto' } });

				this.flexModel.setLayout({
					flexFlow: 'column',
					height: '100%'
				});

				await this.view.initializeModel(this.flexModel);
				resolve();
			});
		});
	}

	// update source and target name to display
	public updateSourceAndTarget() {
		this.sourceName = getEndpointName(this.sourceEndpointInfo);
		this.targetName = getEndpointName(this.targetEndpointInfo);

		this.sourceNameComponent.updateProperties({
			value: this.sourceName,
			title: this.sourceName
		});
		this.targetNameComponent.updateProperties({
			value: this.targetName,
			title: this.targetName
		});
		if (!this.sourceName || !this.targetName || this.sourceName === ' ' || this.targetName === ' ') {
			this.resetButtons(ResetButtonState.noSourceTarget);
		} else {
			// reset buttons to before comparison state
			this.resetButtons(ResetButtonState.beforeCompareStart);
		}
	}

	public setDeploymentOptions(deploymentOptions: mssql.DeploymentOptions): void {
		this.deploymentOptions = deploymentOptions;
	}

	private async populateProjectScripts(endpointInfo: mssql.SchemaCompareEndpointInfo): Promise<void> {
		if (endpointInfo.endpointType !== mssql.SchemaCompareEndpointType.Project) {
			return;
		}

		const databaseProjectsExtension = vscode.extensions.getExtension(loc.sqlDatabaseProjectExtensionId);

		if (databaseProjectsExtension) {
			endpointInfo.targetScripts = await (await databaseProjectsExtension.activate() as sqldbproj.IExtension).getProjectScriptFiles(endpointInfo.projectFilePath);
		}
	}

	public async execute(comparisonResult: mssql.SchemaCompareCompletionResult = undefined) {
		const service = await this.getService();

		if (comparisonResult) {
			this.operationId = comparisonResult.operationId;
			this.comparisonResult = comparisonResult;
			this.flexModel.removeItem(this.startText);
		} else {
			TelemetryReporter.sendActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaComparisonStarted');

			if (!this.operationId) {
				// create once per page
				this.operationId = generateGuid();
			}

			await Promise.all([this.populateProjectScripts(this.sourceEndpointInfo), this.populateProjectScripts(this.targetEndpointInfo)]);

			this.comparisonResult = await service.schemaCompare(this.operationId, this.sourceEndpointInfo, this.targetEndpointInfo, azdata.TaskExecutionMode.execute, this.deploymentOptions);

			if (!this.comparisonResult || !this.comparisonResult.success) {
				TelemetryReporter.createErrorEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaComparisonFailed', undefined, getTelemetryErrorType(this.comparisonResult?.errorMessage))
					.withAdditionalProperties({
						operationId: this.comparisonResult.operationId
					}).send();

				vscode.window.showErrorMessage(loc.compareErrorMessage(this.comparisonResult?.errorMessage));

				// reset state so a new comparison can be made
				this.resetWindow();

				return;
			}

			TelemetryReporter.createActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaComparisonFinished')
				.withAdditionalProperties({
					'endTime': Date.now().toString(),
					'operationId': this.comparisonResult.operationId
				}).send();
		}

		let data = this.getAllDifferences(this.comparisonResult.differences);

		this.differencesTable.updateProperties({
			data: data,
			columns: [
				{
					value: loc.type,
					cssClass: 'align-with-header',
					width: 50
				},
				{
					value: loc.sourceName,
					cssClass: 'align-with-header',
					width: 90
				},
				<azdata.CheckboxColumn>
				{
					value: loc.include,
					cssClass: 'align-with-header',
					width: 60,
					type: azdata.ColumnType.checkBox,
					action: azdata.ActionOnCellCheckboxCheck.customAction
				},
				{
					value: loc.action,
					cssClass: 'align-with-header',
					width: 30
				},
				{
					value: loc.targetName,
					cssClass: 'align-with-header',
					width: 150
				}
			],
			CSSStyles: { 'left': '15px' },
			width: '98%'
		});

		this.flexModel.removeItem(this.loader);
		this.flexModel.removeItem(this.waitText);
		this.resetButtons(ResetButtonState.afterCompareComplete);

		if (this.comparisonResult.differences.length > 0) {
			this.flexModel.addItem(this.splitView);

			this.splitView.addItem(this.differencesTable);
			this.splitView.addItem(this.diffEditor);
			this.splitView.setLayout({
				orientation: 'vertical',
				splitViewHeight: 800
			});

			// create a map of the differences to row numbers
			for (let i = 0; i < data.length; ++i) {
				this.diffEntryRowMap.set(this.createDiffEntryKey(this.comparisonResult.differences[i]), i);
			}

			// only enable generate script button if the target is a db
			if (this.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
				this.generateScriptButton.enabled = true;
			} else {
				this.generateScriptButton.title = loc.generateScriptDisabled;
			}

			// only enable apply button if the target is a db or a project
			if (this.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database ||
				this.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Project) {
				this.applyButton.enabled = true;
			} else {
				this.applyButton.title = loc.applyDisabled;
			}
		} else {
			this.flexModel.addItem(this.noDifferencesLabel, { CSSStyles: { 'margin': 'auto' } });
		}

		// explicitly exclude things that were excluded in previous compare
		const thingsToExclude = this.sourceTargetSwitched ? this.originalTargetExcludes : this.originalSourceExcludes;
		if (thingsToExclude) {
			thingsToExclude.forEach(async (item) => {
				await service.schemaCompareIncludeExcludeNode(this.comparisonResult.operationId, item, false, azdata.TaskExecutionMode.execute);
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
					title: loc.diffEditorTitle
				});
			}
		}));
		this.tablelistenersToDispose.push(this.differencesTable.onCellAction(async (rowState) => {
			let checkboxState = <azdata.ICheckboxCellActionEventArgs>rowState;
			if (checkboxState) {
				await this.applyIncludeExclude(checkboxState);
			}
		}));
	}

	public async applyIncludeExclude(checkboxState: azdata.ICheckboxCellActionEventArgs): Promise<void> {
		const service = await this.getService();
		// show an info notification the first time when trying to exclude to notify the user that it may take some time to calculate affected dependencies
		if (this.showIncludeExcludeWaitingMessage) {
			this.showIncludeExcludeWaitingMessage = false;
			vscode.window.showInformationMessage(loc.includeExcludeInfoMessage);
		}

		let diff = this.comparisonResult.differences[checkboxState.row];
		const result = await service.schemaCompareIncludeExcludeNode(this.comparisonResult.operationId, diff, checkboxState.checked, azdata.TaskExecutionMode.execute);
		let checkboxesToChange = [];
		if (result.success) {
			this.saveExcludeState(checkboxState);

			// dependencies could have been included or excluded as a result, so save their exclude states
			result.affectedDependencies.forEach(difference => {
				// find the row of the difference and set its checkbox
				const diffEntryKey = this.createDiffEntryKey(difference);
				if (this.diffEntryRowMap.has(diffEntryKey)) {
					const row = this.diffEntryRowMap.get(diffEntryKey);
					checkboxesToChange.push({ row: row, column: 2, columnName: 'Include', checked: difference.included });
					const dependencyCheckBoxState: azdata.ICheckboxCellActionEventArgs = {
						checked: difference.included,
						row: row,
						column: 2,
						columnName: undefined
					};
					this.saveExcludeState(dependencyCheckBoxState);
				}
			});
		} else {
			// failed because of dependencies
			if (result.blockingDependencies) {
				// show the first dependent that caused this to fail in the warning message
				const diffEntryName = this.createName(diff.sourceValue ? diff.sourceValue : diff.targetValue);
				const firstDependentName = this.createName(result.blockingDependencies[0].sourceValue ? result.blockingDependencies[0].sourceValue : result.blockingDependencies[0].targetValue);
				let cannotExcludeMessage: string;
				let cannotIncludeMessage: string;
				if (firstDependentName) {
					cannotExcludeMessage = loc.cannotExcludeMessageDependent(diffEntryName, firstDependentName);
					cannotIncludeMessage = loc.cannotIncludeMessageDependent(diffEntryName, firstDependentName);
				} else {
					cannotExcludeMessage = loc.cannotExcludeMessage(diffEntryName);
					cannotIncludeMessage = loc.cannotIncludeMessage(diffEntryName);
				}
				vscode.window.showWarningMessage(checkboxState.checked ? cannotIncludeMessage : cannotExcludeMessage);
			} else {
				vscode.window.showWarningMessage(result.errorMessage);
			}

			// set checkbox back to previous state
			checkboxesToChange.push({ row: checkboxState.row, column: checkboxState.column, columnName: 'Include', checked: !checkboxState.checked });
		}

		if (checkboxesToChange.length > 0) {
			this.differencesTable.updateCells = checkboxesToChange;
		}
	}

	// save state based on source name if present otherwise target name (parity with SSDT)
	private saveExcludeState(rowState: azdata.ICheckboxCellActionEventArgs) {
		if (rowState) {
			if (this.differencesTable.data[rowState.row]?.length > 2) {
				this.differencesTable.data[rowState.row][2] = rowState.checked;
			}
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

	private createDiffEntryKey(entry: mssql.DiffEntry): string {
		return `${this.createName(entry.sourceValue)}_${this.createName(entry.targetValue)}_${entry.updateAction}_${entry.name}`;
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

	public async startCompare(): Promise<void> {
		this.flexModel.removeItem(this.splitView);
		this.flexModel.removeItem(this.noDifferencesLabel);
		this.flexModel.removeItem(this.startText);
		this.flexModel.addItem(this.loader, { CSSStyles: { 'margin-top': '30px' } });
		this.flexModel.addItem(this.waitText, { CSSStyles: { 'margin-top': '30px', 'align-self': 'center' } });
		this.showIncludeExcludeWaitingMessage = true;
		this.diffEditor.updateProperties({
			contentLeft: os.EOL,
			contentRight: os.EOL,
			title: loc.diffEditorTitle
		});

		this.differencesTable.selectedRows = null;
		if (this.tablelistenersToDispose) {
			this.tablelistenersToDispose.forEach(x => x.dispose());
		}
		this.resetButtons(ResetButtonState.comparing);
		this.promise = this.execute();
		await this.promise;
	}

	private createCompareButton(): void {
		this.compareButton = this.view.modelBuilder.button().withProps({
			label: loc.compare,
			iconPath: {
				light: path.join(this.extensionContext.extensionPath, 'media', 'compare.svg'),
				dark: path.join(this.extensionContext.extensionPath, 'media', 'compare-inverse.svg')
			},
			title: loc.compare
		}).component();

		this.compareButton.onDidClick(async (click) => {
			await this.startCompare();
		});
	}

	private createCancelButton(): void {
		this.cancelCompareButton = this.view.modelBuilder.button().withProps({
			label: loc.stop,
			iconPath: {
				light: path.join(this.extensionContext.extensionPath, 'media', 'stop.svg'),
				dark: path.join(this.extensionContext.extensionPath, 'media', 'stop-inverse.svg')
			},
			title: loc.stop
		}).component();

		this.cancelCompareButton.onDidClick(async (click) => {
			await this.cancelCompare();
		});
	}

	/**
	 * Resets state of buttons and text to initial state before a comparison is started/completed
	 */
	public resetWindow(): void {
		// clean the pane
		this.flexModel.removeItem(this.loader);
		this.flexModel.removeItem(this.waitText);
		this.flexModel.addItem(this.startText, { CSSStyles: { 'margin': 'auto' } });
		this.resetButtons(ResetButtonState.beforeCompareStart);
	}

	public async cancelCompare(): Promise<void> {

		TelemetryReporter.createActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareCancelStarted')
			.withAdditionalProperties({
				'startTime': Date.now().toString(),
				'operationId': this.operationId
			}).send();

		this.resetWindow();

		// cancel compare
		if (this.operationId) {
			const service = await this.getService();
			const result = await service.schemaCompareCancel(this.operationId);

			if (!result || !result.success) {
				TelemetryReporter.createErrorEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareCancelFailed', undefined, getTelemetryErrorType(result.errorMessage))
					.withAdditionalProperties({
						'operationId': this.operationId
					}).send();
				vscode.window.showErrorMessage(loc.cancelErrorMessage(result.errorMessage));
			}
			TelemetryReporter.createActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareCancelEnded')
				.withAdditionalProperties({
					'endTime': Date.now().toString(),
					'operationId': this.operationId
				}).send();
		}
	}

	private createGenerateScriptButton(): void {
		this.generateScriptButton = this.view.modelBuilder.button().withProps({
			label: loc.generateScript,
			iconPath: {
				light: path.join(this.extensionContext.extensionPath, 'media', 'generate-script.svg'),
				dark: path.join(this.extensionContext.extensionPath, 'media', 'generate-script-inverse.svg')
			},
		}).component();

		this.generateScriptButton.onDidClick(async (click) => {
			await this.generateScript();
		});
	}

	public async generateScript(): Promise<void> {
		TelemetryReporter.createActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareGenerateScriptStarted')
			.withAdditionalProperties({
				'startTime': Date.now().toString(),
				'operationId': this.comparisonResult.operationId
			}).send();
		const service = await this.getService();
		const result = await service.schemaCompareGenerateScript(this.comparisonResult.operationId, this.targetEndpointInfo.serverName, this.targetEndpointInfo.databaseName, azdata.TaskExecutionMode.script);
		if (!result || !result.success) {
			TelemetryReporter.createErrorEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareGenerateScriptFailed', undefined, getTelemetryErrorType(result.errorMessage))
				.withAdditionalProperties({
					'operationId': this.comparisonResult.operationId
				}).send();
			vscode.window.showErrorMessage(loc.generateScriptErrorMessage(result.errorMessage));
		}
		TelemetryReporter.createActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareGenerateScriptEnded')
			.withAdditionalProperties({
				'endTime': Date.now().toString(),
				'operationId': this.comparisonResult.operationId
			}).send();
	}

	private createOptionsButton() {
		this.optionsButton = this.view.modelBuilder.button().withProps({
			label: loc.options,
			iconPath: {
				light: path.join(this.extensionContext.extensionPath, 'media', 'options.svg'),
				dark: path.join(this.extensionContext.extensionPath, 'media', 'options-inverse.svg')
			},
			title: loc.options
		}).component();

		this.optionsButton.onDidClick(async (click) => {
			TelemetryReporter.sendActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareOptionsOpened');
			// create fresh every time
			this.schemaCompareOptionDialog = new SchemaCompareOptionsDialog(this.deploymentOptions, this);
			this.schemaCompareOptionDialog.openDialog();
		});
	}

	private createApplyButton() {

		this.applyButton = this.view.modelBuilder.button().withProps({
			label: loc.apply,
			iconPath: {
				light: path.join(this.extensionContext.extensionPath, 'media', 'start.svg'),
				dark: path.join(this.extensionContext.extensionPath, 'media', 'start-inverse.svg')
			},
		}).component();

		this.applyButton.onDidClick(async (click) => {
			await this.publishChanges();
		});
	}

	public async publishChanges(): Promise<void> {
		// need only yes button - since the modal dialog has a default cancel
		const yesString = loc.YesButtonText;
		await vscode.window.showWarningMessage(loc.applyConfirmation, { modal: true }, yesString).then(async (result) => {
			if (result === yesString) {
				TelemetryReporter.createActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareApplyStarted')
					.withAdditionalProperties({
						'startTime': Date.now().toString(),
						'operationId': this.comparisonResult.operationId,
						'targetType': getSchemaCompareEndpointString(this.targetEndpointInfo.endpointType)
					}).send();

				// disable apply and generate script buttons because the results are no longer valid after applying the changes
				this.setButtonsForRecompare();

				const service: mssql.ISchemaCompareService = await this.getService();
				let result: azdata.ResultStatus | undefined = undefined;

				switch (this.targetEndpointInfo.endpointType) {
					case mssql.SchemaCompareEndpointType.Database:
						result = await service.schemaComparePublishDatabaseChanges(this.comparisonResult.operationId, this.targetEndpointInfo.serverName, this.targetEndpointInfo.databaseName, azdata.TaskExecutionMode.execute);
						break;
					case mssql.SchemaCompareEndpointType.Project:
						result = await vscode.commands.executeCommand(loc.sqlDatabaseProjectsPublishChanges, this.comparisonResult.operationId, this.targetEndpointInfo.projectFilePath, this.targetEndpointInfo.folderStructure);
						if (!result.success) {
							void vscode.window.showErrorMessage(loc.applyError);
						}
						break;
					case mssql.SchemaCompareEndpointType.Dacpac: // Dacpac is an invalid publish target
					default:
						throw new Error(`Unsupported SchemaCompareEndpointType: ${getSchemaCompareEndpointString(this.targetEndpointInfo.endpointType)}`);
				}

				if (!result || !result.success) {

					TelemetryReporter.createErrorEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareApplyFailed', undefined, getTelemetryErrorType(result?.errorMessage))
						.withAdditionalProperties({
							'operationId': this.comparisonResult.operationId,
							'targetType': getSchemaCompareEndpointString(this.targetEndpointInfo.endpointType)
						}).send();
					vscode.window.showErrorMessage(loc.applyErrorMessage(result?.errorMessage));

					// reenable generate script and apply buttons if apply failed
					this.generateScriptButton.enabled = true;
					this.generateScriptButton.title = loc.generateScriptEnabledMessage;
					this.applyButton.enabled = true;
					this.applyButton.title = loc.applyEnabledMessage;
				}

				TelemetryReporter.createActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareApplyEnded')
					.withAdditionalProperties({
						'endTime': Date.now().toString(),
						'operationId': this.comparisonResult.operationId,
						'targetType': getSchemaCompareEndpointString(this.targetEndpointInfo.endpointType)
					}).send();

				if (this.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Project) {
					const workspaceApi = getDataWorkspaceExtensionApi();
					workspaceApi.showProjectsView();

					void vscode.window.showInformationMessage(loc.applySuccess);
				}
			}
		});
	}

	private resetButtons(resetButtonState: ResetButtonState): void {
		switch (resetButtonState) {
			case (ResetButtonState.noSourceTarget): {
				this.compareButton.enabled = false;
				this.optionsButton.enabled = false;
				this.switchButton.enabled = ((this.sourceName && this.sourceName !== ' ') || (this.targetName && this.targetName !== ' ')) ? true : false; // allows switching if the source or target name is set
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
		this.generateScriptButton.title = loc.generateScriptEnabledMessage;
		this.applyButton.title = loc.applyEnabledMessage;
	}

	public setButtonsForRecompare(): void {
		this.generateScriptButton.enabled = false;
		this.applyButton.enabled = false;
		this.generateScriptButton.title = loc.reCompareToRefeshMessage;
		this.applyButton.title = loc.reCompareToRefeshMessage;
	}

	// reset state afer loading an scmp
	private resetForNewCompare(): void {
		this.flexModel.removeItem(this.splitView);
		this.flexModel.removeItem(this.noDifferencesLabel);
		this.flexModel.addItem(this.startText, { CSSStyles: { 'margin': 'auto' } });
	}

	private createSwitchButton(): void {
		this.switchButton = this.view.modelBuilder.button().withProps({
			label: loc.switchDirection,
			iconPath: {
				light: path.join(this.extensionContext.extensionPath, 'media', 'switch-directions.svg'),
				dark: path.join(this.extensionContext.extensionPath, 'media', 'switch-directions-inverse.svg')
			},
			title: loc.switchDirectionDescription
		}).component();

		this.switchButton.onDidClick(async (click) => {
			TelemetryReporter.sendActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareSwitch');
			// switch source and target
			[this.sourceEndpointInfo, this.targetEndpointInfo] = [this.targetEndpointInfo, this.sourceEndpointInfo];
			[this.sourceName, this.targetName] = [this.targetName, this.sourceName];

			this.sourceNameComponent.updateProperties({
				value: this.sourceName,
				title: this.sourceName
			});

			this.targetNameComponent.updateProperties({
				value: this.targetName,
				title: this.targetName
			});

			// remember that source target have been toggled
			this.sourceTargetSwitched = this.sourceTargetSwitched ? false : true;

			// only compare if both source and target are set
			if (this.sourceEndpointInfo && this.targetEndpointInfo) {
				await this.startCompare();
			}
		});
	}

	private createSourceAndTargetButtons(): void {
		this.selectSourceButton = this.view.modelBuilder.button().withProps({
			label: '•••',
			title: loc.selectSource,
			ariaLabel: loc.selectSource,
			secondary: true
		}).component();

		this.selectSourceButton.onDidClick(async () => {
			TelemetryReporter.sendActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareSelectSource');
			this.schemaCompareDialog = new SchemaCompareDialog(this, undefined, this.extensionContext);
			this.promise = this.schemaCompareDialog.openDialog();
			await this.promise;
		});

		this.selectTargetButton = this.view.modelBuilder.button().withProps({
			label: '•••',
			title: loc.selectTarget,
			ariaLabel: loc.selectTarget,
			secondary: true
		}).component();

		this.selectTargetButton.onDidClick(async () => {
			TelemetryReporter.sendActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareSelectTarget');
			this.schemaCompareDialog = new SchemaCompareDialog(this, undefined, this.extensionContext);
			this.promise = await this.schemaCompareDialog.openDialog();
			await this.promise;
		});
	}

	private createOpenScmpButton() {
		this.openScmpButton = this.view.modelBuilder.button().withProps({
			label: loc.openScmp,
			iconPath: {
				light: path.join(this.extensionContext.extensionPath, 'media', 'open-scmp.svg'),
				dark: path.join(this.extensionContext.extensionPath, 'media', 'open-scmp-inverse.svg')
			},
			title: loc.openScmpDescription
		}).component();

		this.openScmpButton.onDidClick(async (click) => {
			await this.openScmp();
		});
	}

	public async openScmp(): Promise<void> {
		TelemetryReporter.sendActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareOpenScmpStarted');
		const rootPath = getRootPath();
		let fileUris = await vscode.window.showOpenDialog(
			{
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				defaultUri: vscode.Uri.file(rootPath),
				openLabel: loc.open,
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
			TelemetryReporter.sendErrorEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareOpenScmpFailed', undefined, getTelemetryErrorType(result.errorMessage));
			vscode.window.showErrorMessage(loc.openScmpErrorMessage(result.errorMessage));
			return;
		}

		this.sourceEndpointInfo = await this.constructEndpointInfo(result.sourceEndpointInfo, loc.sourceTitle);
		this.targetEndpointInfo = await this.constructEndpointInfo(result.targetEndpointInfo, loc.targetTitle);

		this.updateSourceAndTarget();
		this.setDeploymentOptions(result.deploymentOptions);
		this.scmpSourceExcludes = result.excludedSourceElements;
		this.scmpTargetExcludes = result.excludedTargetElements;
		this.sourceTargetSwitched = result.originalTargetName !== this.targetEndpointInfo.databaseName;

		// clear out any old results
		this.resetForNewCompare();

		TelemetryReporter.createActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareOpenScmpEnded')
			.withAdditionalProperties({
				elapsedTime: (Date.now() - startTime).toString()
			}).send();
	}

	private async constructEndpointInfo(endpoint: mssql.SchemaCompareEndpointInfo, caller: string): Promise<mssql.SchemaCompareEndpointInfo> {
		let ownerUri;
		let endpointInfo;
		if (endpoint && endpoint.endpointType === mssql.SchemaCompareEndpointType.Database) {
			// only set endpoint info if able to connect to the database
			ownerUri = await verifyConnectionAndGetOwnerUri(endpoint, caller);
		}
		if (ownerUri) {
			endpointInfo = endpoint;
			endpointInfo.ownerUri = ownerUri;
		} else {
			// need to do this instead of just setting it to the endpoint because some fields are null which will cause an error when sending the compare request
			endpointInfo = {
				endpointType: endpoint.endpointType === mssql.SchemaCompareEndpointType.Database ? mssql.SchemaCompareEndpointType.Database : mssql.SchemaCompareEndpointType.Dacpac,
				serverDisplayName: '',
				serverName: '',
				databaseName: '',
				ownerUri: '',
				packageFilePath: endpoint.packageFilePath,
				connectionDetails: undefined
			};
		}
		return endpointInfo;
	}

	private createSaveScmpButton(): void {
		this.saveScmpButton = this.view.modelBuilder.button().withProps({
			label: loc.saveScmp,
			iconPath: {
				light: path.join(this.extensionContext.extensionPath, 'media', 'save-scmp.svg'),
				dark: path.join(this.extensionContext.extensionPath, 'media', 'save-scmp-inverse.svg')
			},
			title: loc.saveScmpDescription,
			enabled: false
		}).component();

		this.saveScmpButton.onDidClick(async (click) => {
			await this.saveScmp();
		});
	}

	public async saveScmp(): Promise<void> {
		const rootPath = getRootPath();
		const filePath = await vscode.window.showSaveDialog(
			{
				defaultUri: vscode.Uri.file(rootPath),
				saveLabel: loc.save,
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
		TelemetryReporter.sendActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareSaveScmp');
		const service = await this.getService();
		const result = await service.schemaCompareSaveScmp(this.sourceEndpointInfo, this.targetEndpointInfo, azdata.TaskExecutionMode.execute, this.deploymentOptions, filePath.fsPath, sourceExcludes, targetExcludes);
		if (!result || !result.success) {
			TelemetryReporter.createErrorEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareSaveScmpFailed', undefined, getTelemetryErrorType(result.errorMessage))
				.withAdditionalProperties({
					operationId: this.comparisonResult.operationId
				}).send();
			vscode.window.showErrorMessage(loc.saveScmpErrorMessage(result.errorMessage));
		}
		TelemetryReporter.createActionEvent(TelemetryViews.SchemaCompareMainWindow, 'SchemaCompareSaveScmpEnded')
			.withAdditionalProperties({
				elapsedTime: (Date.now() - startTime).toString(),
				operationId: this.comparisonResult.operationId
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
		// generate script and apply can only be enabled if the target is a database or project
		if (this.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database ||
			this.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Project) {
			this.applyButton.enabled = enableButtons;
			this.applyButton.title = enableButtons ? loc.applyEnabledMessage : loc.applyNoChangesMessage;
		}

		if (this.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
			this.generateScriptButton.enabled = enableButtons;
			this.generateScriptButton.title = enableButtons ? loc.generateScriptEnabledMessage : loc.generateScriptNoChangesMessage;
		}
	}

	private async getService(): Promise<mssql.ISchemaCompareService> {
		if (this.schemaCompareService === null || this.schemaCompareService === undefined) {
			this.schemaCompareService = (await vscode.extensions.getExtension(mssql.extension.name).exports as mssql.IExtension).schemaCompare;
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
