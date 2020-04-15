/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from './localizedConstants';
import { IconPathHelper, cssStyles } from './constants';
import { BasicAuth } from './controller/auth';
import { DatabaseRouterApi, DuskyObjectModelsDatabaseService, DuskyObjectModelsDatabase, DuskyObjectModelsDatabaseServiceArcPayload } from './controller/generated/dusky/api';
import { EndpointsRouterApi, EndpointModel, RegistrationRouterApi, RegistrationResponse, TokenRouterApi, TokenModel } from './controller/generated/v1/api';
import { MiaaDashboard } from './ui/dashboards/miaa/miaaDashboard';

// Controller information
const controllerUrl = 'https://0.0.0.0:30080';
const auth = new BasicAuth('username', 'password');

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	IconPathHelper.setExtensionContext(context);
	vscode.commands.registerCommand('arc.manageMiaa', async () => {
		await new MiaaDashboard(loc.miaaDashboard).showDashboard();
	});
	vscode.commands.registerCommand('arc.managePostgres', async () => {
		await openPostgresDashboard();
	});
}

async function openPostgresDashboard(): Promise<void> {
	const dashboard: azdata.window.ModelViewDashboard = azdata.window.createModelViewDashboard('Azure Arc - Postgres');
	dashboard.registerTabs(async (view: azdata.ModelView) => {
		// TODO: Loading icon while we fetch information

		// Database service information
		const dbName = 'my-postgres2';
		const dbNamespace = 'default';

		// Get database service from the controller
		const duskyApi = new DatabaseRouterApi(auth.username, auth.password, controllerUrl);
		duskyApi.setDefaultAuthentication(auth);
		const servicePromise: Promise<{ body: DuskyObjectModelsDatabaseService }> = duskyApi.getDuskyDatabaseService(dbNamespace, dbName);

		// Get controller endpoints
		const endpointApi = new EndpointsRouterApi(auth.username, auth.password, controllerUrl);
		endpointApi.setDefaultAuthentication(auth);
		const mgmtproxyPromise: Promise<{ body: EndpointModel }> = endpointApi.apiV1BdcEndpointsEndpointNameGet('mgmtproxy');

		// Get the controller's k8s namespace
		// TODO: This token could be used for authentication (OAuthWithSsl) instead of basic auth.
		//       Tokens expire every 10 hours, so the user would have to re-login like with azdata.
		const tokenApi = new TokenRouterApi(auth.username, auth.password, controllerUrl);
		tokenApi.setDefaultAuthentication(auth);
		const tokenPromise: Promise<{ body: TokenModel }> = tokenApi.apiV1TokenPost();

		// Await the controller requests in parallel
		// TODO: Error handling everywhere that communicates with the controller - make errors surface in the UI
		const controllerResp = await Promise.all([servicePromise, mgmtproxyPromise, tokenPromise]);
		const service: DuskyObjectModelsDatabaseService = controllerResp[0].body;
		const mgmtproxy: EndpointModel = controllerResp[1].body;
		const controllerNamespace: string = controllerResp[2].body.namespace;

		// Get Azure registration information
		// TODO: Improve the registration router to query a single resource rather than list all
		const registrationApi = new RegistrationRouterApi(auth.username, auth.password, controllerUrl);
		registrationApi.setDefaultAuthentication(auth);
		const registrations: RegistrationResponse[] = (await registrationApi.apiV1RegistrationListResourcesNsGet(controllerNamespace)).body;
		const registration: RegistrationResponse = registrations.find(r => {
			// Resources deployed outside the controller's namespace are named in the format 'namespace_name'
			let name: string = r.instanceName;
			const parts: string[] = name.split('_');
			if (parts.length === 2) {
				name = parts[1];
			}
			else if (parts.length > 2) {
				throw new Error(`Cannot parse resource '${name}'. Acceptable formats are 'namespace_name' or 'name'.`);
			}
			return r.instanceType === 'postgres' && r.instanceNamespace === dbNamespace && name === dbName;
		});

		// Construct the dashboard
		return [
			await getOverviewTab(view, service, controllerNamespace, registration, mgmtproxy),
			{
				title: 'Settings',
				tabs: [
					getComputeStorageTab(view),
					getConnectionStringsTab(view),
					getBackupTab(view),
					getPropertiesTab(view)
				]
			}, {
				title: 'Security',
				tabs: [
					getNetworkingTab(view)
				]
			}
		];
	});
	await dashboard.open();
}

