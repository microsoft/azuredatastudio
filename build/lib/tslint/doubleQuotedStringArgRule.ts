/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ts from 'typescript';
import * as Lint from 'tslint';

/**
 * Implementation of the double-quoted-string-arg rule which verifies that the specified index of calls matching
 * the specified signatures is quoted with double-quotes only.
 */
export class Rule extends Lint.Rules.AbstractRule {
	public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new DoubleQuotedStringArgRuleWalker(sourceFile, this.getOptions()));
	}
}

interface Map<V> {
	[key: string]: V;
}

interface DoubleQuotedStringArgOptions {
	signatures?: string[];
	argIndex?: number;
}

class DoubleQuotedStringArgRuleWalker extends Lint.RuleWalker {

	private static DOUBLE_QUOTE: string = '"';

	private signatures: Map<boolean>;
	private argIndex: number | undefined;

	constructor(file: ts.SourceFile, opts: Lint.IOptions) {
		super(file, opts);
		this.signatures = Object.create(null);
		this.argIndex = undefined;
		const options: any[] = this.getOptions();
		const first: DoubleQuotedStringArgOptions = options && options.length > 0 ? options[0] : null;
		if (first) {
			if (Array.isArray(first.signatures)) {
				first.signatures.forEach((signature: string) => this.signatures[signature] = true);
			}
			if (typeof first.argIndex !== 'undefined') {
				this.argIndex = first.argIndex;
			}
		}
	}

	protected visitCallExpression(node: ts.CallExpression): void {
		this.checkCallExpression(node);
		super.visitCallExpression(node);
	}

	private checkCallExpression(node: ts.CallExpression): void {
		// Not one of the functions we're looking for, continue on
		const functionName = node.expression.getText();
		if (functionName && !this.signatures[functionName]) {
			return;
		}

		const arg = node.arguments[this.argIndex!];

		// Ignore if the arg isn't a string - we expect the compiler to warn if that's an issue
		if(arg && ts.isStringLiteral(arg)) {
			const argText = arg.getText();
			const doubleQuotedArg = argText.length >= 2 && argText[0] === DoubleQuotedStringArgRuleWalker.DOUBLE_QUOTE && argText[argText.length - 1] === DoubleQuotedStringArgRuleWalker.DOUBLE_QUOTE;

			if (!doubleQuotedArg) {
				const fix = [
					Lint.Replacement.replaceFromTo(arg.getStart(), arg.getWidth(), `"${arg.getText().slice(1, arg.getWidth() - 2)}"`),
				];
				this.addFailure(this.createFailure(
					arg.getStart(), arg.getWidth(),
					`Argument ${this.argIndex! + 1} to '${functionName}' must be double quoted.`, fix));
				return;
			}
		}

	}
}
