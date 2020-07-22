/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as WS from 'ws';

import { IAzureTerminalService } from '../interfaces';
import { AzureAccount, Tenant } from '../../account-provider/interfaces';

const localize = nls.loadMessageBundle();


const handleNeverUsed = async (): Promise<void> => {
	const neverUsedString = localize('azure.coudTerminal.neverUsed', "If you have not launched Azure Cloud Shell from this account before, please visit https://shell.azure.com/ to get started. Once you are set up, you can use AzureCloud Shell directly in Azure Data Studio.");
	enum TerminalOption {
		OPEN_SITE,
		OK
	}
	interface TerminalMessageItem extends vscode.MessageItem {
		action: TerminalOption;
	}

	const openAzureShellButton: TerminalMessageItem = {
		action: TerminalOption.OPEN_SITE,
		title: localize('azure.cloudTerminal.openAzureShell', "Open Azure Shell")
	};

	const okButton: TerminalMessageItem = {
		action: TerminalOption.OK,
		title: localize('azure.cloudTerminal.ok', "OK")
	};

	const option = await vscode.window.showInformationMessage<TerminalMessageItem>(neverUsedString, openAzureShellButton, okButton);

	if (option.action === TerminalOption.OPEN_SITE) {
		vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/AA83f8f'));
	}
};

export class AzureTerminalService implements IAzureTerminalService {
	private readonly apiVersion = '?api-version=2018-10-01';

	public constructor(context: vscode.ExtensionContext) {

	}

	public async getOrCreateCloudConsole(account: AzureAccount, tenant: Tenant): Promise<void> {
		const token = await azdata.accounts.getAccountSecurityToken(account, tenant.id, azdata.AzureResource.MicrosoftResourceManagement);
		const settings: AxiosRequestConfig = {
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token.token}`
			},
			validateStatus: () => true
		};

		const metadata = account.properties.providerSettings;
		const userSettingsUri = this.getConsoleUserSettingsUri(metadata.settings.armResource.endpoint);

		let userSettingsResult: AxiosResponse<any>;
		try {
			userSettingsResult = await axios.get(userSettingsUri, settings);
		} catch (ex) {
			console.log(ex, ex.response);
			await handleNeverUsed();
			return;
		}

		const preferredShell = userSettingsResult.data?.properties?.preferredShellType ?? 'bash';
		const preferredLocation = userSettingsResult.data?.properties?.preferredLocation;

		const consoleRequestUri = this.getConsoleRequestUri(metadata.settings.armResource.endpoint);
		if (preferredLocation) {
			settings.headers['x-ms-console-preferred-location'] = preferredLocation;
		}

		let provisionResult: AxiosResponse<any>;
		try {
			provisionResult = await axios.put(consoleRequestUri, {}, settings);
		} catch (ex) {
			console.log(ex, ex.response);
			await handleNeverUsed();
			return;
		}

		if (provisionResult.data?.properties?.provisioningState !== 'Succeeded') {
			throw new Error(provisionResult.data);
		}
		const consoleUri = provisionResult.data.properties.uri;

		return this.createTerminal(consoleUri, token.token, account.displayInfo.displayName, preferredShell);
	}


	private async createTerminal(provisionedUri: string, token: string, accountDisplayName: string, preferredShell: string): Promise<void> {
		class ShellType implements vscode.QuickPickItem {
			constructor(public readonly label: string, public readonly value: string) {
			}
		}

		const shells = [new ShellType('PowerShell', 'pwsh'), new ShellType('Bash', 'bash'),];
		const idx = shells.findIndex(s => s.value === preferredShell);

		const prefShell = shells.splice(idx, 1);
		shells.unshift(prefShell[0]);

		let shell = await vscode.window.showQuickPick(shells, {
			canPickMany: false,
			placeHolder: localize('azure.selectShellType', "Select Bash or PowerShell for Azure Cloud Shell")
		});

		if (!shell) {
			vscode.window.showErrorMessage(localize('azure.shellTypeRequired', "You must pick a shell type"));
			return;
		}

		const terminalName = localize('azure.cloudShell', "Azure Cloud Shell (Preview) {0} ({1})", shell.label, accountDisplayName);

		const azureTerminal = new AzureTerminal(provisionedUri, token, shell.value);
		const terminal = vscode.window.createTerminal({
			name: terminalName,
			pty: azureTerminal
		});

		terminal.show();
	}

	public getConsoleRequestUri(armEndpoint: string): string {
		return `${armEndpoint}/providers/Microsoft.Portal/consoles/default${this.apiVersion}`;
	}

	public getConsoleUserSettingsUri(armEndpoint: string): string {
		return `${armEndpoint}/providers/Microsoft.Portal/userSettings/cloudconsole${this.apiVersion}`;
	}
}

class AzureTerminal implements vscode.Pseudoterminal {
	private readonly writeEmitter: vscode.EventEmitter<string>;
	public readonly onDidWrite: vscode.Event<string>;

	private socket: WS;
	private intervalTimer: NodeJS.Timer;
	private terminalDimensions: vscode.TerminalDimensions;

	constructor(private readonly consoleUri: string, private readonly token: string, private shell: string) {
		this.writeEmitter = new vscode.EventEmitter<string>();
		this.onDidWrite = this.writeEmitter.event;
	}

	handleInput(data: string): void {
		this.socket?.send(data);
	}

	async open(initialDimensions: vscode.TerminalDimensions): Promise<void> {
		this.setDimensions(initialDimensions);
	}

	close(): void {
		if (!this.socket) { return; }

		this.socket.removeAllListeners('open');
		this.socket.removeAllListeners('message');
		this.socket.removeAllListeners('close');

		this.socket.terminate();
		if (this.intervalTimer) {
			clearInterval(this.intervalTimer);
		}
	}

	async setDimensions(dimensions: vscode.TerminalDimensions): Promise<void> {
		if (!dimensions) {
			return;
		}
		this.terminalDimensions = dimensions;
		return this.resetTerminalSize();
	}

	private async resetTerminalSize(): Promise<void> {
		try {
			// Close the shell before this and restablish a new connection
			this.close();

			const terminalUri = await this.establishTerminal(this.terminalDimensions);
			if (!terminalUri) {
				return;
			}
			this.socket = new WS(terminalUri);

			this.socket.on('message', (data: WS.Data) => {
				// Write to the console
				this.writeEmitter.fire(data.toString());
			});

			this.socket.on('close', () => {
				this.writeEmitter.fire(localize('azure.shellClosed', "Shell closed.\n"));
				this.close();
			});

			// Keep alives
			this.intervalTimer = setInterval(() => {
				this.socket.ping();
			}, 5000);
		} catch (ex) {
			console.log(ex);
		}
	}


	private async establishTerminal(dimensions: vscode.TerminalDimensions): Promise<string> {
		let terminalResult: AxiosResponse<any>;
		try {
			terminalResult = await axios.post(`${this.consoleUri}/terminals?rows=${dimensions.rows}&cols=${dimensions.columns}&shell=${this.shell}`, undefined, {
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.token}`
				}
			});
		} catch (ex) {
			console.log(ex, ex.response);
			await handleNeverUsed();
			return undefined;
		}

		const terminalUri = terminalResult.data?.socketUri;

		if (terminalResult.data.error) {
			vscode.window.showErrorMessage(terminalResult.data.error.message);
		}

		if (!terminalUri) {
			console.log(terminalResult);
			throw new Error(terminalResult.data);
		}

		return terminalUri;
	}
}
