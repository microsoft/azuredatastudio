/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as loc from '../localizedConstants';

export class Logger {

	public static channel: vscode.OutputChannel = vscode.window.createOutputChannel(loc.extensionName);

	private static _piiLogging: boolean = false;

	static log(msg: any, ...vals: any[]) {
		const fullMessage = `${msg} - ${vals.map(v => JSON.stringify(v)).join(' - ')}`;
		this.channel.appendLine(fullMessage);
	}

	static error(msg: any, ...vals: any[]) {
		const fullMessage = `${msg} - ${vals.map(v => JSON.stringify(v)).join(' - ')}`;
		this.channel.appendLine(fullMessage);
	}

	/**
	 * Logs a message containing PII (when enabled). Provides the ability to sanitize or shorten values to hide information or reduce the amount logged.
	 * @param msg The initial message to log
	 * @param objsToSanitize Set of objects we want to sanitize
	 * @param stringsToShorten Set of strings to shorten
	 * @param vals Any other values to add on to the end of the log message
	 */
	static pii(msg: any, objsToSanitize: { name: string, objOrArray: any | any[] }[], stringsToShorten: { name: string, value: string }[], ...vals: any[]) {
		if (this.piiLogging) {
			msg = [
				msg,
				...objsToSanitize.map(obj => `${obj.name}=${sanitize(obj.objOrArray)}`),
				...stringsToShorten.map(str => `${str.name}=${shorten(str.value)}`)
			].join(' ');
			Logger.log(msg, vals);
		}
	}

	public static set piiLogging(val: boolean) {
		this._piiLogging = val;
	}

	public static get piiLogging(): boolean {
		return this._piiLogging;
	}
}

/**
 * Sanitizes a given object for logging to the output window, removing/shortening any PII or unneeded values
 * @param objOrArray The object to sanitize for output logging
 * @returns The stringified version of the sanitized object
 */
function sanitize(objOrArray: any): string {
	if (Array.isArray(objOrArray)) {
		return JSON.stringify(objOrArray.map(o => sanitizeImpl(o)));
	} else {
		return sanitizeImpl(objOrArray);
	}
}

function sanitizeImpl(obj: any): string {
	obj = Object.assign({}, obj);
	delete obj.domains; // very long and not really useful
	// shorten all tokens since we don't usually need the exact values and there's security concerns if they leaked
	shortenIfExists(obj, 'token');
	shortenIfExists(obj, 'refresh_token');
	shortenIfExists(obj, 'access_token');
	return JSON.stringify(obj);
}

/**
 * Shortens the given string property on an object if it exists, otherwise does nothing
 * @param obj The object possibly containing the property
 * @param property The name of the property to shorten - if it exists
 */
function shortenIfExists(obj: any, property: string): void {
	if (obj[property]) {
		obj[property] = shorten(obj[property]);
	}
}

/**
 * Shortens a given string - if it's longer than 6 characters will return the first 3 characters
 * followed by a ... followed by the last 3 characters. Returns the original string if 6 characters
 * or less.
 * @param str The string to shorten
 * @returns Shortened string in the form 'xxx...xxx'
 */
function shorten(str?: string): string | undefined {
	// Don't shorten if adding the ... wouldn't make the string shorter
	if (!str || str.length < 10) {
		return str;
	}
	return `${str.substr(0, 3)}...${str.slice(-3)}`;
}
