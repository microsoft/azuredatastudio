/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface ConnectionProfile {
	providerId: string;
	connectionId: string;
	connectionName: string;
	serverName: string;
	databaseName: string;
	userName: string;
	password: string;
	authenticationType: string;
	savePassword: boolean;
	groupFullName: string;
	groupId: string;
	saveProfile: boolean;
	azureTenantId?: string;
	options: { [name: string]: any };
}

class QueryString {
	private readonly queryMap = new Map<string, string>();

	add(key: string, value?: string): void {
		if (!value) {
			return;
		}
		this.queryMap.set(key, value);
	}

	toString(): string {
		if (this.queryMap.size === 0) {
			return '';
		}

		let ret = '?';

		for (const [entry, value] of this.queryMap.entries()) {
			if (ret !== '?') {
				ret += '&';
			}
			ret += `${entry}=${value}`;
		}

		return ret;
	}
}

export function uriFromConnection(profile: ConnectionProfile): vscode.Uri {
	// we have to create a uri string then parse that
	const queryString = new QueryString();
	queryString.add('authenticationType', profile.authenticationType);
	const connString = `${profile.providerId}://${profile.userName ? `${profile.userName}@` : ''}${profile.serverName}/${profile.databaseName}${queryString.toString()}`;
	return vscode.Uri.parse(connString);
}

export interface DataWorkspaceJsonFile {
	name: string;
	folders?: string[];
	files?: string[];
	connections?: string[];
}

export async function addUriToSpace(space: vscode.Uri, category: 'files' | 'folders' | 'connections', toAdd: vscode.Uri): Promise<void> {
	if (await validateWorkspaceFile(space)) {
		const json: DataWorkspaceJsonFile = JSON.parse((await vscode.workspace.fs.readFile(space)).toString());
		if (!json[category]) {
			json[category] = [];
		}
		json[category]!.push(toAdd.toString());
		await vscode.workspace.fs.writeFile(space, Buffer.from(JSON.stringify(json)));
	} else {
		throw new Error('Invalid workspace file');
	}
}

export async function validateWorkspaceFile(uri: vscode.Uri): Promise<boolean> {
	try {
		let json = JSON.parse((await vscode.workspace.fs.readFile(uri.with({ scheme: 'file' }))).toString());
		if (Array.isArray(json)) {
			throw new Error('Arrays not valid for workspace json');
		}
		const { connections, files, folders, name } = (json as DataWorkspaceJsonFile);
		if (!name || typeof name !== 'string') {
			throw new Error('name must be a string and be present');
		}
		// if we have connections and it is not an array or every value isn't a string
		if (connections && (!Array.isArray(connections) || connections.some(c => typeof c !== 'string'))) {
			throw new Error('connections must be array of strings');
		}
		if (files && (!Array.isArray(files) || files.some(c => typeof c !== 'string'))) {
			throw new Error('connections must be array of strings');
		}
		if (folders && (!Array.isArray(folders) || folders.some(c => typeof c !== 'string'))) {
			throw new Error('connections must be array of strings');
		}
		return true;
	} catch (e) {
		return false;
	}
}
