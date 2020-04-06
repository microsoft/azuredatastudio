/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { BasicAuth } from './controller/auth';
import { DatabaseRouterApi, DuskyObjectModelsDatabaseService } from './controller/generated/api';

export function activate(context: vscode.ExtensionContext) {
	const dashboard = azdata.window.createModelViewDashboard('Azure Arc - Postgres');
	dashboard.registerTabs(async (view: azdata.ModelView) => {
		const auth = new BasicAuth('', '');
		const api = new DatabaseRouterApi(auth.username, auth.password, '');
		api.setDefaultAuthentication(auth);
		const service: DuskyObjectModelsDatabaseService = (await api.getDuskyDatabaseService('default', 'a')).body;
		console.log(service);

		const overview = getOverviewTab(context, view, service);
		const backup = view.modelBuilder.flexContainer().component();
		const properties = view.modelBuilder.flexContainer().component();
		const networking = view.modelBuilder.flexContainer().component();
		const configure = view.modelBuilder.flexContainer().component();

		const newDatabaseButton = view.modelBuilder.button().withProperties({
			label: 'New Database',
			iconPath: context.asAbsolutePath('images/add.svg')
		}).component();

		newDatabaseButton.onDidClick(async () => {
			vscode.window.showInformationMessage(await vscode.window.showInputBox({ prompt: 'Database name' }));
		});

		const resetPasswordButton = view.modelBuilder.button().withProperties({
			label: 'Reset Password',
			iconPath: context.asAbsolutePath('images/edit.svg')
		}).component();

		const deleteButton = view.modelBuilder.button().withProperties({
			label: 'Delete',
			iconPath: context.asAbsolutePath('images/delete.svg')
		}).component();

		const openInAzurePortalButton = view.modelBuilder.button().withProperties({
			label: 'Open in Azure portal',
			iconPath: context.asAbsolutePath('images/open-in-tab.svg')
		}).component();

		const feedbackButton = view.modelBuilder.button().withProperties({
			label: 'Feedback',
			iconPath: context.asAbsolutePath('images/heart.svg')
		}).component();

		const toolbar = view.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: newDatabaseButton },
			{ component: resetPasswordButton },
			{ component: deleteButton, toolbarSeparatorAfter: true },
			{ component: openInAzurePortalButton },
			{ component: feedbackButton }
		]).component();

		return [
			{
				title: 'Overview',
				id: 'overview-tab',
				icon: {
					'light': context.asAbsolutePath('images/Icon-databases-131-Azure-Database-PostgreSQL-Server.svg'),
					'dark': context.asAbsolutePath('images/Icon-databases-131-Azure-Database-PostgreSQL-Server.svg')
				},
				toolbar: toolbar,
				content: overview
			}, {
				title: 'Settings',
				tabs: [
					{
						title: 'Configure',
						id: 'configure-tab',
						icon: {
							'light': context.asAbsolutePath('images/Icon-general-12-Billing.svg'),
							'dark': context.asAbsolutePath('images/Icon-general-12-Billing.svg')
						},
						content: configure
					},
					{
						title: 'Backup',
						id: 'backup-tab',
						icon: {
							'light': context.asAbsolutePath('images/Icon-migrate-282-Recovery-Services-Vaults.svg'),
							'dark': context.asAbsolutePath('images/Icon-migrate-282-Recovery-Services-Vaults.svg')
						},
						content: backup
					}, {
						title: 'Properties',
						id: 'properties-tab',
						icon: {
							'light': context.asAbsolutePath('images/properties.svg'),
							'dark': context.asAbsolutePath('images/properties.svg')
						},
						content: properties
					}
				]
			}, {
				title: 'Security',
				tabs: [
					{
						title: 'Networking',
						id: 'networking-tab',
						icon: {
							'light': context.asAbsolutePath('images/Icon-security-241-Security-Center.svg'),
							'dark': context.asAbsolutePath('images/Icon-security-241-Security-Center.svg')
						},
						content: networking
					}
				]
			}
		];
	});
	dashboard.open();
}

