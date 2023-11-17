/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Widget } from 'vs/base/browser/ui/widget';
import * as DOM from 'vs/base/browser/dom';
import 'vs/css!./media/fieldset';

export interface FieldSetOptions {
	ariaLabel: string;
}

/**
 * A wrapper for the HTML FieldSet element, used to group logically related elements in a form.
 * Note: The element must be put under the context of an HTML form element in order to make the screen reader announce
 * the group name.
 */
export class FieldSet extends Widget {
	public readonly element: HTMLFieldSetElement;

	constructor(container: HTMLElement, opts: FieldSetOptions) {
		super();
		this.element = DOM.$('fieldset.default-fieldset');
		this.element.setAttribute('aria-label', opts.ariaLabel);
		container.appendChild(this.element);
	}
}
