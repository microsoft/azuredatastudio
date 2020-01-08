/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export class CreateSessionData {
	public ownerUri: string;
	public sessionName: string;
	public templates: Array<azdata.ProfilerSessionTemplate> = new Array<azdata.ProfilerSessionTemplate>();

	constructor(ownerUri: string, templates: Array<azdata.ProfilerSessionTemplate>) {
		this.ownerUri = ownerUri;
		this.templates = templates;
	}

	public getTemplateNames(): string[] {
		return this.templates.map(e => e.name);
	}

	public selectTemplate(name: string): azdata.ProfilerSessionTemplate {
		return this.templates.find((t) => { return t.name === name; });
	}
}
