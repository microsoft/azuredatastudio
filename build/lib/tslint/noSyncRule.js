"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const minimatch = require("minimatch");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        const args = this.getOptions().ruleArguments[0];
        if (args.exclude.every(x => !minimatch(sourceFile.fileName, x))) {
            return this.applyWithWalker(new NoSyncRuleWalker(sourceFile, this.getOptions()));
        }
        return [];
    }
}
exports.Rule = Rule;
class NoSyncRuleWalker extends Lint.RuleWalker {
    constructor(file, opts) {
        super(file, opts);
    }
    visitCallExpression(node) {
        if (node.expression && NoSyncRuleWalker.operations.some(x => node.expression.getText().indexOf(x) >= 0)) {
            this.addFailureAtNode(node, `Do not use Sync operations`);
        }
        super.visitCallExpression(node);
    }
}
NoSyncRuleWalker.operations = ['readFileSync', 'writeFileSync', 'existsSync', 'fchmodSync', 'lchmodSync',
    'statSync', 'fstatSync', 'lstatSync', 'linkSync', 'symlinkSync', 'readlinkSync', 'realpathSync', 'unlinkSync', 'rmdirSync',
    'mkdirSync', 'mkdtempSync', 'readdirSync', 'openSync', 'utimesSync', 'futimesSync', 'fsyncSync', 'writeSync', 'readSync',
    'appendFileSync', 'accessSync', 'fdatasyncSync', 'copyFileSync'];
