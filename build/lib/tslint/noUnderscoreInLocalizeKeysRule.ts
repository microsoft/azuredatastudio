/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ts from 'typescript';
import * as Lint from 'tslint';

/**
 * Implementation of the no-localize-keys-with-underscore rule which verifies that keys to the localize
 * calls don't contain underscores (_) since those break the localization process.
 */
export class Rule extends Lint.Rules.AbstractRule {
	public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new NoLocalizeKeysWithUnderscore(sourceFile, this.getOptions()));
	}
}

const signatures = [
	"localize",
	"nls.localize"
];

class NoLocalizeKeysWithUnderscore extends Lint.RuleWalker {

	constructor(file: ts.SourceFile, opts: Lint.IOptions) {
		super(file, opts);
	}

	protected visitCallExpression(node: ts.CallExpression): void {
		this.checkCallExpression(node);
		super.visitCallExpression(node);
	}

	private checkCallExpression(node: ts.CallExpression): void {
		// If this isn't one of the localize functions then continue on
		const functionName = node.expression.getText();
		if (functionName && !signatures.some(s => s === functionName)) {
			return;
		}
		const arg = node && node.arguments && node.arguments.length > 0 ? node.arguments[0] : undefined; // The key is the first element
		// Ignore if the arg isn't a string - we expect the compiler to warn if that's an issue
		if(arg && ts.isStringLiteral(arg)) {
			if (arg.getText().indexOf('_') >= 0) {
				const fix = [
					Lint.Replacement.replaceFromTo(arg.getStart(), arg.getEnd(), `${arg.getText().replace(/_/g, '.')}`),
				];
				this.addFailure(this.createFailure(
					arg.getStart(), arg.getWidth(),
					`Keys for localize calls must not contain underscores. Use periods (.) instead.`, fix));
				return;
			}
		}
	}
}
