/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as utils from '../utils';

const mgmtProxyName = 'mgmtproxy';
const grafanaEndpointName = 'metricsui';
const grafanaDescription = localize('grafana', "Metrics Dashboard");
const logsuiEndpointName = 'logsui';
const logsuiDescription = localize('kibana', "Log Search Dashboard");
const sparkHistoryEndpointName = 'spark-history';
const sparkHistoryDescription = localize('sparkHistory', "Spark Jobs Management and Monitoring Dashboard");
const yarnUiEndpointName = 'yarn-ui';
const yarnHistoryDescription = localize('yarnHistory', "Spark Diagnostics and Monitoring Dashboard");
const hyperlinkedEndpoints = [grafanaEndpointName, logsuiEndpointName, sparkHistoryEndpointName, yarnUiEndpointName];

export function registerServiceEndpoints(context: vscode.ExtensionContext): void {
	azdata.ui.registerModelViewProvider('bdc-endpoints', async (view) => {
		let endpointsArray: Array<utils.IEndpoint> = Object.assign([], utils.getClusterEndpoints(view.serverInfo));

		if (endpointsArray.length > 0) {
			const grafanaEp = endpointsArray.find(e => e.serviceName === grafanaEndpointName);
			if (grafanaEp && grafanaEp.endpoint && grafanaEp.endpoint.indexOf('/d/wZx3OUdmz') === -1) {
				// Update to have correct URL
				grafanaEp.endpoint += '/d/wZx3OUdmz';
			}
			const kibanaEp = endpointsArray.find(e => e.serviceName === logsuiEndpointName);
			if (kibanaEp && kibanaEp.endpoint && kibanaEp.endpoint.indexOf('/app/kibana#/discover') === -1) {
				// Update to have correct URL
				kibanaEp.endpoint += '/app/kibana#/discover';
			}

			if (!grafanaEp) {
				// We are on older CTP, need to manually add some endpoints.
				// TODO remove once CTP support goes away
				const managementProxyEp = endpointsArray.find(e => e.serviceName === mgmtProxyName);
				if (managementProxyEp) {
					endpointsArray.push(getCustomEndpoint(managementProxyEp, grafanaEndpointName, grafanaDescription, '/grafana/d/wZx3OUdmz'));
					endpointsArray.push(getCustomEndpoint(managementProxyEp, logsuiEndpointName, logsuiDescription, '/kibana/app/kibana#/discover'));
				}

				const gatewayEp = endpointsArray.find(e => e.serviceName === 'gateway');
				if (gatewayEp) {
					endpointsArray.push(getCustomEndpoint(gatewayEp, sparkHistoryEndpointName, sparkHistoryDescription, '/gateway/default/sparkhistory'));
					endpointsArray.push(getCustomEndpoint(gatewayEp, yarnUiEndpointName, yarnHistoryDescription, '/gateway/default/yarn'));
				}
			}

			endpointsArray = endpointsArray.map(e => {
				e.description = getEndpointDisplayText(e.serviceName, e.description);
				return e;
			});

			// Sort the endpoints. The sort method is that SQL Server Master is first - followed by all
			// others in alphabetical order by endpoint
			const sqlServerMasterEndpoints = endpointsArray.filter(e => e.serviceName === Endpoint.sqlServerMaster);
			endpointsArray = endpointsArray.filter(e => e.serviceName !== Endpoint.sqlServerMaster)
				.sort((e1, e2) => e1.endpoint.localeCompare(e2.endpoint));
			endpointsArray.unshift(...sqlServerMasterEndpoints);

			const container = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%' }).component();
			endpointsArray.forEach(endpointInfo => {
				const endPointRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
				const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: endpointInfo.description }).component();
				endPointRow.addItem(nameCell, { CSSStyles: { 'width': '35%', 'font-weight': '600', 'user-select': 'text' } });
				if (hyperlinkedEndpoints.findIndex(e => e === endpointInfo.serviceName) >= 0) {
					const linkCell = view.modelBuilder.hyperlink()
						.withProperties<azdata.HyperlinkComponentProperties>({
							label: endpointInfo.endpoint,
							title: endpointInfo.endpoint,
							url: endpointInfo.endpoint
						}).component();
					endPointRow.addItem(linkCell, { CSSStyles: { 'width': '62%', 'color': '#0078d4', 'text-decoration': 'underline', 'padding-top': '10px', 'overflow': 'hidden', 'text-overflow': 'ellipsis' } });
				}
				else {
					const endpointCell =
						view.modelBuilder.text()
							.withProperties<azdata.TextComponentProperties>(
								{
									value: endpointInfo.endpoint,
									title: endpointInfo.endpoint,
									CSSStyles: { 'overflow': 'hidden', 'text-overflow': 'ellipsis' }
								})
							.component();
					endPointRow.addItem(endpointCell, { CSSStyles: { 'width': '62%', 'user-select': 'text' } });
				}
				const copyValueCell = view.modelBuilder.button().component();
				copyValueCell.iconPath = { light: context.asAbsolutePath('resources/light/copy.png'), dark: context.asAbsolutePath('resources/dark/copy_inverse.png') };
				copyValueCell.onDidClick(() => {
					vscode.env.clipboard.writeText(endpointInfo.endpoint);
				});
				copyValueCell.title = localize("copyText", "Copy");
				copyValueCell.iconHeight = '14px';
				copyValueCell.iconWidth = '14px';
				endPointRow.addItem(copyValueCell, { CSSStyles: { 'width': '3%', 'padding-top': '10px' } });

				container.addItem(endPointRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });
			});
			const endpointsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '540px', height: '100%', position: 'absolute' }).component();
			endpointsContainer.addItem(container, { CSSStyles: { 'padding-top': '25px', 'padding-left': '5px' } });

			await view.initializeModel(endpointsContainer);
		}
	});
}

