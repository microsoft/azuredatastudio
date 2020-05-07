/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();
const tabName = 'sql-assessment-tab';

export enum AssessmentType {
	AvailableRules = 1,
	InvokeAssessment = 2
}

/**
 * The main controller class that initializes the extension
 */
export default class MainController {
	private sqlAssessment!: mssql.ISqlAssessmentService;
	private connectionUri: string = '';
	private apiVersionPropItem: azdata.PropertiesContainerItem;
	private defaultRulesetPropItem: azdata.PropertiesContainerItem;
	private toDispose: vscode.Disposable[] = [];
	private lastInvokedResults!: mssql.SqlAssessmentResultItem[];
	private tblResults!: azdata.TableComponent;
	private btnExportAsScript!: azdata.ButtonComponent;

	public constructor() {
		this.apiVersionPropItem = { displayName: localize('propApiVersion', "API Version"), value: '' };
		this.defaultRulesetPropItem = { displayName: localize('propDefaultRuleset', "Default Ruleset"), value: '' };
	}
	/**
	 */
	public deactivate(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	public async activate(): Promise<boolean> {
		this.sqlAssessment = ((await vscode.extensions.getExtension(mssql.extension.name)?.activate() as mssql.IExtension)).sqlAssessment;
		this.registerModelView();
		return true;
	}

	private registerModelView(): void {
		azdata.ui.registerModelViewProvider(tabName, async (view) => {
			this.connectionUri = await azdata.connection.getUriForConnection(view.connection.connectionId);

			const rootContainer = view.modelBuilder.flexContainer().withLayout(
				{
					flexFlow: 'column',
					width: '100%',
					height: '100%'
				}).component();

			rootContainer.addItem(await this.createPropertiesSection(view), { flex: '0 0 auto' });
			rootContainer.addItem(await this.createToolbar(view), {
				flex: '0 0 auto', CSSStyles: {
					'border-top': '3px solid rgb(221, 221, 221)',
					'margin-top': '20px'
				}
			});
			this.tblResults = await this.createTable(view);
			rootContainer.addItem(this.tblResults, { flex: '1 1 auto' });
			await view.initializeModel(rootContainer);
		});
	}

	private async createPropertiesSection(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const serverInfo = await azdata.connection.getServerInfo(view.connection.connectionId);

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
			view.modelBuilder.text().withProperties({ value: 'API Information' }).component(), {
			CSSStyles: { 'font-size': 'larger' }
		});
		apiInformationContainer.addItem(
			view.modelBuilder.propertiesContainer()
				.withProperties<azdata.PropertiesContainerComponentProperties>({
					propertyItems: [
						this.apiVersionPropItem,
						this.defaultRulesetPropItem]
				}).component(), {
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
			view.modelBuilder.text().withProperties({ value: 'SQL Server Instance Details' }).component(), {
			CSSStyles: { 'font-size': 'larger' }
		});
		sqlServerContainer.addItem(
			view.modelBuilder.propertiesContainer()
				.withProperties<azdata.PropertiesContainerComponentProperties>({
					propertyItems: [
						{ displayName: 'Version', value: serverInfo.serverVersion },
						{ displayName: 'Instance Name', value: (await azdata.connection.getCurrentConnection()).serverName },
						{ displayName: 'Edititon', value: serverInfo.serverEdition },
						{ displayName: 'OS Version', value: serverInfo.osVersion },
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
		const btnInvokeAssessment = view.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: localize('btnInvokeAssessment', "Invoke Assessment"),
				iconPath: ' ',
			}).component();
		const btnInvokeAssessmentLoading = view.modelBuilder.loadingComponent()
			.withItem(btnInvokeAssessment)
			.withProperties<azdata.LoadingComponentProperties>({
				loadingText: localize('btnInvokeAssessment', "Invoke Assessment"),
				showText: true,
				loading: false
			}).component();
		this.toDispose.push(btnInvokeAssessment.onDidClick(async () => {
			btnInvokeAssessmentLoading.loading = true;
			let assessmentResult = await this.sqlAssessment.assessmentInvoke(this.connectionUri, mssql.SqlAssessmentTargetType.Server);
			btnInvokeAssessmentLoading.loading = false;
			this.displayResults(assessmentResult, AssessmentType.InvokeAssessment);
		}));

		const btnGetAssessmentItems = view.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: localize('btnGetAssessmentItems', "View applicable rules"),
				iconPath: ' ',
			}).component();
		const btnGetAssessmentItemsLoading = view.modelBuilder.loadingComponent()
			.withItem(btnGetAssessmentItems)
			.withProperties<azdata.LoadingComponentProperties>({
				loadingText: localize('btnGetAssessmentItems', "View applicable rules"),
				showText: true,
				loading: false
			}).component();
		this.toDispose.push(btnGetAssessmentItems.onDidClick(async () => {
			btnGetAssessmentItemsLoading.loading = true;
			let assessmentResult = await this.sqlAssessment.getAssessmentItems(this.connectionUri, mssql.SqlAssessmentTargetType.Server);
			btnGetAssessmentItemsLoading.loading = false;
			this.displayResults(assessmentResult, AssessmentType.AvailableRules);
		}));

		this.btnExportAsScript = view.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: localize('btnExportAsScript', "Export as script"),
				iconPath: ' ',
				enabled: false
			}).component();
		this.toDispose.push(this.btnExportAsScript.onDidClick(async () => {
			this.sqlAssessment.generateAssessmentScript(this.lastInvokedResults, '', '', azdata.TaskExecutionMode.script);
		}));

		let btnViewSamples = view.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: localize('btnViewSamples', "View all rules and learn more on GitHub"),
				iconPath: ' ',
			}).component();

		this.toDispose.push(btnViewSamples.onDidClick(() => {
			vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/sql-assessment-api'));
		}));

		return view.modelBuilder.toolbarContainer()
			.withToolbarItems(
				[
					{ component: btnInvokeAssessmentLoading },
					{ component: btnGetAssessmentItemsLoading },
					{ component: this.btnExportAsScript },
					{ component: btnViewSamples }
				]
			).component();
	}

	private async createTable(view: azdata.ModelView): Promise<azdata.TableComponent> {
		return view.modelBuilder.table()
			.withProperties<azdata.TableComponentProperties>({
				data: [],
				columns: [{
					value: 'Target',
					headerCssClass: 'no-borders align-with-header',
					width: 125
				},
				{
					value: 'Severity',
					headerCssClass: 'no-borders align-with-header',
					width: 100
				},
				{
					value: 'Message',
					headerCssClass: 'no-borders align-with-header',
					width: 900
				},
				{
					value: 'Tags',
					headerCssClass: 'no-borders align-with-header',
					width: 200,
				},
				{
					value: 'Check ID',
					headerCssClass: 'no-borders ',
					width: 80
				}],
				height: '100%',
				width: '100%',
			}).component();
	}

	private displayResults(result: mssql.SqlAssessmentResult, assessmentType: AssessmentType): void {
		this.apiVersionPropItem.value = result.apiVersion;
		this.defaultRulesetPropItem.value = result.items[0].rulesetVersion;
		let items = result.items.map(item => [
			item.targetName,
			item.level,
			assessmentType === AssessmentType.AvailableRules ? item.description : item.message,
			item.tags.join(','),
			item.checkId
		]);
		if (assessmentType === AssessmentType.InvokeAssessment) {
			this.btnExportAsScript.enabled = true;
			this.lastInvokedResults = result.items;
		} else {
			this.btnExportAsScript.enabled = false;
		}

		this.tblResults.data = items;
	}
}


