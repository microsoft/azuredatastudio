/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as Utils from '../utils';

export function registerServiceEndpoints(context: vscode.ExtensionContext): void {
	azdata.ui.registerModelViewProvider('bdc-endpoints', async (view) => {

		const endpointsArray: Array<Utils.IEndpoint> = Object.assign([], view.serverInfo.options['clusterEndpoints']);
		endpointsArray.forEach(endpointInfo => {
			endpointInfo.hyperlink = 'https://' + endpointInfo.ipAddress + ':' + endpointInfo.port;

		});
		if (endpointsArray.length > 0) {
			const managementProxyEp = endpointsArray.find(e => e.serviceName === 'management-proxy' || e.serviceName === 'mgmtproxy');
			if (managementProxyEp) {
				endpointsArray.push(getCustomEndpoint(managementProxyEp, localize("grafana", "Metrics Dashboard"), '/grafana/d/wZx3OUdmz'));
				endpointsArray.push(getCustomEndpoint(managementProxyEp, localize("kibana", "Log Search Dashboard"), '/kibana/app/kibana#/discover'));
			}

			const gatewayEp = endpointsArray.find(e => e.serviceName === 'gateway');
			if (gatewayEp) {
				endpointsArray.push(getCustomEndpoint(gatewayEp, localize("sparkHostory", "Spark Job Monitoring"), '/gateway/default/sparkhistory'));
				endpointsArray.push(getCustomEndpoint(gatewayEp, localize("yarnHistory", "Spark Resource Management"), '/gateway/default/yarn'));
			}

			const container = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%', alignItems: 'left' }).component();
			endpointsArray.forEach(endpointInfo => {
				const endPointRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
				const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: getFriendlyEndpointNames(endpointInfo.serviceName) }).component();
				endPointRow.addItem(nameCell, { CSSStyles: { 'width': '35%', 'font-weight': '600', 'user-select': 'text' } });
				if (endpointInfo.isHyperlink) {
					const linkCell = view.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({ label: endpointInfo.hyperlink, url: endpointInfo.hyperlink }).component();
					endPointRow.addItem(linkCell, { CSSStyles: { 'width': '62%', 'color': '#0078d4', 'text-decoration': 'underline', 'padding-top': '10px' } });
				}
				else {
					const endpointCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: endpointInfo.ipAddress + ':' + endpointInfo.port }).component();
					endPointRow.addItem(endpointCell, { CSSStyles: { 'width': '62%', 'user-select': 'text' } });
				}
				const copyValueCell = view.modelBuilder.button().component();
				copyValueCell.iconPath = { light: context.asAbsolutePath('resources/light/copy.png'), dark: context.asAbsolutePath('resources/dark/copy_inverse.png') };
				copyValueCell.onDidClick(() => {
					vscode.env.clipboard.writeText(endpointInfo.hyperlink);
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

function getCustomEndpoint(parentEndpoint: Utils.IEndpoint, serviceName: string, serviceUrl?: string): Utils.IEndpoint {
	if (parentEndpoint) {
		let endpoint: Utils.IEndpoint = {
			serviceName: serviceName,
			ipAddress: parentEndpoint.ipAddress,
			port: parentEndpoint.port,
			isHyperlink: serviceUrl ? true : false,
			hyperlink: 'https://' + parentEndpoint.ipAddress + ':' + parentEndpoint.port + serviceUrl
		};
		return endpoint;
	}
	return null;
}

function getFriendlyEndpointNames(name: string): string {
	let friendlyName: string = name;
	switch (name) {
		case 'app-proxy':
			friendlyName = localize("appproxy", "Application Proxy");
			break;
		case 'controller':
			friendlyName = localize("controller", "Cluster Management Service");
			break;
		case 'gateway':
			friendlyName = localize("gateway", "HDFS and Spark");
			break;
		case 'management-proxy':
			friendlyName = localize("managementproxy", "Management Proxy");
			break;
		case 'mgmtproxy':
			friendlyName = localize("mgmtproxy", "Management Proxy");
			break;
		default:
			break;
	}
	return friendlyName;
}