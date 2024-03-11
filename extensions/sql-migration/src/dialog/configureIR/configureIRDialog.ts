/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { createManualIRconfigContentContainer, createPowershellscriptContentContainer, injectKeysIntoShirScriptContent, invokeScript, retrieveAuthKeys } from '../../api/utils';
import path = require('path');
import { MigrationStateModel } from '../../models/stateMachine';

export class ConfigureIRDialog {

	private dialog: azdata.window.Dialog | undefined;
	private _disposables: vscode.Disposable[] = [];
	private isPowershellScriptExpanded = true;
	private islocalPowershellScriptExpanded = true;
	private isConfigureIRmanuallyExpanded = true;
	private modifiedScriptPath = "";
	private _migrationStateModel: MigrationStateModel;
	public executeScriptButton!: azdata.window.Button;

	constructor(migrationStateModel: MigrationStateModel) {
		this._migrationStateModel = migrationStateModel;
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		dialog.registerContent(async (view: azdata.ModelView) => {
			const rootContainer = this.constructIRConfig(view, dialog);
			return view.initializeModel(await rootContainer);
		});

		this.executeScriptButton = azdata.window.createButton(
			constants.EXECUTE_SCRIPT,
			'left');
		this._disposables.push(
			this.executeScriptButton.onClick(async (value) => {

				// on click of execute button, execute teh script
				await invokeScript(this.modifiedScriptPath);
				azdata.window.closeDialog(dialog);
				await vscode.window.showInformationMessage(constants.EXECUTING_POWERSHELLSCRIPT);
			}));

		this.executeScriptButton.enabled = false;

		dialog.customButtons = [this.executeScriptButton];

		dialog.cancelButton.hidden = true;
		dialog.okButton.label = constants.CLOSE;
		dialog.okButton.position = 'right';
	}

	//This function opens the configure IR dialog
	public async openDialog(): Promise<void> {
		this.dialog = azdata.window.createModelViewDialog(constants.CONFIGURE_INTEGRATION_RUNTIME,
			constants.CONFIGURE_INTEGRATION_RUNTIME);
		this.dialog.cancelButton.hidden = true;
		this.dialog.okButton.label = constants.CLOSE;
		this.dialog.okButton.position = 'left';
		const dialogSetupPromises: Thenable<void>[] = [];
		dialogSetupPromises.push(this.initializeDialog(this.dialog));
		azdata.window.openDialog(this.dialog);
		await Promise.all(dialogSetupPromises);
	}

