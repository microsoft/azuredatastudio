/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';

export class Separator extends Disposable {
	private readonly element: HTMLHRElement;

	constructor(container: HTMLElement) {
		super();

		this.element = document.createElement('hr');
		container.append(this.element);
	}
}
