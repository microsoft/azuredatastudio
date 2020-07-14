// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import Prompt from './prompt';
import ConfirmPrompt from './confirm';

export default class PromptFactory {

	public static createPrompt(question: any): Prompt {
		switch (question.type) {
			case 'confirm':
				return new ConfirmPrompt(question);
			default:
				throw new Error(`Could not find a prompt for question type ${question.type}`);
		}
	}
}
