/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as crypto from 'crypto';
import * as os from 'os';
import vscode = require('vscode');
import { Constants } from './constants';
import { ExtensionContext } from 'vscode';
var path = require('path');

export namespace Utils {
	// INTERFACES /////////////////////////////////////////////////////////////////////////////////////

	// Interface for package.json information
	export interface IPackageInfo {
		name: string;
		version: string;
		aiKey: string;
	}

	// FUNCTIONS //////////////////////////////////////////////////////////////////////////////////////

	// Get information from the extension's package.json file
	export function getPackageInfo(context: ExtensionContext): IPackageInfo {
		let extensionPackage = require(context.asAbsolutePath('./package.json'));
		if (extensionPackage) {
			return {
				name: extensionPackage.name,
				version: extensionPackage.version,
				aiKey: extensionPackage.aiKey
			};
		}
	}

	// Generate a new GUID
	export function generateGuid(): string {
		let hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
		// c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
		let oct: string = '';
		let tmp: number;
		/* tslint:disable:no-bitwise */
		for (let a: number = 0; a < 4; a++) {
			tmp = (4294967296 * Math.random()) | 0;
			oct += hexValues[tmp & 0xF] +
				hexValues[tmp >> 4 & 0xF] +
				hexValues[tmp >> 8 & 0xF] +
				hexValues[tmp >> 12 & 0xF] +
				hexValues[tmp >> 16 & 0xF] +
				hexValues[tmp >> 20 & 0xF] +
				hexValues[tmp >> 24 & 0xF] +
				hexValues[tmp >> 28 & 0xF];
		}

		// 'Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively'
		let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
		return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
		/* tslint:enable:no-bitwise */
	}

	// Generate a unique, deterministic ID for the current user of the extension
	export function generateUserId(): Promise<string> {
		return new Promise<string>(resolve => {
			try {
				let interfaces = os.networkInterfaces();
				let mac;
				for (let key of Object.keys(interfaces)) {
					let item = interfaces[key][0];
					if (!item.internal) {
						mac = item.mac;
						break;
					}
				}
				if (mac) {
					resolve(crypto.createHash('sha256').update(mac + os.homedir(), 'utf8').digest('hex'));
				} else {
					resolve(generateGuid());
				}
			} catch (err) {
				resolve(generateGuid()); // fallback
			}
		});
	}

	// Retrieve the URI for the currently open file if there is one; otherwise return the empty string
	export function getActiveTextEditorUri(): string {
		if (typeof vscode.window.activeTextEditor !== 'undefined' &&
			typeof vscode.window.activeTextEditor.document !== 'undefined') {
			return vscode.window.activeTextEditor.document.uri.toString();
		}
		return '';
	}

	// Helper to log debug messages
	export function logDebug(msg: any, extensionConfigSectionName: string): void {
		let config = vscode.workspace.getConfiguration(extensionConfigSectionName);
		let logDebugInfo = config[Constants.configLogDebugInfo];
		if (logDebugInfo === true) {
			let currentTime = new Date().toLocaleTimeString();
			let outputMsg = '[' + currentTime + ']: ' + msg ? msg.toString() : '';
			console.log(outputMsg);
		}
	}

	// Helper to show an error message
	export function showErrorMsg(msg: string, extensionName: string): void {
		vscode.window.showErrorMessage(extensionName + ': ' + msg);
	}

	export function isEmpty(str: any): boolean {
		return (!str || '' === str);
	}

	// The function is a duplicate of \src\paths.js. IT would be better to import path.js but it doesn't
	// work for now because the extension is running in different process.
	export function getAppDataPath() {
		var platform = process.platform;
		switch (platform) {
			case 'win32': return process.env['APPDATA'] || path.join(process.env['USERPROFILE'], 'AppData', 'Roaming');
			case 'darwin': return path.join(os.homedir(), 'Library', 'Application Support');
			case 'linux': return process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
			default: throw new Error('Platform not supported');
		}
	}

	export function getDefaultLogLocation() {
		return path.join(getAppDataPath(), 'sqlops');
	}
}
