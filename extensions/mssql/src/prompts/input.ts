// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import { window, InputBoxOptions } from 'vscode';
import Prompt from './prompt';
import EscapeException from '../escapeException';

const figures = require('figures');

export default class InputPrompt extends Prompt {

	protected _options: InputBoxOptions;

	constructor(question: any, ignoreFocusOut?: boolean) {
		super(question, ignoreFocusOut);

		this._options = this.defaultInputBoxOptions;
		this._options.prompt = this._question.message;
	}

	// Helper for callers to know the right type to get from the type factory
	public static get promptType(): string { return 'input'; }

	public render(): any {
		// Prefer default over the placeHolder, if specified
		let placeHolder = this._question.default ? this._question.default : this._question.placeHolder;

		if (this._question.default instanceof Error) {
			placeHolder = this._question.default.message;
			this._question.default = undefined;
		}

		this._options.placeHolder = placeHolder;

		return window.showInputBox(this._options)
			.then(result => {
				if (result === undefined) {
					throw new EscapeException();
				}

				if (result === '') {
					// Use the default value, if defined
					result = this._question.default || '';
				}

				const validationError = this._question.validate ? this._question.validate(result || '') : undefined;

				if (validationError) {
					this._question.default = new Error(`${figures.warning} ${validationError}`);

					return this.render();
				}

				return result;
			});
	}
}
