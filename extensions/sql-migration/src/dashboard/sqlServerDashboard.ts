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
import * as styles from '../constants/styles';

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
					'background-image': `
						url(${vscode.Uri.file(<string>IconPathHelper.migrationDashboardHeaderBackground.light)}),
						linear-gradient(0deg, rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0) 100%)
					`,
					'background-repeat': 'no-repeat',
					'background-position': '91.06% 100%',
					'margin-bottom': '20px'
				}
			});

			const tasksContainer = await this.createTasks(view);
			header.addItem(tasksContainer, {
				CSSStyles: {
					'width': `${maxWidth}px`,
					'margin': '24px'
				}
			});
			container.addItem(await this.createFooter(view), {
				CSSStyles: {
					'margin': '0 24px'
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
		this.setAutoRefresh(refreshFrequency);

		const header = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
		}).component();
		const titleComponent = view.modelBuilder.text().withProps({
			value: loc.DASHBOARD_TITLE,
			width: '750px',
			CSSStyles: {
				...styles.DASHBOARD_TITLE_CSS
			}
		}).component();

		const descriptionComponent = view.modelBuilder.text().withProps({
			value: loc.DASHBOARD_DESCRIPTION,
			CSSStyles: {
				...styles.NOTE_CSS
			}
		}).component();
		header.addItems([titleComponent, descriptionComponent], {
			CSSStyles: {
				'width': `${maxWidth}px`,
				'padding-left': '24px'
			}
		});
		return header;
	}

	private async createTasks(view: azdata.ModelView): Promise<azdata.Component> {
		const tasksContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: '100%',
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
				...styles.BODY_CSS,
				'padding-left': '16px',
				'margin-bottom': '4px',
			}
		}).component();

		const migrateButton = this.createTaskButton(view, migrateButtonMetadata);

		const points = `•	${loc.PRE_REQ_1}
•	${loc.PRE_REQ_2}
•	${loc.PRE_REQ_3}`;

		const preRequisiteListElement = view.modelBuilder.text().withProps({
			value: points,
			CSSStyles: {
				'padding-left': '16px',
				'margin-bottom': '4px',
				'margin-top': '8px',
				...styles.SMALL_NOTE_CSS
			}
		}).component();

		const preRequisiteLearnMoreLink = view.modelBuilder.hyperlink().withProps({
			label: loc.LEARN_MORE,
			ariaLabel: loc.LEARN_MORE_ABOUT_PRE_REQS,
			url: 'https://aka.ms/azuresqlmigrationextension',
			CSSStyles: {
				'padding-left': '8px'
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
				'padding-left': '8px'
			}
		});

		tasksContainer.addItem(migrateButton, {});
		tasksContainer.addItems([preReqContainer], {
			CSSStyles: {
				'margin-left': '8px'
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
		hasSubtext: boolean = false
	): StatusCard {
		const buttonWidth = '400px';
		const buttonHeight = hasSubtext ? '70px' : '50px';
		const statusCard = this._view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'width': buttonWidth,
					'height': buttonHeight,
					'align-items': 'center',
				}
			}).component();

		const statusIcon = this._view.modelBuilder.image().withProps({
			iconPath: cardIconPath!.light,
			iconHeight: 24,
			iconWidth: 24,
			height: 32,
			CSSStyles: {
				'margin': '0 8px'
			}
		}).component();

		const textContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		const cardTitleText = this._view.modelBuilder.text().withProps({ value: cardTitle }).withProps({
			CSSStyles: {
				...styles.SECTION_HEADER_CSS,
				'width': '240px'
			}
		}).component();
		textContainer.addItem(cardTitleText);

		const cardCount = this._view.modelBuilder.text().withProps({
			value: '0',
			CSSStyles: {
				...styles.BIG_NUMBER_CSS,
				'margin': '0 0 0 8px',
				'text-align': 'center',
			}
		}).component();

		let warningContainer;
		let warningText;
		if (hasSubtext) {
			const warningIcon = this._view.modelBuilder.image().withProps({
				iconPath: IconPathHelper.warning,
				iconWidth: 12,
				iconHeight: 12,
				width: 12,
				height: 18
			}).component();

			const warningDescription = '';
			warningText = this._view.modelBuilder.text().withProps({ value: warningDescription }).withProps({
				CSSStyles: {
					...styles.BODY_CSS,
					'padding-left': '8px',
				}
			}).component();

			warningContainer = this._view.modelBuilder.flexContainer().withItems([
				warningIcon,
				warningText
			], {
				flex: '0 0 auto'
			}).withProps({
				CSSStyles: {
					'align-items': 'center'
				}
			}).component();

			textContainer.addItem(warningContainer);
		}

		statusCard.addItems([
			statusIcon,
			textContainer,
			cardCount,
		]);

		const compositeButton = this._view.modelBuilder.divContainer()
			.withItems([statusCard])
			.withProps({
				ariaRole: 'button',
				ariaLabel: loc.SHOW_STATUS,
				clickable: true,
				CSSStyles: {
					'width': buttonWidth,
					'height': buttonHeight,
					'margin-bottom': '16px',
					'border': '1px solid',
				}
			}).component();
		return {
			container: compositeButton,
			count: cardCount,
			textContainer: textContainer,
			warningContainer: warningContainer,
			warningText: warningText
		};
	}

	private async createFooter(view: azdata.ModelView): Promise<azdata.Component> {
		const footerContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth,
			justifyContent: 'flex-start'
		}).component();
		const statusContainer = await this.createMigrationStatusContainer(view);
		const videoLinksContainer = this.createVideoLinks(view);
		footerContainer.addItem(statusContainer);
		footerContainer.addItem(videoLinksContainer, {
			CSSStyles: {
				'padding-left': '8px',
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
				'padding': '16px'
			}
		}).component();

		const statusContainerTitle = view.modelBuilder.text().withProps({
			value: loc.DATABASE_MIGRATION_STATUS,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS
			}
		}).component();

		this._viewAllMigrationsButton = view.modelBuilder.hyperlink().withProps({
			label: loc.VIEW_ALL,
			url: '',
			CSSStyles: {
				...styles.BODY_CSS
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
				...styles.BODY_CSS,
				'text-align': 'right',
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
			CSSStyles: {
				'padding-right': '8px',
				'border-right': '1px solid',
			}
		});

		buttonContainer.addItem(refreshButton, {
			CSSStyles: {
				'padding-left': '8px',
			}
		});

		const addAccountImage = view.modelBuilder.image().withProps({
			iconPath: IconPathHelper.addAzureAccount,
			iconHeight: 100,
			iconWidth: 100,
			width: 96,
			height: 96,
			CSSStyles: {
				'opacity': '50%',
				'margin': '20% auto 10% auto',
				'filter': 'drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.25))',
				'display': 'none'
			}
		}).component();

		const addAccountText = view.modelBuilder.text().withProps({
			value: loc.ADD_ACCOUNT,
			width: 198,
			height: 34,
			CSSStyles: {
				...styles.NOTE_CSS,
				'margin': 'auto',
				'text-align': 'center',
				'display': 'none'
			}
		}).component();

		const header = view.modelBuilder.flexContainer().withItems(
			[
				statusContainerTitle,
				buttonContainer
			]
		).withLayout({
			flexFlow: 'row'
		}).component();

		this._migrationStatusCardsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();

		let accounts = await azdata.accounts.getAllAccounts();

		if (accounts.length === 0) {
			addAccountImage.updateCssStyles({
				'display': 'block'
			});
			addAccountText.updateCssStyles({
				'display': 'block'
			});
			this._migrationStatusCardsContainer.updateCssStyles({
				'visibility': 'hidden'
			});
			buttonContainer.removeItem(this._viewAllMigrationsButton);
			refreshButton.updateCssStyles({
				'float': 'right'
			});
		}

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

		this._inProgressWarningMigrationButton = this.createStatusCard(
			IconPathHelper.inProgressMigration,
			loc.MIGRATION_IN_PROGRESS,
			true
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
				'margin-bottom': '16px'
			}
		}
		);

		statusContainer.addItem(addAccountImage, {});
		statusContainer.addItem(addAccountText, {});
		statusContainer.addItem(this._migrationStatusCardLoadingContainer, {});

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
				'padding': '16px'
			}
		}).component();
		const titleComponent = view.modelBuilder.text().withProps({
			value: loc.HELP_TITLE,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS
			}
		}).component();

		linksContainer.addItems([titleComponent], {
			CSSStyles: {
				'margin-bottom': '16px'
			}
		});

		const links = [{
			title: loc.HELP_LINK1_TITLE,
			description: loc.HELP_LINK1_DESCRIPTION,
			link: 'https://docs.microsoft.com/azure/azure-sql/migration-guides/managed-instance/sql-server-to-sql-managed-instance-assessment-rules'
		}];

		linksContainer.addItems(links.map(l => this.createLink(view, l)), {
			CSSStyles: {
				'margin-bottom': '8px'
			}
		});

		const videosContainer = this.createVideoLinkContainers(view, []);
		linksContainer.addItem(videosContainer, {
			CSSStyles: {
				'margin-bottom': '8px'
			}
		});

		return linksContainer;
	}

	private createLink(view: azdata.ModelView, linkMetaData: IActionMetadata): azdata.Component {
		const maxWidth = 400;
		const labelsContainer = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'column',
				'width': `${maxWidth}px`,
				'justify-content': 'flex-start'
			}
		}).component();
		const linkContainer = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'row',
				'width': `${maxWidth + 10}px`,
				'justify-content': 'flex-start',
				'margin-bottom': '4px'
			}

		}).component();
		const descriptionComponent = view.modelBuilder.text().withProps({
			value: linkMetaData.description,
			width: maxWidth,
			CSSStyles: {
				...styles.NOTE_CSS
			}
		}).component();
		const linkComponent = view.modelBuilder.hyperlink().withProps({
			label: linkMetaData.title!,
			url: linkMetaData.link!,
			showLinkIcon: true,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();
		linkContainer.addItem(linkComponent);
		labelsContainer.addItems([linkContainer, descriptionComponent]);
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
				...styles.BODY_CSS
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
