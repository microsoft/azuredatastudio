/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { PostgresModel } from '../../../models/postgresModel';
import { ControllerModel } from '../../../models/controllerModel';

export class PostgresDiagnoseAndSolveProblemsPage extends DashboardPage {
	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _context: vscode.ExtensionContext, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(modelView, dashboard);
	}

	protected get title(): string {
		return loc.diagnoseAndSolveProblems;
	}

	protected get id(): string {
		return 'postgres-diagnose-and-solve-problems';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.wrench;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.diagnoseAndSolveProblems,
			CSSStyles: { ...cssStyles.title, 'margin-bottom': '20px' }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.clickTheTroubleshootButton('Postgres'),
			CSSStyles: { ...cssStyles.text, 'margin-bottom': '20px' }
		}).component());

		const troubleshootButton = this.modelView.modelBuilder.button().withProps({
			iconPath: IconPathHelper.wrench,
			label: loc.troubleshoot,
			width: '160px'
		}).component();

		this.disposables.push(
			troubleshootButton.onDidClick(() => {
				process.env['POSTGRES_SERVER_NAMESPACE'] = this._controllerModel.controllerConfig?.metadata.namespace ?? '';
				process.env['POSTGRES_SERVER_NAME'] = this._postgresModel.info.name;
				vscode.commands.executeCommand('bookTreeView.openBook', this._context.asAbsolutePath('notebooks/arcDataServices'), true, 'postgres/tsg100-troubleshoot-postgres');
			}));

		content.addItem(troubleshootButton);
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return this.modelView.modelBuilder.toolbarContainer().component();
	}
}
