/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationContext, MigrationLocalStorage } from '../models/migrationLocalStorage';
import * as loc from '../constants/strings';
import { IconPath, IconPathHelper } from '../constants/iconPathHelper';
import { MigrationStatusDialog } from '../dialog/migrationStatus/migrationStatusDialog';
import { AdsMigrationStatus } from '../dialog/migrationStatus/migrationStatusDialogModel';
import { filterMigrations, SupportedAutoRefreshIntervals } from '../api/utils';

interface IActionMetadata {
	title?: string,
	description?: string,
	link?: string,
	iconPath?: azdata.ThemedIconPath,
	command?: string;
}

const maxWidth = 800;
const refreshFrequency: SupportedAutoRefreshIntervals = 180000;

interface StatusCard {
	container: azdata.DivContainer;
	count: azdata.TextComponent,
	textContainer?: azdata.FlexContainer,
	warningContainer?: azdata.FlexContainer,
	warningText?: azdata.TextComponent,
}

export class DashboardWidget {

	private _migrationStatusCardsContainer!: azdata.FlexContainer;
	private _migrationStatusCardLoadingContainer!: azdata.LoadingComponent;
	private _view!: azdata.ModelView;

	private _inProgressMigrationButton!: StatusCard;
	private _inProgressWarningMigrationButton!: StatusCard;
	private _successfulMigrationButton!: StatusCard;
	private _failedMigrationButton!: StatusCard;
	private _completingMigrationButton!: StatusCard;
	private _notStartedMigrationCard!: StatusCard;
	private _migrationStatusMap: Map<string, MigrationContext[]> = new Map();
	private _viewAllMigrationsButton!: azdata.ButtonComponent;

	private _autoRefreshHandle!: NodeJS.Timeout;
	private _disposables: vscode.Disposable[] = [];

	private isRefreshing: boolean = false;

	constructor() {
	}

	private async getCurrentMigrations(): Promise<MigrationContext[]> {
		const connectionId = (await azdata.connection.getCurrentConnection()).connectionId;
		return this._migrationStatusMap.get(connectionId)!;
	}

	private async setCurrentMigrations(migrations: MigrationContext[]): Promise<void> {
		const connectionId = (await azdata.connection.getCurrentConnection()).connectionId;
		this._migrationStatusMap.set(connectionId, migrations);
	}

