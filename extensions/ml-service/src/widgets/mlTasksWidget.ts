/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { MlServiceprovider } from '../mlServiceProvider';
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
			height: '100%'
		})
			.component();

		const installWarning = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: '',
		}).component();

		let notebooksFolder = path.join(__dirname, '..', '..', 'notebooks');

		let isBigDataCluster = false;
		if (!types.isUndefinedOrNull(view.serverInfo.options)) {
			isBigDataCluster = view.serverInfo.options[isBigDataClusterProperty];
		}
		let deployMlFlowButton: azdata.ButtonComponent;
		let deployCognitiveServicesButton: azdata.ButtonComponent;
		if (isBigDataCluster) {
			deployMlFlowButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				label: 'Deploy MLFlow',
				title: 'Deploy MLFlow'
			}).component();

			deployMlFlowButton.onDidClick(async () => {
				let notebookPath = path.join(notebooksFolder, 'Deploy MLFlow', 'Deploy MLFlow.ipynb');
				let doc = await vscode.workspace.openTextDocument(notebookPath);
				vscode.window.showTextDocument(doc);
			});

			deployCognitiveServicesButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				label: 'Deploy Cognitive Services',
				title: 'Deploy Cognitive Services'
			}).component();

			deployCognitiveServicesButton.onDidClick(async () => {
				let notebookPath = path.join(notebooksFolder, 'Deploy Cognitive Services', 'Deploy Cognitive Services.ipynb');
				let doc = await vscode.workspace.openTextDocument(notebookPath);
				vscode.window.showTextDocument(doc);
			});
		}

		const mlDocsButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Machine Learning Services Documentation',
			title: 'Machine Learning Services Documentation'
		}).component();

		mlDocsButton.onDidClick(async () => {
			vscode.env.openExternal(vscode.Uri.parse('https://docs.microsoft.com/en-us/sql/advanced-analytics/?view=sql-server-ver15'));
		});


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

		addRow(container, view, installWarning);

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

		let spinner = view.modelBuilder.loadingComponent()
			.withItem(bookslocationContainer)
			.withProperties<azdata.LoadingComponentProperties>({ loading: true })
			.component();

		loadTasks(view, container, [mlDocsButton, deployMlFlowButton, installOdbcDriverButton, deployCognitiveServicesButton], installWarning, spinner);
		await view.initializeModel(spinner);
	});
}

async function loadTasks(
	view: azdata.ModelView,
	container: azdata.FlexContainer,
	components: azdata.Component[],
	warningComponent: azdata.TextComponent,
	loadingComponent: azdata.LoadingComponent): Promise<void> {
	let mlServiceprovider = new MlServiceprovider();
	components.push(await loadButton(view, mlServiceprovider));
	let isMLInstalled = await mlServiceprovider.IsPythonInstalled();
	if (isMLInstalled) {
		container.clearItems();
		components.forEach(component => {
			if (component) {
				addRow(container, view, component);
			}
		});

	} else {
		warningComponent.value = 'To get started, click <a target="blank" href="https://docs.microsoft.com/en-us/sql/advanced-analytics/install/sql-machine-learning-services-windows-install?view=sql-server-ver15">here</a> to download and install SQL Machine Learning Services';
	}

	loadingComponent.updateProperties({ loading: false });
}

async function loadButton(view: azdata.ModelView, mlServiceprovider: MlServiceprovider): Promise<azdata.ButtonComponent> {

	const button = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
		label: 'Loading...',
		title: 'Loading...'
	}).component();
	let isEnabled = await mlServiceprovider.IsMachineLearningServiceEnabled();
	button.label = getLabel(isEnabled);
	button.onDidClick(async () => {
		button.label = 'Loading ...';
		await mlServiceprovider.ChangeExternalScriptConfig(!isEnabled);
		isEnabled = !isEnabled;
		button.label = getLabel(isEnabled);
	});
	return button;
}

function getLabel(isEnabled: boolean): string {
	let enable = 'Enable Machine Learning Services';
	let disable = 'Disable Machine Learning Services';
	let title = enable;
	if (!isEnabled) {
		title = enable;

	} else {
		title = disable;
	}
	return title;
}

