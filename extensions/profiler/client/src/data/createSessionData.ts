/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';

export class CreateSessionData  {
	public dialogMode: 'CREATE';
	public ownerUri: string;
	public templates: string[];
	public selectedTemplate: string;
	public sessionName: string;

	constructor(ownerUri:string, templates: string[]) {
		this.ownerUri = ownerUri;
		this.templates = templates;
		this.selectedTemplate = templates[0];
	}

	public async initialize() {
		// this is where preprocessing for checking versions would go
	}

	public async save() {
		// probably can be safely removed
	}
}