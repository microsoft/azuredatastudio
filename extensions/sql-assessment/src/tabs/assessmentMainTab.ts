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
import { suggestReportFile, limitLongName } from '../utils';
import { HTMLReportBuilder } from '../htmlReportGenerator';
import { AssessmentResultGrid } from '../assessmentResultGrid';
import { LocalizedStrings } from '../localized';
import { TelemetryReporter, SqlAssessmentTelemetryView, SqlTelemetryActions } from '../telemetry';
import { EOL } from 'os';

const localize = nls.loadMessageBundle();

export class SqlAssessmentMainTab extends SqlAssessmentTab {
	private apiVersionPropItem: azdata.PropertiesContainerItem;
	private defaultRulesetPropItem: azdata.PropertiesContainerItem;
	private serverProps: azdata.PropertiesContainerItem[] = [];

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

	public override dispose() {
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
		await this.createServerProperties(view);

		rootContainer.addItem(await this.createToolbar(view), {
			flex: '0 0 auto', CSSStyles: {
				'border-top': '3px solid rgb(221, 221, 221)'
			}
		});

		this.resultGrid = new AssessmentResultGrid(view, this.extensionContext);
		rootContainer.addItem(this.resultGrid.component, {
			flex: '1 1 auto',
			CSSStyles: {
				'padding-bottom': '10px'
			}
		});

		return rootContainer;
	}

