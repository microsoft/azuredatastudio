/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import * as path from 'path';
import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { IConfig, ServerProvider, Events } from 'service-downloader';
import { ServerOptions, TransportKind } from 'vscode-languageclient';

import * as Constants from './constants';
import ContextProvider from './contextProvider';
import { CredentialStore } from './credentialstore/credentialstore';
import { AzureResourceProvider } from './resourceProvider/resourceProvider';
import * as Utils from './utils';
import { Telemetry, LanguageClientErrorHandler } from './telemetry';
import { TelemetryFeature, AgentServicesFeature } from './features';

const baseConfig = require('./config.json');
const outputChannel = vscode.window.createOutputChannel(Constants.serviceName);
const statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

export async function activate(context: vscode.ExtensionContext) {
	// lets make sure we support this platform first
	let supported = await Utils.verifyPlatform();

	if (!supported) {
		vscode.window.showErrorMessage('Unsupported platform');
		return;
	}

	let config: IConfig = JSON.parse(JSON.stringify(baseConfig));
	config.installDirectory = path.join(__dirname, config.installDirectory);
	config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
	config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL') || true;

	const credentialsStore = new CredentialStore(config);
	const resourceProvider = new AzureResourceProvider(config);
	let languageClient: SqlOpsDataClient;

	const serverdownloader = new ServerProvider(config);

	serverdownloader.eventEmitter.onAny(generateHandleServerProviderEvent());

	let clientOptions: ClientOptions = {
		documentSelector: ['sql'],
		synchronize: {
			configurationSection: Constants.extensionConfigSectionName
		},
		providerId: Constants.providerId,
		errorHandler: new LanguageClientErrorHandler(),
		features: [
			// we only want to add new features
			...SqlOpsDataClient.defaultFeatures,
			TelemetryFeature,
			AgentServicesFeature
		],
		outputChannel: new CustomOutputChannel()
	};

	const installationStart = Date.now();
	serverdownloader.getOrDownloadServer().then(e => {
		const installationComplete = Date.now();
		let serverOptions = generateServerOptions(e);
		languageClient = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
		const processStart = Date.now();
		languageClient.onReady().then(() => {
			console.log('ready!');
			const processEnd = Date.now();
			statusView.text = 'Service Started';
			setTimeout(() => {
				statusView.hide();
			}, 1500);
			Telemetry.sendTelemetryEvent('startup/LanguageClientStarted', {
				installationTime: String(installationComplete - installationStart),
				processStartupTime: String(processEnd - processStart),
				totalTime: String(processEnd - installationStart),
				beginningTimestamp: String(installationStart)
			});
		}, err => console.log('failed: ' + err));
		statusView.show();
		statusView.text = 'Starting service';
		languageClient.start();
		credentialsStore.start();
		resourceProvider.start();
	}, e => {
		Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
		vscode.window.showErrorMessage('Failed to start Sql tools service');
	});

	let contextProvider = new ContextProvider();
	context.subscriptions.push(contextProvider);
	context.subscriptions.push(credentialsStore);
	context.subscriptions.push(resourceProvider);
	context.subscriptions.push({ dispose: () => languageClient.stop() });

	// vscode.commands.registerCommand('mssql.listTasks', async () => {
	// 	let currentConnection = await sqlops.connection.getCurrentConnection();
	// 	let taskProvider = sqlops.dataprotocol.getProvider<sqlops.TaskServicesProvider>(currentConnection.providerName, sqlops.DataProviderType.TaskServicesProvider);
	// 	let tasks = await taskProvider.getAllTasks({
	// 		listActiveTasksOnly: false
	// 	});
	// 	vscode.window.showQuickPick(tasks.tasks.map(task => task.name));
	// });

	vscode.commands.registerCommand('mssql.openTestDialog', () => {
		let dialog = sqlops.window.modelviewdialog.createDialog('test dialog');
		let tab1 = sqlops.window.modelviewdialog.createTab('Tab 1');
		tab1.registerContent(view => {
			doOpenWizard(dialog, view);
		});
		let tab2 = sqlops.window.modelviewdialog.createTab('Tab 2');
		tab2.registerContent(view => {
			doOpenWizard(dialog, view);
		});
		let tab3 = sqlops.window.modelviewdialog.createWizardPage('Page 3');
		tab3.registerContent(async view => {
			let stepName = view.modelBuilder.inputBox().component();
			let stepType = view.modelBuilder.inputBox().component();
			let runAs = view.modelBuilder.inputBox().component();
			let database = view.modelBuilder.inputBox().component();
			let command = view.modelBuilder.inputBox().withProperties({
				multiline: true
			}).component();
			let openButton = view.modelBuilder.button().withProperties<sqlops.ButtonProperties>({label: 'Open...'}).component();
			let selectAll = view.modelBuilder.button().withProperties<sqlops.ButtonProperties>({label: 'Select all'}).component();
			let copyButton = view.modelBuilder.button().withProperties<sqlops.ButtonProperties>({label: 'Copy'}).component();
			let pasteButton = view.modelBuilder.button().withProperties<sqlops.ButtonProperties>({label: 'Paste'}).component();
			let parseButton = view.modelBuilder.button().withProperties<sqlops.ButtonProperties>({label: 'Parse'}).component();
			let form1 = view.modelBuilder.formContainer().withFormItems([
				{
					component: stepName,
					title: 'Step name'
				},
				{
					component: stepType,
					title: 'Type'
				},
				{
					component: runAs,
					title: 'Run as'
				}
			], {
				horizontal: false
			}).component();
			let form2 = view.modelBuilder.formContainer().withFormItems([
				{
					component: database,
					title: 'Database'
				},
				{
					component: command,
					title: 'Command',
					actions: [
						openButton, selectAll, copyButton, pasteButton, parseButton
					]
				}
			], {
				horizontal: true
			}).component();
			let flexContainer = view.modelBuilder.flexContainer().withItems([form1, form2]).component();
			flexContainer.setLayout({
				flexFlow: 'column'
			});
			await view.initializeModel(flexContainer);
		});
		dialog.content = [tab1, tab2, tab3];
		dialog.onValidityChanged(valid => dialog.okButton.enabled = valid);
		// dialog.registerContent(view => {
		// 	doOpenWizard(dialog, view);
		// 	view.onValidityChanged(valid => {
		// 		dialog.okButton.enabled = valid;
		// 	});
		// });
		let dialogButton = sqlops.window.modelviewdialog.createButton('Open alert\nTTest two lines');
		dialogButton.onClick(() => {
			vscode.window.showErrorMessage('This is a very long test message with a bunch of text');
		});
		let errorButton = sqlops.window.modelviewdialog.createButton('Message');
		errorButton.onClick(() => {
			if (dialog.message) {
				dialog.message = undefined;
			} else {
				let rand = Math.floor(Math.random() * 4);
				if (rand === 3) {
					rand = undefined;
				}
				dialog.message = {
					text: 'This is a very long test message with a bunch of text',
					level: rand
				};
			}
		});
		dialog.customButtons = [errorButton];
		dialog.registerCloseValidator(() => {
			return dialog.message === undefined;
		});
		sqlops.window.modelviewdialog.openDialog(dialog);
	});

	vscode.commands.registerCommand('mssql.openTestWizard', () => {
		let wizard = sqlops.window.modelviewdialog.createWizard('test wizard');
		let tab1 = sqlops.window.modelviewdialog.createWizardPage('Page 1');
		tab1.registerContent(async view => {
			let action = view.modelBuilder.button().withProperties<sqlops.ButtonProperties>({label: 'Add option'}).component();
			let dropdown = view.modelBuilder.dropDown().withProperties<sqlops.DropDownProperties>({
				editable: false,
				values: ['option 1', 'option 2', 'something else'],
				value: 'option 1'
			}).component();
			dropdown.enabled = false;
			action.onDidClick(() => {
				// (dropdown as any).properties['values'] = (dropdown as any).properties['values'].concat('new option');
				// (dropdown as any).updateProperties();
				dropdown.updateProperties({
					values: (dropdown.values as string[]).concat('new option')
				});
				dropdown.enabled = !dropdown.enabled;
			});
			let form = view.modelBuilder.formContainer().withFormItems([
				{
					component: dropdown,
					actions: [action],
					title: 'Dropdown'
				}
			]).component();
			await view.initializeModel(form);
		});
		let tab2 = sqlops.window.modelviewdialog.createWizardPage('Page 2');
		tab2.registerContent(view => {
			doOpenWizard(undefined, view);
		});
		wizard.pages = [tab1, tab2];
		wizard.nextButton.onClick(() => {
			console.log('Next button clicked. Current page is ' + wizard.currentPage);
		});
		wizard.backButton.onClick(() => {
			console.log('Back button clicked. Current page is ' + wizard.currentPage);
		});
		wizard.onPageChanged(info => {
			console.log('Page change event. Current page is ' + wizard.currentPage + '. Event info: Last page ' + info.lastPage + ', new page ' + info.newPage);
		});
		// let shouldNavigate = true;
		// wizard.registerNavigationValidator(info => {
		// 	shouldNavigate = !shouldNavigate;
		// 	console.log('Attempting page change from ' + info.lastPage + ' to ' + info.newPage + '. Returning ' + shouldNavigate);
		// 	return shouldNavigate;
		// });
		let customButton = sqlops.window.modelviewdialog.createButton('Message');
		customButton.onClick(() => {
			if (wizard.message) {
				wizard.message = undefined;
			} else {
				let rand = Math.floor(Math.random() * 4);
				if (rand === 3) {
					rand = undefined;
				}
				wizard.message = {
					text: '<marquee>This is a test error message</marquee>',
					level: rand
				};
			}
		});
		wizard.customButtons = [customButton];
		wizard.open();
	});
}