// List of buttons at the top of the overview page
function getOverviewToolbar(view: azdata.ModelView, service: DuskyObjectModelsDatabaseService): azdata.ToolbarContainer {
	const duskyApi = new DatabaseRouterApi(auth.username, auth.password, controllerUrl);
	duskyApi.setDefaultAuthentication(auth);

	// New database
	const newDatabaseButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
		label: 'New Database',
		iconPath: IconPathHelper.add
	}).component();

	newDatabaseButton.onDidClick(async () => {
		const name: string = await vscode.window.showInputBox({ prompt: 'Database name' });
		let db: DuskyObjectModelsDatabase = { name: name }; // TODO support other options (sharded, owner)
		db = (await duskyApi.createDuskyDatabase(service.metadata.namespace, service.metadata.name, db)).body;
		vscode.window.showInformationMessage(`Database '${db.name}' created`);
	});

	// Reset password
	const resetPasswordButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
		label: 'Reset Password',
		iconPath: IconPathHelper.edit
	}).component();

	resetPasswordButton.onDidClick(async () => {
		const password: string = await vscode.window.showInputBox({ prompt: 'New password', password: true });
		// Get the latest spec of the service in case it has changed
		const updateService: DuskyObjectModelsDatabaseService = (await duskyApi.getDuskyDatabaseService(service.metadata.namespace, service.metadata.name)).body;
		updateService.status = undefined; // can't update the status
		if (updateService.arc === undefined) { updateService.arc = new DuskyObjectModelsDatabaseServiceArcPayload(); }
		updateService.arc.servicePassword = password;
		service = (await duskyApi.updateDuskyDatabaseService(updateService.metadata.namespace, updateService.metadata.name, updateService)).body;
		vscode.window.showInformationMessage(`Password reset for service '${service.metadata.namespace}.${service.metadata.name}'`);
	});

	// Delete service
	const deleteButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
		label: 'Delete',
		iconPath: IconPathHelper.delete
	}).component();

	deleteButton.onDidClick(async () => {
		const response: string = await vscode.window.showQuickPick(['Yes', 'No'], {
			placeHolder: `Delete service '${service.metadata.namespace}.${service.metadata.name}'?`
		});
		if (response === 'Yes') {
			await duskyApi.deleteDuskyDatabaseService(service.metadata.namespace, service.metadata.name);
			vscode.window.showInformationMessage(`Service '${service.metadata.namespace}.${service.metadata.name}' deleted`);
		}
	});

	// TODO implement click
	const openInAzurePortalButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
		label: 'Open in Azure portal',
		iconPath: IconPathHelper.openInTab
	}).component();

	// TODO implement click
	const feedbackButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
		label: 'Feedback',
		iconPath: IconPathHelper.heart
	}).component();

	return view.modelBuilder.toolbarContainer().withToolbarItems([
		{ component: newDatabaseButton },
		{ component: resetPasswordButton },
		{ component: deleteButton, toolbarSeparatorAfter: true },
		{ component: openInAzurePortalButton },
		{ component: feedbackButton }
	]).component();
}