	public async constructIRConfig(view: azdata.ModelView, dialog: azdata.window.Dialog):
		Promise<azdata.FlexContainer> {

		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withProps({
			CSSStyles: {
				'width': '500px',
				'height': '746px',
				'padding': '10px 27px',
				'flex-shrink': '0'
			}
		}).component();

		const setupIRdescription1 = view.modelBuilder.text().withProps({
			value: constants.IR_CONTAINER_DESCRIPTION,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		// a note to user with instrcutions on prereq and recommendation
		const noteContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).component();

		const recommendedIRnote: azdata.LinkArea = {
			text: constants.RECOMMENDED_LINK,
			url: 'https://learn.microsoft.com/en-us/azure/dms/migration-using-azure-data-studio?tabs=azure-sql-mi#recommendations-for-using-a-self-hosted-integration-runtime-for-database-migrations'
		}

		const noteForIR = view.modelBuilder.infoBox().withProps({
			text: constants.IMPORTANT + "\n" + "\n" +
				constants.POWERSHELL_PREREQ + "\n" +
				"{0}" + "\n",
			style: 'information',
			links: [recommendedIRnote],
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		noteContainer.addItems([noteForIR]);

		// add the radio buttons
		const setupLocalIR = view.modelBuilder.radioButton().withProps({
			name: constants.SETUP_LOCAL_IR_DESCRIPTION,
			label: constants.SETUP_LOCAL_IR_DESCRIPTION,
			checked: false,
			CSSStyles: {
				'gap': '8px'
			}
		}).component();

		const setupRemoteIR = view.modelBuilder.radioButton().withProps({
			name: constants.SETUP_REMOTE_IR_DESCRIPTION,
			label: constants.SETUP_REMOTE_IR_DESCRIPTION,
			checked: true
		}).component();

		const remoteIRContainer = await this.createRemoteIRContainer(view);

		remoteIRContainer.CSSStyles = {
			'padding': '10px'
		};

		const localIRContainer = await this.createLocalIRContainer(view);

		// remote is selected by default and remote container is added
		const irTypeRadioButtonsModel = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([setupLocalIR, setupRemoteIR, remoteIRContainer])
			.withProps({
				ariaRole: 'radiogroup',
				ariaLabel: constants.IR_CONFIG_TYPE,
			})
			.component();

		container.addItems([setupIRdescription1,
			noteContainer,
			irTypeRadioButtonsModel
		]);

		setupLocalIR.onDidChangeCheckedState(async (e) => {
			// if local is selected, uncheck remote
			if (setupLocalIR.checked) {
				setupRemoteIR.checked = false;
				this.executeScriptButton.enabled = true;
				irTypeRadioButtonsModel.removeItem(remoteIRContainer);
				irTypeRadioButtonsModel.removeItem(setupRemoteIR);
				irTypeRadioButtonsModel.addItem(localIRContainer);
				irTypeRadioButtonsModel.addItem(setupRemoteIR);
			}
		});

		setupRemoteIR.onDidChangeCheckedState(async (e) => {
			// if remote is selected, uncheck local
			if (setupRemoteIR.checked) {
				setupLocalIR.checked = false;
				this.executeScriptButton.enabled = false;
				irTypeRadioButtonsModel.addItem(remoteIRContainer);
				irTypeRadioButtonsModel.removeItem(localIRContainer);
			}
		});

		return container;
	}


	private async createLocalIRContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).component();

		// a note to user with instrcutions on execution of script
		const localIRdescription = view.modelBuilder.text().withProps({
			value: constants.LOCAL_IR_SETUP_NOTE,
		}).component();

		// get the SHIR script
		const scriptPath = path.join(__dirname, '../scripts/SHIR-auto-configuration.ps1');

		const scriptContent = await fs.readFile(scriptPath);

		// inject auth keys in the script
		const authKeys = await retrieveAuthKeys(this._migrationStateModel);
		const modifiedScriptContent = await injectKeysIntoShirScriptContent
			(authKeys.authKey1, authKeys.authKey2, scriptContent.toString());

		// write it back to different file
		this.modifiedScriptPath = path.join(__dirname, '../scripts/SHIR-auto-configuration-with-auth-keys.ps1');
		await fs.writeFile(this.modifiedScriptPath, modifiedScriptContent);

		const powershellScriptExpander = view.modelBuilder.button().withProps(
			{
				iconPath: IconPathHelper.expandButtonOpen,
				ariaLabel: constants.PS_SCRIPT_EXPANDED,
			}
		).component();

		// create title containers
		const powershellscriptTitleContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
		}).component();

		const powershellScriptTitle = view.modelBuilder.text().withProps({
			value: constants.POWERSHELL_SCRIPT,
			height: 18,
			CSSStyles: {
				'font-size': '13px',
				'height': '18px',
				'line-height': '18px',
				'margin': '0px',
				'font-weight': '600',
				'padding': '0px 8px'

			},
		}).component();

		// add title and openclose to this container
		powershellscriptTitleContainer.addItem(powershellScriptExpander,
			{ flex: 'none' });
		powershellscriptTitleContainer.addItems([powershellScriptTitle]);

		// script box
		const scriptBox = view.modelBuilder.inputBox()
			.withProps({
				value: modifiedScriptContent.toString(),
				readOnly: true,
				multiline: true,
				height: 400,
				inputType: 'text',
				display: 'inline-block',
				CSSStyles:
				{
					'font': '12px "Monaco", "Menlo", "Consolas", "Droid Sans Mono", "Inconsolata", "Courier New", monospace',
					'margin': '0',
					'padding': '8px',
					'white-space': 'pre',
					'background-color': '#eeeeee',
					'overflow-x': 'hidden',
					'word-break': 'break-all'
				},
			})
			.component();


		container.addItems([localIRdescription, powershellscriptTitleContainer, scriptBox]);

		// configure the behaviour of expanders
		powershellScriptExpander.onDidClick(() => {
			if (this.islocalPowershellScriptExpanded === false) {
				powershellScriptExpander.iconPath = IconPathHelper.expandButtonOpen;
				powershellScriptExpander.ariaLabel = constants.PS_SCRIPT_EXPANDED;
				this.islocalPowershellScriptExpanded = true;
				container.addItem(scriptBox);
			}
			else {
				powershellScriptExpander.iconPath = IconPathHelper.expandButtonClosed;
				powershellScriptExpander.ariaLabel = constants.PS_SCRIPT_COLLAPSED;
				this.islocalPowershellScriptExpanded = false;
				container.removeItem(scriptBox);
			}
		});

