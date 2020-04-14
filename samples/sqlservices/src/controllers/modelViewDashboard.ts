/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export async function openModelViewDashboard(context: vscode.ExtensionContext): Promise<void> {
	const dashboard = azdata.window.createModelViewDashboard('Test Dashboard');
	dashboard.registerTabs(async (view: azdata.ModelView) => {
		// Tab with toolbar
		const button = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Add databases tab',
			iconPath: {
				light: context.asAbsolutePath('images/compare.svg'),
				dark: context.asAbsolutePath('images/compare-inverse.svg')
			}
		}).component();

		const toolbar = view.modelBuilder.toolbarContainer().withItems([button]).withLayout({
			orientation: azdata.Orientation.Horizontal
		}).component();

		const input1 = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({ value: 'input 1' }).component();
		const homeTab: azdata.DashboardTab = {
			id: 'home',
			toolbar: toolbar,
			content: input1,
			title: 'Home',
			icon: context.asAbsolutePath('images/home.svg') // icon can be the path of a svg file
		};

		// Tab with nested tabbed Panel
		const addTabButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: 'Add a tab', width: '150px' }).component();
		const removeTabButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: 'Remove a tab', width: '150px' }).component();
		const container = view.modelBuilder.flexContainer().withItems([addTabButton, removeTabButton]).withLayout({ flexFlow: 'column' }).component();
		const nestedTab1 = {
			title: 'Tab1',
			content: container,
			id: 'tab1',
			icon: {
				light: context.asAbsolutePath('images/user.svg'),
				dark: context.asAbsolutePath('images/user_inverse.svg') // icon can also be theme aware
			}
		};

		const input2 = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({ value: 'input 2' }).component();
		const nestedTab2 = {
			title: 'Tab2',
			content: input2,
			icon: {
				light: context.asAbsolutePath('images/group.svg'),
				dark: context.asAbsolutePath('images/group_inverse.svg')
			},
			id: 'tab2'
		};

		const input3 = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({ value: 'input 4' }).component();
		const nestedTab3 = {
			title: 'Tab3',
			content: input3,
			id: 'tab3'
		};

		const tabbedPanel = view.modelBuilder.tabbedPanel().withTabs([
			nestedTab1, nestedTab2
		]).withLayout({
			orientation: azdata.TabOrientation.Horizontal,
			showIcon: true
		}).component();


		addTabButton.onDidClick(() => {
			tabbedPanel.updateTabs([nestedTab1, nestedTab2, nestedTab3]);
		});

		removeTabButton.onDidClick(() => {
			tabbedPanel.updateTabs([nestedTab1, nestedTab3]);
		});

		const settingsTab: azdata.DashboardTab = {
			id: 'settings',
			content: tabbedPanel,
			title: 'Settings',
			icon: context.asAbsolutePath('images/default.svg')
		};

		// You can also add a tab group
		const securityTabGroup: azdata.DashboardTabGroup = {
			title: 'Security',
			tabs: [
				settingsTab
			]
		};

		// Databases tab
		const databasesText = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({ value: 'This is databases tab', width: '200px' }).component();
		const databasesTab: azdata.DashboardTab = {
			id: 'databases',
			content: databasesText,
			title: 'Databases',
			icon: context.asAbsolutePath('images/default.svg')
		};
		button.onDidClick(() => {
			dashboard.updateTabs([homeTab, databasesTab, securityTabGroup]);
		});

		return [
			homeTab,
			securityTabGroup
		];
	});
	await dashboard.open();
}

