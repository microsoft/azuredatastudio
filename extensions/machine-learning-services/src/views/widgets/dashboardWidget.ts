/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ApiWrapper } from '../../common/apiWrapper';
import * as path from 'path';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';

interface IActionMetadata {
	title?: string,
	description?: string,
	link?: string,
	iconPath?: { light: string | vscode.Uri; dark: string | vscode.Uri },
	command?: string;
}

const maxWidth = 800;
const headerMaxHeight = 200;
export class DashboardWidget {

	/**
	 * Creates new instance of dashboard
	 */
	constructor(private _apiWrapper: ApiWrapper, private _root: string) {
	}

	public register(): void {
		this._apiWrapper.registerWidget('mls.dashboard', async (view) => {
			const container = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '100%',
				height: '100%'
			}).component();
			const header = this.createHeader(view);
			const tasksContainer = this.createTasks(view);
			const footerContainer = this.createFooter(view);
			container.addItem(header, {
				CSSStyles: {
					'background-image': `url(${vscode.Uri.file(this.asAbsolutePath('images/background.svg'))})`,
					'background-repeat': 'no-repeat',
					'background-position': 'top',
					'width': `${maxWidth}px`,
					'height': '130px',
					'background-size': `${maxWidth}px ${headerMaxHeight}px`
				}
			});
			container.addItem(tasksContainer, {
				CSSStyles: {
					'width': `${maxWidth}px`,
					'height': '150px',
				}
			});
			container.addItem(footerContainer, {
				CSSStyles: {
					'width': `${maxWidth}px`,
					'height': '500px',
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
		});
	}

	private createHeader(view: azdata.ModelView): azdata.Component {
		const header = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			height: headerMaxHeight,
		}).component();
		const titleComponent = view.modelBuilder.text().withProperties({
			value: constants.dashboardTitle,
			CSSStyles: {
				'font-size': '36px',
				//'color': '#333333',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();
		const descComponent = view.modelBuilder.text().withProperties({
			value: constants.dashboardDesc,
			CSSStyles: {
				'font-size': '14px',
				//'color': '#888888',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();
		header.addItems([titleComponent, descComponent], {
			CSSStyles: {
				'width': `${maxWidth}px`,
				'padding': '10px'
			}
		});

		return header;
	}

	private createFooter(view: azdata.ModelView): azdata.Component {
		const footerContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth,
			height: '500px',
			justifyContent: 'flex-start'
		}).component();
		const linksContainer = this.createLinks(view);
		const videoLinksContainer = this.createVideoLinks(view);
		footerContainer.addItem(linksContainer);
		footerContainer.addItem(videoLinksContainer, {
			CSSStyles: {
				'padding-left': '50px',
			}
		});

		return footerContainer;
	}

	private createVideoLinks(view: azdata.ModelView): azdata.Component {
		const maxWidth = 400;
		const linksContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			height: '500px',
			justifyContent: 'flex-start'
		}).component();
		const titleComponent = view.modelBuilder.text().withProperties({
			value: constants.dashboardVideoLinksTitle,
			CSSStyles: {
				'font-size': '18px',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();
		const videosContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth,
			height: '500px',
		}).component();
		const video1Container = this.createVideoLink(view, {
			iconPath: { light: 'images/video1.svg', dark: 'images/video1.svg' },
			description: 'Visualize data using SandDance',
			link: 'https://www.youtube.com/watch?v=e305wTAoLZs'
		});
		videosContainer.addItem(video1Container);
		const video2Container = this.createVideoLink(view, {
			iconPath: { light: 'images/video2.svg', dark: 'images/video2.svg' },
			description: 'How to make the best out of Microsoft Azure'
		});
		videosContainer.addItem(video2Container);

		linksContainer.addItems([titleComponent], {
			CSSStyles: {
				'padding': '0px',
				'padding-right': '5px',
				'padding-top': '10px',
				'height': '10px',
				'margin': '0px'
			}
		});
		linksContainer.addItems([videosContainer], {
			CSSStyles: {
				'padding': '0px',
				'padding-right': '5px',
				'padding-top': '10px',
				'height': '10px',
				'margin': '0px'
			}
		});
		return linksContainer;
	}

	private createVideoLink(view: azdata.ModelView, linkMetaData: IActionMetadata): azdata.Component {
		const maxWidth = 200;
		const videosContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			height: '200px',
			justifyContent: 'flex-start'
		}).component();
		const video1Container = view.modelBuilder.divContainer().withProperties({
			clickable: true,
			width: maxWidth,
			height: '100px'
		}).component();
		const descriptionComponent = view.modelBuilder.text().withProperties({
			value: linkMetaData.description,
			width: '200px',
			height: '50px',
			CSSStyles: {
				//'color': '#605E5C',
				'font-size': '12px',
				'margin': '0px'
			}
		}).component();
		video1Container.onDidClick(async () => {
			if (linkMetaData.link) {
				await this._apiWrapper.openExternal(vscode.Uri.parse(linkMetaData.link));
			}
		});
		videosContainer.addItem(video1Container, {
			CSSStyles: {
				'background-image': `url(${vscode.Uri.file(this.asAbsolutePath(<string>linkMetaData.iconPath?.light || ''))})`,
				'background-repeat': 'no-repeat',
				'background-position': 'top',
				'width': `150px`,
				'height': '110px',
				'background-size': `150px 120px`
			}
		});
		videosContainer.addItem(descriptionComponent);
		return videosContainer;
	}

