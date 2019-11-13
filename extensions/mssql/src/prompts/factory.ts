// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import Prompt from './prompt';
import InputPrompt from './input';
import PasswordPrompt from './password';
import ConfirmPrompt from './confirm';
import { IQuestion } from './question';

export default class PromptFactory {

	public static createPrompt(question: IQuestion, ignoreFocusOut?: boolean): Prompt {
		switch (question.type) {
			case 'input':
				return new InputPrompt(question, ignoreFocusOut);
			case 'password':
				return new PasswordPrompt(question, ignoreFocusOut);
			case 'confirm':
				return new ConfirmPrompt(question, ignoreFocusOut);
			default:
				throw new Error(`Could not find a prompt for question type ${question.type}`);
		}
	}
}
