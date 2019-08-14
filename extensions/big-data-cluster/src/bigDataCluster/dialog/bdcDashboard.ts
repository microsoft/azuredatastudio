/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BdcDashboardModel } from './bdcDashboardModel';

const localize = nls.loadMessageBundle();

export class BdcDashboard {

	private dashboard: azdata.workspace.ModelViewEditor;

	private copyIconPath: { light: string, dark: string };
	private refreshIconPath: { light: string, dark: string };

	constructor(private title: string, private model: BdcDashboardModel, context: vscode.ExtensionContext) {
		this.copyIconPath = {
			light: context.asAbsolutePath('resources/light/copy.svg'),
			dark: context.asAbsolutePath('resources/dark/copy_inverse.svg')
		};

		this.refreshIconPath = {
			light: context.asAbsolutePath('resources/light/refresh.svg'),
			dark: context.asAbsolutePath('resources/dark/refresh_inverse.svg')
		};
	}

	public showDashboard(): void {
		this.createDashboard();
		this.dashboard.openEditor();
	}

	private createDashboard(): void {
		this.dashboard = azdata.workspace.createModelViewEditor(this.title, { retainContextWhenHidden: true, supportsSave: false });
		this.dashboard.registerContent(async (view: azdata.ModelView) => {

			const dashboardRootContainer = view.modelBuilder.flexContainer().withLayout(
				{
					flexFlow: 'column',
					width: '100%',
					height: '100%',
					alignItems: 'left'
				}).component();

			// ###########
			// # TOOLBAR #
			// ###########

			// Refresh button
			const refreshButton = view.modelBuilder.button()
				.withProperties({
					label: localize('bdc.dashboard.refreshButton', "Refresh"),
					iconPath: this.refreshIconPath,
					height: '50'
				}).component();

			refreshButton.onDidClick(() => this.model.refresh());

			const toolbarContainer = view.modelBuilder.toolbarContainer().withToolbarItems([{ component: refreshButton }]).component();

			dashboardRootContainer.addItem(toolbarContainer);

			// ################
			// # CONTENT AREA #
			// ################

			const contentContainer = view.modelBuilder.flexContainer().withLayout(
				{
					flexFlow: 'column',
					width: '100%',
					height: '100%',
					alignItems: 'left'
				}).component();

			dashboardRootContainer.addItem(contentContainer, { flex: '0 0 100%' });

			// ##############
			// # PROPERTIES #
			// ##############

			const propertiesLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.propertiesHeader', "Cluster Properties") }).component();
			contentContainer.addItem(propertiesLabel, { CSSStyles: { 'margin-top': '15px', 'font-size': '20px', 'font-weight': 'bold', 'padding-left': '10px' } });

			// Row 1
			const row1 = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', height: '30px', alignItems: 'center' }).component();
			// Cluster Name
			const clusterNameLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.clusterName', "Cluster Name :") }).component();
			const clusterNameValue = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this.model.clusterName }).component();
			row1.addItem(clusterNameLabel, { CSSStyles: { 'width': '25%', 'user-select': 'text' } });
			row1.addItem(clusterNameValue, { CSSStyles: { 'width': '25%', 'user-select': 'text' } });

			contentContainer.addItem(row1, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });

			// Row 2
			const row2 = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', height: '30px', alignItems: 'center' }).component();

