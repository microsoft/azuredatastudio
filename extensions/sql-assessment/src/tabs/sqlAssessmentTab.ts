/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export abstract class SqlAssessmentTab implements azdata.Tab, vscode.Disposable {
	title!: string;
	content!: azdata.Component;
	id!: string;
	icon?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri; } | undefined;

	protected extensionContext: vscode.ExtensionContext;

	public constructor(extensionContext: vscode.ExtensionContext, title: string, id: string, icon: { light: string; dark: string }) {
		this.title = title;
		this.id = id;
		this.icon = icon;
		this.extensionContext = extensionContext;
	}
	public dispose() {

	}

	public async Create(view: azdata.ModelView): Promise<SqlAssessmentTab> {
		this.content = await this.tabContent(view);
		return this;
	}

	abstract tabContent(view: azdata.ModelView): Promise<azdata.Component>;
}


