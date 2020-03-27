/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import * as WS from 'ws';

import { IAzureTerminalService } from '../interfaces';
import { AzureAccount, AzureAccountSecurityToken, Tenant } from '../../account-provider/interfaces';

const localize = nls.loadMessageBundle();
export class AzureTerminalService implements IAzureTerminalService {
	private readonly apiVersion = '?api-version=2018-10-01';

	public constructor(context: vscode.ExtensionContext) {

	}

	public async getOrCreateCloudConsole(account: AzureAccount, tenant: Tenant, tokens: { [key: string]: AzureAccountSecurityToken }): Promise<void> {
		const metadata = account.properties.providerSettings;
		const consoleRequestUri = this.getConsoleUri(metadata.settings.armResource.endpoint);
		const token = tokens[tenant.id].token;

		const provisionResult = await axios.post(consoleRequestUri,
			{
				properties: {
					'osType': 'linux'
				}
			},
			{
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				}
			}
		);


		if (provisionResult.data?.properties?.provisioningState !== 'Succeeded') {
			throw new Error(provisionResult.data);
		}

		const consoleUri = provisionResult.data.properties.uri;
		return this.createTerminal(consoleUri, token, account.displayInfo.displayName);
	}


	private async createTerminal(provisionedUri: string, token: string, accountDisplayName: string): Promise<void> {
		let shell = await vscode.window.showQuickPick(['Bash', 'PowerShell'], { canPickMany: false });
		if (!shell) {
			vscode.window.showErrorMessage(localize('azure.shellTypeRequired', "You must pick a shell type"));
			return;
		}

		const terminalName = localize('azure.cloudConsole', "Azure Cloud Shell") + ` ${shell} (${accountDisplayName})`;

		if (shell === 'PowerShell') {
			shell = 'pwsh';
		}
		shell = shell.toLowerCase();

		const azureTerminal = new AzureTerminal(provisionedUri, token, shell);
		const terminal = vscode.window.createTerminal({
			name: terminalName,
			pty: azureTerminal
		});

		terminal.show();
	}

	public getConsoleUri(armEndpoint: string): string {
		return `${armEndpoint}/providers/Microsoft.Portal/consoles/default${this.apiVersion}`;
	}
}

class AzureTerminal implements vscode.Pseudoterminal {
	private readonly writeEmitter: vscode.EventEmitter<string>;
	public readonly onDidWrite: vscode.Event<string>;

	private socket: WS;
	private terminalDimensions: vscode.TerminalDimensions;

	constructor(private consoleUri: string, private token: string, private shell: string) {
		this.writeEmitter = new vscode.EventEmitter<string>();
		this.onDidWrite = this.writeEmitter.event;
	}

	handleInput(data: string): void {
		this.socket.send(data);
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
	}

	async setDimensions(dimensions: vscode.TerminalDimensions): Promise<void> {
		return this.resetTerminalSize(dimensions);
	}

	private async resetTerminalSize(dimensions: vscode.TerminalDimensions): Promise<void> {
		try {
			if (dimensions) {
				this.terminalDimensions = dimensions;
			}
			if (!this.terminalDimensions) {
				vscode.window.showErrorMessage(localize('azure.terminalDimensionsError', "Terminal dimensions broken :("));
				throw new Error('Terminal dimensions broken');
			}

			if (this.socket) {
				this.socket.removeAllListeners('open');
				this.socket.removeAllListeners('message');
				this.socket.removeAllListeners('close');

				this.socket.terminate();
			}

			const terminalUri = await this.createTerminalForCloudConsole(this.terminalDimensions);
			this.socket = new WS(terminalUri);

			this.socket.on('message', (data: WS.Data) => {
				// Write to the console
				this.writeEmitter.fire(data.toString());
			});

			// Reconnect if something bad happens
			this.socket.on('close', () => {
				this.resetTerminalSize(this.terminalDimensions).catch(e => console.error(e));
			});

			// Keep alives
			setInterval(() => {
				this.socket.ping();
			}, 5000);
		} catch (ex) {
			console.log(ex);
		}
	}


	private async createTerminalForCloudConsole(dimensions: vscode.TerminalDimensions): Promise<string> {
		const terminalRequest = request({
			uri: `${this.consoleUri}/terminals?rows=${dimensions.rows}&cols=${dimensions.columns}&shell=${this.shell}`,
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.token}`
			},
			json: true,
			simple: false,
		});

		const terminalResult = await terminalRequest;


		const terminalUri = terminalResult.socketUri;

		if (terminalResult.error) {
			vscode.window.showErrorMessage(terminalResult.error.message);
		}

		if (!terminalUri) {
			console.log(terminalResult);
			throw new Error(terminalResult);
		}

		return terminalUri;
	}
}
