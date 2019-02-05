'use strict';

// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { window } from 'vscode';
import Prompt from './prompt';
import EscapeException from '../escapeException';

export default class ConfirmPrompt extends Prompt {

	constructor(question: any, ignoreFocusOut?: boolean) {
		super(question, ignoreFocusOut);
	}

	public render(): any {
		let choices: { [id: string]: boolean } = {};
		choices[localize('msgYes', 'Yes')] = true;
		choices[localize('msgNo', 'No')] = false;

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