	public register(): void {
		azdata.ui.registerModelViewProvider('migration.dashboard', async (view) => {
			this._view = view;

			const container = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '100%',
				height: '100%'
			}).component();

			const header = this.createHeader(view);
			container.addItem(header, {
				CSSStyles: {
					'background-image': `url(${vscode.Uri.file(<string>IconPathHelper.migrationDashboardHeaderBackground.light)})`,
					'width': '870px',
					'height': '260px',
					'background-size': '100%',
				}
			});

			const tasksContainer = await this.createTasks(view);
			header.addItem(tasksContainer, {
				CSSStyles: {
					'width': `${maxWidth}px`,
					'height': '150px',
				}
			});
			container.addItem(await this.createFooter(view), {
				CSSStyles: {
					'margin-top': '20px'
				}
			});
			this._disposables.push(this._view.onClosed(e => {
				clearInterval(this._autoRefreshHandle);
				this._disposables.forEach(
					d => { try { d.dispose(); } catch { } });
			}));

			await view.initializeModel(container);
			this.refreshMigrations();
		});
	}

	private createHeader(view: azdata.ModelView): azdata.FlexContainer {
		const header = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
		}).component();
		const titleComponent = view.modelBuilder.text().withProps({
			value: loc.DASHBOARD_TITLE,
			width: '750px',
			CSSStyles: {
				'font-size': '36px',
				'margin-bottom': '5px',
			}
		}).component();

		this.setAutoRefresh(refreshFrequency);

		const container = view.modelBuilder.flexContainer().withItems([
			titleComponent,
		]).component();

		const descComponent = view.modelBuilder.text().withProps({
			value: loc.DASHBOARD_DESCRIPTION,
			CSSStyles: {
				'font-size': '12px',
				'margin-top': '10px',
			}
		}).component();
		header.addItems([container, descComponent], {
			CSSStyles: {
				'width': `${maxWidth}px`,
				'padding-left': '20px'
			}
		});
		return header;
	}

	private async createTasks(view: azdata.ModelView): Promise<azdata.Component> {
		const tasksContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: '100%',
			height: '50px',
		}).component();

		const migrateButtonMetadata: IActionMetadata = {
			title: loc.DASHBOARD_MIGRATE_TASK_BUTTON_TITLE,
			description: loc.DASHBOARD_MIGRATE_TASK_BUTTON_DESCRIPTION,
			iconPath: IconPathHelper.sqlMigrationLogo,
			command: 'sqlmigration.start'
		};

		const preRequisiteListTitle = view.modelBuilder.text().withProps({
			value: loc.PRE_REQ_TITLE,
			CSSStyles: {
				'font-size': '14px',
				'padding-left': '15px',
				'margin-bottom': '-5px'
			}
		}).component();

		const migrateButton = this.createTaskButton(view, migrateButtonMetadata);

		const points = `•	${loc.PRE_REQ_1}
•	${loc.PRE_REQ_2}
•	${loc.PRE_REQ_3}`;

		const preRequisiteListElement = view.modelBuilder.text().withProps({
			value: points,
			CSSStyles: {
				'padding-left': '15px',
				'margin-bottom': '5px',
				'margin-top': '10px'
			}
		}).component();

		const preRequisiteLearnMoreLink = view.modelBuilder.hyperlink().withProps({
			label: loc.LEARN_MORE,
			ariaLabel: loc.LEARN_MORE_ABOUT_PRE_REQS,
			url: 'https://aka.ms/azuresqlmigrationextension',
			CSSStyles: {
				'padding-left': '10px'
			}
		}).component();

		const preReqContainer = view.modelBuilder.flexContainer().withItems([
			preRequisiteListTitle,
			preRequisiteListElement
		]).withLayout({
			flexFlow: 'column'
		}).component();

		preReqContainer.addItem(preRequisiteLearnMoreLink, {
			CSSStyles: {
				'padding-left': '10px'
			}
		});

		tasksContainer.addItem(migrateButton, {
			CSSStyles: {
				'margin-top': '20px',
				'padding': '10px'
			}
		});
		tasksContainer.addItems([preReqContainer], {
			CSSStyles: {
				'padding': '10px'
			}
		});

		return tasksContainer;
	}

	private createTaskButton(view: azdata.ModelView, taskMetaData: IActionMetadata): azdata.Component {
		const maxHeight: number = 84;
		const maxWidth: number = 236;
		const buttonContainer = view.modelBuilder.button().withProps({
			buttonType: azdata.ButtonType.Informational,
			description: taskMetaData.description,
			height: maxHeight,
			iconHeight: 32,
			iconPath: taskMetaData.iconPath,
			iconWidth: 32,
			label: taskMetaData.title,
			title: taskMetaData.title,
			width: maxWidth,
			CSSStyles: {
				'border': '1px solid'
			}
		}).component();
		this._disposables.push(buttonContainer.onDidClick(async () => {
			if (taskMetaData.command) {
				await vscode.commands.executeCommand(taskMetaData.command);
			}
		}));
		return view.modelBuilder.divContainer().withItems([buttonContainer]).component();
	}

	private setAutoRefresh(interval: SupportedAutoRefreshIntervals): void {
		const classVariable = this;
		clearInterval(this._autoRefreshHandle);
		if (interval !== -1) {
			this._autoRefreshHandle = setInterval(async function () { await classVariable.refreshMigrations(); }, interval);
		}
	}

	private async refreshMigrations(): Promise<void> {
		if (this.isRefreshing) {
			return;
		}

		this.isRefreshing = true;
		this._viewAllMigrationsButton.enabled = false;
		this._migrationStatusCardLoadingContainer.loading = true;
		try {
			this.setCurrentMigrations(await this.getMigrations());
			const migrations = await this.getCurrentMigrations();
			const inProgressMigrations = filterMigrations(migrations, AdsMigrationStatus.ONGOING);
			let warningCount = 0;
			for (let i = 0; i < inProgressMigrations.length; i++) {
				if (
					inProgressMigrations[i].asyncOperationResult?.error?.message ||
					inProgressMigrations[i].migrationContext.properties.migrationFailureError?.message ||
					inProgressMigrations[i].migrationContext.properties.migrationStatusDetails?.fileUploadBlockingErrors ||
					inProgressMigrations[i].migrationContext.properties.migrationStatusDetails?.restoreBlockingReason
				) {
					warningCount += 1;
				}
			}
			if (warningCount > 0) {
				this._inProgressWarningMigrationButton.warningText!.value = loc.MIGRATION_INPROGRESS_WARNING(warningCount);
				this._inProgressMigrationButton.container.display = 'none';
				this._inProgressWarningMigrationButton.container.display = '';
			} else {
				this._inProgressMigrationButton.container.display = '';
				this._inProgressWarningMigrationButton.container.display = 'none';
			}

			this._inProgressMigrationButton.count.value = inProgressMigrations.length.toString();
			this._inProgressWarningMigrationButton.count.value = inProgressMigrations.length.toString();

			const successfulMigration = filterMigrations(migrations, AdsMigrationStatus.SUCCEEDED);

			this._successfulMigrationButton.count.value = successfulMigration.length.toString();

			const failedMigrations = filterMigrations(migrations, AdsMigrationStatus.FAILED);
			const failedCount = failedMigrations.length;
			if (failedCount > 0) {
				this._failedMigrationButton.container.display = '';
				this._failedMigrationButton.count.value = failedCount.toString();
			} else {
				this._failedMigrationButton.container.display = 'none';
			}

			const completingCutoverMigrations = filterMigrations(migrations, AdsMigrationStatus.COMPLETING);
			const cutoverCount = completingCutoverMigrations.length;
			if (cutoverCount > 0) {
				this._completingMigrationButton.container.display = '';
				this._completingMigrationButton.count.value = cutoverCount.toString();
			} else {
				this._completingMigrationButton.container.display = 'none';
			}

		} catch (error) {
			console.log(error);
		} finally {
			this.isRefreshing = false;
			this._migrationStatusCardLoadingContainer.loading = false;
			this._viewAllMigrationsButton.enabled = true;
		}

	}

	private async getMigrations(): Promise<MigrationContext[]> {
		const currentConnection = (await azdata.connection.getCurrentConnection());
		return await MigrationLocalStorage.getMigrationsBySourceConnections(currentConnection, true);
	}

	private createStatusCard(
		cardIconPath: IconPath,
		cardTitle: string,
	): StatusCard {

		const cardTitleText = this._view.modelBuilder.text().withProps({ value: cardTitle }).withProps({
			CSSStyles: {
				'height': '23px',
				'margin-top': '15px',
				'margin-bottom': '0px',
				'width': '300px',
				'font-size': '14px',
				'font-weight': 'bold'
			}
		}).component();

		const cardCount = this._view.modelBuilder.text().withProps({
			value: '0',
			CSSStyles: {
				'font-size': '28px',
				'line-height': '36px',
				'margin-top': '4px'
			}
		}).component();

		const flex = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'width': '400px',
				'height': '50px'
			}
		}).component();

		const img = this._view.modelBuilder.image().withProps({
			iconPath: cardIconPath!.light,
			iconHeight: 24,
			iconWidth: 24,
			width: 64,
			height: 30,
			CSSStyles: {
				'margin-top': '10px'
			}
		}).component();

		flex.addItem(img, {
			flex: '0'
		});
		flex.addItem(cardTitleText, {
			flex: '0',
			CSSStyles: {
				'width': '300px'
			}
		});
		flex.addItem(cardCount, {
			flex: '0'
		});

		const compositeButton = this._view.modelBuilder.divContainer().withItems([flex]).withProps({
			ariaRole: 'button',
			ariaLabel: loc.SHOW_STATUS,
			clickable: true,
			CSSStyles: {
				'width': '400px',
				'border': '1px solid',
				'margin-top': '10px',
				'height': '50px'
			}
		}).component();
		return {
			container: compositeButton,
			count: cardCount
		};
	}

	private createStatusWithSubtextCard(
		cardIconPath: IconPath,
		cardTitle: string,
		cardDescription: string
	): StatusCard {

		const cardTitleText = this._view.modelBuilder.text().withProps({ value: cardTitle }).withProps({
			CSSStyles: {
				'height': '23px',
				'margin-top': '15px',
				'margin-bottom': '0px',
				'width': '300px',
				'font-size': '14px',
			}
		}).component();

		const cardDescriptionWarning = this._view.modelBuilder.image().withProps({
			iconPath: IconPathHelper.warning,
			iconWidth: 12,
			iconHeight: 12,
			width: 12,
			height: 17
		}).component();

		const cardDescriptionText = this._view.modelBuilder.text().withProps({ value: cardDescription }).withProps({
			CSSStyles: {
				'height': '13px',
				'margin-top': '0px',
				'margin-bottom': '0px',
				'width': '250px',
				'font-height': '13px',
				'margin': '0 0 0 4px'
			}
		}).component();

		const subTextContainer = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'justify-content': 'left',
			}
		}).component();

		subTextContainer.addItem(cardDescriptionWarning, {
			flex: '0 0 auto'
		});

		subTextContainer.addItem(cardDescriptionText, {
			flex: '0 0 auto'
		});

		const cardCount = this._view.modelBuilder.text().withProps({
			value: '0',
			CSSStyles: {
				'font-size': '28px',
				'line-height': '28px',
				'margin-top': '15px'
			}
		}).component();

		const flexContainer = this._view.modelBuilder.flexContainer().withItems([
			cardTitleText,
			subTextContainer
		]).withLayout({
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				'width': '300px',
			}
		}).component();

		const flex = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'width': '400px',
				'height': '70px',
			}
		}).component();

		const img = this._view.modelBuilder.image().withProps({
			iconPath: cardIconPath!.light,
			iconHeight: 24,
			iconWidth: 24,
			width: 64,
			height: 30,
			CSSStyles: {
				'margin-top': '20px'
			}
		}).component();

		flex.addItem(img, {
			flex: '0'
		});
		flex.addItem(flexContainer, {
			flex: '0',
			CSSStyles: {
				'width': '300px'
			}
		});
		flex.addItem(cardCount, {
			flex: '0'
		});

		const compositeButton = this._view.modelBuilder.divContainer().withItems([flex]).withProps({
			ariaRole: 'button',
			ariaLabel: 'show status',
			clickable: true,
			CSSStyles: {
				'width': '400px',
				'height': '70px',
				'margin-top': '10px',
				'border': '1px solid'
			}
		}).component();
		return {
			container: compositeButton,
			count: cardCount,
			textContainer: flexContainer,
			warningContainer: subTextContainer,
			warningText: cardDescriptionText
		};
	}

	private async createFooter(view: azdata.ModelView): Promise<azdata.Component> {
		const footerContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth,
			height: '500px',
			justifyContent: 'flex-start'
		}).component();
		const statusContainer = await this.createMigrationStatusContainer(view);
		const videoLinksContainer = this.createVideoLinks(view);
		footerContainer.addItem(statusContainer);
		footerContainer.addItem(videoLinksContainer, {
			CSSStyles: {
				'padding-left': '10px',
			}
		});

		return footerContainer;
	}

	private async createMigrationStatusContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const statusContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '400px',
			height: '350px',
			justifyContent: 'flex-start',
		}).withProps({
			CSSStyles: {
				'border': '1px solid',
				'padding': '15px'
			}
		}).component();

		const statusContainerTitle = view.modelBuilder.text().withProps({
			value: loc.DATABASE_MIGRATION_STATUS,
			CSSStyles: {
				'font-size': '14px',
				'font-weight': 'bold',
				'margin': '0px',
				'width': '290px'
			}
		}).component();

		this._viewAllMigrationsButton = view.modelBuilder.hyperlink().withProps({
			label: loc.VIEW_ALL,
			url: '',
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		this._disposables.push(this._viewAllMigrationsButton.onDidClick(async (e) => {
			const migrationStatus = await this.getCurrentMigrations();
			new MigrationStatusDialog(migrationStatus ? migrationStatus : await this.getMigrations(), AdsMigrationStatus.ALL).initialize();
		}));

		const refreshButton = view.modelBuilder.hyperlink().withProps({
			label: loc.REFRESH,
			url: '',
			ariaRole: 'button',
			CSSStyles: {
				'text-align': 'right',
				'font-size': '13px'
			}
		}).component();

		this._disposables.push(refreshButton.onDidClick(async (e) => {
			refreshButton.enabled = false;
			await this.refreshMigrations();
			refreshButton.enabled = true;
		}));

		const buttonContainer = view.modelBuilder.flexContainer().withLayout({
			justifyContent: 'flex-end',
		}).component();

		buttonContainer.addItem(this._viewAllMigrationsButton, {
			flex: 'auto',
			CSSStyles: {
				'border-right': '1px solid ',
				'width': '40px',
			}
		});

		buttonContainer.addItem(refreshButton, {
			flex: 'auto',
			CSSStyles: {
				'margin-left': '5px',
				'width': '25px'
			}
		});

		const header = view.modelBuilder.flexContainer().withItems(
			[
				statusContainerTitle,
				buttonContainer
			]
		).withLayout({
			flexFlow: 'row'
		}).component();

		this._migrationStatusCardsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();

		this._inProgressMigrationButton = this.createStatusCard(
			IconPathHelper.inProgressMigration,
			loc.MIGRATION_IN_PROGRESS
		);
		this._disposables.push(this._inProgressMigrationButton.container.onDidClick(async (e) => {
			const dialog = new MigrationStatusDialog(await this.getCurrentMigrations(), AdsMigrationStatus.ONGOING);
			dialog.initialize();
		}));

		this._migrationStatusCardsContainer.addItem(
			this._inProgressMigrationButton.container
		);

		this._inProgressWarningMigrationButton = this.createStatusWithSubtextCard(
			IconPathHelper.inProgressMigration,
			loc.MIGRATION_IN_PROGRESS,
			''
		);
		this._disposables.push(this._inProgressWarningMigrationButton.container.onDidClick(async (e) => {
			const dialog = new MigrationStatusDialog(await this.getCurrentMigrations(), AdsMigrationStatus.ONGOING);
			dialog.initialize();
		}));

		this._migrationStatusCardsContainer.addItem(
			this._inProgressWarningMigrationButton.container
		);

		this._successfulMigrationButton = this.createStatusCard(
			IconPathHelper.completedMigration,
			loc.MIGRATION_COMPLETED
		);
		this._disposables.push(this._successfulMigrationButton.container.onDidClick(async (e) => {
			const dialog = new MigrationStatusDialog(await this.getCurrentMigrations(), AdsMigrationStatus.SUCCEEDED);
			dialog.initialize();
		}));
		this._migrationStatusCardsContainer.addItem(
			this._successfulMigrationButton.container
		);


		this._completingMigrationButton = this.createStatusCard(
			IconPathHelper.completingCutover,
			loc.MIGRATION_CUTOVER_CARD
		);
		this._disposables.push(this._completingMigrationButton.container.onDidClick(async (e) => {
			const dialog = new MigrationStatusDialog(await this.getCurrentMigrations(), AdsMigrationStatus.COMPLETING);
			dialog.initialize();
		}));
		this._migrationStatusCardsContainer.addItem(
			this._completingMigrationButton.container
		);

		this._failedMigrationButton = this.createStatusCard(
			IconPathHelper.error,
			loc.MIGRATION_FAILED
		);
		this._disposables.push(this._failedMigrationButton.container.onDidClick(async (e) => {
			const dialog = new MigrationStatusDialog(await this.getCurrentMigrations(), AdsMigrationStatus.FAILED);
			dialog.initialize();
		}));
		this._migrationStatusCardsContainer.addItem(
			this._failedMigrationButton.container
		);

		this._notStartedMigrationCard = this.createStatusCard(
			IconPathHelper.notStartedMigration,
			loc.MIGRATION_NOT_STARTED
		);
		this._disposables.push(this._notStartedMigrationCard.container.onDidClick((e) => {
			vscode.window.showInformationMessage('Feature coming soon');
		}));

		this._migrationStatusCardLoadingContainer = view.modelBuilder.loadingComponent().withItem(this._migrationStatusCardsContainer).component();

		statusContainer.addItem(
			header, {
			CSSStyles: {
				'padding': '0px',
				'padding-right': '5px',
				'padding-top': '10px',
				'height': '10px',
				'margin': '0px'
			}
		}
		);

		statusContainer.addItem(this._migrationStatusCardLoadingContainer, {
			CSSStyles: {
				'margin-top': '30px'
			}
		});

		return statusContainer;
	}

	private createVideoLinks(view: azdata.ModelView): azdata.Component {
		const linksContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '400px',
			height: '350px',
			justifyContent: 'flex-start',
		}).withProps({
			CSSStyles: {
				'border': '1px solid',
				'padding': '15px'
			}
		}).component();
		const titleComponent = view.modelBuilder.text().withProps({
			value: loc.HELP_TITLE,
			CSSStyles: {
				'font-size': '18px',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();

		linksContainer.addItems([titleComponent], {
			CSSStyles: {
				'padding': '0px',
				'padding-right': '5px',
				'padding-top': '10px',
				'height': '10px',
				'margin': '0px'
			}
		});

		const links = [{
			title: loc.HELP_LINK1_TITLE,
			description: loc.HELP_LINK1_DESCRIPTION,
			link: 'https://docs.microsoft.com/azure/azure-sql/migration-guides/managed-instance/sql-server-to-sql-managed-instance-assessment-rules'
		}];

		const styles = {
			'margin-top': '10px',
			'padding': '10px 10px 10px 0'
		};
		linksContainer.addItems(links.map(l => this.createLink(view, l)), {
			CSSStyles: styles
		});

		const videosContainer = this.createVideoLinkContainers(view, [
		]);
		const viewPanelStyle = {
			'padding': '10px 5px 10px 10px',
			'margin-top': '-15px'
		};
		linksContainer.addItem(videosContainer, {
			CSSStyles: viewPanelStyle
		});

		return linksContainer;
	}

	private createLink(view: azdata.ModelView, linkMetaData: IActionMetadata): azdata.Component {
		const maxWidth = 400;
		const labelsContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			justifyContent: 'flex-start'
		}).component();
		const descriptionComponent = view.modelBuilder.text().withProps({
			value: linkMetaData.description,
			width: maxWidth,
			CSSStyles: {
				'font-size': '12px',
				'line-height': '16px',
				'margin': '0px'
			}
		}).component();
		const linkContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth + 10,
			justifyContent: 'flex-start'
		}).component();
		const linkComponent = view.modelBuilder.hyperlink().withProps({
			label: linkMetaData.title!,
			url: linkMetaData.link!,
			showLinkIcon: true,
			CSSStyles: {
				'font-size': '14px',
				'margin': '0px'
			}
		}).component();
		linkContainer.addItem(linkComponent, {
			CSSStyles: {
				'font-size': '14px',
				'line-height': '18px',
				'padding': '0 5px 0 0',
			}
		});
		labelsContainer.addItems([linkContainer, descriptionComponent], {
			CSSStyles: {
				'padding': '5px 0 0 0',
			}
		});

		return labelsContainer;
	}

	private createVideoLinkContainers(view: azdata.ModelView, links: IActionMetadata[]): azdata.Component {
		const maxWidth = 400;
		const videosContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth,
		}).component();
		links.forEach(link => {
			const videoContainer = this.createVideoLink(view, link);
			videosContainer.addItem(videoContainer);
		});
		return videosContainer;
	}

	private createVideoLink(view: azdata.ModelView, linkMetaData: IActionMetadata): azdata.Component {
		const maxWidth = 150;
		const videosContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			justifyContent: 'flex-start'
		}).component();
		const video1Container = view.modelBuilder.divContainer().withProps({
			clickable: true,
			width: maxWidth,
			height: '100px'
		}).component();
		const descriptionComponent = view.modelBuilder.text().withProps({
			value: linkMetaData.description,
			width: maxWidth,
			height: '50px',
			CSSStyles: {
				'font-size': '13px',
				'margin': '0px'
			}
		}).component();
		this._disposables.push(video1Container.onDidClick(async () => {
			if (linkMetaData.link) {
				await vscode.env.openExternal(vscode.Uri.parse(linkMetaData.link));
			}
		}));
		videosContainer.addItem(video1Container, {
			CSSStyles: {
				'background-image': `url(${vscode.Uri.file(<string>linkMetaData.iconPath?.light)})`,
				'background-repeat': 'no-repeat',
				'background-position': 'top',
				'width': `${maxWidth}px`,
				'height': '104px',
				'background-size': `${maxWidth}px 120px`
			}
		});
		videosContainer.addItem(descriptionComponent);
		return videosContainer;
	}
}
