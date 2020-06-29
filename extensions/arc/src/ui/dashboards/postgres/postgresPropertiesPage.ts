/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles, ResourceType } from '../../../constants';
import { KeyValueContainer, InputKeyValue, LinkKeyValue, TextKeyValue } from '../../components/keyValueContainer';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';

export class PostgresPropertiesPage extends DashboardPage {
	private keyValueContainer?: KeyValueContainer;

	constructor(protected modelView: azdata.ModelView, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(modelView);

		this.disposables.push(this._postgresModel.onServiceUpdated(
			() => this.eventuallyRunOnInitialized(() => this.refresh())));

		this.disposables.push(this._controllerModel.onRegistrationsUpdated(
			() => this.eventuallyRunOnInitialized(() => this.refresh())));
	}

	protected get title(): string {
		return loc.properties;
	}

	protected get id(): string {
		return 'postgres-properties';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.properties;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.properties,
			CSSStyles: { ...cssStyles.title, 'margin-bottom': '25px' }
		}).component());

		this.keyValueContainer = new KeyValueContainer(this.modelView.modelBuilder, []);
		content.addItem(this.keyValueContainer.container);
		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		const refreshButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.refresh,
			iconPath: IconPathHelper.refresh
		}).component();

		this.disposables.push(
			refreshButton.onDidClick(async () => {
				refreshButton.enabled = false;
				try {
					await Promise.all([
						this._postgresModel.refresh(),
						this._controllerModel.refresh()
					]);
				} catch (error) {
					vscode.window.showErrorMessage(loc.refreshFailed(error));
				}
				finally {
					refreshButton.enabled = true;
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: refreshButton }
		]).component();
	}

	private refresh() {
		const endpoint: { ip?: string, port?: number } = this._postgresModel.endpoint;
		const connectionString = `postgresql://postgres@${endpoint.ip}:${endpoint.port}`;
		const registration = this._controllerModel.getRegistration(ResourceType.postgresInstances, this._postgresModel.namespace, this._postgresModel.name);

		this.keyValueContainer?.refresh([
			new InputKeyValue(loc.coordinatorEndpoint, connectionString),
			new InputKeyValue(loc.postgresAdminUsername, 'postgres'),
			new TextKeyValue(loc.status, this._postgresModel.service?.status?.state ?? 'Unknown'),
			new LinkKeyValue(loc.dataController, this._controllerModel.namespace ?? '', _ => vscode.window.showInformationMessage('TODO: Go to data controller')),
			new TextKeyValue(loc.nodeConfiguration, this._postgresModel.configuration),
			new TextKeyValue(loc.postgresVersion, this._postgresModel.service?.spec?.engine?.version?.toString() ?? ''),
			new TextKeyValue(loc.resourceGroup, registration?.resourceGroupName ?? ''),
			new TextKeyValue(loc.subscriptionId, registration?.subscriptionId ?? '')
		]);
	}
}
