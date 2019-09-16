"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
class Rule extends Lint.Rules.TypedRule {
    applyWithProgram(sourceFile, program) {
        if (program.getCompilerOptions().alwaysStrict) {
            return this.applyWithWalker(new NoUselessStrictRuleWalker(sourceFile, this.getOptions()));
        }
        return [];
    }
}
exports.Rule = Rule;
class NoUselessStrictRuleWalker extends Lint.RuleWalker {
    visitStringLiteral(node) {
        this.checkStringLiteral(node);
        super.visitStringLiteral(node);
    }
    checkStringLiteral(node) {
        const text = node.getText();
        if (text === '\'use strict\'' || text === '"use strict"') {
            this.addFailureAtNode(node, 'use strict directive is unnecessary');
        }
    }
}
