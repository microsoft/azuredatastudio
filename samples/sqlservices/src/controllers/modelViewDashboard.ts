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
			label: 'Run',
			iconPath: {
				light: context.asAbsolutePath('images/compare.svg'),
				dark: context.asAbsolutePath('images/compare-inverse.svg')
			}
		}).component();

		button.onDidClick(() => {
			vscode.window.showInformationMessage('Run button clicked');
		});

		const toolbar = view.modelBuilder.toolbarContainer().withItems([button]).withLayout({
			orientation: azdata.Orientation.Horizontal
		}).component();

		const textComponent1 = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'text 1' }).component();
		const tab1: azdata.DashboardTab = {
			id: 'home',
			toolbar: toolbar,
			content: textComponent1,
			title: 'Home',
			icon: context.asAbsolutePath('images/home.svg')
		};

		// Tab with nested tabbed Panel
		const textComponent2 = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'text 2' }).component();
		const textComponent3 = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'text 3' }).component();

		const tabbedPanel = view.modelBuilder.tabbedPanel().withTabs([
			{
				title: 'Tab1',
				content: textComponent2,
				id: 'tab1',
				icon: {
					light: context.asAbsolutePath('images/user.svg'),
					dark: context.asAbsolutePath('images/user_inverse.svg')
				}
			}, {
				title: 'Tab2',
				content: textComponent3,
				icon: {
					light: context.asAbsolutePath('images/group.svg'),
					dark: context.asAbsolutePath('images/group_inverse.svg')
				},
				id: 'tab2'
			}
		]).withLayout({
			orientation: azdata.TabOrientation.Horizontal,
			showIcon: true
		}).component();

		const tab2: azdata.DashboardTab = {
			id: 'settings',
			content: tabbedPanel,
			title: 'Settings',
			icon: context.asAbsolutePath('images/default.svg')
		};
		return [
			tab1,
			{
				title: 'Security',
				tabs: [
					tab2
				]
			}
		];
	});
	dashboard.open();
}