function getCustomEndpoint(parentEndpoint: utils.IEndpoint, serviceName: string, description: string, serviceUrl?: string): utils.IEndpoint {
	if (parentEndpoint) {
		let endpoint: utils.IEndpoint = {
			serviceName: serviceName,
			description: description,
			endpoint: parentEndpoint.endpoint + serviceUrl,
			protocol: 'https'
		};
		return endpoint;
	}
	return null;
}

export enum Endpoint {
	gateway = 'gateway',
	sparkHistory = 'spark-history',
	yarnUi = 'yarn-ui',
	appProxy = 'app-proxy',
	mgmtproxy = 'mgmtproxy',
	managementProxy = 'management-proxy',
	logsui = 'logsui',
	metricsui = 'metricsui',
	controller = 'controller',
	sqlServerMaster = 'sql-server-master',
	webhdfs = 'webhdfs',
	livy = 'livy'
}

/**
 * Gets the localized text to display for a corresponding endpoint
 * @param serviceName The endpoint name to get the display text for
 * @param description The backup description to use if we don't have our own
 */
function getEndpointDisplayText(endpointName?: string, description?: string): string {
	endpointName = endpointName || '';
	switch (endpointName.toLowerCase()) {
		case Endpoint.appProxy:
			return localize('endpoint.appproxy', "Application Proxy");
		case Endpoint.controller:
			return localize('endpoint.controller', "Cluster Management Service");
		case Endpoint.gateway:
			return localize('endpoint.gateway', "Gateway to access HDFS files, Spark");
		case Endpoint.managementProxy:
			return localize('endpoint.managementproxy', "Management Proxy");
		case Endpoint.mgmtproxy:
			return localize('endpoint.mgmtproxy', "Management Proxy");
		case Endpoint.sqlServerMaster:
			return localize('endpoint.sqlServerEndpoint', "SQL Server Master Instance Front-End");
		case Endpoint.metricsui:
			return localize('endpoint.grafana', "Metrics Dashboard");
		case Endpoint.logsui:
			return localize('endpoint.kibana', "Log Search Dashboard");
		case Endpoint.yarnUi:
			return localize('endpoint.yarnHistory', "Spark Diagnostics and Monitoring Dashboard");
		case Endpoint.sparkHistory:
			return localize('endpoint.sparkHistory', "Spark Jobs Management and Monitoring Dashboard");
		case Endpoint.webhdfs:
			return localize('endpoint.webhdfs', "HDFS File System Proxy");
		case Endpoint.livy:
			return localize('endpoint.livy', "Proxy for running Spark statements, jobs, applications");
		default:
			// Default is to use the description if one was given, otherwise worst case just fall back to using the
			// original endpoint name
			return description && description.length > 0 ? description : endpointName;
	}
}
