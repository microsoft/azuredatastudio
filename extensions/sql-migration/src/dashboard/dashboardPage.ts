/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';

interface IActionMetadata {
	title?: string,
	description?: string,
	link?: string,
	iconPath?: { light: string | vscode.Uri; dark: string | vscode.Uri },
	command?: string;
}

const maxWidth = 800;
const headerMaxHeight = 300;
export class DashboardWidget {

	/**
	 * Creates new instance of dashboard
	 */
	constructor(private _root: string) {
	}

	public register(): Promise<void> {
		return new Promise<void>(resolve => {
			azdata.ui.registerModelViewProvider('migration.dashboard', async (view) => {
				const container = view.modelBuilder.flexContainer().withLayout({
					flexFlow: 'column',
					width: '100%',
					height: '100%'
				}).component();
				const header = this.createHeader(view);

				const tasksContainer = await this.createTasks(view);

				container.addItem(header, {
					CSSStyles: {
						'background-image': `url(${vscode.Uri.file(this.asAbsolutePath('images/background.svg'))})`,
						'background-repeat': 'no-repeat',
						'background-position': 'bottom',
						'width': `${maxWidth}px`,
						'height': '280px',
						'background-size': `${maxWidth}px ${headerMaxHeight}px`,
						'margin-bottom': '-60px'
					}
				});
				container.addItem(tasksContainer, {
					CSSStyles: {
						'width': `${maxWidth}px`,
						'height': '150px',
					}
				});
				const mainContainer = view.modelBuilder.flexContainer()
					.withLayout({
						flexFlow: 'column',
						width: '100%',
						height: '100%',
						position: 'absolute'
					}).component();
				mainContainer.addItem(container, {
					CSSStyles: { 'padding-top': '25px', 'padding-left': '5px' }
				});
				await view.initializeModel(mainContainer);
				resolve();
			});
		});
	}

	private createHeader(view: azdata.ModelView): azdata.Component {
		const header = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			height: headerMaxHeight
		}).component();
		const titleComponent = view.modelBuilder.text().withProperties({
			value: 'SQL Server Migration',
			CSSStyles: {
				'font-size': '36px',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();
		const descComponent = view.modelBuilder.text().withProperties({
			value: 'Migrate to Azure SQL VM or Azure SQL MI instances',
			CSSStyles: {
				'font-size': '14px',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();
		header.addItems([titleComponent, descComponent], {
			CSSStyles: {
				'width': `${maxWidth}px`,
				'padding': '5px'
			}
		});

		return header;
	}

	private asAbsolutePath(filePath: string): string {
		return path.join(this._root || '', filePath);
	}

	private async createTasks(view: azdata.ModelView): Promise<azdata.Component> {
		const tasksContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: '100%',
			height: '50px',
		}).component();

		const notebookMetadata: IActionMetadata = {
			title: 'Prerequisites',
			description: 'Verify that prerequisites are meet prior to starting a migration.',
			iconPath: {
				dark: this.asAbsolutePath('images/createNotebook.svg'),
				light: this.asAbsolutePath('images/createNotebook.svg'),
			},
			link: 'https://go.microsoft.com/fwlink/?linkid=2129920',
			command: 'sqlmigration.start'
		};
		const notebookModelsButton = this.createTaskButton(view, notebookMetadata);

		const importMetadata: IActionMetadata = {
			title: 'Migrate',
			description: 'Start a migration of this SQL Server instance to Azure SQL',
			iconPath: {
				dark: this.asAbsolutePath('images/manageModels.svg'),
				light: this.asAbsolutePath('images/manageModels.svg'),
			},
			link: 'https://go.microsoft.com/fwlink/?linkid=2129796',
			command: 'sqlmigration.start'
		};
		const importModelsButton = this.createTaskButton(view, importMetadata);

		tasksContainer.addItems([notebookModelsButton, importModelsButton,], {
			CSSStyles: {
				'padding': '10px'
			}
		});

		return tasksContainer;
	}

	private createTaskButton(view: azdata.ModelView, taskMetaData: IActionMetadata): azdata.Component {
		const maxHeight = 160;
		const maxWidth = 360;
		const mainContainer = view.modelBuilder.divContainer().withLayout({
			width: maxWidth,
			height: maxHeight
		}).withProperties({
			clickable: true,
			ariaRole: taskMetaData.title
		}).component();
		const iconContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth,
			height: maxHeight - 23,
			alignItems: 'flex-start'
		}).component();
		const labelsContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth - 50,
			height: maxHeight - 20,
			justifyContent: 'space-between'
		}).component();
		const titleComponent = view.modelBuilder.text().withProperties({
			value: taskMetaData.title,
			CSSStyles: {
				'font-size': '14px',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();
		const descriptionComponent = view.modelBuilder.text().withProperties({
			value: taskMetaData.description,
			CSSStyles: {
				'font-size': '13px',
				'margin': '0px'
			}
		}).component();
		const linkComponent = view.modelBuilder.hyperlink().withProperties({
			label: 'Learn more',
			url: taskMetaData.link
		}).component();
		const image = view.modelBuilder.image().withProperties({
			width: '20px',
			height: '20px',
			iconPath: taskMetaData.iconPath,
			iconHeight: '20px',
			iconWidth: '20px'
		}).component();
		labelsContainer.addItems([titleComponent, descriptionComponent, linkComponent], {
			CSSStyles: {
				'padding': '0px',
				'padding-bottom': '5px',
				'width': '200px',
				'margin': '0px',
				'color': '#006ab1'
			}
		});
		iconContainer.addItem(image, {
			CSSStyles: {
				'padding-top': '10px',
				'padding-right': '10px'
			}
		});
		iconContainer.addItem(labelsContainer, {
			CSSStyles: {
				'padding-top': '5px',
				'padding-right': '10px'
			}
		});
		mainContainer.addItems([iconContainer], {
			CSSStyles: {
				'padding': '10px',
				'border-radius': '5px',
				'border-color': '#f2f2f2',
				'border': '1px solid'
			}
		});
		mainContainer.onDidClick(async () => {
			if (mainContainer.enabled && taskMetaData.command) {
				await vscode.commands.executeCommand(taskMetaData.command);
			}
		});
		return mainContainer;
	}
}
