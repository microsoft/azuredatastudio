/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';
import { ResourceType } from 'arc';
import { PostgresModel } from '../../../models/postgresModel';

export class PostgresSupportRequestPage extends DashboardPage {
	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(modelView, dashboard);
	}

	protected get title(): string {
		return loc.newSupportRequest;
	}

	protected get id(): string {
		return 'postgres-support-request';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.support;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.newSupportRequest,
			CSSStyles: { ...cssStyles.title, 'margin-bottom': '20px' }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.clickTheNewSupportRequestButton,
			CSSStyles: { ...cssStyles.text, 'margin-bottom': '20px' }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.supportRequestNote,
			CSSStyles: { ...cssStyles.text, 'margin-bottom': '20px' }
		}).component());

		const supportRequestButton = this.modelView.modelBuilder.button().withProps({
			iconPath: IconPathHelper.support,
			label: loc.newSupportRequest,
			width: '205px'
		}).component();

		this.disposables.push(
			supportRequestButton.onDidClick(() => {
				const azure = this._controllerModel.controllerConfig?.spec.settings.azure;
				if (azure) {
					vscode.env.openExternal(vscode.Uri.parse(
						`https://portal.azure.com/#resource/subscriptions/${azure.subscription}/resourceGroups/${azure.resourceGroup}/providers/Microsoft.AzureArcData/${ResourceType.postgresInstances}/${this._postgresModel.info.name}/supportrequest`));
				} else {
					vscode.window.showErrorMessage(loc.couldNotFindControllerRegistration);
				}
			}));

		content.addItem(supportRequestButton);
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return this.modelView.modelBuilder.toolbarContainer().component();
	}
}
