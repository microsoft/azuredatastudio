'use strict';

// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import { window } from 'vscode';
import Prompt from './prompt';
import EscapeException from './escapeException';

const figures = require('figures');

export default class CheckboxPrompt extends Prompt {

	constructor(question: any, ignoreFocusOut?: boolean) {
		super(question, ignoreFocusOut);
	}

	public render(): any {
		let choices = this._question.choices.reduce((result, choice) => {
			let choiceName = choice.name || choice;
			result[`${choice.checked === true ? figures.radioOn : figures.radioOff} ${choiceName}`] = choice;
			return result;
		}, {});

		let options = this.defaultQuickPickOptions;
		options.placeHolder = this._question.message;

		let quickPickOptions = Object.keys(choices);
		quickPickOptions.push(figures.tick);

		return window.showQuickPick(quickPickOptions, options)
			.then(result => {
				if (result === undefined) {
					throw new EscapeException();
				}

				if (result !== figures.tick) {
					choices[result].checked = !choices[result].checked;

					return this.render();
				}

				return this._question.choices.reduce((result2, choice) => {
					if (choice.checked === true) {
						result2.push(choice.value);
					}

					return result2;
				}, []);
			});
	}
}
