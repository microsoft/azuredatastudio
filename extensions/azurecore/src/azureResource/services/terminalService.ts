/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import axios, { AxiosRequestConfig } from 'axios';
import * as WS from 'ws';

import { IAzureTerminalService } from '../interfaces';
import { AzureAccount, AzureAccountSecurityToken, Tenant } from '../../account-provider/interfaces';

const localize = nls.loadMessageBundle();
export class AzureTerminalService implements IAzureTerminalService {
	private readonly apiVersion = '?api-version=2018-10-01';

	public constructor(context: vscode.ExtensionContext) {

	}

	public async getOrCreateCloudConsole(account: AzureAccount, tenant: Tenant, tokens: { [key: string]: AzureAccountSecurityToken }): Promise<void> {
		const token = tokens[tenant.id].token;
		const settings: AxiosRequestConfig = {
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			validateStatus: () => true
		};

		const metadata = account.properties.providerSettings;

		const userSettingsUri = this.getConsoleUserSettingsUri(metadata.settings.armResource.endpoint);
		const userSettingsResult = await axios.get(userSettingsUri, settings);

		const preferredShell = userSettingsResult.data?.properties?.preferredShellType ?? 'bash';
		const preferredLocation = userSettingsResult.data?.properties?.preferredLocation;

		const consoleRequestUri = this.getConsoleRequestUri(metadata.settings.armResource.endpoint);
		if (preferredLocation) {
			settings.headers['x-ms-console-preferred-location'] = preferredLocation;
		}

		const provisionResult = await axios.put(consoleRequestUri, {}, settings);

		if (provisionResult.data?.properties?.provisioningState !== 'Succeeded') {
			throw new Error(provisionResult.data);
		}
		const consoleUri = provisionResult.data.properties.uri;

		return this.createTerminal(consoleUri, token, account.displayInfo.displayName, preferredShell);
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

		const terminalName = localize('azure.cloudShell', "Azure Cloud Shell (Preview)") + ` ${shell} (${accountDisplayName})`;

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
		return this.resetTerminalSize(initialDimensions);
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
		return this.resetTerminalSize(dimensions);
	}

	private async resetTerminalSize(dimensions: vscode.TerminalDimensions): Promise<void> {
		try {

			if (!this.terminalDimensions) { // first time
				this.writeEmitter.fire(localize('azure.connectingShellTerminal', "Connecting terminal...\n"));
			}

			if (dimensions) {
				this.terminalDimensions = dimensions;
			}

			// Close the shell before this and restablish a new connection
			this.close();

			const terminalUri = await this.establishTerminal(this.terminalDimensions);
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
		const terminalResult = await axios.post(`${this.consoleUri}/terminals?rows=${dimensions.rows}&cols=${dimensions.columns}&shell=${this.shell}`, undefined, {
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.token}`
			}
		});

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