	private async createServerProperties(view: azdata.ModelView): Promise<void> {
		const serverInfo = await azdata.connection.getServerInfo(view.connection.connectionId);
		const connectionProfile = await azdata.connection.getCurrentConnection();
		this.serverProps = [
			{ displayName: LocalizedStrings.SERVER_VERSION, value: serverInfo.serverVersion },
			{ displayName: LocalizedStrings.SERVER_INSTANCENAME, value: connectionProfile.serverName },
			{ displayName: LocalizedStrings.SERVER_EDITION, value: serverInfo.serverEdition },
			{ displayName: LocalizedStrings.SERVER_OSVERSION, value: serverInfo.osVersion },
		];
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
		const iconSize: number = 16;
		const btnHeight: string = '26px';
		const maxNameLength: number = 40;

		const btnInvokeAssessment = view.modelBuilder.button()
			.withProps({
				label: limitLongName(this.invokeAssessmentLabel, maxNameLength),
				iconPath: targetIconPath,
				iconHeight: iconSize,
				iconWidth: iconSize,
				height: btnHeight

			}).component();
		const btnInvokeAssessmentLoading = view.modelBuilder.loadingComponent()
			.withItem(btnInvokeAssessment)
			.withProps({
				loadingText: limitLongName(this.invokeAssessmentLabel, maxNameLength),
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
							await this.displayResults(result, assessmentType);
						}
					});
			}
			finally {
				btnInvokeAssessmentLoading.loading = false;
			}
		}));

		const btnGetAssessmentItems = view.modelBuilder.button()
			.withProps({
				label: limitLongName(this.getItemsLabel, maxNameLength),
				iconPath: targetIconPath,
				iconHeight: iconSize,
				iconWidth: iconSize,
				height: btnHeight
			}).component();
		const btnGetAssessmentItemsLoading = view.modelBuilder.loadingComponent()
			.withItem(btnGetAssessmentItems)
			.withProps({
				loadingText: limitLongName(this.getItemsLabel, maxNameLength),
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
							await this.displayResults(result, assessmentType);
						}
					});
			}
			finally {
				btnGetAssessmentItemsLoading.loading = false;
			}
		}));

		this.btnExportAsScript = view.modelBuilder.button()
			.withProps({
				label: localize('btnExportAsScript', "Export as script"),
				enabled: false,
				iconPath: {
					dark: this.extensionContext.asAbsolutePath('resources/dark/newquery_inverse.svg'),
					light: this.extensionContext.asAbsolutePath('resources/light/newquery.svg')
				},
				iconHeight: iconSize,
				iconWidth: iconSize,
				height: btnHeight
			}).component();
		this.toDispose.push(this.btnExportAsScript.onDidClick(async () => {
			this.engine.generateAssessmentScript();
		}));

		this.btnHTMLExport = view.modelBuilder.button()
			.withProps({
				label: localize('btnGeneratehtmlreport', "Create HTML Report"),
				enabled: false,
				iconPath: {
					dark: this.extensionContext.asAbsolutePath('resources/dark/book_inverse.svg'),
					light: this.extensionContext.asAbsolutePath('resources/light/book.svg')
				},
				iconHeight: iconSize,
				iconWidth: iconSize,
				height: btnHeight
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
			.withProps({
				label: localize('btnViewSamplesShort', "View all on GitHub"),
				iconPath: {
					dark: this.extensionContext.asAbsolutePath('resources/dark/configuredashboard_inverse.svg'),
					light: this.extensionContext.asAbsolutePath('resources/light/configuredashboard.svg')
				},
				iconHeight: iconSize,
				iconWidth: iconSize,
				height: btnHeight,
				title: localize('btnViewSamples', "View all rules and learn more on GitHub"),
			}).component();

		this.toDispose.push(btnViewSamples.onDidClick(() => {
			TelemetryReporter.sendActionEvent(SqlAssessmentTelemetryView, SqlTelemetryActions.LearnMoreAssessmentLink);
			vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/sql-assessment-api'));
		}));

		let btnAPIDetails = view.modelBuilder.button()
			.withProps({
				label: LocalizedStrings.SECTION_TITLE_API,
				iconPath: {
					dark: this.extensionContext.asAbsolutePath('resources/dark/status_info.svg'),
					light: this.extensionContext.asAbsolutePath('resources/light/status_info.svg')
				},
				iconHeight: iconSize,
				iconWidth: iconSize,
				height: btnHeight
			}).component();
		this.toDispose.push(btnAPIDetails.onDidClick(async () => {
			let infoArray: azdata.PropertiesContainerItem[] = [];

			if (this.apiVersionPropItem.value) {
				infoArray.push(this.apiVersionPropItem);
			}

			if (this.defaultRulesetPropItem.value) {
				infoArray.push(this.defaultRulesetPropItem);
			}

			infoArray.push(...this.serverProps);
			const message = localize('msgBoxAsmtInfo', "SQL Assessment Information") + EOL + EOL +
				infoArray.map(v => `${v.displayName}: ${v.value}`).join(EOL);

			const copy: vscode.MessageItem = { title: localize('msgBoxCopyBtn', "Copy") };
			const ok: vscode.MessageItem = { isCloseAffordance: true, title: localize('ok', "OK") };

			const response = await vscode.window.showInformationMessage(message, { modal: true }, copy, ok);
			if (response === copy) {
				await vscode.env.clipboard.writeText(message);
				vscode.window.showInformationMessage(localize('msgBoxCopied', 'SQL Assessment Information copied'));
			}
		}));

		btnGetAssessmentItemsLoading.loading = false;
		btnInvokeAssessmentLoading.loading = false;

		return view.modelBuilder.toolbarContainer()
			.withToolbarItems(
				[
					{ component: btnInvokeAssessmentLoading },
					{ component: btnGetAssessmentItemsLoading },
					{ component: this.btnExportAsScript },
					{ component: this.btnHTMLExport },
					{ component: btnViewSamples },
					{ component: btnAPIDetails }
				]
			).component();
	}

	private async displayResults(result: azdata.SqlAssessmentResult, assessmentType: AssessmentType): Promise<void> {
		this.apiVersionPropItem.value = result.apiVersion;
		this.defaultRulesetPropItem.value = result.items?.length > 0 ? result.items[0].rulesetVersion : '';

		await this.resultGrid.displayResult(result, assessmentType);
		this.btnExportAsScript.enabled = this.btnHTMLExport.enabled = assessmentType === AssessmentType.InvokeAssessment;
	}
}
