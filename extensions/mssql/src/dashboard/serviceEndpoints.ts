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
const kibanaDescription = localize('kibana', "Log Search Dashboard");
const sparkHistoryEndpointName = 'spark-history';
const sparkHistoryDescription = localize('sparkHistory', "Spark Jobs Management and Monitoring Dashboard");
const yarnUiEndpointName = 'yarn-ui';
const yarnHistoryDescription = localize('yarnHistory', "Spark Diagnostics and Monitoring Dashboard");
const hyperlinkedEndpoints = [grafanaEndpointName, logsuiEndpointName, sparkHistoryEndpointName, yarnUiEndpointName];

export function registerServiceEndpoints(context: vscode.ExtensionContext): void {
	azdata.ui.registerModelViewProvider('bdc-endpoints', async (view) => {
		const endpointsArray: Array<utils.IEndpoint> = Object.assign([], utils.getClusterEndpoints(view.serverInfo));

		if (endpointsArray.length > 0) {
			const grafanaEp = endpointsArray.find(e => e.serviceName === grafanaEndpointName);
			if (grafanaEp) {
				// Update to have correct URL
				grafanaEp.endpoint += '/d/wZx3OUdmz';
			}
			const kibanaEp = endpointsArray.find(e => e.serviceName === logsuiEndpointName);
			if (kibanaEp) {
				// Update to have correct URL
				kibanaEp.endpoint += '/app/kibana#/discover';
			}

			if (!grafanaEp) {
				// We are on older CTP, need to manually add some endpoints.
				// TODO remove once CTP support goes away
				const managementProxyEp = endpointsArray.find(e => e.serviceName === mgmtProxyName);
				if (managementProxyEp) {
					endpointsArray.push(getCustomEndpoint(managementProxyEp, grafanaEndpointName, grafanaDescription, '/grafana/d/wZx3OUdmz'));
					endpointsArray.push(getCustomEndpoint(managementProxyEp, logsuiEndpointName, kibanaDescription, '/kibana/app/kibana#/discover'));
				}

				const gatewayEp = endpointsArray.find(e => e.serviceName === 'gateway');
				if (gatewayEp) {
					endpointsArray.push(getCustomEndpoint(gatewayEp, sparkHistoryEndpointName, sparkHistoryDescription, '/gateway/default/sparkhistory'));
					endpointsArray.push(getCustomEndpoint(gatewayEp, yarnUiEndpointName, yarnHistoryDescription, '/gateway/default/yarn'));
				}
			}

			const container = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%', alignItems: 'left' }).component();
			endpointsArray.forEach(endpointInfo => {

				const endPointRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
				const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: getFriendlyEndpointNames(endpointInfo) }).component();
				endPointRow.addItem(nameCell, { CSSStyles: { 'width': '35%', 'font-weight': '600', 'user-select': 'text' } });
				if (hyperlinkedEndpoints.findIndex(e => e === endpointInfo.serviceName) >= 0) {
					const linkCell = view.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({ label: endpointInfo.endpoint, url: endpointInfo.endpoint }).component();
					endPointRow.addItem(linkCell, { CSSStyles: { 'width': '62%', 'color': '#0078d4', 'text-decoration': 'underline', 'padding-top': '10px' } });
				}
				else {
					const endpointCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: endpointInfo.endpoint }).component();
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
			const endpointsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '540px', height: '100%', alignItems: 'left', position: 'absolute' }).component();
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

function getFriendlyEndpointNames(endpointInfo: utils.IEndpoint): string {
	let friendlyName: string = endpointInfo.description || endpointInfo.serviceName;
	switch (endpointInfo.serviceName) {
		case 'app-proxy':
			friendlyName = localize('approxy.description', "Application Proxy");
			break;
		case 'controller':
			friendlyName = localize('controller.description', "Cluster Management Service");
			break;
		case 'gateway':
			friendlyName = localize('gateway.description', "HDFS and Spark");
			break;
		case mgmtProxyName:
			friendlyName = localize('mgmtproxy.description', "Management Proxy");
			break;
		case logsuiEndpointName:
			friendlyName = kibanaDescription;
			break;
		case grafanaEndpointName:
			friendlyName = grafanaDescription;
			break;
		case sparkHistoryEndpointName:
			friendlyName = sparkHistoryDescription;
			break;
		case yarnUiEndpointName:
			friendlyName = yarnHistoryDescription;
			break;
		case 'sql-server-master':
			friendlyName = localize('sqlmaster.description', "SQL Server Master Instance Front-End");
			break;
		case 'webhdfs':
			friendlyName = localize('webhdfs.description', "HDFS File System Proxy");
			break;
		case 'livy':
			friendlyName = localize('livy.description', "Proxy for running Spark statements, jobs, applications");
			break;
		default:
			break;
	}
	return friendlyName;
}
