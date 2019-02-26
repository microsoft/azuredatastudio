/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { WizardPageBase } from '../../wizardPageBase';
import * as nls from 'vscode-nls';
import { ClusterPorts, ContainerRegistryInfo } from '../../../interfaces';
import { CreateClusterWizard } from '../createClusterWizard';

const localize = nls.loadMessageBundle();
const UserNameInputWidth = '300px';
const PortInputWidth = '100px';
const RestoreDefaultValuesText = localize('bdc-create.RestoreDefaultValuesText', 'Restore Default Values');

export class SettingsPage extends WizardPageBase<CreateClusterWizard> {
	constructor(wizard: CreateClusterWizard) {
		super(localize('bdc-create.settingsPageTitle', 'Settings'),
			localize('bdc-create.settingsPageDescription', 'Configure the settings required for deploying SQL Server big data cluster'),
			wizard);
	}

	protected initialize(view: sqlops.ModelView): Thenable<void> {
		let clusterPorts: ClusterPorts;
		let containerRegistryInfo: ContainerRegistryInfo;

		let clusterPortsPromise = this.wizard.model.getDefaultPorts().then(ports => {
			clusterPorts = ports;
		});

		let containerRegistryPromise = this.wizard.model.getDefaultContainerRegistryInfo().then(containerRegistry => {
			containerRegistryInfo = containerRegistry;
		});
		return Promise.all([clusterPortsPromise, containerRegistryPromise]).then(() => {
			let formBuilder = view.modelBuilder.formContainer();

			//User settings
			let adminUserNameInput = this.createInputWithLabel(view, localize('bdc-create.AdminUsernameText', 'Admin username'), true, UserNameInputWidth, '', (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.adminUserName = inputBox.value;
			});
			let adminPasswordInput = this.createInputWithLabel(view, localize('bdc-create.AdminUserPasswordText', 'Password'), true, UserNameInputWidth, '', (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.adminPassword = inputBox.value;
			}, 'password');

			// Port settings
			let sqlPortInput = this.createInputWithLabel(view, localize('bdc-create.SQLPortText', 'SQL Server master'), true, PortInputWidth, clusterPorts.sql, (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.sqlPort = inputBox.value;
			});
			let knoxPortInput = this.createInputWithLabel(view, localize('bdc-create.KnoxPortText', 'Knox'), true, PortInputWidth, clusterPorts.knox, (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.knoxPort = inputBox.value;
			});
			let controllerPortInput = this.createInputWithLabel(view, localize('bdc-create.ControllerPortText', 'Controller'), true, PortInputWidth, clusterPorts.controller, (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.controllerPort = inputBox.value;
			});
			let proxyPortInput = this.createInputWithLabel(view, localize('bdc-create.ProxyPortText', 'Proxy'), true, PortInputWidth, clusterPorts.proxy, (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.proxyPort = inputBox.value;
			});
			let grafanaPortInput = this.createInputWithLabel(view, localize('bdc-create.GrafanaPortText', 'Grafana dashboard'), true, PortInputWidth, clusterPorts.grafana, (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.grafanaPort = inputBox.value;
			});
			let kibanaPortInput = this.createInputWithLabel(view, localize('bdc-create.KibanaPortText', 'Kibana dashboard'), true, PortInputWidth, clusterPorts.kibana, (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.kibanaPort = inputBox.value;
			});
			let restorePortSettingsButton = view.modelBuilder.button().withProperties<sqlops.ButtonProperties>({
				label: RestoreDefaultValuesText,
				width: 200
			}).component();
			restorePortSettingsButton.onDidClick(() => {
				sqlPortInput.input.value = clusterPorts.sql;
				knoxPortInput.input.value = clusterPorts.knox;
				controllerPortInput.input.value = clusterPorts.controller;
				proxyPortInput.input.value = clusterPorts.proxy;
				grafanaPortInput.input.value = clusterPorts.grafana;
				kibanaPortInput.input.value = clusterPorts.kibana;
			});

			// Container Registry Settings
			let registryInput = this.createInputWithLabel(view, localize('bdc-create.RegistryText', 'Registry'), true, UserNameInputWidth, containerRegistryInfo.registry, (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.containerRegistry = inputBox.value;
			});

			let repositoryInput = this.createInputWithLabel(view, localize('bdc-create.RepositoryText', 'Repository'), true, UserNameInputWidth, containerRegistryInfo.repository, (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.containerRepository = inputBox.value;
			});

			let imageTagInput = this.createInputWithLabel(view, localize('bdc-create.ImageTagText', 'Image tag'), true, UserNameInputWidth, containerRegistryInfo.imageTag, (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.containerRegistry = inputBox.value;
			});

			let registryUserNameInput = this.createInputWithLabel(view, localize('bdc-create.RegistryUserNameText', 'Username'), false, UserNameInputWidth, '', (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.containerRegistryUserName = inputBox.value;
			});

			let registryPasswordInput = this.createInputWithLabel(view, localize('bdc-create.RegistryPasswordText', 'Password'), false, UserNameInputWidth, '', (inputBox: sqlops.InputBoxComponent) => {
				this.wizard.model.containerRegistryPassword = inputBox.value;
			});
			let restoreContainerSettingsButton = view.modelBuilder.button().withProperties<sqlops.ButtonProperties>({
				label: RestoreDefaultValuesText,
				width: 200
			}).component();
			restoreContainerSettingsButton.onDidClick(() => {
				registryInput.input.value = containerRegistryInfo.registry;
				repositoryInput.input.value = containerRegistryInfo.repository;
				imageTagInput.input.value = containerRegistryInfo.imageTag;
			});

			let basicSettingsGroup = view.modelBuilder.groupContainer().withItems([adminUserNameInput.row, adminPasswordInput.row]).withLayout({ header: localize('bdc-create.BasicSettingsText', 'Basic Settings'), collapsible: true }).component();
			let containerSettingsGroup = view.modelBuilder.groupContainer().withItems([registryInput.row, repositoryInput.row, imageTagInput.row, registryUserNameInput.row, registryPasswordInput.row, restoreContainerSettingsButton]).withLayout({ header: localize('bdc-create.ContainerRegistrySettings', 'Container Registry Settings'), collapsible: true }).component();
			let portSettingsGroup = view.modelBuilder.groupContainer().withItems([sqlPortInput.row, knoxPortInput.row, controllerPortInput.row, proxyPortInput.row, grafanaPortInput.row, kibanaPortInput.row, restorePortSettingsButton]).withLayout({ header: localize('bdc-create.PortSettings', 'Port Settings (Optional)'), collapsible: true, collapsed: true }).component();

			let acceptEulaCheckbox = view.modelBuilder.checkBox().component();
			acceptEulaCheckbox.checked = false;

			let eulaLink: sqlops.LinkArea = {
				text: localize('bdc-create.LicenseAgreementText', 'License Agreement'),
				url: 'https://docs.microsoft.com/en-us/sql/getting-started/about-the-sql-server-license-terms?view=sql-server-2014'
			};
			let privacyPolicyLink: sqlops.LinkArea = {
				text: localize('bdc-create.PrivacyPolicyText', 'Privacy Policy'),
				url: 'https://privacy.microsoft.com/en-us/privacystatement'
			};

			let checkboxText = view.modelBuilder.text().withProperties<sqlops.TextComponentProperties>({
				value: localize({
					key: 'bdc-create.AcceptTermsText',
					comment: ['{0} is the place holder for License Agreement, {1} is the place holder for Privacy Policy']
				}, 'I accept the {0} and {1}.'),
				links: [eulaLink, privacyPolicyLink]
			}).component();

			let eulaContainer = this.createRow(view, [acceptEulaCheckbox, checkboxText]);

			let form = formBuilder.withFormItems([
				{
					title: '',
					component: eulaContainer
				},
				{
					title: '',
					component: basicSettingsGroup
				}, {
					title: '',
					component: containerSettingsGroup
				}, {
					title: '',
					component: portSettingsGroup
				}]).component();
			return view.initializeModel(form);
		});
	}

	private createInputWithLabel(view: sqlops.ModelView, label: string, isRequiredField: boolean, inputWidth: string, initialValue: string, textChangedHandler: (inputBox: sqlops.InputBoxComponent) => void, inputType: string = 'text'): { row: sqlops.FlexContainer, input: sqlops.InputBoxComponent } {
		let input = view.modelBuilder.inputBox().withProperties({
			required: isRequiredField,
			inputType: inputType
		}).component();
		let text = view.modelBuilder.text().withProperties({ value: label }).component();
		input.width = inputWidth;
		text.width = '150px';
		input.onTextChanged(() => {
			textChangedHandler(input);
		});
		input.value = initialValue;
		let row = this.createRow(view, [text, input]);
		return {
			input: input,
			row: row
		};
	}

	private createRow(view: sqlops.ModelView, items: sqlops.Component[]): sqlops.FlexContainer {
		return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '5px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
	}
}