			// Cluster State
			const clusterStateLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.clusterState', "Cluster State :") }).component();
			const clusterStateValue = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this.model.clusterStatus.state }).component();
			row2.addItem(clusterStateLabel, { CSSStyles: { 'width': '25%', 'user-select': 'text' } });
			row2.addItem(clusterStateValue, { CSSStyles: { 'width': '25%', 'user-select': 'text' } });

			// Health Status
			const healthStatusLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatus', "Health Status :") }).component();
			const healthStatusValue = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this.model.clusterStatus.healthStatus }).component();
			row2.addItem(healthStatusLabel, { CSSStyles: { 'width': '25%', 'user-select': 'text' } });
			row2.addItem(healthStatusValue, { CSSStyles: { 'width': '25%', 'user-select': 'text' } });

			contentContainer.addItem(row2, { CSSStyles: { 'padding-left': '10px', 'border-bottom': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });

			// ############
			// # OVERVIEW #
			// ############

			const overviewLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.overviewHeader', "Cluster Overview") }).component();
			contentContainer.addItem(overviewLabel, { CSSStyles: { 'margin-top': '15px', 'font-size': '20px', 'font-weight': 'bold', 'padding-left': '10px' } });

			const overviewContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%', alignItems: 'left' }).component();

			// Service Status header row
			const serviceStatusHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
			const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.serviceNameHeader', "Service Name") }).component();
			serviceStatusHeaderRow.addItem(nameCell, { CSSStyles: { 'width': '25%', 'font-weight': 'bold', 'user-select': 'text' } });
			const stateCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.stateHeader', "State") }).component();
			serviceStatusHeaderRow.addItem(stateCell, { CSSStyles: { 'width': '15%', 'font-weight': 'bold', 'user-select': 'text' } });
			const healthStatusCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatusHeader', "Health Status") }).component();
			serviceStatusHeaderRow.addItem(healthStatusCell, { CSSStyles: { 'width': '15%', 'font-weight': 'bold', 'user-select': 'text' } });
			overviewContainer.addItem(serviceStatusHeaderRow, { CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

			// Service Status rows
			this.model.serviceStatus.forEach(serviceStatus => {
				const serviceStatusRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center', height: '20px' }).component();
				const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: serviceStatus.serviceName }).component();
				serviceStatusRow.addItem(nameCell, { CSSStyles: { 'width': '25%', 'user-select': 'text' } });
				const stateCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: serviceStatus.status.state }).component();
				serviceStatusRow.addItem(stateCell, { CSSStyles: { 'width': '15%', 'user-select': 'text' } });
				const healthStatusCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: serviceStatus.status.healthStatus }).component();
				serviceStatusRow.addItem(healthStatusCell, { CSSStyles: { 'width': '15%', 'user-select': 'text' } });

				overviewContainer.addItem(serviceStatusRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });
			});

			contentContainer.addItem(overviewContainer);

			// #####################
			// # SERVICE ENDPOINTS #
			// #####################

			const endpointsLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.endpointsLabel', "Service Endpoints") }).component();
			contentContainer.addItem(endpointsLabel, { CSSStyles: { 'font-size': '20px', 'font-weight': 'bold', 'padding-left': '10px' } });

			const endpointsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%', alignItems: 'left' }).component();

			// Service endpoints header row
			const endpointsHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
			const endpointsServiceNameHeaderCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.serviceHeader', "Service") }).component();
			endpointsHeaderRow.addItem(endpointsServiceNameHeaderCell, { CSSStyles: { 'width': '25%', 'font-weight': 'bold', 'user-select': 'text' } });
			const endpointsEndpointHeaderCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.endpointHeader', "Endpoint") }).component();
			endpointsHeaderRow.addItem(endpointsEndpointHeaderCell, { CSSStyles: { 'width': '15%', 'font-weight': 'bold', 'user-select': 'text' } });
			endpointsContainer.addItem(endpointsHeaderRow, { CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

			// Service endpoints rows
			this.model.serviceEndpoints.forEach(endpointInfo => {
				const endPointRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center', height: '20px' }).component();
				const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: getFriendlyEndpointNames(endpointInfo.serviceName) }).component();
				endPointRow.addItem(nameCell, { CSSStyles: { 'width': '25%', 'user-select': 'text' } });
				if (endpointInfo.isHyperlink) {
					const linkCell = view.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({ label: endpointInfo.hyperlink, url: endpointInfo.hyperlink }).component();
					endPointRow.addItem(linkCell, { CSSStyles: { 'width': '35%', 'color': '#0078d4', 'text-decoration': 'underline', 'overflow': 'hidden' } });
				}
				else {
					const endpointCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: endpointInfo.ipAddress + ':' + endpointInfo.port }).component();
					endPointRow.addItem(endpointCell, { CSSStyles: { 'width': '35%', 'user-select': 'text', 'overflow': 'hidden' } });
				}
				const copyValueCell = view.modelBuilder.button().component();
				copyValueCell.iconPath = this.copyIconPath;
				copyValueCell.onDidClick(() => {
					vscode.env.clipboard.writeText(endpointInfo.hyperlink);
				});
				copyValueCell.title = localize("bdc.dashboard.copyTitle", "Copy");
				copyValueCell.iconHeight = '14px';
				copyValueCell.iconWidth = '14px';
				endPointRow.addItem(copyValueCell, { CSSStyles: { 'width': '5%', 'padding-left': '10px' } });

				endpointsContainer.addItem(endPointRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });
			});

			contentContainer.addItem(endpointsContainer);

			await view.initializeModel(dashboardRootContainer);
		});
	}
}

function getFriendlyEndpointNames(name: string): string {
	let friendlyName: string = name;
	switch (name) {
		case 'app-proxy':
			friendlyName = localize('bdc.dashboard.appproxy', "Application Proxy");
			break;
		case 'controller':
			friendlyName = localize('bdc.dashboard.controller', "Cluster Management Service");
			break;
		case 'gateway':
			friendlyName = localize('bdc.dashboard.gateway', "HDFS and Spark");
			break;
		case 'management-proxy':
			friendlyName = localize('bdc.dashboard.managementproxy', "Management Proxy");
			break;
		case 'mgmtproxy':
			friendlyName = localize('bdc.dashboard.mgmtproxy', "Management Proxy");
			break;
		default:
			break;
	}
	return friendlyName;
}
