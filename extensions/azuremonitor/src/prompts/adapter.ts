// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import { window } from 'vscode';
import PromptFactory from './factory';
import EscapeException from './escapeException';
import { IQuestion, IPrompter, IPromptCallback, Answers } from './question';

// Supports simple pattern for prompting for user input and acting on this
export default class CodeAdapter implements IPrompter {

	// TODO define question interface
	private fixQuestion(question: IQuestion): any {
		if (question.type === 'checkbox' && Array.isArray(question.choices)) {
			// For some reason when there's a choice of checkboxes, they aren't formatted properly
			// Not sure where the issue is
			question.choices = question.choices.map(item => {
				if (typeof (item) === 'string') {
					return { checked: false, name: item, value: item };
				} else {
					return item;
				}
			});
		}
	}

	public async promptSingle<T>(question: IQuestion, ignoreFocusOut?: boolean): Promise<T | undefined> {
		let questions: IQuestion[] = [question];
		const answers = await this.prompt<T>(questions, ignoreFocusOut);
		if (answers) {
			let response: T = answers[question.name];
			return response || undefined;
		}
		return undefined;
	}

	public async prompt<T>(questions: IQuestion[], ignoreFocusOut?: boolean): Promise<Answers<T> | undefined> {
		// Collapse multiple questions into a set of prompt steps
		const promptResult = new Promise<Answers<T>>((resolve) => {
			let answers: Answers<T> = {};
			questions.forEach(async (question: IQuestion) => {
				this.fixQuestion(question);
				const prompt = await PromptFactory.createPrompt(question, ignoreFocusOut);
				if (!question.shouldPrompt || question.shouldPrompt(answers) === true) {
					const result = await prompt.render();
					answers[question.name] = result;

					if (question.onAnswered) {
						question.onAnswered(result);
					}
					return;
				}
			});

			resolve(answers);
		});

		try {
			return await promptResult;
		} catch (err) {
			if (err instanceof EscapeException || err instanceof TypeError) {
				window.showErrorMessage(err.message);
			}
			return undefined;
		}
	}

	// Helper to make it possible to prompt using callback pattern. Generally Promise is a preferred flow
	public promptCallback(questions: IQuestion[], callback: IPromptCallback | undefined): void {
		// Collapse multiple questions into a set of prompt steps
		this.prompt(questions).then(answers => {
			if (callback && answers) {
				callback(answers);
			}
		});
	}
}
