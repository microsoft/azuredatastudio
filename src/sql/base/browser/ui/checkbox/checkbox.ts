/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!sql/base/browser/ui/checkbox/media/checkbox';
import { Checkbox as vsCheckbox, ICheckboxOpts, ICheckboxStyles } from 'vs/base/browser/ui/checkbox/checkbox';
import { Color } from 'vs/base/common/color';

const defaultOpts = {
	inputActiveOptionBorder: Color.fromHex('#007ACC'),
	actionClassName: ' sql-checkbox'
};

/**
 * Extends Checkbox to include Carbon checkbox icon and styling.
 */
export class Checkbox extends vsCheckbox {
	private _inputActiveOptionBorder: Color;

	constructor(opts: ICheckboxOpts) {
		super({
			actionClassName: opts.actionClassName + defaultOpts.actionClassName,
			title: opts.title,
			isChecked: opts.isChecked,
			onChange: opts.onChange,
			onKeyDown: opts.onKeyDown,
			inputActiveOptionBorder: opts.inputActiveOptionBorder
		});
		this._inputActiveOptionBorder = opts.inputActiveOptionBorder ? opts.inputActiveOptionBorder : defaultOpts.inputActiveOptionBorder;
	}

	public enable(): void {
		super.enable();
		this.domNode.classList.remove('disabled');
	}

	public disable(): void {
		super.disable();
		this.domNode.classList.add('disabled');
	}

	public style(styles: ICheckboxStyles): void {
		if (styles.inputActiveOptionBorder) {
			this._inputActiveOptionBorder = styles.inputActiveOptionBorder;
		}
		this.applyStyles();
	}

	protected applyStyles(): void {
		if (this.domNode) {
			this.domNode.style.borderColor = this._inputActiveOptionBorder ? this._inputActiveOptionBorder.toString(): defaultOpts.inputActiveOptionBorder.toString();
		}
	}
}