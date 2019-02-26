/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { WizardPageBase } from '../../wizardPageBase';
import { TargetClusterTypeInfo, ToolInstallationStatus } from '../../../interfaces';
import * as nls from 'vscode-nls';
import { CreateClusterWizard } from '../createClusterWizard';

const localize = nls.loadMessageBundle();

const InstallToolsButtonText = localize('bdc-create.InstallToolsText', 'Install Tools');
const InstallingButtonText = localize('bdc-create.InstallingButtonText', 'Installing...');

export class SelectTargetClusterTypePage extends WizardPageBase<CreateClusterWizard> {
	private cards: sqlops.CardComponent[];
	private toolsTable: sqlops.TableComponent;
	private formBuilder: sqlops.FormBuilder;
	private form: sqlops.FormContainer;
	private installToolsButton: sqlops.window.Button;
	private toolsLoadingWrapper: sqlops.LoadingComponent;
	private refreshToolsButton: sqlops.window.Button;
	private isValid: boolean = false;
	private isLoading: boolean = false;

	constructor(wizard: CreateClusterWizard) {
		super(localize('bdc-create.selectTargetClusterTypePageTitle', 'Where do you want to deploy this SQL Server big data cluster?'),
			localize('bdc-create.selectTargetClusterTypePageDescription', 'Choose the target environment and then install the required tools.'),
			wizard);
		this.installToolsButton = sqlops.window.createButton(InstallToolsButtonText);
		this.installToolsButton.hidden = true;
		this.installToolsButton.onClick(() => {
			this.toolsLoadingWrapper.loading = true;
			this.wizard.wizardObject.message = null;
			this.installToolsButton.label = InstallingButtonText;
			this.installToolsButton.enabled = false;
			this.wizard.model.installTools().then(() => {
				this.installToolsButton.label = InstallToolsButtonText;
				this.installToolsButton.enabled = true;
				return this.updateRequiredToolStatus();
			});
		});
		this.wizard.addButton(this.installToolsButton);

		this.refreshToolsButton = sqlops.window.createButton(localize('bdc-create.RefreshToolsButtonText', 'Refresh Status'));
		this.refreshToolsButton.hidden = true;
		this.refreshToolsButton.onClick(() => {
			this.updateRequiredToolStatus();
		});
		this.wizard.addButton(this.refreshToolsButton);
		this.wizard.wizardObject.registerNavigationValidator(() => {
			if (this.isLoading) {
				let messageText = localize('bdc-create.ToolsRefreshingText', 'Please wait while the required tools status is being refreshed.');
				let messageLevel = sqlops.window.MessageLevel.Information;
				this.wizard.wizardObject.message = {
					level: messageLevel,
					text: messageText
				};
				return false;
			}
			if (!this.isValid) {
				let messageText = this.cards.filter(c => { return c.selected; }).length === 0 ?
					localize('bdc-create.TargetClusterTypeNotSelectedText', 'Please select a target cluster type') :
					localize('bdc-create.MissingToolsText', 'Please install the missing tools');
				this.wizard.wizardObject.message = {
					level: sqlops.window.MessageLevel.Error,
					text: messageText
				};
			}
			return this.isValid;
		});
	}

	protected initialize(view: sqlops.ModelView): Thenable<void> {
		let self = this;
		return self.wizard.model.getAllTargetClusterTypeInfo().then((clusterTypes) => {
			self.cards = [];

			clusterTypes.forEach(clusterType => {
				let card = self.createCard(view, clusterType);
				self.cards.push(card);
			});
			let cardsContainer = view.modelBuilder.flexContainer().withItems(self.cards, { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'left' }).component();

			let toolColumn: sqlops.TableColumn = {
				value: localize('bdc-create.toolNameColumnHeader', 'Tool'),
				width: 100
			};
			let descriptionColumn: sqlops.TableColumn = {
				value: localize('bdc-create.toolDescriptionColumnHeader', 'Description'),
				width: 200
			};
			let statusColumn: sqlops.TableColumn = {
				value: localize('bdc-create.toolStatusColumnHeader', 'Status'),
				width: 100
			};

			self.toolsTable = view.modelBuilder.table().withProperties<sqlops.TableComponentProperties>({
				height: 150,
				data: [],
				columns: [toolColumn, descriptionColumn, statusColumn],
				width: 850
			}).component();

			self.toolsLoadingWrapper = view.modelBuilder.loadingComponent().withItem(self.toolsTable).component();
			self.formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: cardsContainer,
						title: localize('bdc-create.PickTargetEnvironmentText', 'Pick target environment')
					}
				],
				{
					horizontal: false
				}
			);


			self.form = self.formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(self.form);
		});
	}

	public onEnter(): void {
		this.installToolsButton.hidden = false;
		this.refreshToolsButton.hidden = false;
		this.refreshToolsButton.enabled = true;
		this.installToolsButton.enabled = false;
	}

	public onLeave(): void {
		this.installToolsButton.hidden = true;
		this.refreshToolsButton.hidden = true;
	}


	private createCard(view: sqlops.ModelView, targetClusterTypeInfo: TargetClusterTypeInfo): sqlops.CardComponent {
		let self = this;
		let card = view.modelBuilder.card().withProperties<sqlops.CardProperties>({
			cardType: sqlops.CardType.VerticalButton,
			iconPath: {
				dark: self.wizard.context.asAbsolutePath(targetClusterTypeInfo.iconPath.dark),
				light: self.wizard.context.asAbsolutePath(targetClusterTypeInfo.iconPath.light)
			},
			label: targetClusterTypeInfo.name
		}).component();
		card.onCardSelectedChanged(() => {
			if (card.selected) {
				self.wizard.wizardObject.message = null;
				self.wizard.model.targetClusterType = targetClusterTypeInfo.type;
				self.cards.forEach(c => {
					if (c !== card) {
						c.selected = false;
					}
				});

				if (self.form.items.length === 1) {
					self.formBuilder.addFormItem({
						title: localize('bdc-create.RequiredToolsText', 'Required tools'),
						component: self.toolsLoadingWrapper
					});
				}
				self.updateRequiredToolStatus();
			} else {
				if (self.cards.filter(c => { return c !== card && c.selected }).length === 0) {
					card.selected = true;
				}
			}
		});
		return card;
	}

	private updateRequiredToolStatus(): Thenable<void> {
		this.isLoading = true;
		this.installToolsButton.hidden = false;
		this.refreshToolsButton.hidden = false;
		this.toolsLoadingWrapper.loading = true;
		this.refreshToolsButton.enabled = false;
		this.installToolsButton.enabled = false;
		return this.wizard.model.getRequiredToolStatus().then(tools => {
			this.isLoading = false;
			this.toolsLoadingWrapper.loading = false;
			this.refreshToolsButton.enabled = true;
			this.installToolsButton.enabled = tools.filter(tool => tool.status !== ToolInstallationStatus.Installed).length !== 0;
			this.isValid = !this.installToolsButton.enabled;
			this.wizard.wizardObject.message = null;
			let tableData = tools.map(tool => {
				return [tool.name, tool.description, this.getStatusText(tool.status)];
			});
			this.toolsTable.data = tableData;
		});
	}

	private getStatusText(status: ToolInstallationStatus): string {
		switch (status) {
			case ToolInstallationStatus.Installed:
				return localize('bdc-create.InstalledText', 'Installed');
			case ToolInstallationStatus.NotInstalled:
				return localize('bdc-create.NotInstalledText', 'Not Installed');
			case ToolInstallationStatus.Installing:
				return localize('bdc-create.InstallingText', 'Installing');
			default:
				return 'unknown status';
		}
	}
}