		return container;
	}


	private async createRemoteIRContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withProps({
			CSSStyles: {
				padding: '0px 0px 0px 0px'
			}
		}).component();

		// create big containers for each case
		const powershellscriptContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).component();

		const manualIRconfigContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).component();

		// create title containers
		const powershellscriptTitleContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
		}).component();

		const configureIRManuallyTitleContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
		}).component();

		const powershellScriptTitle = view.modelBuilder.text().withProps({
			value: constants.CONFIGURE_POWERSHELL_SCRIPT,
			height: 18,
			CSSStyles: {
				'font-size': '13px',
				'height': '18px',
				'line-height': '18px',
				'margin': '0px',
				'font-weight': '600',
				'padding': '0px 8px',
			},
		}).component();

		const manualIRTitle = view.modelBuilder.text().withProps({
			value: constants.CONFIGURE_MANUALLY,
			height: 18,
			CSSStyles: {
				'font-size': '13px',
				'height': '18px',
				'line-height': '18px',
				'margin': '0px',
				'font-weight': '600',
				'padding': '0px 8px',
			},
		}).component();

		const powershellScriptExpander = view.modelBuilder.button().withProps(
			{
				iconPath: IconPathHelper.expandButtonOpen,
				ariaLabel: constants.PS_SCRIPT_EXPANDED,
			}
		).component();

		const manualIRconfigurationExpander = view.modelBuilder.button().withProps(
			{
				iconPath: IconPathHelper.expandButtonClosed,
				ariaLabel: 'Manual IR configuration collapsed'
			}
		).component();

		// add title and openclose to this container
		powershellscriptTitleContainer.addItem(powershellScriptExpander,
			{ flex: 'none' });
		powershellscriptTitleContainer.addItems([powershellScriptTitle]);

		configureIRManuallyTitleContainer.addItem(manualIRconfigurationExpander,
			{ flex: 'none' });
		configureIRManuallyTitleContainer.addItems([manualIRTitle]);

		// construct content
		const powershellscriptContentContainer = await createPowershellscriptContentContainer(view, this._migrationStateModel);

		const manualIRconfigContentContainer = await createManualIRconfigContentContainer(view, this._migrationStateModel);
		manualIRconfigContentContainer.CSSStyles = {
			'padding': '10px',
		};

		// add its items
		powershellscriptContainer.addItems([powershellscriptTitleContainer,
			powershellscriptContentContainer]);

		manualIRconfigContainer.addItems([configureIRManuallyTitleContainer])


		// configure the behaviour of expanders
		powershellScriptExpander.onDidClick(() => {
			if (this.isPowershellScriptExpanded === false) {
				powershellScriptExpander.iconPath = IconPathHelper.expandButtonOpen;
				powershellScriptExpander.ariaLabel = constants.PS_SCRIPT_EXPANDED;
				this.isPowershellScriptExpanded = true;
				powershellscriptContainer.addItem(powershellscriptContentContainer);
			}
			else {
				powershellScriptExpander.iconPath = IconPathHelper.expandButtonClosed;
				powershellScriptExpander.ariaLabel = constants.PS_SCRIPT_COLLAPSED;
				this.isPowershellScriptExpanded = false;
				powershellscriptContainer.removeItem(powershellscriptContentContainer);
			}
		});

		manualIRconfigurationExpander.onDidClick(() => {
			if (this.isConfigureIRmanuallyExpanded === false) {
				manualIRconfigurationExpander.iconPath = IconPathHelper.expandButtonOpen;
				manualIRconfigurationExpander.ariaLabel = constants.MANUAL_IR_EXPANDED;
				this.isConfigureIRmanuallyExpanded = true;
				manualIRconfigContainer.addItem(manualIRconfigContentContainer);
			}
			else {
				manualIRconfigurationExpander.iconPath = IconPathHelper.expandButtonClosed;
				manualIRconfigurationExpander.ariaLabel = constants.MANUAL_IR_COLLAPSED;
				this.isConfigureIRmanuallyExpanded = false;
				manualIRconfigContainer.removeItem(manualIRconfigContentContainer);
			}
		});

		// add items to container
		container.addItems([
			powershellscriptContainer,
			manualIRconfigContainer
		])
		return container;
	}

}
