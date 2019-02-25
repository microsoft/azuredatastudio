/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs-extra';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as constants from '../common/constants';

export enum SettingType {
	String,
	Number,
	Boolean,
	Set
}
export class ISetting {
	key: string;
	value: string | number | boolean;
	type: SettingType;
}

export class JupyterSettingWriter {
	private settings: ISetting[] = [];

	constructor(private baseFile: string) {
	}

	public addSetting(setting: ISetting): void {
		this.settings.push(setting);
	}

	public async writeSettings(targetFile: string): Promise<void> {
		let settings = await this.printSettings();
		await fs.writeFile(targetFile, settings);
	}

	public async printSettings(): Promise<string> {
		let content = '';
		let newLine = process.platform === constants.winPlatform ? '\r\n' : '\n';
		if (this.baseFile) {
			let sourceContents = await fs.readFile(this.baseFile);
			content += sourceContents.toString();
		}

		for (let setting of this.settings) {
			content += newLine;
			content += this.printSetting(setting);
		}
		return content;
	}

	private printSetting(setting: ISetting): string {
		let value: string;
		switch (setting.type) {
			case SettingType.Boolean:
				value = setting.value ? 'True' : 'False';
				break;
			case SettingType.String:
				value = `'${setting.value}'`;
				break;
			case SettingType.Number:
				value = `${setting.value}`;
				break;
			case SettingType.Set:
				value = `set([${setting.value}])`;
				break;
			default:
				throw new Error(localize('UnexpectedSettingType', 'Unexpected setting type {0}', setting.type));
		}
		return `c.${setting.key} = ${value}`;
	}
}
