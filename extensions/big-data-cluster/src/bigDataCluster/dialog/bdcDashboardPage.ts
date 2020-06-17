/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IconPathHelper } from '../constants';
import { BdcDashboardModel, getTroubleshootNotebookUrl } from './bdcDashboardModel';
import * as loc from '../localizedConstants';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { InitializingComponent } from './intializingComponent';

export abstract class BdcDashboardPage extends InitializingComponent {

	private _toolbarContainer: azdata.ToolbarContainer;
	private _refreshButton: azdata.ButtonComponent;

	constructor(protected model: BdcDashboardModel, protected modelView: azdata.ModelView, protected serviceName?: string) {
		super();
	}

	public get toolbarContainer(): azdata.ToolbarContainer {
		// Lazily create the container only when needed
		if (!this._toolbarContainer) {
			this._toolbarContainer = this.createToolbarContainer();
		}
		return this._toolbarContainer;
	}

	protected createToolbarContainer(): azdata.ToolbarContainer {
		// Refresh button
		this._refreshButton = this.modelView.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: loc.refresh,
				iconPath: IconPathHelper.refresh
			}).component();

		this._refreshButton.onDidClick(async () => {
			await this.doRefresh();
		});

		const openTroubleshootNotebookButton = this.modelView.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: loc.troubleshoot,
				iconPath: IconPathHelper.notebook
			}).component();

		openTroubleshootNotebookButton.onDidClick(() => {
			vscode.commands.executeCommand('books.sqlserver2019', getTroubleshootNotebookUrl(this.serviceName));
		});

		return this.modelView.modelBuilder.toolbarContainer()
			.withToolbarItems(
				[
					{ component: this._refreshButton },
					{ component: openTroubleshootNotebookButton }
				]
			).component();
	}

	private async doRefresh(): Promise<void> {
		try {
			this._refreshButton.enabled = false;
			await this.model.refresh();
		} finally {
			this._refreshButton.enabled = true;
		}
	}
}

