'use strict';

// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import { InputBoxOptions, QuickPickOptions } from 'vscode';

abstract class Prompt {

	protected _question: any;
	protected _ignoreFocusOut?: boolean;

	constructor(question: any, ignoreFocusOut?: boolean) {
		this._question = question;
		this._ignoreFocusOut = ignoreFocusOut ? ignoreFocusOut : false;
	}

	public abstract render(): any;

	protected get defaultQuickPickOptions(): QuickPickOptions {
		return {
			ignoreFocusOut: this._ignoreFocusOut
		};
	}

	protected get defaultInputBoxOptions(): InputBoxOptions {
		return {
			ignoreFocusOut: this._ignoreFocusOut
		};
	}
}

export default Prompt;