function generateServerOptions(executablePath: string): ServerOptions {
	let launchArgs = [];
	launchArgs.push('--log-dir');
	let logFileLocation = path.join(Utils.getDefaultLogLocation(), 'mssql');
	launchArgs.push(logFileLocation);
	let config = vscode.workspace.getConfiguration(Constants.extensionConfigSectionName);
	if (config) {
		let logDebugInfo = config[Constants.configLogDebugInfo];
		if (logDebugInfo) {
			launchArgs.push('--enable-logging');
		}
	}

	return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
}

function generateHandleServerProviderEvent() {
	let dots = 0;
	return (e: string, ...args: any[]) => {
		outputChannel.show();
		statusView.show();
		switch (e) {
			case Events.INSTALL_START:
				outputChannel.appendLine(`Installing ${Constants.serviceName} service to ${args[0]}`);
				statusView.text = 'Installing Service';
				break;
			case Events.INSTALL_END:
				outputChannel.appendLine('Installed');
				break;
			case Events.DOWNLOAD_START:
				outputChannel.appendLine(`Downloading ${args[0]}`);
				outputChannel.append(`(${Math.ceil(args[1] / 1024)} KB)`);
				statusView.text = 'Downloading Service';
				break;
			case Events.DOWNLOAD_PROGRESS:
				let newDots = Math.ceil(args[0] / 5);
				if (newDots > dots) {
					outputChannel.append('.'.repeat(newDots - dots));
					dots = newDots;
				}
				break;
			case Events.DOWNLOAD_END:
				outputChannel.appendLine('Done!');
				break;
		}
	};
}

