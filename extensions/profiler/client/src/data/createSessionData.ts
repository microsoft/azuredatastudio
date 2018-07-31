/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';

export class CreateSessionData  {
	public ownerUri: string;
	public sessionName: string;
	public templates: Array<sqlops.ProfilerSessionTemplate> = new Array<sqlops.ProfilerSessionTemplate>();

	constructor(ownerUri:string, templates:Array<sqlops.ProfilerSessionTemplate>) {
		this.ownerUri = ownerUri;
		this.templates = templates;
		if(this.templates)
		{

		} else {
			// display an error here
			console.log('****** DIDN\'T GET TEMPLATES ******');
		}
	}

	public getTemplateNames(): string[] {
		return this.templates.reduce<Array<string>>((p, e) => {
			p.push(e.name);
			return p;
		}, new Array<string>());
	}

	public selectTemplate(name: string): sqlops.ProfilerSessionTemplate {
		return this.templates.find((t) => {return t.name === name;});
	}

	public async initialize() {
		// do something here?
	}
}