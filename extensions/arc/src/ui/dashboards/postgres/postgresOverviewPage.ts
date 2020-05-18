/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DuskyObjectModelsDatabase, DuskyObjectModelsDatabaseServiceArcPayload } from '../../../controller/generated/dusky/api';
import { PostgresDashboardPage } from './postgresDashboardPage';

export class PostgresOverviewPage extends PostgresDashboardPage {
	protected get title(): string {
		return loc.overview;
	}

	protected get id(): string {
		return 'postgres-overview';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.postgres;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '10px 20px 0px 20px' } });

		const registration = this.controllerModel.registration('postgresInstances', this.databaseModel.namespace(), this.databaseModel.name());
		const endpoint: { ip?: string, port?: number } = this.databaseModel.endpoint();
		const essentials = this.modelView.modelBuilder.propertiesContainer().withProperties<azdata.PropertiesContainerComponentProperties>({
			propertyItems: [
				{ displayName: loc.name, value: this.databaseModel.name() },
				{ displayName: loc.serverGroupType, value: loc.postgresArcProductName },
				{ displayName: loc.resourceGroup, value: registration?.resourceGroupName ?? 'None' },
				{ displayName: loc.coordinatorEndpoint, value: `postgresql://postgres:${this.databaseModel.password()}@${endpoint.ip}:${endpoint.port}` },
				{ displayName: loc.status, value: this.databaseModel.service().status?.state ?? '' },
				{ displayName: loc.postgresAdminUsername, value: 'postgres' },
				{ displayName: loc.dataController, value: this.controllerModel.namespace() },
				{ displayName: loc.nodeConfiguration, value: this.databaseModel.configuration() },
				{ displayName: loc.subscriptionId, value: registration?.subscriptionId ?? 'None' },
				{ displayName: loc.postgresVersion, value: this.databaseModel.service().spec.engine.version?.toString() ?? '' }
			]
		}).component();
		content.addItem(essentials, { CSSStyles: cssStyles.text });

		// Service endpoints
		const titleCSS = { ...cssStyles.title, 'margin-block-start': '2em', 'margin-block-end': '0' };
		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.serviceEndpoints, CSSStyles: titleCSS }).component());

		const kibanaQuery = `kubernetes_namespace:"${this.databaseModel.namespace()}" and cluster_name:"${this.databaseModel.name()}"`;
		const kibanaUrl = `${this.controllerModel.endpoint('logsui')?.endpoint}/app/kibana#/discover?_a=(query:(language:kuery,query:'${kibanaQuery}'))`;
		const grafanaUrl = `${this.controllerModel.endpoint('metricsui')?.endpoint}/d/postgres-metrics?var-Namespace=${this.databaseModel.namespace()}&var-Name=${this.databaseModel.name()}`;

		const kibanaLink = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({ label: kibanaUrl, url: kibanaUrl, }).component();
		const grafanaLink = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({ label: grafanaUrl, url: grafanaUrl }).component();

		const endpointsTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			width: '100%',
			columns: [
				{
					displayName: loc.name,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.endpoint,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: '50%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: {
						...cssStyles.tableRow,
						'overflow': 'hidden',
						'text-overflow': 'ellipsis',
						'white-space': 'nowrap',
						'max-width': '0'
					}
				},
				{
					displayName: loc.description,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: [
				[loc.kibanaDashboard, kibanaLink, loc.kibanaDashboardDescription],
				[loc.grafanaDashboard, grafanaLink, loc.grafanaDashboardDescription]]
		}).component();
		content.addItem(endpointsTable);

		// Server group nodes
		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.serverGroupNodes, CSSStyles: titleCSS }).component());
		const nodesTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			width: '100%',
			columns: [
				{
					displayName: loc.name,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.type,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '25%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.fullyQualifiedDomain,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '45%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: []
		}).component();

		const nodes = this.databaseModel.numNodes();
		for (let i = 0; i < nodes; i++) {
			nodesTable.data.push([
				`${this.databaseModel.name()}-${i}`,
				i === 0 ? loc.coordinatorEndpoint : loc.worker,
				i === 0 ? `${endpoint.ip}:${endpoint.port}` : `${this.databaseModel.name()}-${i}.${this.databaseModel.name()}-svc.${this.databaseModel.namespace()}.svc.cluster.local`]);
		}

		content.addItem(nodesTable, { CSSStyles: { 'margin-bottom': '20px' } });
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// New database
		const newDatabaseButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.newDatabase,
			iconPath: IconPathHelper.add
		}).component();

		newDatabaseButton.onDidClick(async () => {
			const name = await vscode.window.showInputBox({ prompt: loc.databaseName });
			if (name === undefined) { return; }
			const db: DuskyObjectModelsDatabase = { name: name }; // TODO support other options (sharded, owner)
			try {
				await this.databaseModel.createDatabase(db);
				vscode.window.showInformationMessage(loc.databaseCreated(db.name));
			} catch (error) {
				vscode.window.showErrorMessage(loc.databaseCreationFailed(db.name, error));
			}
		});

		// Reset password
		const resetPasswordButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.resetPassword,
			iconPath: IconPathHelper.edit
		}).component();

		resetPasswordButton.onDidClick(async () => {
			const password = await vscode.window.showInputBox({ prompt: loc.newPassword, password: true });
			if (password === undefined) { return; }
			try {
				await this.databaseModel.update(s => {
					s.arc = s.arc ?? new DuskyObjectModelsDatabaseServiceArcPayload();
					s.arc.servicePassword = password;
				});
				vscode.window.showInformationMessage(loc.passwordReset(this.databaseModel.fullName()));
			} catch (error) {
				vscode.window.showErrorMessage(loc.passwordResetFailed(this.databaseModel.fullName(), error));
			}
		});

		// Delete service
		const deleteButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.deleteText,
			iconPath: IconPathHelper.delete
		}).component();

		deleteButton.onDidClick(async () => {
			const response = await vscode.window.showQuickPick([loc.yes, loc.no], {
				placeHolder: loc.deleteServicePrompt(this.databaseModel.fullName())
			});
			if (response !== loc.yes) { return; }
			try {
				await this.databaseModel.delete();
				vscode.window.showInformationMessage(loc.serviceDeleted(this.databaseModel.fullName()));
			} catch (error) {
				vscode.window.showErrorMessage(loc.serviceDeletionFailed(this.databaseModel.fullName(), error));
			}
		});

		// Open in Azure portal
		const openInAzurePortalButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.openInAzurePortal,
			iconPath: IconPathHelper.openInTab
		}).component();

		openInAzurePortalButton.onDidClick(async () => {
			const r = this.controllerModel.registration('postgresInstances', this.databaseModel.namespace(), this.databaseModel.name());
			if (r === undefined) {
				vscode.window.showErrorMessage(loc.couldNotFindAzureResource(this.databaseModel.fullName()));
			} else {
				vscode.env.openExternal(vscode.Uri.parse(
					`https://portal.azure.com/#resource/subscriptions/${r.subscriptionId}/resourceGroups/${r.resourceGroupName}/providers/Microsoft.AzureData/postgresInstances/${r.instanceName}`));
			}
		});

		// TODO implement click
		const feedbackButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.feedback,
			iconPath: IconPathHelper.heart
		}).component();

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: newDatabaseButton },
			{ component: resetPasswordButton },
			{ component: deleteButton, toolbarSeparatorAfter: true },
			{ component: openInAzurePortalButton },
			{ component: feedbackButton }
		]).component();
	}
}