async function getOverviewTab(view: azdata.ModelView, service: DuskyObjectModelsDatabaseService, controllerNamespace: string, registration: RegistrationResponse, mgmtproxy: EndpointModel): Promise<azdata.DashboardTab> {
	const overview = view.modelBuilder.divContainer().component();
	const essentials = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
	const leftEssentials = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
	const rightEssentials = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
	const essentialColumns = view.modelBuilder.flexContainer().withItems([leftEssentials, rightEssentials], { flex: '1', CSSStyles: { 'padding': '0px 15px', 'overflow': 'hidden' } }).component();
	essentials.addItem(essentialColumns);
	overview.addItem(essentials);

	// Collapse essentials button
	const collapse = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({ iconPath: IconPathHelper.collapseUp, width: '10px', height: '10px' }).component();
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
	leftEssentials.addItems([
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Name', CSSStyles: headerCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: service.metadata.name, CSSStyles: textCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Resource group', CSSStyles: headerCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: registration?.resourceGroupName ?? 'None', CSSStyles: textCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Status', CSSStyles: headerCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: service.status.state, CSSStyles: textCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Data controller', CSSStyles: headerCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: controllerNamespace, CSSStyles: textCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Subscription', CSSStyles: headerCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: registration?.subscriptionId ?? 'None', CSSStyles: textCSS }).component()]);

	// Right essentials
	// Get the service's password and endpoint
	const duskyApi = new DatabaseRouterApi(auth.username, auth.password, controllerUrl);
	duskyApi.setDefaultAuthentication(auth);
	const password: string = (await duskyApi.getDuskyPassword(service.metadata.namespace, service.metadata.name)).body;
	const pgConnString = `postgresql://postgres:${password}@${getEndpoint(service)}`;

	// Connection string link
	const endpointLink = view.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
		url: pgConnString, label: pgConnString, CSSStyles: {
			...cssStyles.hyperlink, 'display': 'inline-block', 'width': '100%', 'overflow': 'hidden', 'text-overflow': 'ellipsis'
		}
	}).component();
	const endpointDiv = view.modelBuilder.divContainer().component();
	endpointDiv.addItem(endpointLink, { CSSStyles: { 'display': 'inline-block', 'max-width': 'calc(100% - 20px)', 'padding-right': '5px' } });

	// Button to copy the connection string
	const endpointCopy = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({ iconPath: IconPathHelper.copy, width: '15px', height: '15px' }).component();
	endpointDiv.addItem(endpointCopy, { CSSStyles: { 'display': 'inline-block' } });
	endpointCopy.onDidClick(async () => {
		vscode.env.clipboard.writeText(pgConnString);
		vscode.window.showInformationMessage('Coordinator endpoint copied to clipboard');
	});

	rightEssentials.addItems([
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Server group type', CSSStyles: headerCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Azure Database for PostgreSQL - Azure Arc', CSSStyles: textCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Coordinator endpoint', CSSStyles: headerCSS }).component(),
		endpointDiv,
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Admin username', CSSStyles: headerCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'postgres', CSSStyles: textCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Node configuration', CSSStyles: headerCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: getConfiguration(service), CSSStyles: textCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'PostgreSQL version', CSSStyles: headerCSS }).component(),
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: service.spec.engine.version.toString(), CSSStyles: textCSS }).component()]);

	// Service endpoints
	const titleCSS = { ...cssStyles.text, 'font-weight': 'bold', 'font-size': '14px', 'margin-left': '10px', 'margin-block-start': '0', 'margin-block-end': '0' };
	overview.addItem(view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Service endpoints', CSSStyles: titleCSS }).component());

	const kibanaQuery = `kubernetes_namespace:"${service.metadata.namespace}" and cluster_name:"${service.metadata.name}"`;
	const kibanaUrl = `${mgmtproxy.endpoint}/kibana/app/kibana#/discover?_a=(query:(language:kuery,query:'${kibanaQuery}'))`;
	const grafanaUrl = `${mgmtproxy.endpoint}/grafana/d/postgres-metrics?var-Namespace=${service.metadata.namespace}&var-Name=${service.metadata.name}`;

	const kibanaLink = view.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({ label: kibanaUrl, url: kibanaUrl, CSSStyles: cssStyles.hyperlink }).component();
	const grafanaLink = view.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({ label: grafanaUrl, url: grafanaUrl, CSSStyles: cssStyles.hyperlink }).component();

	const endpointsTable = view.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
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
	overview.addItem(view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Server group nodes', CSSStyles: titleCSS }).component());
	const nodesTable = view.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
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

	const nodes = getNumNodes(service);
	for (let i = 0; i < nodes; i++) {
		nodesTable.data.push([
			`${service.metadata.name}-${i}`,
			i === 0 ? 'Coordinator' : 'Worker',
			i === 0 ? getEndpoint(service) : `${service.metadata.name}-${i}.${service.metadata.name}-svc.${service.metadata.namespace}.svc.cluster.local`]);
	}

	overview.addItem(nodesTable, { CSSStyles: { 'margin-left': '10px', 'margin-right': '10px', 'margin-bottom': '20px' } });
	return {
		title: 'Overview',
		id: 'overview-tab',
		icon: IconPathHelper.postgres,
		toolbar: getOverviewToolbar(view, service),
		content: overview
	};
}

function getComputeStorageTab(view: azdata.ModelView): azdata.DashboardTab {
	const computeStorage: azdata.FlexContainer = view.modelBuilder.flexContainer().withItems([
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Compute + storage' }).component()
	]).component();

	return {
		title: 'Compute + storage',
		id: 'compute-storage-tab',
		icon: IconPathHelper.computeStorage,
		content: computeStorage
	};
}

function getConnectionStringsTab(view: azdata.ModelView): azdata.DashboardTab {
	const connectionStrings: azdata.FlexContainer = view.modelBuilder.flexContainer().withItems([
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Connection strings' }).component()
	]).component();

	return {
		title: 'Connection strings',
		id: 'connection-strings-tab',
		icon: IconPathHelper.connection,
		content: connectionStrings
	};
}

function getBackupTab(view: azdata.ModelView): azdata.DashboardTab {
	const backup: azdata.FlexContainer = view.modelBuilder.flexContainer().withItems([
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Backup' }).component()
	]).component();

	return {
		title: 'Backup',
		id: 'backup-tab',
		icon: IconPathHelper.backup,
		content: backup
	};
}

function getPropertiesTab(view: azdata.ModelView): azdata.DashboardTab {
	const properties: azdata.FlexContainer = view.modelBuilder.flexContainer().withItems([
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Properties' }).component()
	]).component();

	return {
		title: 'Properties',
		id: 'properties-tab',
		icon: IconPathHelper.properties,
		content: properties
	};
}

function getNetworkingTab(view: azdata.ModelView): azdata.DashboardTab {
	const networking: azdata.FlexContainer = view.modelBuilder.flexContainer().withItems([
		view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Networking' }).component()
	]).component();

	return {
		title: 'Networking',
		id: 'networking-tab',
		icon: IconPathHelper.networking,
		content: networking
	};
}

// Returns the ip:port of the service
function getEndpoint(service: DuskyObjectModelsDatabaseService): string {
	const externalIp = service.status.externalIP;
	const internalIp = service.status.internalIP;
	const externalPort = service.status.externalPort;
	const internalPort = service.status.internalPort;

	let ip = '0.0.0.0';
	if (externalIp) {
		ip = externalIp;
		if (externalPort) {
			ip += `:${externalPort}`;
		}
	} else if (internalIp) {
		ip = internalIp;
		if (internalPort) {
			ip += `:${internalPort}`;
		}
	}

	return ip;
}

// Returns the number of nodes in the service
function getNumNodes(service: DuskyObjectModelsDatabaseService): number {
	let nodes = service.spec.scale?.shards ?? 1;
	if (nodes > 1) { nodes++; } // for multiple shards there is an additional node for the coordinator
	return nodes;
}

// Returns the service's configuration e.g. '3 nodes, 1.5 vCores, 1GiB RAM, 2GiB storage per node'
function getConfiguration(service: DuskyObjectModelsDatabaseService): string {
	const nodes = getNumNodes(service);
	const cpuLimit = getCores(service.spec.scheduling?.resources.limits?.['cpu']);
	const ramLimit = getMemory(service.spec.scheduling?.resources.limits?.['memory']);
	const cpuRequest = getCores(service.spec.scheduling?.resources.requests?.['cpu']);
	const ramRequest = getMemory(service.spec.scheduling?.resources.requests?.['memory']);
	const storage = getMemory(service.spec.storage.volumeSize);

	// Prefer limits if they're provided, otherwise use requests if they're provided
	let nodeConfiguration = `${nodes} node`;
	if (nodes > 1) { nodeConfiguration += 's'; }
	if (cpuLimit) {
		nodeConfiguration += `, ${cpuLimit} vCores`;
	} else if (cpuRequest) {
		nodeConfiguration += `, ${cpuRequest} vCores`;
	}
	if (ramLimit) {
		nodeConfiguration += `, ${ramLimit} RAM`;
	} else if (ramRequest) {
		nodeConfiguration += `, ${ramRequest} RAM`;
	}
	if (storage) { nodeConfiguration += `, ${storage} storage per node`; }
	return nodeConfiguration;
}

// Converts millicores to cores (600m -> 0.6 cores)
// https://kubernetes.io/docs/concepts/configuration/manage-compute-resources-container/#meaning-of-cpu
function getCores(cores: string): number {
	return cores?.endsWith('m') ? +cores.slice(0, -1) / 1000 : +cores;
}

// Formats the memory to end with 'B' e.g:
// 1 -> 1B
// 1K -> 1KB, 1Ki -> 1KiB
// 1M -> 1MB, 1Mi -> 1MiB
// 1G -> 1GB, 1Gi -> 1GiB
// 1T -> 1TB, 1Ti -> 1TiB
// https://kubernetes.io/docs/concepts/configuration/manage-compute-resources-container/#meaning-of-memory
function getMemory(memory: string): string {
	return memory && !memory.endsWith('B') ? `${memory}B` : memory;
}

export function deactivate(): void {
}
