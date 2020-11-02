/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { SqlAssessmentTab } from './sqlAssessmentTab';
import { AssessmentEngine, AssessmentType } from '../engine';
import { promises as fs } from 'fs';
import { suggestReportFile } from '../utils';
import { HTMLReportBuilder } from '../htmlReportGenerator';
import { AssessmentResultGrid } from '../assessmentResultGrid';
import { LocalizedStrings } from '../localized';
import { TelemetryReporter, SqlAssessmentTelemetryView, SqlTelemetryActions } from '../telemetry';

const localize = nls.loadMessageBundle();

export class SqlAssessmentMainTab extends SqlAssessmentTab {
	private assessmentPropertiesContainer!: azdata.PropertiesContainerComponent;
	private apiVersionPropItem: azdata.PropertiesContainerItem;
	private defaultRulesetPropItem: azdata.PropertiesContainerItem;
	private invokeAssessmentLabel: string = localize('invokeAssessmentLabelServer', "Invoke assessment");
	private getItemsLabel: string = localize('getAssessmentItemsServer', "View applicable rules");
	private btnExportAsScript!: azdata.ButtonComponent;
	private btnHTMLExport!: azdata.ButtonComponent;

	private engine: AssessmentEngine;
	private toDispose: vscode.Disposable[] = [];
	private resultGrid!: AssessmentResultGrid;



	public constructor(extensionContext: vscode.ExtensionContext, engine: AssessmentEngine) {
		super(extensionContext, LocalizedStrings.ASSESSMENT_TAB_NAME, 'MainTab', {
			dark: extensionContext.asAbsolutePath('resources/dark/server.svg'),
			light: extensionContext.asAbsolutePath('resources/light/server.svg')
		});
		this.apiVersionPropItem = { displayName: LocalizedStrings.API_VERSION, value: '' };
		this.defaultRulesetPropItem = { displayName: LocalizedStrings.DEFAULT_RULESET_VERSION, value: '' };
		this.engine = engine;
	}

	public dispose() {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	async tabContent(view: azdata.ModelView): Promise<azdata.Component> {

		if (!this.engine.isServerConnection) {
			this.invokeAssessmentLabel = localize('invokeAssessmentLabelDatabase', "Invoke assessment for {0}", this.engine.databaseName);
			this.getItemsLabel = localize('getAssessmentItemsDatabase', "View applicable rules for {0}", this.engine.databaseName);
		}
		else {
			this.invokeAssessmentLabel = localize('invokeAssessmentLabelServer', "Invoke assessment");
			this.getItemsLabel = localize('getAssessmentItemsServer', "View applicable rules");
		}

		let rootContainer = view.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%',

			}).component();

		rootContainer.addItem(await this.createPropertiesSection(view), { flex: '0 0 auto' });
		rootContainer.addItem(await this.createToolbar(view), {
			flex: '0 0 auto', CSSStyles: {
				'border-top': '3px solid rgb(221, 221, 221)',
				'margin-top': '20px',
				'height': '32px'
			}
		});

		this.resultGrid = new AssessmentResultGrid(view, this.extensionContext);
		rootContainer.addItem(this.resultGrid.component, {
			flex: '1 1 auto',
			CSSStyles: {
				'padding-bottom': '15px'
			}
		});

