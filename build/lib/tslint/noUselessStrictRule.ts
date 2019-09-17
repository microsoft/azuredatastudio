/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Lint from 'tslint';
import * as ts from 'typescript';

export class Rule extends Lint.Rules.TypedRule {
    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
		if (program.getCompilerOptions().alwaysStrict) {
			return this.applyWithWalker(new NoUselessStrictRuleWalker(sourceFile, this.getOptions()));
		}
		return [];
	}
}

class NoUselessStrictRuleWalker extends Lint.RuleWalker {
	protected visitStringLiteral(node: ts.StringLiteral): void {
		this.checkStringLiteral(node);
		super.visitStringLiteral(node);
	}

	private checkStringLiteral(node: ts.StringLiteral): void {
		const text = node.getText();
		if (text === '\'use strict\'' || text === '"use strict"') {
			this.addFailureAtNode(node, 'use strict directive is unnecessary');
		}
	}
}