async function doOpenWizard(dialog: sqlops.window.modelviewdialog.Dialog, modelView: sqlops.ModelView): Promise<void> {
	let builder = modelView.modelBuilder;
	let loadingFormInput: sqlops.FormComponent = initLoadingComponent(builder);
	let form = builder.formContainer().withFormItems([loadingFormInput, {
		component: builder.inputBox().component(),
		title: 'input box'
	}], {
		horizontal: true
	}).component();
	// let loadingComponent = form.items[0] as sqlops.LoadingComponent;
	let root = builder.flexContainer().component();
	root.addItem(form);
	await modelView.initializeModel(root);
	// setTimeout(() => {
	// 	loadingComponent.loading = false;
	// }, 5000);
}
function initLoadingComponent(builder: sqlops.ModelBuilder): sqlops.FormComponent {
	let loadingInput = builder.inputBox().withValidation(component => component.value === 'valid').component();
	loadingInput.enabled = true;
	loadingInput.placeHolder = 'loading...';
	// let loadingComponent = builder.loadingComponent().withItem(loadingInput).component();
	let loadingComponent = loadingInput;
	let formInput: sqlops.FormComponent = {
		component: loadingComponent,
		title: 'Status:'
	};
	return formInput;
}

// this method is called when your extension is deactivated
export function deactivate(): void {
}

class CustomOutputChannel implements vscode.OutputChannel {
	name: string;
	append(value: string): void {
		console.log(value);
	}
	appendLine(value: string): void {
		console.log(value);
	}
	clear(): void {
	}
	show(preserveFocus?: boolean): void;
	show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
	show(column?: any, preserveFocus?: any) {
	}
	hide(): void {
	}
	dispose(): void {
	}
}
