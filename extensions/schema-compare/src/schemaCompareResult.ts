/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { SchemaCompareOptionsDialog } from './dialogs/schemaCompareOptions';
const localize = nls.loadMessageBundle();

export class SchemaCompareResult {
	private differencesTable: azdata.TableComponent;
	private loader: azdata.LoadingComponent;
	private editor: azdata.workspace.ModelViewEditor;
	private diffEditor: azdata.DiffEditorComponent;
	private splitView: azdata.SplitViewContainer;
	private flexModel: azdata.FlexContainer;
	private noDifferencesLabel: azdata.TextComponent;
	private sourceTargetFlexLayout: azdata.FlexContainer;
	private switchButton: azdata.ButtonComponent;
	private compareButton: azdata.ButtonComponent;
	private generateScriptButton: azdata.ButtonComponent;
	private optionsButton: azdata.ButtonComponent;
	private SchemaCompareActionMap: Map<Number, string>;
	private comparisonResult: azdata.SchemaCompareResult;
	private sourceNameComponent: azdata.TableComponent;
	private targetNameComponent: azdata.TableComponent;
	private schemaCompareOptions: azdata.SchemaCompareOptions;
	private schemaCompareOptionDialog: SchemaCompareOptionsDialog;

	constructor(private sourceName: string, private targetName: string, private sourceEndpointInfo: azdata.SchemaCompareEndpointInfo, private targetEndpointInfo: azdata.SchemaCompareEndpointInfo) {
		this.SchemaCompareActionMap = new Map<Number, string>();
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Delete] = localize('schemaCompare.deleteAction', 'Delete');
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Change] = localize('schemaCompare.changeAction', 'Change');
		this.SchemaCompareActionMap[azdata.SchemaUpdateAction.Add] = localize('schemaCompare.addAction', 'Add');

		this.editor = azdata.workspace.createModelViewEditor(localize('schemaCompare.Title', 'Schema Compare'), { retainContextWhenHidden: true, supportsSave: true });
		this.GetDefaultSchemaCompareOptions();

		this.editor.registerContent(async view => {
			this.differencesTable = view.modelBuilder.table().withProperties({
				data: [],
				height: 300,
			}).component();

			this.diffEditor = view.modelBuilder.diffeditor().withProperties({
				contentLeft: '\n',
				contentRight: '\n',
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
			this.createOptionsButton(view);
			this.resetButtons();

			let toolBar = view.modelBuilder.toolbarContainer();
			toolBar.addToolbarItems([{
				component: this.compareButton
			}, {
				component: this.generateScriptButton
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
			this.flexModel.addItem(this.loader, { CSSStyles: { 'margin-top': '2em' } });
			this.flexModel.setLayout({
				flexFlow: 'column',
				height: '100%'
			});

			await view.initializeModel(this.flexModel);
		});
	}

	public async start() {
		this.editor.openEditor();
		this.execute();
	}

	private async execute() {
		if (this.schemaCompareOptionDialog && this.schemaCompareOptionDialog.schemaCompareOptions){
			// take updates if any
			this.schemaCompareOptions = this.schemaCompareOptionDialog.schemaCompareOptions;
		}

		let service = await SchemaCompareResult.getService('MSSQL');
		this.comparisonResult = await service.schemaCompare(this.sourceEndpointInfo, this.targetEndpointInfo, azdata.TaskExecutionMode.execute, this.schemaCompareOptions);
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

		this.splitView.addItem(this.differencesTable);
		this.splitView.addItem(this.diffEditor);
		this.splitView.setLayout({
			orientation: 'vertical',
			splitViewHeight: 800
		});

		this.flexModel.removeItem(this.loader);
		this.switchButton.enabled = true;
		this.compareButton.enabled = true;

		if (this.comparisonResult.differences.length > 0) {
			this.flexModel.addItem(this.splitView);

			// only enable generate script button if the target is a db
			if (this.targetEndpointInfo.endpointType === azdata.SchemaCompareEndpointType.database) {
				this.generateScriptButton.enabled = true;
			} else {
				this.generateScriptButton.title = localize('schemaCompare.generateScriptButtonDisabledTitle', 'Generate script is enabled when the target is a database');
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
		if (differences) {
			differences.forEach(difference => {
				if (difference.differenceType === azdata.SchemaDifferenceType.Object) {
					if (difference.sourceValue !== null || difference.targetValue !== null) {
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

	private reExecute() {
		this.flexModel.removeItem(this.splitView);
		this.flexModel.removeItem(this.noDifferencesLabel);
		this.flexModel.addItem(this.loader, { CSSStyles: { 'margin-top': '2em' } });
		this.diffEditor.updateProperties({
			contentLeft: '\n',
			contentRight: '\n'
		});
		this.differencesTable.selectedRows = null;
		this.resetButtons();
		this.execute();
	}

	private createCompareButton(view: azdata.ModelView) {
		let runIcon = path.join(__dirname, '.', 'media', 'compare.svg');

		this.compareButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.compareButton', 'Compare'),
			iconPath: runIcon,
			title: localize('schemaCompare.compareButtonTitle', 'Compare')
		}).component();

		this.compareButton.onDidClick(async (click) => {
			this.reExecute();
		});
	}

	private createGenerateScriptButton(view: azdata.ModelView) {
		let fileIcon = path.join(__dirname, '.', 'media', 'generate-script.svg');

		this.generateScriptButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.generateScriptButton', 'Generate script'),
			iconPath: fileIcon
		}).component();

		this.generateScriptButton.onDidClick(async (click) => {
			// get file path
			let now = new Date();
			let datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes();
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
					localize('schemaCompare.generateScriptErrorMessage', "Generate script failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
			}
		});
	}

	private createOptionsButton(view: azdata.ModelView) {
		let fileIcon = path.join(__dirname, '.', 'media', 'generate-script.svg'); //placeholder

		this.optionsButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.optionsButton', 'Options'),
			iconPath: fileIcon
		}).component();

		this.optionsButton.onDidClick(async (click) => {
			//restore options from last time
			if(this.schemaCompareOptionDialog && this.schemaCompareOptionDialog.schemaCompareOptions)
			{
				this.schemaCompareOptions = this.schemaCompareOptionDialog.schemaCompareOptions;
			}
			// create fresh every time
			this.schemaCompareOptionDialog = new SchemaCompareOptionsDialog(this.schemaCompareOptions);
			await this.schemaCompareOptionDialog.openDialog();
		});
	}

	private resetButtons() {
		this.compareButton.enabled = false;
		this.switchButton.enabled = false;
		this.generateScriptButton.enabled = false;
		this.generateScriptButton.title = localize('schemaCompare.generateScriptEnabledButton', 'Generate script to deploy changes to target');
	}

	private createSwitchButton(view: azdata.ModelView) {
		let swapIcon = path.join(__dirname, '.', 'media', 'switch-directions.svg');

		this.switchButton = view.modelBuilder.button().withProperties({
			label: localize('schemaCompare.switchDirectionButton', 'Switch direction'),
			iconPath: swapIcon,
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

	private GetDefaultSchemaCompareOptions() {
		// Same as dacfx default options
		this.schemaCompareOptions = {
			IgnoreTableOptions: false,
			IgnoreSemicolonBetweenStatements: true,
			IgnoreRouteLifetime: true,
			IgnoreRoleMembership: false,
			IgnoreQuotedIdentifiers: true,
			IgnorePermissions: false,
			IgnorePartitionSchemes: false,
			IgnoreObjectPlacementOnPartitionScheme: true,
			IgnoreNotForReplication: false,
			IgnoreLoginSids: true,
			IgnoreLockHintsOnIndexes: false,
			IgnoreKeywordCasing: true,
			IgnoreIndexPadding: true,
			IgnoreIndexOptions: false,
			IgnoreIncrement: false,
			IgnoreIdentitySeed: false,
			IgnoreUserSettingsObjects: false,
			IgnoreFullTextCatalogFilePath: true,
			IgnoreWhitespace: true,
			IgnoreWithNocheckOnForeignKeys: false,
			VerifyCollationCompatibility: true,
			UnmodifiableObjectWarnings: true,
			TreatVerificationErrorsAsWarnings: false,
			ScriptRefreshModule: true,
			ScriptNewConstraintValidation: true,
			ScriptFileSize: false,
			ScriptDeployStateChecks: false,
			ScriptDatabaseOptions: false,
			ScriptDatabaseCompatibility: false,
			ScriptDatabaseCollation: false,
			RunDeploymentPlanExecutors: false,
			RegisterDataTierApplication: false,
			PopulateFilesOnFileGroups: true,
			NoAlterStatementsToChangeClrTypes: false,
			IncludeTransactionalScripts: false,
			IncludeCompositeObjects: false,
			AllowUnsafeRowLevelSecurityDataMovement: false,
			IgnoreWithNocheckOnCheckConstraints: false,
			IgnoreFillFactor: true,
			IgnoreFileSize: true,
			IgnoreFilegroupPlacement: true,
			DoNotAlterReplicatedObjects: true,
			DoNotAlterChangeDataCaptureObjects: true,
			DisableAndReenableDdlTriggers: true,
			DeployDatabaseInSingleUserMode: false,
			CreateNewDatabase: false,
			CompareUsingTargetCollation: false,
			CommentOutSetVarDeclarations: false,
			BlockWhenDriftDetected: false,
			BlockOnPossibleDataLoss: true,
			BackupDatabaseBeforeChanges: false,
			AllowIncompatiblePlatform: false,
			AllowDropBlockingAssemblies: false,
			DropConstraintsNotInSource: true,
			DropDmlTriggersNotInSource: true,
			DropExtendedPropertiesNotInSource: true,
			DropIndexesNotInSource: true,
			IgnoreFileAndLogFilePath: true,
			IgnoreExtendedProperties: false,
			IgnoreDmlTriggerState: false,
			IgnoreDmlTriggerOrder: false,
			IgnoreDefaultSchema: false,
			IgnoreDdlTriggerState: false,
			IgnoreDdlTriggerOrder: false,
			IgnoreCryptographicProviderFilePath: true,
			VerifyDeployment: true,
			IgnoreComments: false,
			IgnoreColumnCollation: false,
			IgnoreAuthorizer: false,
			IgnoreAnsiNulls: true,
			GenerateSmartDefaults: false,
			DropStatisticsNotInSource: true,
			DropRoleMembersNotInSource: false,
			DropPermissionsNotInSource: false,
			DropObjectsNotInSource: true,
			IgnoreColumnOrder: false,
			DoNotDropObjectTypes: null,
			ExcludeObjectTypes: [
				azdata.SchemaObjectType.ServerTriggers,
				azdata.SchemaObjectType.Routes,
				azdata.SchemaObjectType.LinkedServerLogins,
				azdata.SchemaObjectType.Endpoints,
				azdata.SchemaObjectType.ErrorMessages,
				azdata.SchemaObjectType.Filegroups,
				azdata.SchemaObjectType.Logins,
				azdata.SchemaObjectType.LinkedServers,
				azdata.SchemaObjectType.Credentials,
				azdata.SchemaObjectType.DatabaseScopedCredentials,
				azdata.SchemaObjectType.DatabaseEncryptionKeys,
				azdata.SchemaObjectType.MasterKeys,
				azdata.SchemaObjectType.DatabaseAuditSpecifications,
				azdata.SchemaObjectType.Audits,
				azdata.SchemaObjectType.ServerAuditSpecifications,
				azdata.SchemaObjectType.CryptographicProviders,
				azdata.SchemaObjectType.ServerRoles,
				azdata.SchemaObjectType.EventSessions,
				azdata.SchemaObjectType.DatabaseOptions,
				azdata.SchemaObjectType.EventNotifications,
				azdata.SchemaObjectType.ServerRoleMembership,
				azdata.SchemaObjectType.AssemblyFiles,
			]
		};
	}

	private static async getService(providerName: string): Promise<azdata.SchemaCompareServicesProvider> {
		let service = azdata.dataprotocol.getProvider<azdata.SchemaCompareServicesProvider>(providerName, azdata.DataProviderType.SchemaCompareServicesProvider);
		return service;
	}
}