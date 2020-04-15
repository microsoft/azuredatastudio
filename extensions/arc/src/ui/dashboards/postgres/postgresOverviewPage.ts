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
		const overview = this.modelView.modelBuilder.divContainer().component();
		const essentials = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		const leftEssentials = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		const rightEssentials = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		const essentialColumns = this.modelView.modelBuilder.flexContainer().withItems([leftEssentials, rightEssentials], { flex: '1', CSSStyles: { 'padding': '0px 15px', 'overflow': 'hidden' } }).component();
		essentials.addItem(essentialColumns);
		overview.addItem(essentials);

		// Collapse essentials button
		const collapse = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({ iconPath: IconPathHelper.collapseUp, width: '10px', height: '10px' }).component();
		essentials.addItem(collapse, { CSSStyles: { 'margin-left': 'auto', 'margin-right': 'auto' } });
		collapse.onDidClick(async () => {
			if (essentialColumns.display === undefined) {
				essentialColumns.display = 'none';
				collapse.iconPath = IconPathHelper.collapseDown;
			} else {
				essentialColumns.display = undefined;
				collapse.iconPath = IconPathHelper.collapseUp;
			}
		});

		const headerCSS = { ...cssStyles.text, 'font-weight': '400', 'margin-block-start': '8px', 'margin-block-end': '0px' };
		const textCSS = { ...cssStyles.text, 'font-weight': '500', 'margin-block-start': '0px', 'margin-block-end': '0px' };

		// Left essentials
		const registration = this.controllerModel.registration('postgres', this.databaseModel.namespace(), this.databaseModel.name());
		leftEssentials.addItems([
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Name', CSSStyles: headerCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this.databaseModel.name(), CSSStyles: textCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Resource group', CSSStyles: headerCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: registration?.resourceGroupName ?? 'None', CSSStyles: textCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Status', CSSStyles: headerCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this.databaseModel.service().status.state, CSSStyles: textCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Data controller', CSSStyles: headerCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this.controllerModel.controllerNamespace(), CSSStyles: textCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Subscription', CSSStyles: headerCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: registration?.subscriptionId ?? 'None', CSSStyles: textCSS }).component()]);

		// Right essentials
		// Connection string
		const pgConnString = `postgresql://postgres:${this.databaseModel.password()}@${this.databaseModel.endpoint()}`;
		const endpointLink = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			url: pgConnString, label: pgConnString, CSSStyles: {
				...cssStyles.hyperlink, 'display': 'inline-block', 'width': '100%', 'overflow': 'hidden', 'text-overflow': 'ellipsis'
			}
		}).component();
		const endpointDiv = this.modelView.modelBuilder.divContainer().component();
		endpointDiv.addItem(endpointLink, { CSSStyles: { 'display': 'inline-block', 'max-width': 'calc(100% - 20px)', 'padding-right': '5px' } });

		// Button to copy the connection string
		const endpointCopy = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({ iconPath: IconPathHelper.copy, width: '15px', height: '15px' }).component();
		endpointDiv.addItem(endpointCopy, { CSSStyles: { 'display': 'inline-block' } });
		endpointCopy.onDidClick(async () => {
			vscode.env.clipboard.writeText(pgConnString);
			vscode.window.showInformationMessage('Coordinator endpoint copied to clipboard');
		});

		rightEssentials.addItems([
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Server group type', CSSStyles: headerCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Azure Database for PostgreSQL - Azure Arc', CSSStyles: textCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Coordinator endpoint', CSSStyles: headerCSS }).component(),
			endpointDiv,
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Admin username', CSSStyles: headerCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'postgres', CSSStyles: textCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Node configuration', CSSStyles: headerCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this.databaseModel.configuration(), CSSStyles: textCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'PostgreSQL version', CSSStyles: headerCSS }).component(),
			this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this.databaseModel.service().spec.engine.version.toString(), CSSStyles: textCSS }).component()]);

		// Service endpoints
		const titleCSS = { ...cssStyles.text, 'font-weight': 'bold', 'font-size': '14px', 'margin-left': '10px', 'margin-block-start': '0', 'margin-block-end': '0' };
		overview.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Service endpoints', CSSStyles: titleCSS }).component());

		const kibanaQuery = `kubernetes_namespace:"${this.databaseModel.namespace()}" and cluster_name:"${this.databaseModel.name()}"`;
		const kibanaUrl = `${this.controllerModel.endpoint('logsui').endpoint}/app/kibana#/discover?_a=(query:(language:kuery,query:'${kibanaQuery}'))`;
		const grafanaUrl = `${this.controllerModel.endpoint('metricsui').endpoint}/d/postgres-metrics?var-Namespace=${this.databaseModel.namespace()}&var-Name=${this.databaseModel.name()}`;

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
		overview.addItem(endpointsTable, { CSSStyles: { 'margin-left': '10px', 'margin-right': '10px' } });

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

		overview.addItem(nodesTable, { CSSStyles: { 'margin-left': '10px', 'margin-right': '10px', 'margin-bottom': '20px' } });
		return overview;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// New database
		const newDatabaseButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'New Database',
			iconPath: IconPathHelper.add
		}).component();

		newDatabaseButton.onDidClick(async () => {
			const name: string = await vscode.window.showInputBox({ prompt: 'Database name' });
			let db: DuskyObjectModelsDatabase = { name: name }; // TODO support other options (sharded, owner)
			this.databaseModel.createDatabase(db);
			vscode.window.showInformationMessage(`Database '${db.name}' created`);
		});

		// Reset password
		const resetPasswordButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Reset Password',
			iconPath: IconPathHelper.edit
		}).component();

		resetPasswordButton.onDidClick(async () => {
			const password: string = await vscode.window.showInputBox({ prompt: 'New password', password: true });
			this.databaseModel.update(s => {
				if (s.arc === undefined) { s.arc = new DuskyObjectModelsDatabaseServiceArcPayload(); }
				s.arc.servicePassword = password;
			});

			vscode.window.showInformationMessage(`Password reset for service '${this.databaseModel.namespace()}.${this.databaseModel.name()}'`);
		});

		// Delete service
		const deleteButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Delete',
			iconPath: IconPathHelper.delete
		}).component();

		deleteButton.onDidClick(async () => {
			const response: string = await vscode.window.showQuickPick(['Yes', 'No'], {
				placeHolder: `Delete service '${this.databaseModel.namespace()}.${this.databaseModel.name()}'?`
			});
			if (response === 'Yes') {
				this.databaseModel.delete();
				vscode.window.showInformationMessage(`Service '${this.databaseModel.namespace()}.${this.databaseModel.name()}' deleted`);
			}
		});

		// TODO implement click
		const openInAzurePortalButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Open in Azure portal',
			iconPath: IconPathHelper.openInTab
		}).component();

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
