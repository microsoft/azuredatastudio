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
		const overview = this.modelView.modelBuilder.divContainer().component();
		root.addItem(overview, { CSSStyles: { 'margin': '10px' } });

		const registration = this.controllerModel.registration('postgres', this.databaseModel.namespace(), this.databaseModel.name());
		const essentials = this.modelView.modelBuilder.propertiesContainer().withProperties<azdata.PropertiesContainerComponentProperties>({
			propertyItems: [
				{ displayName: 'Name', value: this.databaseModel.name() },
				{ displayName: 'Server group type', value: 'Azure Database for PostgreSQL - Azure Arc' },
				{ displayName: 'Resource group', value: registration?.resourceGroupName ?? 'None' },
				{ displayName: 'Coordinator endpoint', value: `postgresql://postgres:${this.databaseModel.password()}@${this.databaseModel.endpoint()}` },
				{ displayName: 'Status', value: this.databaseModel.service().status!.state },
				{ displayName: 'Admin username', value: 'postgres' },
				{ displayName: 'Data controller', value: this.controllerModel.controllerNamespace() },
				{ displayName: 'Node configuration', value: this.databaseModel.configuration() },
				{ displayName: 'Subscription', value: registration?.subscriptionId ?? 'None' },
				{ displayName: 'PostgreSQL version', value: this.databaseModel.service().spec.engine.version!.toString() }
			]
		}).component();
		overview.addItem(essentials, { CSSStyles: cssStyles.text });

		// Service endpoints
		const titleCSS = { ...cssStyles.text, 'font-weight': 'bold', 'font-size': '14px', 'margin-block-start': '2em', 'margin-block-end': '0' };
		overview.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Service endpoints', CSSStyles: titleCSS }).component());

		const kibanaQuery = `kubernetes_namespace:"${this.databaseModel.namespace()}" and cluster_name:"${this.databaseModel.name()}"`;
		const kibanaUrl = `${this.controllerModel.endpoint('logsui')?.endpoint}/app/kibana#/discover?_a=(query:(language:kuery,query:'${kibanaQuery}'))`;
		const grafanaUrl = `${this.controllerModel.endpoint('metricsui')?.endpoint}/d/postgres-metrics?var-Namespace=${this.databaseModel.namespace()}&var-Name=${this.databaseModel.name()}`;

		const kibanaLink = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({ label: kibanaUrl, url: kibanaUrl, CSSStyles: cssStyles.hyperlink }).component();
		const grafanaLink = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({ label: grafanaUrl, url: grafanaUrl, CSSStyles: cssStyles.hyperlink }).component();

		const endpointsTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			width: '100%',
			columns: [
				{
					displayName: 'Name',
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: 'Endpoint',
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
					displayName: 'Description',
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: [
				['Kibana Dashboard', kibanaLink, 'Dashboard for viewing logs'],
				['Grafana Dashboard', grafanaLink, 'Dashboard for viewing metrics']]
		}).component();
		overview.addItem(endpointsTable);

		// Server group nodes
		overview.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Server group nodes', CSSStyles: titleCSS }).component());
		const nodesTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			width: '100%',
			columns: [
				{
					displayName: 'Name',
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: 'Type',
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '25%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: 'Fully qualified domain',
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
				i === 0 ? 'Coordinator' : 'Worker',
				i === 0 ? this.databaseModel.endpoint() : `${this.databaseModel.name()}-${i}.${this.databaseModel.name()}-svc.${this.databaseModel.namespace()}.svc.cluster.local`]);
		}

		overview.addItem(nodesTable, { CSSStyles: { 'margin-bottom': '20px' } });
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// New database
		const newDatabaseButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'New Database',
			iconPath: IconPathHelper.add
		}).component();

		newDatabaseButton.onDidClick(async () => {
			const name = await vscode.window.showInputBox({ prompt: 'Database name' });
			if (name === undefined) { return; }
			let db: DuskyObjectModelsDatabase = { name: name }; // TODO support other options (sharded, owner)
			await this.databaseModel.createDatabase(db)
				.then(db => vscode.window.showInformationMessage(`Database '${db.name}' created`))
				.catch(error => vscode.window.showErrorMessage(
					`Failed to create database '${db.name}'. ${error instanceof Error ? error.message : error}`));
		});

		// Reset password
		const resetPasswordButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Reset Password',
			iconPath: IconPathHelper.edit
		}).component();

		resetPasswordButton.onDidClick(async () => {
			const password = await vscode.window.showInputBox({ prompt: 'New password', password: true });
			if (password === undefined) { return; }
			await this.databaseModel.update(s => {
				s.arc = s.arc ?? new DuskyObjectModelsDatabaseServiceArcPayload();
				s.arc.servicePassword = password;
			})
				.then(_ => vscode.window.showInformationMessage(`Password reset for service '${this.databaseModel.fullName()}'`))
				.catch(error => vscode.window.showErrorMessage(
					`Failed to reset password for service '${this.databaseModel.fullName()}'. ${error instanceof Error ? error.message : error}`));
		});

		// Delete service
		const deleteButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Delete',
			iconPath: IconPathHelper.delete
		}).component();

		deleteButton.onDidClick(async () => {
			const response = await vscode.window.showQuickPick(['Yes', 'No'], {
				placeHolder: `Delete service '${this.databaseModel.fullName()}'?`
			});
			if (response === 'Yes') {
				await this.databaseModel.delete()
					.then(_ => vscode.window.showInformationMessage(`Service '${this.databaseModel.fullName()}' deleted`))
					.catch(error => vscode.window.showErrorMessage(
						`Failed to delete service '${this.databaseModel.fullName()}'. ${error instanceof Error ? error.message : error}`));
			}
		});

		// Open in Azure portal
		const openInAzurePortalButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Open in Azure portal',
			iconPath: IconPathHelper.openInTab
		}).component();

		openInAzurePortalButton.onDidClick(async () => {
			const r = this.controllerModel.registration('postgres', this.databaseModel.namespace(), this.databaseModel.name());
			if (r === undefined) {
				vscode.window.showErrorMessage(`Could not find Azure resource for '${this.databaseModel.fullName()}'`);
			} else {
				vscode.env.openExternal(vscode.Uri.parse(
					`https://portal.azure.com/#resource/subscriptions/${r.subscriptionId}/resourceGroups/${r.resourceGroupName}/providers/Microsoft.AzureData/postgresInstances/${r.instanceName}`));
			}
		});

		// TODO implement click
		const feedbackButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Feedback',
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