	private createLinks(view: azdata.ModelView): azdata.Component {
		const maxWidth = 400;
		const linksContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			height: '500px',
		}).component();
		const titleComponent = view.modelBuilder.text().withProperties({
			value: constants.dashboardLinksTitle,
			CSSStyles: {
				'font-size': '18px',
				//'color': '#323130',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();
		let mlsLink: string;
		if (utils.isWindows()) {
			mlsLink = constants.installMlsWindowsDocs;
		} else {
			mlsLink = constants.installMlsLinuxDocs;
		}
		const mlsDocs = this.createLink(view, {
			title: constants.mlsInstallMlsDocTitle,
			description: constants.mlsInstallMlsDocDesc,
			link: mlsLink
		});
		let odbcLink: string;
		if (utils.isWindows()) {
			odbcLink = constants.odbcDriverWindowsDocuments;
		} else {
			odbcLink = constants.odbcDriverLinuxDocuments;
		}
		const rdbcDocs = this.createLink(view, {
			title: constants.mlsInstallOdbcDocTitle,
			description: constants.mlsInstallOdbcDocDesc,
			link: odbcLink
		});

		linksContainer.addItems([titleComponent, mlsDocs, rdbcDocs], {
			CSSStyles: {
				'padding': '10px'
			}
		});
		return linksContainer;
	}

	private createLink(view: azdata.ModelView, linkMetaData: IActionMetadata): azdata.Component {
		const maxHeight = 80;
		const maxWidth = 400;
		const labelsContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			height: maxHeight,
			justifyContent: 'flex-start'
		}).component();
		const descriptionComponent = view.modelBuilder.text().withProperties({
			value: linkMetaData.description,
			width: maxWidth,
			CSSStyles: {
				//'color': '#605E5C',
				'font-size': '12px',
				'margin': '0px'
			}
		}).component();
		const linkContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth,
			justifyContent: 'flex-start'
		}).component();
		const linkComponent = view.modelBuilder.hyperlink().withProperties({
			label: linkMetaData.title,
			url: linkMetaData.link,
			CSSStyles: {
				'color': '#3794ff',
				'font-size': '14px',
				'margin': '0px'
			}
		}).component();
		const image = view.modelBuilder.image().withProperties({
			width: '10px',
			height: '10px',
			iconPath: {
				dark: this.asAbsolutePath('images/linkIcon.svg'),
				light: this.asAbsolutePath('images/linkIcon.svg'),
			},
			iconHeight: '10px',
			iconWidth: '10px'
		}).component();
		linkContainer.addItem(linkComponent, {
			CSSStyles: {
				'padding': '0px',
				'padding-right': '5px',
				'height': '10px',
				'margin': '0px'
			}
		});
		linkContainer.addItem(image, {
			CSSStyles: {
				'padding': '0px',
				'padding-right': '5px',
				'padding-top': '5px',
				'height': '10px',
				'margin': '0px'
			}
		});
		labelsContainer.addItems([linkContainer, descriptionComponent], {
			CSSStyles: {
				'padding': '0px',
				'padding-top': '5px',
				'margin': '0px'
			}
		});

		return labelsContainer;
	}

	private asAbsolutePath(filePath: string): string {
		return path.join(this._root || '', filePath);
	}

	private createTasks(view: azdata.ModelView): azdata.Component {
		const tasksContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: '100%',
			height: '50px',
		}).component();
		const predictionMetadata: IActionMetadata = {
			title: constants.makePredictionTitle,
			description: constants.makePredictionDesc,
			iconPath: {
				dark: this.asAbsolutePath('images/makePredictions.svg'),
				light: this.asAbsolutePath('images/makePredictions.svg'),
			},
			link: '',
			command: constants.mlsPredictModelCommand
		};
		const predictionButton = this.createTaskButton(view, predictionMetadata);
		const importMetadata: IActionMetadata = {
			title: constants.importModelTitle,
			description: constants.importModelDesc,
			iconPath: {
				dark: this.asAbsolutePath('images/makePredictions.svg'),
				light: this.asAbsolutePath('images/makePredictions.svg'),
			},
			link: '',
			command: constants.mlImportModelCommand
		};
		const importModelsButton = this.createTaskButton(view, importMetadata);
		const notebookMetadata: IActionMetadata = {
			title: constants.createNotebookTitle,
			description: constants.createNotebookDesc,
			iconPath: {
				dark: this.asAbsolutePath('images/createNotebook.svg'),
				light: this.asAbsolutePath('images/createNotebook.svg'),
			},
			link: '',
			command: constants.notebookCommandNew
		};
		const notebookModelsButton = this.createTaskButton(view, notebookMetadata);
		tasksContainer.addItems([predictionButton, importModelsButton, notebookModelsButton], {
			CSSStyles: {
				'padding': '10px'
			}
		});

		return tasksContainer;
	}

	private createTaskButton(view: azdata.ModelView, taskMetaData: IActionMetadata): azdata.Component {
		const maxHeight = 106;
		const maxWidth = 250;
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
			height: maxHeight - 20,
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
				//'color': '#323130',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();
		const descriptionComponent = view.modelBuilder.text().withProperties({
			value: taskMetaData.description,
			CSSStyles: {
				//'color': '#605E5C',
				'font-size': '13px',
				'margin': '0px'
			}
		}).component();
		const linkComponent = view.modelBuilder.hyperlink().withProperties({
			label: constants.learnMoreTitle,
			url: taskMetaData.link,
			CSSStyles: {
				//'background-color': '#F2F2F2',
				'color': '#3794ff',
				'margin': '0px'
			}
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
				'width': '180px',
				'margin': '0px'
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
				//'background-color': '#f4f4f4',
				'padding': '10px',
				'border-radius': '5px',
				'border-color': '#f2f2f2',
				'border': '1px solid'
			}
		});
		mainContainer.onDidClick(async () => {
			if (taskMetaData.command) {
				await this._apiWrapper.executeCommand(taskMetaData.command);
			}
		});
		return mainContainer;
	}
}
