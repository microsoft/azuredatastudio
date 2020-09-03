/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { $, append } from 'vs/base/browser/dom';

export class Separator extends Disposable {

	constructor(container: HTMLElement) {
		super();

		append(container, <hr></hr>);
	}
}
