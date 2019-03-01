'use strict';

// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import Prompt from './prompt';
import InputPrompt from './input';
import PasswordPrompt from './password';
import ListPrompt from './list';
import ConfirmPrompt from './confirm';
import CheckboxPrompt from './checkbox';
import ExpandPrompt from './expand';

export default class PromptFactory {

	public static createPrompt(question: any, ignoreFocusOut?: boolean): Prompt {
		/**
		 * TODO:
		 *   - folder
		 */
		switch (question.type || 'input') {
			case 'string':
			case 'input':
				return new InputPrompt(question, ignoreFocusOut);
			case 'password':
				return new PasswordPrompt(question, ignoreFocusOut);
			case 'list':
				return new ListPrompt(question, ignoreFocusOut);
			case 'confirm':
				return new ConfirmPrompt(question, ignoreFocusOut);
			case 'checkbox':
				return new CheckboxPrompt(question, ignoreFocusOut);
			case 'expand':
				return new ExpandPrompt(question, ignoreFocusOut);
			default:
				throw new Error(`Could not find a prompt for question type ${question.type}`);
		}
	}
}