function getOverviewTab(context: vscode.ExtensionContext, view: azdata.ModelView, service: DuskyObjectModelsDatabaseService): azdata.FlexContainer {
	const overview = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
	const essentials = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
	//const endpoints = view.modelBuilder.divContainer().component();
	//const nodes = view.modelBuilder.flexContainer().component();
	overview.addItem(essentials, { CSSStyles: { 'border-bottom': 'solid 1px rgb(214, 214, 214)' } });
	//overview.addItems([endpoints, nodes]);

	// Essentials
	const leftEssentials = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
	const rightEssentials = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
	const essentialColumns = view.modelBuilder.flexContainer().withItems([leftEssentials, rightEssentials], { flex: '1', CSSStyles: { 'padding': '0 10px 10px 10px' } }).component();
	essentials.addItem(essentialColumns);

	const collapse = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
		iconPath: {
			light: context.asAbsolutePath('images/collapse-up.svg'),
			dark: context.asAbsolutePath('images/collapse-up-inverse.svg')
		}
	}).component();
	essentials.addItem(collapse, { CSSStyles: { 'margin-left': 'auto', 'margin-right': 'auto' } });

	collapse.onDidClick(async () => {
		if (essentialColumns.display === 'none') {
			collapse.iconPath = {
				light: context.asAbsolutePath('images/collapse-up.svg'),
				dark: context.asAbsolutePath('images/collapse-up-inverse.svg')
			};
			essentialColumns.display = undefined;
		} else {
			collapse.iconPath = {
				light: context.asAbsolutePath('images/collapse-down.svg'),
				dark: context.asAbsolutePath('images/collapse-down-inverse.svg')
			};
			essentialColumns.display = 'none';
		}
	});

	const headerCSS = { 'font-weight': 'bold', 'margin-block-end': '0' };
	const textCSS = { 'margin-block-start': '0', 'margin-block-end': '0' };

	// Left
	leftEssentials.addItem(view.modelBuilder.text().withProperties({ value: 'Name', CSSStyles: headerCSS }).component());
	leftEssentials.addItem(view.modelBuilder.text().withProperties({ value: service.metadata.name, CSSStyles: textCSS }).component());

	leftEssentials.addItem(view.modelBuilder.text().withProperties({ value: 'Status', CSSStyles: headerCSS }).component());
	leftEssentials.addItem(view.modelBuilder.text().withProperties({ value: service.status.state, CSSStyles: textCSS }).component());

	leftEssentials.addItem(view.modelBuilder.text().withProperties({ value: 'Subscription', CSSStyles: headerCSS }).component());
	leftEssentials.addItem(view.modelBuilder.text().withProperties({ value: '170dfd6e-e460-4e98-a927-3cd4f8caeaf1', CSSStyles: textCSS }).component());

	leftEssentials.addItem(view.modelBuilder.text().withProperties({ value: 'Resource group', CSSStyles: headerCSS }).component());
	leftEssentials.addItem(view.modelBuilder.text().withProperties({ value: 'brberger', CSSStyles: textCSS }).component());

	// Right
	rightEssentials.addItem(view.modelBuilder.text().withProperties({ value: 'Server group type', CSSStyles: headerCSS }).component());
	rightEssentials.addItem(view.modelBuilder.text().withProperties({ value: 'Hyperscale (Citus) - Azure Arc', CSSStyles: textCSS }).component());

	rightEssentials.addItem(view.modelBuilder.text().withProperties({ value: 'Namespace', CSSStyles: headerCSS }).component());
	rightEssentials.addItem(view.modelBuilder.text().withProperties({ value: service.metadata.namespace, CSSStyles: textCSS }).component());

	rightEssentials.addItem(view.modelBuilder.text().withProperties({ value: 'Node configuration', CSSStyles: headerCSS }).component());
	rightEssentials.addItem(view.modelBuilder.text().withProperties({ value: '.5 cores', CSSStyles: textCSS }).component());

	rightEssentials.addItem(view.modelBuilder.text().withProperties({ value: 'PostgreSQL version', CSSStyles: headerCSS }).component());
	rightEssentials.addItem(view.modelBuilder.text().withProperties({ value: service.spec.engine.version.toString(), CSSStyles: textCSS }).component());

	// todo

	const table = view.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
		columns: [
			{
				displayName: 'Name',
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: '20%',
				headerCssStyles: {
					'border': 'none'
				},
				rowCssStyles: {
					'border-top': 'solid 1px #ccc',
					'border-bottom': 'solid 1px #ccc',
					'border-left': 'none',
					'border-right': 'none'
				}
			},
			{
				displayName: 'Endpoint',
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: '40%',
				headerCssStyles: {
					'border': 'none'
				},
				rowCssStyles: {
					'border-top': 'solid 1px #ccc',
					'border-bottom': 'solid 1px #ccc',
					'border-left': 'none',
					'border-right': 'none'
				}
			},
			{
				displayName: 'Description',
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: '40%',
				headerCssStyles: {
					'border': 'none'
				},
				rowCssStyles: {
					'border-top': 'solid 1px #ccc',
					'border-bottom': 'solid 1px #ccc',
					'border-left': 'none',
					'border-right': 'none'
				}
			}
		],
		data: [
			['Grafana Dashboard', 'https://example.com', 'Metrics...sdf sdf sd rt gf dsfg dsfg fsghs fsd fgsd gdsf gdsf gs'],
			['Kibana Dashboard', 'https://example.com', 'Logs...']]
	}).component();

	overview.addItem(table, { CSSStyles: { 'margin-left': '10px', 'margin-right': '10px' } });

	//endpoints.addItem(table, {CSSStyles: {'width': '100%'}});
	//nodes.addItem(view.modelBuilder.text().withProperties({ value: 'nodes' }).component());
	return overview;
}

export function deactivate(): void {
}
