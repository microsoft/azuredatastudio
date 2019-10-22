/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as minimatch from 'minimatch';

interface NoSyncRuleConfig {
	exclude: string[];
}

export class Rule extends Lint.Rules.AbstractRule {

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		const args = <NoSyncRuleConfig>this.getOptions().ruleArguments[0];

		if (args.exclude.every(x => !minimatch(sourceFile.fileName, x))) {
			return this.applyWithWalker(new NoSyncRuleWalker(sourceFile, this.getOptions()));
		}

		return [];
	}
}

class NoSyncRuleWalker extends Lint.RuleWalker {

	private static readonly operations = ['readFileSync', 'writeFileSync', 'existsSync', 'fchmodSync', 'lchmodSync',
	'statSync', 'fstatSync', 'lstatSync', 'linkSync', 'symlinkSync', 'readlinkSync', 'realpathSync', 'unlinkSync', 'rmdirSync',
	'mkdirSync', 'mkdtempSync', 'readdirSync', 'openSync', 'utimesSync', 'futimesSync', 'fsyncSync', 'writeSync', 'readSync',
	'appendFileSync', 'accessSync', 'fdatasyncSync', 'copyFileSync'];

	constructor(file: ts.SourceFile, opts: Lint.IOptions) {
		super(file, opts);
	}

	visitCallExpression(node: ts.CallExpression) {
		if (node.expression && NoSyncRuleWalker.operations.some(x => node.expression.getText().indexOf(x) >= 0)) {
			this.addFailureAtNode(node, `Do not use Sync operations`);
		}

		super.visitCallExpression(node);
	}
}
