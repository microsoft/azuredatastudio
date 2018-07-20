/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';

export class CreateSessionData  {
	public ownerUri: string;
	public sessionName: string;
	public templates: Map<string, string> = new Map<string, string>();
	public templateOptions: string[];
	public selectedTemplate: string;

	constructor(ownerUri:string, templates: Map<string, string>) {
		this.ownerUri = ownerUri;
		this.templates = templates;
		this.templateOptions = [];
		if(this.templates)
		{
			for (let key in this.templates)
			{
				this.templateOptions.push(key);
			}

			if (this.templateOptions.length > 0) {
				this.selectedTemplate = this.templates[this.templateOptions[0]];
			} else {
				this.selectedTemplate = '';
			}

		} else {
			// display an error here
			console.log('****** DIDN\'T GET TEMPLATES ******');
		}
	}

	public getCreateStatement(): string {
		return this.templates[this.selectedTemplate];
	}
	public async initialize() {
		// do something here?
	}
}