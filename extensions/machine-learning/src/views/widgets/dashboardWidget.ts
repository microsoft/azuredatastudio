/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ApiWrapper } from '../../common/apiWrapper';
import * as path from 'path';
import * as constants from '../../common/constants';
import { PredictService } from '../../prediction/predictService';

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
	constructor(private _apiWrapper: ApiWrapper, private _root: string, private _predictService: PredictService) {
	}

	public register(): Promise<void> {
		return new Promise<void>(resolve => {
			this._apiWrapper.registerWidget('mls.dashboard', async (view) => {
				const container = view.modelBuilder.flexContainer().withLayout({
					flexFlow: 'column',
					width: '100%',
					height: '100%'
				}).component();
				const header = this.createHeader(view);
				const tasksContainer = await this.createTasks(view);
				const footerContainer = this.createFooter(view);
				container.addItem(header, {
					CSSStyles: {
						'background-image': `url(${vscode.Uri.file(this.asAbsolutePath('images/background.svg'))})`,
						'background-repeat': 'no-repeat',
						'background-position': 'bottom',
						'width': `${maxWidth}px`,
						'height': '330px',
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
			value: constants.dashboardTitle,
			CSSStyles: {
				'font-size': '36px',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();
		const descComponent = view.modelBuilder.text().withProperties({
			value: constants.dashboardDesc,
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
				'padding-left': '45px',
			}
		});

		return footerContainer;
	}

	private createVideoLinkContainers(view: azdata.ModelView, links: IActionMetadata[]): azdata.Component {
		const maxWidth = 400;
		const videosContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth,
			height: '300px',
		}).component();

		links.forEach(link => {
			const videoContainer = this.createVideoLink(view, link);

			videosContainer.addItem(videoContainer);
		});

		return videosContainer;
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
		const viewPanelStyle = {
			'padding': '0px',
			'padding-right': '5px',
			'padding-top': '20px',
			'height': '200px',
			'margin': '0px'
		};

		linksContainer.addItems([titleComponent], {
			CSSStyles: {
				'padding': '0px',
				'padding-right': '5px',
				'padding-top': '10px',
				'height': '10px',
				'margin': '0px'
			}
		});
		const videosContainer = this.createVideoLinkContainers(view, [
			{
				iconPath: { light: 'images/aiMlSqlServer.svg', dark: 'images/aiMlSqlServer.svg' },
				description: 'Artificial intelligence and machine learning with SQL Server 2019',
				link: 'https://www.youtube.com/watch?v=sE99cSoFOHs'
			},
			{
				iconPath: { light: 'images/sqlServerMl.svg', dark: 'images/sqlServerMl.svg' },
				description: 'SQL Server Machine Learning Services',
				link: 'https://www.youtube.com/watch?v=R4GCBoxADyQ'
			}
		]);

		linksContainer.addItem(videosContainer, {
			CSSStyles: viewPanelStyle
		});

		const moreVideosContainer = this.createVideoLinkContainers(view, [
			{
				iconPath: { light: 'images/notebooksIntro.svg', dark: 'images/notebooksIntro.svg' },
				description: 'Introduction to Azure Data Studio Notebooks',
				link: 'https://www.youtube.com/watch?v=Nt4kIHQ0IOc'
			}
		]);

		this.addShowMorePanel(view, linksContainer, moreVideosContainer, { 'padding-left': '5px' }, viewPanelStyle);
		return linksContainer;
	}

	private addShowMorePanel(view: azdata.ModelView, parentPanel: azdata.FlexContainer, morePanel: azdata.Component, moreButtonStyle: { [key: string]: string }, morePanelStyle: { [key: string]: string }): azdata.Component {
		const maxWidth = 100;
		const linkContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth + 10,
			justifyContent: 'flex-start'
		}).component();
		const showMoreComponent = view.modelBuilder.hyperlink().withProperties({
			label: constants.showMoreTitle
		}).component();
		const image = view.modelBuilder.image().withProperties({
			width: '10px',
			height: '10px',
			iconPath: {
				dark: this.asAbsolutePath('images/dark/showMore_inverse.svg'),
				light: this.asAbsolutePath('images/light/showMore.svg'),
			},
			iconHeight: '10px',
			iconWidth: '10px'
		}).component();
		showMoreComponent.onDidClick(() => {
			let showMore = showMoreComponent.label === constants.showMoreTitle;
			if (showMore) {
				showMoreComponent.label = constants.showLessTitle;
				image.iconPath = {
					dark: this.asAbsolutePath('images/dark/showLess_inverse.svg'),
					light: this.asAbsolutePath('images/light/showLess.svg'),
				};
				parentPanel.addItem(morePanel, {
					CSSStyles: morePanelStyle
				});
			} else {
				showMoreComponent.label = constants.showMoreTitle;
				parentPanel.removeItem(morePanel);
				image.iconPath = {
					dark: this.asAbsolutePath('images/dark/showMore_inverse.svg'),
					light: this.asAbsolutePath('images/light/showMore.svg'),
				};
			}
			showMore = !showMore;
		});
		linkContainer.addItem(showMoreComponent, {
			CSSStyles: Object.assign({}, moreButtonStyle, {
				'font-size': '12px',
				'margin': '0px',
				'color': '#006ab1',
				'padding-right': '5px'
			}
			)
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

		parentPanel.addItem(linkContainer, {
			CSSStyles: {
				'padding': '0px',
				'padding-right': '5px',
				'padding-top': '10px',
				'height': '10px',
				'margin': '0px'
			}
		});

		return showMoreComponent;
	}

	private createVideoLink(view: azdata.ModelView, linkMetaData: IActionMetadata): azdata.Component {
		const maxWidth = 150;
		const videosContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			height: maxWidth,
			justifyContent: 'flex-start'
		}).component();
		const video1Container = view.modelBuilder.divContainer().withProperties({
			clickable: true,
			width: maxWidth,
			height: '100px'
		}).component();
		const descriptionComponent = view.modelBuilder.text().withProperties({
			value: linkMetaData.description,
			width: maxWidth,
			height: '50px',
			CSSStyles: {
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
				'width': `${maxWidth}px`,
				'height': '110px',
				'background-size': `${maxWidth}px 120px`
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
		const moreLinksContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			height: '300px',
		}).component();
		const titleComponent = view.modelBuilder.text().withProperties({
			value: constants.dashboardLinksTitle,
			CSSStyles: {
				'font-size': '18px',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();

		const links = [{
			title: constants.sqlMlExtDocTitle,
			description: constants.sqlMlExtDocDesc,
			link: constants.mlExtDocLink
		}, {
			title: constants.sqlMlDocTitle,
			description: constants.sqlMlDocDesc,
			link: constants.mlDocLink
		}, {
			title: constants.sqlMlsDocTitle,
			description: constants.sqlMlsDocDesc,
			link: constants.mlsDocLink
		}];

		const moreLinks = [{
			title: constants.onnxOnEdgeOdbcDocTitle,
			description: constants.onnxOnEdgeOdbcDocDesc,
			link: constants.onnxOnEdgeDocs
		},
		{
			title: constants.sqlMlsMIDocTitle,
			description: constants.sqlMlsMIDocDesc,
			link: constants.mlsMIDocLink
		}, {
			title: constants.mlsInstallOdbcDocTitle,
			description: constants.mlsInstallOdbcDocDesc,
			link: constants.odbcDriverDocuments
		}];
		const styles = {
			'padding': '10px'
		};

		linksContainer.addItem(titleComponent, {
			CSSStyles: {
				'padding': '10px'
			}
		});

		linksContainer.addItems(links.map(l => this.createLink(view, l)), {
			CSSStyles: styles
		});
		moreLinksContainer.addItems(moreLinks.map(l => this.createLink(view, l)));

		this.addShowMorePanel(view, linksContainer, moreLinksContainer, { 'padding-left': '10px' }, styles);

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
				'font-size': '12px',
				'margin': '0px'
			}
		}).component();
		const linkContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth + 10,
			justifyContent: 'flex-start'
		}).component();
		const linkComponent = view.modelBuilder.hyperlink().withProperties({
			label: linkMetaData.title,
			url: linkMetaData.link,
			CSSStyles: {
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
				'margin': '0px',
				'color': '#006ab1'
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

	private async createTasks(view: azdata.ModelView): Promise<azdata.Component> {
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
			link: 'https://go.microsoft.com/fwlink/?linkid=2129795',
			command: constants.mlsPredictModelCommand
		};
		const predictionButton = this.createTaskButton(view, predictionMetadata);
		const importMetadata: IActionMetadata = {
			title: constants.importModelTitle,
			description: constants.importModelDesc,
			iconPath: {
				dark: this.asAbsolutePath('images/manageModels.svg'),
				light: this.asAbsolutePath('images/manageModels.svg'),
			},
			link: 'https://go.microsoft.com/fwlink/?linkid=2129796',
			command: constants.mlManageModelsCommand
		};
		const importModelsButton = this.createTaskButton(view, importMetadata);
		const notebookMetadata: IActionMetadata = {
			title: constants.createNotebookTitle,
			description: constants.createNotebookDesc,
			iconPath: {
				dark: this.asAbsolutePath('images/createNotebook.svg'),
				light: this.asAbsolutePath('images/createNotebook.svg'),
			},
			link: 'https://go.microsoft.com/fwlink/?linkid=2129920',
			command: constants.notebookCommandNew
		};
		const notebookModelsButton = this.createTaskButton(view, notebookMetadata);
		tasksContainer.addItems([predictionButton, importModelsButton, notebookModelsButton], {
			CSSStyles: {
				'padding': '10px'
			}
		});
		if (!await this._predictService.serverSupportOnnxModel()) {
			console.log(constants.onnxNotSupportedError);
		}

		return tasksContainer;
	}

	private createTaskButton(view: azdata.ModelView, taskMetaData: IActionMetadata): azdata.Component {
		const maxHeight = 116;
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
			label: constants.learnMoreTitle,
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
				await this._apiWrapper.executeCommand(taskMetaData.command);
			}
		});
		return mainContainer;
	}
}