		return rootContainer;
	}

	private async createPropertiesSection(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const serverInfo = await azdata.connection.getServerInfo(view.connection.connectionId);
		const connectionProfile = await azdata.connection.getCurrentConnection();

		const propertiesContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				justifyContent: 'flex-start'
			}).component();

		const apiInformationContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				alignContent: 'flex-start'
			}).component();
		apiInformationContainer.addItem(
			view.modelBuilder.text().withProperties({ value: LocalizedStrings.SECTION_TITLE_API }).component(), {
			CSSStyles: { 'font-size': 'larger' }
		});

		this.assessmentPropertiesContainer = view.modelBuilder.propertiesContainer()
			.withProperties<azdata.PropertiesContainerComponentProperties>({
				propertyItems: [
					this.apiVersionPropItem,
					this.defaultRulesetPropItem]
			}).component();

		apiInformationContainer.addItem(this.assessmentPropertiesContainer, {
			CSSStyles: {
				'margin-left': '20px'
			}
		});

		const sqlServerContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				alignContent: 'flex-start'
			}).component();
		sqlServerContainer.addItem(
			view.modelBuilder.text().withProperties({ value: LocalizedStrings.SECTION_TITLE_SQL_SERVER }).component(), {
			CSSStyles: { 'font-size': 'larger' }
		});
		sqlServerContainer.addItem(
			view.modelBuilder.propertiesContainer()
				.withProperties<azdata.PropertiesContainerComponentProperties>({
					propertyItems: [
						{ displayName: LocalizedStrings.SERVER_VERSION, value: serverInfo.serverVersion },
						{ displayName: LocalizedStrings.SERVER_INSTANCENAME, value: connectionProfile.serverName },
						{ displayName: LocalizedStrings.SERVER_EDITION, value: serverInfo.serverEdition },
						{ displayName: LocalizedStrings.SERVER_OSVERSION, value: serverInfo.osVersion },
					]
				}).component(), {
			CSSStyles: {
				'margin-left': '20px'
			}
		});

		propertiesContainer.addItem(apiInformationContainer, { flex: '0 0 300px', CSSStyles: { 'margin-left': '10px' } });
		propertiesContainer.addItem(sqlServerContainer, { flex: '1 1 auto' });

		return propertiesContainer;
	}

	private async createToolbar(view: azdata.ModelView): Promise<azdata.ToolbarContainer> {

		const targetIconPath = this.engine.isServerConnection
			? {
				dark: this.extensionContext.asAbsolutePath('resources/dark/server.svg'),
				light: this.extensionContext.asAbsolutePath('resources/light/server.svg')
			} : {
				dark: this.extensionContext.asAbsolutePath('resources/dark/database.svg'),
				light: this.extensionContext.asAbsolutePath('resources/light/database.svg')
			};

		const btnInvokeAssessment = view.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: this.invokeAssessmentLabel,
				iconPath: targetIconPath,
			}).component();
		const btnInvokeAssessmentLoading = view.modelBuilder.loadingComponent()
			.withItem(btnInvokeAssessment)
			.withProperties<azdata.LoadingComponentProperties>({
				loadingText: this.invokeAssessmentLabel,
				showText: true,
				loading: false
			}).component();

		this.toDispose.push(btnInvokeAssessment.onDidClick(async () => {
			btnInvokeAssessmentLoading.loading = true;
			try {
				await this.engine.performAssessment(AssessmentType.InvokeAssessment,
					async (result: azdata.SqlAssessmentResult, assessmentType: AssessmentType, append: boolean) => {
						if (append) {
							await this.resultGrid.appendResult(result);
						} else {
							this.displayResults(result, assessmentType);
						}
					});
			}
			finally {
				btnInvokeAssessmentLoading.loading = false;
			}
		}));

		const btnGetAssessmentItems = view.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: this.getItemsLabel,
				iconPath: targetIconPath,
			}).component();
		const btnGetAssessmentItemsLoading = view.modelBuilder.loadingComponent()
			.withItem(btnGetAssessmentItems)
			.withProperties<azdata.LoadingComponentProperties>({
				loadingText: this.getItemsLabel,
				showText: true,
				loading: false
			}).component();

		this.toDispose.push(btnGetAssessmentItems.onDidClick(async () => {
			btnGetAssessmentItemsLoading.loading = true;
			try {
				await this.engine.performAssessment(AssessmentType.AvailableRules,
					async (result: azdata.SqlAssessmentResult, assessmentType: AssessmentType, append: boolean) => {
						if (append) {
							await this.resultGrid.appendResult(result);
						} else {
							this.displayResults(result, assessmentType);
						}
					});
			}
			finally {
				btnGetAssessmentItemsLoading.loading = false;
			}
		}));

		this.btnExportAsScript = view.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: localize('btnExportAsScript', "Export as script"),
				iconPath: {
					dark: this.extensionContext.asAbsolutePath('resources/dark/newquery_inverse.svg'),
					light: this.extensionContext.asAbsolutePath('resources/light/newquery.svg')
				},
				enabled: false
			}).component();
		this.toDispose.push(this.btnExportAsScript.onDidClick(async () => {
			this.engine.generateAssessmentScript();
		}));

		this.btnHTMLExport = view.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: localize('btnGeneratehtmlreport', "Create HTML Report"),
				iconPath: {
					dark: this.extensionContext.asAbsolutePath('resources/dark/newquery_inverse.svg'),
					light: this.extensionContext.asAbsolutePath('resources/light/newquery.svg')
				},
				enabled: false
			}).component();

		this.toDispose.push(this.btnHTMLExport.onDidClick(async () => {
			TelemetryReporter.sendActionEvent(SqlAssessmentTelemetryView, SqlTelemetryActions.CreateHTMLReport);
			const options: vscode.SaveDialogOptions = {
				defaultUri: vscode.Uri.file(suggestReportFile(Date.now())),
				filters: { 'HTML File': ['html'] }
			};

			const choosenPath = await vscode.window.showSaveDialog(options);
			if (choosenPath !== undefined) {
				const reportContent = await new HTMLReportBuilder(this.engine.recentResult.result,
					this.engine.recentResult.dateUpdated,
					this.engine.recentResult.connectionInfo).build();
				await fs.writeFile(choosenPath.fsPath, reportContent);
				if (await vscode.window.showInformationMessage(
					localize('asmtaction.openReport', "Report has been saved. Do you want to open it?"),
					localize('asmtaction.label.open', "Open"), localize('asmtaction.label.cancel', "Cancel")
				) === localize('asmtaction.label.open', "Open")) {
					vscode.env.openExternal(choosenPath);
				}
			}
		}));


		let btnViewSamples = view.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: localize('btnViewSamples', "View all rules and learn more on GitHub"),
				iconPath: {
					dark: this.extensionContext.asAbsolutePath('resources/dark/configuredashboard_inverse.svg'),
					light: this.extensionContext.asAbsolutePath('resources/light/configuredashboard.svg')
				},
			}).component();

		this.toDispose.push(btnViewSamples.onDidClick(() => {
			TelemetryReporter.sendActionEvent(SqlAssessmentTelemetryView, SqlTelemetryActions.LearnMoreAssessmentLink);
			vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/sql-assessment-api'));
		}));

		return view.modelBuilder.toolbarContainer()
			.withToolbarItems(
				[
					{ component: btnInvokeAssessmentLoading },
					{ component: btnGetAssessmentItemsLoading },
					{ component: this.btnExportAsScript },
					{ component: this.btnHTMLExport },
					{ component: btnViewSamples }
				]
			).component();
	}

	private displayResults(result: azdata.SqlAssessmentResult, assessmentType: AssessmentType): void {
		this.apiVersionPropItem.value = result.apiVersion;
		this.defaultRulesetPropItem.value = result.items?.length > 0 ? result.items[0].rulesetVersion : '';
		this.assessmentPropertiesContainer.propertyItems = [
			this.apiVersionPropItem,
			this.defaultRulesetPropItem
		];

		this.resultGrid.displayResult(result, assessmentType);
		this.btnExportAsScript.enabled = this.btnHTMLExport.enabled = assessmentType === AssessmentType.InvokeAssessment;
	}
}
