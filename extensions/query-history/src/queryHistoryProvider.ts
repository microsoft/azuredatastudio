/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { QueryHistoryItem } from './queryHistoryItem';
import { debounce, removeNewLines } from './utils';
import { CAPTURE_ENABLED_CONFIG_SECTION, ITEM_SELECTED_COMMAND_ID, PERSIST_HISTORY_CONFIG_SECTION, QUERY_HISTORY_CONFIG_SECTION } from './constants';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as loc from './localizedConstants';

const STORAGE_IV_KEY = 'queryHistory.storage-iv';
const STORAGE_KEY_KEY = 'queryHistory.storage-key';
const HISTORY_STORAGE_FILE_NAME = 'queryHistory.bin';
const STORAGE_ENCRYPTION_ALGORITHM = 'aes-256-ctr';
const HISTORY_DEBOUNCE_MS = 10000;
const DEFAULT_CAPTURE_ENABLED = true;
const DEFAULT_PERSIST_HISTORY = true;
const successIcon = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
const failedIcon = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));

export class QueryHistoryProvider implements vscode.TreeDataProvider<QueryHistoryItem>, vscode.Disposable {

	private _onDidChangeTreeData: vscode.EventEmitter<QueryHistoryItem | undefined> = new vscode.EventEmitter<QueryHistoryItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<QueryHistoryItem | undefined> = this._onDidChangeTreeData.event;

	private _queryHistoryItems: QueryHistoryItem[] = [];
	private _captureEnabled: boolean = DEFAULT_CAPTURE_ENABLED;
	private _persistHistory: boolean = DEFAULT_PERSIST_HISTORY;

	private _historyStorageFile: string;

	private _disposables: vscode.Disposable[] = [];

	private writeHistoryFileWorker: (() => void) | undefined;


	/**
	 * Mapping of query URIs to the query text being executed
	 */
	private queryTextMappings: Map<string, string> = new Map<string, string>();

	constructor(private _context: vscode.ExtensionContext) {
		this._historyStorageFile = path.join(this._context.globalStorageUri.fsPath, HISTORY_STORAGE_FILE_NAME);
		// Kick off initialization but then continue on since that may take a while and we don't want to block extension activation
		void this.initialize();
		this._disposables.push(vscode.workspace.onDidChangeConfiguration(async e => {
			if (e.affectsConfiguration(QUERY_HISTORY_CONFIG_SECTION)) {
				await this.updateConfigurationValues();
			}
		}));
		this._disposables.push(azdata.queryeditor.registerQueryEventListener({
			onQueryEvent: async (type: azdata.queryeditor.QueryEventType, document: azdata.queryeditor.QueryDocument, args: azdata.ResultSetSummary | string | undefined, queryInfo?: azdata.queryeditor.QueryInfo) => {
				if (this._captureEnabled && queryInfo) {
					if (type === 'queryStop') {
						const connectionProfile = await azdata.connection.getConnection(document.uri);
						const isSuccess = queryInfo.messages.find(m => m.isError) ? false : true;
						// Add to the front of the list so the new item appears at the top
						const queryText = this.queryTextMappings.get(document.uri);
						if (queryText === undefined) {
							console.error(`Couldn't find query text for URI ${document.uri.toString()}`);
							return;
						}
						this.queryTextMappings.delete(document.uri);
						this._queryHistoryItems.unshift({ queryText, connectionProfile, timestamp: new Date().toLocaleString(), isSuccess });
						this._onDidChangeTreeData.fire(undefined);
						this.writeHistoryFile();
					} else if (type === 'queryStart') {
						// We get the text and save it on queryStart because we want to get the query text immediately when
						// the query is started but then only add the item when it finishes (so that we can properly determine the success of the execution).
						// This avoids a race condition with the text being modified during execution and ending up with the query text at the end being
						// different than when it started.
						const textEditor = vscode.window.activeTextEditor;
						// We need to compare URIs, but the event Uri comes in as string so while it should be in the same format as
						// the textDocument uri.toString() we parse it into a vscode.Uri first to be absolutely sure.
						if (textEditor?.document.uri.toString() !== vscode.Uri.parse(document.uri).toString()) {
							// If we couldn't find the document then we can't get the text so just log the error and move on
							console.error(`Active text editor ${textEditor?.document.uri} does not match URI ${document.uri} for query event`);
							return;
						}
						// Get the text from the current selection - or the entire document if there isn't a selection (mimicking what STS is doing itself)
						const queryText = textEditor.document.getText(textEditor.selection.isEmpty ? undefined : textEditor.selection) ?? '';
						this.queryTextMappings.set(document.uri, queryText);
					}
				}
			}
		}));
	}

