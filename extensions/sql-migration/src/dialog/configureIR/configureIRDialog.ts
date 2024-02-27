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
import { createAuthenticationKeyTable, createRegistrationInstructions, refreshAuthenticationKeyTable, suggestReportFile } from '../../api/utils';
import path = require('path');
import { MigrationStateModel } from '../../models/stateMachine';
import { SqlMigrationServiceAuthenticationKeys, getSqlMigrationService, getSqlMigrationServiceAuthKeys } from '../../api/azure';
//import { spawn } from 'child_process';

const LABEL_MARGIN = '0 10px 0 10px';

export class ConfigureIRDialog {

	private dialog: azdata.window.Dialog | undefined;
	private isPowershellScriptExpanded = true;
	private isConfigureIRmanuallyExpanded = true;
	private _migrationStateModel: MigrationStateModel;
	private _migrationServiceAuthKeyTable: azdata.DeclarativeTableComponent | undefined;

	constructor(migrationStateModel: MigrationStateModel) {
		this._migrationStateModel = migrationStateModel;
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		dialog.registerContent(async (view: azdata.ModelView) => {
			const rootContainer = this.constructIRConfig(view);
			return view.initializeModel(await rootContainer);
		});
		dialog.cancelButton.hidden = true;
		dialog.okButton.label = constants.CLOSE;
		dialog.okButton.position = 'left';
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

	public async constructIRConfig(view: azdata.ModelView): Promise<azdata.FlexContainer> {
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
				'width': '453px'
			}
		}).component();

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
				ariaLabel: 'IR configuration type',
			})
			.component();

		container.addItems([setupIRdescription1,
			irTypeRadioButtonsModel
		]);

		setupLocalIR.onDidChangeCheckedState(async (e) => {
			// if local is selected, uncheck remote
			if (setupLocalIR.checked) {
				setupRemoteIR.checked = false;
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
		const localIRdescription = view.modelBuilder.infoBox().withProps({
			text: constants.LOCAL_IR_SETUP_NOTE,
			style: 'information',
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		const executeScriptButton = view.modelBuilder.button().withProps({
			label: 'Execute script',
			ariaLabel: 'Execute script',
			iconPath: IconPathHelper.runScript,
			iconWidth: '18px',
			iconHeight: '18px',
			height: '40px',
			width: '110px',
		}).component();

		// get the SHIR script
		const scriptPath = path.join(__dirname, '../../../scripts/SHIR-auto-configuration.ps1');

		const scriptContent = await fs.readFile(scriptPath);

		// inject auth keys in the script
		const authKeys = await this.retrieveAuthKeys();
		const modifiedScriptContent = await this.injectKeysIntoShirScriptContent
			(authKeys.authKey1, authKeys.authKey2, scriptContent.toString());

		// write it back to different file
		const modifiedScriptPath = path.join(__dirname, '../../../scripts/SHIR-auto-configuration-with-auth-keys.ps1');
		await fs.writeFile(modifiedScriptPath, modifiedScriptContent);

		executeScriptButton.onDidClick(async () => {

			// Invoke the PowerShell script with the specified arguments
			await this.invokeScript(modifiedScriptPath)
		});

		container.addItems([localIRdescription, executeScriptButton]);

		return container;
	}


	// retrieve the auth keys
	private async retrieveAuthKeys(): Promise<SqlMigrationServiceAuthenticationKeys> {

		let defaultKeys: SqlMigrationServiceAuthenticationKeys = {
			authKey1: '',
			authKey2: ''
		};

		const service = this._migrationStateModel._sqlMigrationService;
		if (service) {
			const account = this._migrationStateModel._azureAccount;
			const subscription = this._migrationStateModel._sqlMigrationServiceSubscription;
			const resourceGroup = this._migrationStateModel._sqlMigrationServiceResourceGroup.name;
			const location = service.location;
			const serviceName = service.name;
			if (service?.properties?.integrationRuntimeState) {
				service.properties.integrationRuntimeState = undefined;
			}
			const keys = await getSqlMigrationServiceAuthKeys(
				account,
				subscription,
				resourceGroup,
				location,
				serviceName);

			return keys;
		}
		return defaultKeys;
	}

	// invoke and execute the script
	private async invokeScript(scriptPath: string): Promise<void> {

		var spawn = require("child_process").spawn, child;
		child = spawn("powershell.exe", [scriptPath]);
		child.stdout.on("data", function (data: string) {
			console.log("Powershell Data: " + data);
		});
		child.stderr.on("data", function (data: string) {
			console.log("Powershell Errors: " + data);
		});
		child.on("exit", function () {
			console.log("Powershell Script finished");
		});
		child.stdin.end(); //end input
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
				ariaLabel: 'Powershell script expanded',
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
		const powershellscriptContentContainer = await this.createPowershellscriptContentContainer(view);

		const manualIRconfigContentContainer = await this.createManualIRconfigContentContainer(view);
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
				powershellScriptExpander.ariaLabel = 'Powershell script expanded';
				this.isPowershellScriptExpanded = true;
				powershellscriptContainer.addItem(powershellscriptContentContainer);
			}
			else {
				powershellScriptExpander.iconPath = IconPathHelper.expandButtonClosed;
				powershellScriptExpander.ariaLabel = 'Powershell script collapsed';
				this.isPowershellScriptExpanded = false;
				powershellscriptContainer.removeItem(powershellscriptContentContainer);
			}
		});

		manualIRconfigurationExpander.onDidClick(() => {
			if (this.isConfigureIRmanuallyExpanded === false) {
				manualIRconfigurationExpander.iconPath = IconPathHelper.expandButtonOpen;
				manualIRconfigurationExpander.ariaLabel = 'Manual IR configuration expanded';
				this.isConfigureIRmanuallyExpanded = true;
				manualIRconfigContainer.addItem(manualIRconfigContentContainer);
			}
			else {
				manualIRconfigurationExpander.iconPath = IconPathHelper.expandButtonClosed;
				manualIRconfigurationExpander.ariaLabel = 'Manual IR configuration collapsed';
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

	// creates manual IR config container
	private async createManualIRconfigContentContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).component();

		const instructions = createRegistrationInstructions(view, false);
		await instructions.updateCssStyles({
			...styles.BODY_CSS,
			'margin': LABEL_MARGIN,
		})

		this._migrationServiceAuthKeyTable = createAuthenticationKeyTable(view, '50px', '100%');

		const service = this._migrationStateModel._sqlMigrationService;
		if (service) {
			const account = this._migrationStateModel._azureAccount;
			const subscription = this._migrationStateModel._sqlMigrationServiceSubscription;
			const resourceGroup = this._migrationStateModel._sqlMigrationServiceResourceGroup.name;
			const location = service.location;
			const serviceName = service.name;
			if (service?.properties?.integrationRuntimeState) {
				service.properties.integrationRuntimeState = undefined;
			}

			const migrationService = await getSqlMigrationService(
				account,
				subscription,
				resourceGroup,
				location,
				serviceName);

			await refreshAuthenticationKeyTable(view,
				this._migrationServiceAuthKeyTable,
				account,
				subscription,
				resourceGroup,
				location,
				migrationService);

		}

		container.addItems([instructions, this._migrationServiceAuthKeyTable]);

		return container;
	}

	// creates powershell script container
	private async createPowershellscriptContentContainer(view: azdata.ModelView): Promise<azdata.Component> {
		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).component();

		const def = view.modelBuilder.text().withProps({
			value: constants.POWERSHELL_SCRIPT_DESCRIPTION,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'margin': '0px',
				'margin-top': '8px',
				'margin-bottom': '8px',
			},
		}).component();

		const saveScriptButton = view.modelBuilder.button().withProps({
			label: 'Save script',
			ariaLabel: 'Save script',
			iconWidth: '18px',
			iconHeight: '18px',
			height: '40px',
			width: '100px',
			iconPath: IconPathHelper.save,
			CSSStyles: {
				'padding': '8px 8px',
			},
		}).component();

		const scriptContent = await fs.readFile(path.join(__dirname, '../../../scripts/SHIR-auto-configuration.ps1'));

		// inject auth keys in the script
		const authKeys = await this.retrieveAuthKeys();
		const modifiedScriptContent = await this.injectKeysIntoShirScriptContent
			(authKeys.authKey1, authKeys.authKey2, scriptContent.toString());

		// write it back to different file
		const modifiedScriptPath = path.join(__dirname, '../../../scripts/SHIR-auto-configuration-with-auth-keys.ps1');
		await fs.writeFile(modifiedScriptPath, modifiedScriptContent);

		saveScriptButton.onDidClick(async () => {
			const options: vscode.SaveDialogOptions = {
				defaultUri: vscode.Uri.file(suggestReportFile(Date.now())),
				filters: { 'Windows PowerShell Script': ['ps1'] }
			};

			const choosenPath = await vscode.window.showSaveDialog(options);
			if (choosenPath !== undefined) {
				const value = modifiedScriptContent.toString();
				await fs.writeFile(choosenPath.fsPath, value);
				if (await vscode.window.showInformationMessage(
					constants.POWERSHELL_SCRIPT_SAVED,
					constants.OPEN, constants.CANCEL) === constants.OPEN) {
					await vscode.env.openExternal(choosenPath);
				}
			}
		});

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

		container.addItems([def, saveScriptButton, scriptBox]);

		return container;
	}

	// inject the auth keys
	private async injectKeysIntoShirScriptContent(authKey1: string, authKey2: string,
		scriptContent: string): Promise<string> {
		if (!scriptContent)
			return ""; // If the script is null or empty, return empty string

		// Replace placeholders for authentication keys in the script
		if (authKey1) {
			scriptContent = scriptContent.replace(/\$AuthKey1 = \$null/, `$AuthKey1 = "${authKey1}"`);
		}
		if (authKey2) {
			scriptContent = scriptContent.replace(/\$AuthKey2 = \$null/, `$AuthKey2 = "${authKey2}"`);
		}

		return scriptContent; // Return the script with injected authentication keys
	}

}
