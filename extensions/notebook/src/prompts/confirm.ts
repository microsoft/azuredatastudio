// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import Prompt from './prompt';
import LocalizedConstants = require('../common/localizedConstants');
import EscapeException from './escapeException';
import * as vscode from 'vscode';

export default class ConfirmPrompt extends Prompt {

	constructor(question: any) {
		super(question);
	}

	public render(): any {
		let choices: { [id: string]: boolean } = {};
		choices[LocalizedConstants.msgYes] = true;
		choices[LocalizedConstants.msgNo] = false;

		let options = this.defaultQuickPickOptions;
		options.placeHolder = this._question.message;

		return vscode.window.showQuickPick(Object.keys(choices), options)
			.then(result => {
				if (result === undefined) {
					throw new EscapeException();
				}

				return choices[result] || false;
			});
	}
}