	/**
	 * Initializes the provider, loading the history from the previous session if it exists.
	 * @returns
	 */
	private async initialize(): Promise<void> {
		// First update our configuration values to make sure we have the settings the user has configured
		await this.updateConfigurationValues();

		let iv: Buffer | undefined;
		try {
			let ivString = await this._context.secrets.get(STORAGE_IV_KEY);
			if (!ivString) {
				iv = crypto.randomBytes(16);
				await this._context.secrets.store(STORAGE_IV_KEY, iv.toString('binary'));
			} else {
				iv = Buffer.from(ivString, 'binary');
			}
		} catch (err) {
			console.error(`Error getting persistance storage IV: ${err}`);
			// An IV is required to read/write the encrypted file so if we can't get it then just fail early
			return;
		}


		let key: string | undefined;
		try {
			key = await this._context.secrets.get(STORAGE_KEY_KEY);
			if (!key) {
				// Generate a random key - this is internal to the extension so the user doesn't need to know it
				key = crypto.createHash('sha256').update(crypto.randomBytes(64)).digest('base64').substring(0, 32);
				await this._context.secrets.store(STORAGE_KEY_KEY, key);
			}
		} catch (err) {
			console.error(`Error getting persistance storage key: ${err}`);
			// A key is required to read/write the encrypted file so if we can't get it then just fail early
			return;
		}

		this.writeHistoryFileWorker = (): void => {
			if (this._persistHistory) {
				try {
					// We store the history entries in an encrypted file because they may contain sensitive information
					// such as passwords (even in the query text itself)
					const cipher = crypto.createCipheriv(STORAGE_ENCRYPTION_ALGORITHM, key!, iv!);
					const stringifiedItems = JSON.stringify(this._queryHistoryItems);
					const encryptedText = Buffer.concat([cipher.update(Buffer.from(stringifiedItems)), cipher.final()]);
					// Use sync here so that we can write this out when the object is disposed
					fs.writeFileSync(this._historyStorageFile, encryptedText);
				} catch (err) {
					console.error(`Error writing query history to disk: ${err}`);
				}

			}
		};

		// If we're not persisting the history then we can skip even trying to load the file (which shouldn't exist)
		if (!this._persistHistory) {
			return;
		}

		try {
			// Read and decrypt any previous history items
			const encryptedItems = await fs.promises.readFile(this._historyStorageFile);
			const decipher = crypto.createDecipheriv(STORAGE_ENCRYPTION_ALGORITHM, key, iv);
			const result = Buffer.concat([decipher.update(encryptedItems), decipher.final()]).toString();
			this._queryHistoryItems = JSON.parse(result);
			this._onDidChangeTreeData.fire(undefined);
		} catch (err) {
			// Ignore ENOENT errors, those are expected if the storage file doesn't exist (on first run or if results aren't being persisted)
			if (err.code !== 'ENOENT') {
				console.error(`Error deserializing stored history items: ${err}`);
				void vscode.window.showWarningMessage(loc.errorLoading(err));
				// Rename the file to avoid attempting to load a potentially corrupted or unreadable file every time we start up, we'll make
				// a new one next time we write the history file
				try {
					const bakPath = path.join(path.dirname(this._historyStorageFile), `${HISTORY_STORAGE_FILE_NAME}.bak`);
					await fs.promises.rename(this._historyStorageFile, bakPath);
				} catch (err) {
					console.error(`Error moving corrupted history file: ${err}`);
				}
			}

		}
	}

