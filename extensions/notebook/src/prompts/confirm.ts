'use strict';

// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import { window } from 'vscode';
import Prompt from './prompt';
import LocalizedConstants = require('../common/localizedConstants');
import EscapeException from './escapeException';

export default class ConfirmPrompt extends Prompt {

	constructor(question: any, ignoreFocusOut?: boolean) {
		super(question, ignoreFocusOut);
	}

	public render(): any {
		let choices: { [id: string]: boolean } = {};
		choices[LocalizedConstants.msgYes] = true;
		choices[LocalizedConstants.msgNo] = false;

		let options = this.defaultQuickPickOptions;
		options.placeHolder = this._question.message;

		return window.showQuickPick(Object.keys(choices), options)
			.then(result => {
				if (result === undefined) {
					throw new EscapeException();
				}

				return choices[result] || false;
			});
	}
}
