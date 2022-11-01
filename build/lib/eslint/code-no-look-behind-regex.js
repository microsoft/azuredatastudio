/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------
const _positiveLookBehind = /\(\?<=.+/;
const _negativeLookBehind = /\(\?<!.+/;
function _containsLookBehind(pattern) {
    if (typeof pattern !== 'string') {
        return false;
    }
    return _positiveLookBehind.test(pattern) || _negativeLookBehind.test(pattern);
}
module.exports = {
    create(context) {
        return {
            // /.../
            ['Literal[regex]']: (node) => {
                var _a;
                const pattern = (_a = node.regex) === null || _a === void 0 ? void 0 : _a.pattern;
                if (_containsLookBehind(pattern)) {
                    context.report({
                        node,
                        message: 'Look behind assertions are not yet supported in all browsers'
                    });
                }
            },
            // new Regex("...")
            ['NewExpression[callee.name="RegExp"] Literal']: (node) => {
                if (_containsLookBehind(node.value)) {
                    context.report({
                        node,
                        message: 'Look behind assertions are not yet supported in all browsers'
                    });
                }
            }
        };
    }
};
