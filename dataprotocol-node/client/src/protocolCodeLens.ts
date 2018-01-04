/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the Source EULA. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as code from 'vscode';

export default class ProtocolCodeLens extends code.CodeLens {

	public data: any;

	constructor(range: code.Range) {
		super(range);
	}
}