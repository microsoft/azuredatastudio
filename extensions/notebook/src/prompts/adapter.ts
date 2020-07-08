// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import PromptFactory from './factory';
import EscapeException from './escapeException';
import { IQuestion, IPrompter } from './question';
import * as vscode from 'vscode';

// Supports simple pattern for prompting for user input and acting on this
export default class CodeAdapter implements IPrompter {

	public promptSingle<T>(question: IQuestion): Promise<T> {
		let questions: IQuestion[] = [question];
		return this.prompt(questions).then((answers: { [key: string]: T }) => {
			if (answers) {
				let response: T = answers[question.name];
				return response || undefined;
			}
			return undefined;
		});
	}

	public prompt<T>(questions: IQuestion[]): Promise<{ [key: string]: T }> {
		let answers: { [key: string]: T } = {};

		// Collapse multiple questions into a set of prompt steps
		let promptResult: Promise<{ [key: string]: T }> = questions.reduce((promise: Promise<{ [key: string]: T }>, question: IQuestion) => {
			return promise.then(() => {
				return PromptFactory.createPrompt(question);
			}).then(prompt => {
				// Original Code: uses jQuery patterns. Keeping for reference
				// if (!question.when || question.when(answers) === true) {
				//     return prompt.render().then(result => {
				//         answers[question.name] = question.filter ? question.filter(result) : result;
				//     });
				// }

				if (!question.shouldPrompt || question.shouldPrompt(answers) === true) {
					return prompt.render().then((result: any) => {
						answers[question.name] = result;

						if (question.onAnswered) {
							question.onAnswered(result);
						}
						return answers;
					});
				}
				return answers;
			});
		}, Promise.resolve());

		return promptResult.catch(err => {
			if (err instanceof EscapeException || err instanceof TypeError) {
				return undefined;
			}

			vscode.window.showErrorMessage(err.message);
		});
	}
}
