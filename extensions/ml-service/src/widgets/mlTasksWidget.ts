/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { MlServiceprovider} from '../mlServiceProvider';
import * as path from 'path';
import { Dataspace } from '../models/dataspace';
import * as types from '../types';

export const isBigDataClusterProperty = 'isBigDataCluster';
function addRow(container: azdata.FlexContainer, view: azdata.ModelView, component: azdata.Component) {
	const bookRow = view.modelBuilder.flexContainer().withLayout({
		flexFlow: 'row'
	}).component();
	bookRow.addItem(component, {
		CSSStyles: {
			'width': '100%',
			'color': '#0078d4',
			'padding-top': '10px',
			'text-align': 'left'
		}
	});
	container.addItems([bookRow]);
}

export function registerMlTasksWidget(dataspace: Dataspace): void {
	azdata.ui.registerModelViewProvider('ml.tasks', async (view) => {
		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '100%',
			height: '100%' })
		.component();

		let notebooksFolder = path.join(__dirname, '..', '..', 'notebooks');
		const enableMlButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Loading...',
			title: 'Loading...'
		}).component();

		const enableMlFlowButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Install MlFlow Package',
			title: 'Install MlFlow Package'
		}).component();

		enableMlFlowButton.onDidClick(async () => {
			let notebookPath = path.join(notebooksFolder, 'enable-MlFlow.ipynb');
			let doc = await vscode.workspace.openTextDocument(notebookPath);
			vscode.window.showTextDocument(doc);
		});

		let isBigDataCluster = false;
		if (!types.isUndefinedOrNull(view.serverInfo.options)) {
			isBigDataCluster = view.serverInfo.options[isBigDataClusterProperty];
		}
		if (isBigDataCluster) {
			const deployMlFlowButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				label: 'Deploy Model Management',
				title: 'Deploy Model Management'
			}).component();

			deployMlFlowButton.onDidClick(async () => {
				let notebookPath = path.join(notebooksFolder, 'deploy-ml-aks.ipynb');
				let doc = await vscode.workspace.openTextDocument(notebookPath);
				vscode.window.showTextDocument(doc);
			});
			addRow(container, view, deployMlFlowButton);

		}

		const installOdbcDriverButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Install ODBC Driver for SQL Server',
			title: 'Install ODBC Driver for SQL Server'
		}).component();

		installOdbcDriverButton.onDidClick(async () => {
			let isWindows = process.platform === 'win32';
			if (isWindows) {
				vscode.env.openExternal(vscode.Uri.parse('https://docs.microsoft.com/en-us/sql/connect/odbc/windows/microsoft-odbc-driver-for-sql-server-on-windows?view=sql-server-ver15'));
			} else {
				vscode.env.openExternal(vscode.Uri.parse('https://docs.microsoft.com/en-us/sql/connect/odbc/linux-mac/installing-the-microsoft-odbc-driver-for-sql-server?view=sql-server-ver15'));
			}
		});

		const installWarning = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			title: '',
		}).component();

		addRow(container, view, enableMlFlowButton);
		addRow(container, view, enableMlButton);
		addRow(container, view, installOdbcDriverButton);
		addRow(container, view, installWarning);

		loadLabel(installWarning, container);
		loadButton(enableMlButton);

		const bookslocationContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '270px',
			height: '100%',
			position: 'absolute'
		}).component();

		bookslocationContainer.addItem(container, {
			CSSStyles: {
				'padding-top': '25px',
				'padding-left': '5px'
			}
		});
		await view.initializeModel(bookslocationContainer);
	});
}

async function loadLabel(installWarning: azdata.TextComponent, container: azdata.FlexContainer): Promise<void> {
	let mlServiceprovider = new MlServiceprovider();
	let isInstalled = await mlServiceprovider.IsPythonInstalled();
	if (!isInstalled) {
		container.items.forEach(item => {
			item.enabled = false;
		});
		installWarning.value = 'To get started, click <a target="blank" href="https://docs.microsoft.com/en-us/sql/advanced-analytics/install/sql-machine-learning-services-windows-install?view=sql-server-ver15">here</a> to download and install SQL Machine Learning Services';
	}
	return;
}

async function loadButton(button: azdata.ButtonComponent): Promise<void> {
	let mlServiceprovider = new MlServiceprovider();
	let isEnabled = await mlServiceprovider.IsMachineLearningServiceEnabled();
	button.label = getLabel(isEnabled);
	button.onDidClick(async () => {
		button.label = 'Loading ...';
		await mlServiceprovider.ChangeExternalScriptConfig(!isEnabled);
		isEnabled = !isEnabled;
		button.label = getLabel(isEnabled);
	});
	return;
}

function getLabel(isEnabled: boolean): string {
	let enable = 'Enable Machine Learning Service';
	let disable = 'Disable Machine Learning Service';
	let title = enable;
	if(!isEnabled) {
		title = enable;

	} else {
		title = disable;
	}
	return title;
}

