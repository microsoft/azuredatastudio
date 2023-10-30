/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import { SqlAssessmentMainTab } from './tabs/assessmentMainTab';
import { SqlAssessmentHistoryTab } from './tabs/historyTab';
import { AssessmentEngine } from './engine';
import { TelemetryReporter, SqlAssessmentTelemetryView } from './telemetry';

const tabName = 'data-management-asmt';

/**
 * The main controller class that initializes the extension
 */
export default class MainController {
	private extensionContext: vscode.ExtensionContext;
	private sqlAssessment!: mssql.ISqlAssessmentService;
	private toDispose: vscode.Disposable[] = [];
	private engine!: AssessmentEngine;

	public constructor(context: vscode.ExtensionContext) {
		this.extensionContext = context;
	}

	public deactivate(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	public async activate(): Promise<boolean> {
		this.sqlAssessment = ((await vscode.extensions.getExtension(mssql.extension.name)?.activate() as mssql.IExtension)).sqlAssessment;
		this.engine = new AssessmentEngine(this.sqlAssessment);
		this.registerModelViewProvider();
		TelemetryReporter.sendViewEvent(SqlAssessmentTelemetryView);
		return true;
	}

	private registerModelViewProvider(): void {
		azdata.ui.registerModelViewProvider(tabName, async (view) => {
			await this.engine.initialize(view.connection.connectionId);
			const mainTab = await new SqlAssessmentMainTab(this.extensionContext, this.engine).Create(view);
			this.toDispose.push(mainTab);
			const historyTab = await new SqlAssessmentHistoryTab(this.extensionContext, this.engine).Create(view) as SqlAssessmentHistoryTab;
			this.toDispose.push(historyTab);
			const tabbedPanel = view.modelBuilder.tabbedPanel()
				.withTabs([mainTab, historyTab])
				.withLayout({ showIcon: true, alwaysShowTabs: true })
				.component();
			this.toDispose.push(tabbedPanel.onTabChanged(async (id) => {
				if (id === historyTab.id) {
					await historyTab.refresh();
				}
			}));
			await view.initializeModel(tabbedPanel);
		});
	}
}

