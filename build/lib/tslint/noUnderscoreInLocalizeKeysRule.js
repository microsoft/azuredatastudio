"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const Lint = require("tslint");
/**
 * Implementation of the no-localize-keys-with-underscore rule which verifies that keys to the localize
 * calls don't contain underscores (_) since those break the localization process.
 */
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithWalker(new NoLocalizeKeysWithUnderscore(sourceFile, this.getOptions()));
    }
}
exports.Rule = Rule;
const signatures = [
    "localize",
    "nls.localize"
];
class NoLocalizeKeysWithUnderscore extends Lint.RuleWalker {
    constructor(file, opts) {
        super(file, opts);
    }
    visitCallExpression(node) {
        this.checkCallExpression(node);
        super.visitCallExpression(node);
    }
    checkCallExpression(node) {
        // If this isn't one of the localize functions then continue on
        const functionName = node.expression.getText();
        if (functionName && !signatures.some(s => s === functionName)) {
            return;
        }
        const arg = node && node.arguments && node.arguments.length > 0 ? node.arguments[0] : undefined; // The key is the first element
        // Ignore if the arg isn't a string - we expect the compiler to warn if that's an issue
        if (arg && ts.isStringLiteral(arg)) {
            if (arg.getText().indexOf('_') >= 0) {
                const fix = [
                    Lint.Replacement.replaceFromTo(arg.getStart(), arg.getEnd(), `${arg.getText().replace(/_/g, '.')}`),
                ];
                this.addFailure(this.createFailure(arg.getStart(), arg.getWidth(), `Keys for localize calls must not contain underscores. Use periods (.) instead.`, fix));
                return;
            }
        }
    }
}
