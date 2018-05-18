/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
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
import { resolve } from 'dns';

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
		});
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

	//'color' | 'date' | 'datetime-local' | 'email' | 'month' | 'number' | 'password' | 'range' | 'search' | 'text' | 'time' | 'url' | 'week';

	sqlops.ui.registerModelViewProvider('dialogContent1', async view => {
		let inputBox1 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'color' })
			.component();
		let inputBox2 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'date' })
			.component();
		let inputBox3 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'datetime-local' })
			.component();
		let inputBox4 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'email' })
			.component();
		let inputBox5 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'month' })
			.component();
		let inputBox6 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'number' })
			.component();
		let inputBox7 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'password', required: true })
			.component();
		let inputBox8 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'range' })
			.component();
		let inputBox9 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'search' })
			.component();
		let inputBox10 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'text' })
			.component();
		let inputBox11 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'time' })
			.component();
		let inputBox12 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'url' })
			.component();
		let inputBox13 = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'week' })
			.component();
		let formModel = view.modelBuilder.formContainer()
			.withFormItems([{
				component: inputBox1,
				title: 'Color',
				actions: [
					view.modelBuilder.button().withProperties({ label: 'Button 1' }).component(),
					view.modelBuilder.button().withProperties({ label: 'Button 2' }).component(),
				]
			},
			{
				component: inputBox2,
				title: 'Date',
				actions: [
					view.modelBuilder.button().withProperties({ label: 'Button 1' }).component(),
				]
			},
			{
				component: inputBox3,
				title: 'Datetime-local'
			},
			{
				component: inputBox4,
				title: 'Email'
			},
			{
				component: inputBox5,
				title: 'Month'
			},
			{
				component: inputBox6,
				title: 'Number'
			},
			{
				component: inputBox7,
				title: 'Password'
			},
			{
				component: inputBox8,
				title: 'Range'
			},
			{
				component: inputBox9,
				title: 'Search'
			},
			{
				component: inputBox10,
				title: 'Text'
			},
			{
				component: inputBox11,
				title: 'Time'
			},
			{
				component: inputBox12,
				title: 'Url'
			},
			{
				component: inputBox13,
				title: 'Week'
			},
			], {
				horizontal: true,
				componentWidth: undefined,
				width: undefined
			}).component();
		await view.initializeModel(formModel);
	});

	sqlops.ui.registerModelViewProvider('dialogContent2', async view => {
		let inputBox = view.modelBuilder.inputBox()
			.withValidation(component => component.value === 'valid')
			.component();
		let inputBox2 = view.modelBuilder.inputBox()
			.withValidation(component => component.value === 'valid')
			.component();
		let formModel = view.modelBuilder.formContainer()
			.withFormItems([{
				component: inputBox,
				title: 'Enter "valid"',
				actions: [
					view.modelBuilder.button().withProperties({ label: 'Button 1' }).component(),
					view.modelBuilder.button().withProperties({ label: 'Button 2' }).component(),
				]
			}, {
				component: inputBox2,
				title: 'Item 2',
				actions: [
					view.modelBuilder.button().withProperties({ label: 'Button 1' }).component(),
				]
			}], {
				horizontal: false,
				componentWidth: undefined,
				width: 100
			}).component();
		await view.initializeModel(formModel);
	});

	vscode.commands.registerCommand('mssql.openTestDialog', () => {
		let dialog = sqlops.window.modelviewdialog.createDialog('Test dialog');
		let tab1 = sqlops.window.modelviewdialog.createTab('Tab 1');
		tab1.content = 'dialogContent1';
		let tab2 = sqlops.window.modelviewdialog.createTab('Tab 2');
		tab2.content = 'dialogContent2';
		dialog.content = [tab1, tab2];
		dialog.onValidityChanged(valid => {
			console.log('dialog is ' + dialog.valid + ', validity is ' + valid);
			dialog.okButton.enabled = valid;
		});
		tab1.onValidityChanged(valid => {
			console.log('tab 1 validity changed: ' + valid);
			console.log('tab 1 valid property is ' + tab1.valid);
		});
		tab2.onValidityChanged(valid => {
			console.log('tab 2 validity changed: ' + valid);
			console.log('tab 2 valid property is ' + tab2.valid);
		});
		dialog.onValidityChanged(valid => {
			console.log('dialog validity changed: ' + valid);
			console.log('dialog valid property is ' + dialog.valid);
		});
		sqlops.window.modelviewdialog.openDialog(dialog);
		// sqlops.workspace.openModelViewEditor('Test Model View', 'dialogContent1');
	});

	vscode.commands.registerCommand('mssql.openTestWizard', () => {
		let page1 = sqlops.window.modelviewdialog.createWizardPage('Page 1');
		page1.content = 'dialogContent1';
		page1.onValidityChanged(valid => {
			console.log('page 1 validity changed: ' + valid);
			console.log('page 1 valid property is ' + page1.valid);
		});
		let page2 = sqlops.window.modelviewdialog.createWizardPage('Page 2');
		page2.content = 'dialogContent2';
		page2.onValidityChanged(valid => {
			console.log('page 2 validity changed: ' + valid);
			console.log('page 2 valid property is ' + page2.valid);
		});
		let wizard = sqlops.window.modelviewdialog.createWizard('Test Wizard');
		wizard.pages = [page1, page2];
		wizard.onPageChanged(info => console.log('Page changed! Last page: ' + info.lastPage + ', new page: ' + info.newPage));
		wizard.cancelButton.onClick(() => console.log('wizard canceled'));
		wizard.doneButton.onClick(() => console.log('wizard done'));
		wizard.nextButton.onClick(() => console.log('wizard next button clicked'));
		wizard.backButton.onClick(() => console.log('wizard back button clicked'));
		sqlops.window.modelviewdialog.openWizard(wizard);
	});

	// vscode.commands.registerCommand('mssql.openTestDialog2', () => {
	// 	sqlops.workspace.openModelViewEditor('Test Model View', 'dialogContent1');
	// });

	// sqlops.dashboard.registerModelViewProvider('tab1content', async (view) => {
	// 	let flexModel = view.modelBuilder.flexContainer()
	// 		.withLayout({
	// 			flexFlow: 'row',
	// 			alignItems: 'center'
	// 		}).withItems([
	// 			// 1st child panel with N cards
	// 			view.modelBuilder.flexContainer()
	// 				.withLayout({
	// 					flexFlow: 'column',
	// 					alignItems: 'center',
	// 					justifyContent: 'center'
	// 				})
	// 				.withItems([
	// 					view.modelBuilder.card()
	// 						.withProperties<sqlops.CardProperties>({
	// 							label: 'label1',
	// 							value: 'value1',
	// 							actions: [{ label: 'action', taskId: 'sqlservices.clickTask' }]
	// 						})
	// 						.component()
	// 				]).component(),
	// 			// 2nd child panel with N cards
	// 			view.modelBuilder.flexContainer()
	// 				.withLayout({ flexFlow: 'column' })
	// 				.withItems([
	// 					view.modelBuilder.inputBox()
	// 						.withProperties<sqlops.InputBoxProperties>({
	// 							value: 'value2'
	// 						})
	// 						.component()
	// 				]).component()
	// 		], { flex: '1 1 50%' })
	// 		.component();
	// 	await view.initializeModel(flexModel);
	// });

	// let modelView: sqlops.ModelView;
	// let tab2FirstContainer: sqlops.FlexContainer;
	// let tab2Valid: boolean = false;
	// let resolveContentLoaded: () => void;
	// let contentLoaded = new Promise(resolve => resolveContentLoaded = resolve);

	// sqlops.dashboard.registerModelViewProvider('tab2content', async (view) => {
	// 	modelView = view;
	// 	tab2FirstContainer = view.modelBuilder.flexContainer()
	// 		.withLayout({
	// 			flexFlow: 'column',
	// 			alignItems: 'center',
	// 			justifyContent: 'center'
	// 		})
	// 		.withItems([
	// 			view.modelBuilder.inputBox()
	// 				.withProperties<sqlops.InputBoxProperties>({
	// 					value: 'value1'
	// 				})
	// 				.withValidation(component => {
	// 					if (component.value === 'valid') {
	// 						console.log('valid!');
	// 						return true;
	// 					} else {
	// 						console.log('invalid');
	// 						return false;
	// 					}
	// 				})
	// 				.component()
	// 		])
	// 		.withValidation(component => tab2Valid)
	// 		.component();
	// 	let flexModel = view.modelBuilder.flexContainer()
	// 		.withLayout({
	// 			flexFlow: 'row',
	// 			alignItems: 'center'
	// 		}).withItems([
	// 			// 1st child panel with N cards
	// 			tab2FirstContainer,
	// 			// 2nd child panel with N cards
	// 			view.modelBuilder.flexContainer()
	// 				.withLayout({ flexFlow: 'column' })
	// 				.withItems([
	// 					view.modelBuilder.card()
	// 						.withProperties<sqlops.CardProperties>({
	// 							label: 'label2',
	// 							value: 'value2',
	// 							actions: [{ label: 'action', taskId: 'sqlservices.clickTask' }]
	// 						})
	// 						.component()
	// 				]).component()
	// 		], { flex: '1 1 50%' })
	// 		.component();
	// 	await view.initializeModel(flexModel);
	// 	resolveContentLoaded();
	// });

	// vscode.commands.registerCommand('mssql.openTestDialog', () => {
	// 	tab2Valid = false;
	// 	resolveContentLoaded = undefined;
	// 	contentLoaded = new Promise(resolve => resolveContentLoaded = resolve);
	// 	let dialog = sqlops.window.modelviewdialog.createDialog('Test dialog');
	// 	let tab1 = sqlops.window.modelviewdialog.createTab('Test tab 1');
	// 	tab1.content = 'tab1content';
	// 	let tab2 = sqlops.window.modelviewdialog.createTab('Test tab 2');
	// 	tab2.content = 'tab2content';
	// 	dialog.content = [tab1, tab2];
	// 	dialog.okButton.onClick(() => console.log('ok clicked!'));
	// 	dialog.cancelButton.onClick(() => console.log('cancel clicked!'));
	// 	dialog.cancelButton.enabled = false;
	// 	dialog.okButton.label = 'ok';
	// 	dialog.cancelButton.label = 'no';
	// 	dialog.okButton.enabled = false;
	// 	let customButton1 = sqlops.window.modelviewdialog.createButton('Test button 1');
	// 	customButton1.onClick(() => console.log('button 1 clicked!'));
	// 	customButton1.enabled = false;
	// 	let customButton2 = sqlops.window.modelviewdialog.createButton('Test button 2');
	// 	customButton2.onClick(() => console.log('button 2 clicked!'));
	// 	dialog.customButtons = [customButton1, customButton2];
	// 	contentLoaded.then(() => {
	// 		modelView.onValidityChanged(valid => {
	// 			if (valid) {
	// 				dialog.okButton.enabled = true;
	// 			} else {
	// 				dialog.okButton.enabled = false;
	// 			}
	// 		});
	// 		// tab2FirstContainer.validate();
	// 	});
	// 	sqlops.window.modelviewdialog.openDialog(dialog);
	// 	setTimeout(() => {
	// 		tab2Valid = true;
	// 		tab2FirstContainer.validate();
	// 	}, 10000);
	// setTimeout(() => {
	// 	dialog.okButton.label = 'done';
	// 	dialog.cancelButton.enabled = true;
	// 	customButton1.enabled = true;
	// 	customButton2.enabled = false;
	// 	customButton2.label = 'disabled button 2';
	// 	customButton1.hidden = true;
	// 	dialog.cancelButton.hidden = true;
	// 	dialog.okButton.hidden = false;
	// 	if (tab2FirstContainer) {
	// 		tab2FirstContainer.addItem(modelView.modelBuilder.card()
	// 			.withProperties<sqlops.CardProperties>({
	// 				label: 'newCard',
	// 				value: 'newValue',
	// 				actions: [{ label: 'action', taskId: 'sqlservices.clickTask' }]
	// 			})
	// 			.component());
	// 	}
	// 	// sqlops.window.modelviewdialog.closeDialog(dialog);
	// 	// sqlops.window.modelviewdialog.closeDialog(dialog);
	// }, 5000);
	// });
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