	/**
	 * Write the query history items to our encrypted file. This is debounced to
	 * prevent doing unnecessary writes if the user is executing many queries in
	 * a row
	 */
	@debounce(HISTORY_DEBOUNCE_MS)
	private writeHistoryFile(): void {
		this.writeHistoryFileWorker?.();
	}

	public async clearAll(): Promise<void> {
		this._queryHistoryItems = [];
		this.writeHistoryFile();
		this._onDidChangeTreeData.fire(undefined);
	}

	public async deleteItem(item: QueryHistoryItem): Promise<void> {
		this._queryHistoryItems = this._queryHistoryItems.filter(n => n !== item);
		this.writeHistoryFile();
		this._onDidChangeTreeData.fire(undefined);
	}

	public getTreeItem(item: QueryHistoryItem): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(removeNewLines(item.queryText), vscode.TreeItemCollapsibleState.None);
		treeItem.iconPath = item.isSuccess ? successIcon : failedIcon;
		treeItem.tooltip = item.queryText;
		treeItem.description = item.connectionProfile ? `${item.connectionProfile.serverName}|${item.connectionProfile.databaseName} ${item.timestamp}` : item.timestamp;
		treeItem.command = { title: '', command: ITEM_SELECTED_COMMAND_ID, arguments: [item] };
		return treeItem;
	}

	public getChildren(element?: QueryHistoryItem): QueryHistoryItem[] {
		// We only have top level items
		return this._queryHistoryItems;
	}

	public dispose(): void {
		this._disposables.forEach(d => d.dispose());
		// Call the worker directly to skip the debounce
		this.writeHistoryFileWorker?.();
	}

	private async updateConfigurationValues(): Promise<void> {
		const configSection = vscode.workspace.getConfiguration(QUERY_HISTORY_CONFIG_SECTION);
		this._captureEnabled = configSection.get(CAPTURE_ENABLED_CONFIG_SECTION, DEFAULT_CAPTURE_ENABLED);
		this._persistHistory = configSection.get(PERSIST_HISTORY_CONFIG_SECTION, DEFAULT_PERSIST_HISTORY);
		if (!this._persistHistory) {
			// If we're no longer persisting the history then clean up our storage file
			try {
				await fs.promises.rmdir(this._historyStorageFile);
			} catch (err) {
				// Ignore ENOENT errors, those are expected if the storage file doesn't exist (on first run or if results aren't being persisted)
				if (err.code !== 'ENOENT') {
					// Best effort, we don't want other things to fail if we can't delete the file for some reason
					console.error(`Error cleaning up query history storage: ${this._historyStorageFile}. ${err}`);
				}
			}
		} else {
			this.writeHistoryFile();
		}
	}

	/**
	 * Set whether query history capture is currently enabled
	 * @param enabled Whether capture is currently enabled
	 * @returns A promise that resolves when the value is updated and persisted to configuration
	 */
	public async setCaptureEnabled(enabled: boolean): Promise<void> {
		this._captureEnabled = enabled;
		return vscode.workspace.getConfiguration(QUERY_HISTORY_CONFIG_SECTION).update(CAPTURE_ENABLED_CONFIG_SECTION, this._captureEnabled, vscode.ConfigurationTarget.Global);
	}

	/**
	 * Set whether query history persistence is currently enabled
	 * @param enabled Whether persistence is currently enabled
	 * @returns A promise that resolves when the value is updated and persisted to configuration
	 */
	public async setPersistenceEnabled(enabled: boolean): Promise<void> {
		this._persistHistory = enabled;
		return vscode.workspace.getConfiguration(QUERY_HISTORY_CONFIG_SECTION).update(PERSIST_HISTORY_CONFIG_SECTION, this._persistHistory, vscode.ConfigurationTarget.Global);
	}
}
