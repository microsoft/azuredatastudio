/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles, ResourceType } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';

export class PostgresSupportRequestPage extends DashboardPage {
	constructor(protected modelView: azdata.ModelView, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(modelView);
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

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.newSupportRequest,
			CSSStyles: { ...cssStyles.title, 'margin-bottom': '20px' }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.clickTheNewSupportRequestButton,
			CSSStyles: { ...cssStyles.text, 'margin-bottom': '20px' }
		}).component());

		const supportRequestButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			iconPath: IconPathHelper.support,
			label: loc.newSupportRequest,
			width: '205px'
		}).component();

		this.disposables.push(
			supportRequestButton.onDidClick(() => {
				const r = this._controllerModel.getRegistration(ResourceType.postgresInstances, this._postgresModel.namespace, this._postgresModel.name);
				if (!r) {
					vscode.window.showErrorMessage(loc.couldNotFindAzureResource(this._postgresModel.fullName));
				} else {
					vscode.env.openExternal(vscode.Uri.parse(
						`https://portal.azure.com/#resource/subscriptions/${r.subscriptionId}/resourceGroups/${r.resourceGroupName}/providers/Microsoft.AzureData/${ResourceType.postgresInstances}/${r.instanceName}/supportrequest`));
				}
			}));

		content.addItem(supportRequestButton);
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return this.modelView.modelBuilder.toolbarContainer().component();
	}
}
