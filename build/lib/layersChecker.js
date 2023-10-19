"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fs_1 = require("fs");
const path_1 = require("path");
const minimatch_1 = require("minimatch");
//
// #############################################################################################
//
// A custom typescript checker for the specific task of detecting the use of certain types in a
// layer that does not allow such use. For example:
// - using DOM globals in common/node/electron-main layer (e.g. HTMLElement)
// - using node.js globals in common/browser layer (e.g. process)
//
// Make changes to below RULES to lift certain files from these checks only if absolutely needed
//
// #############################################################################################
//
// Types we assume are present in all implementations of JS VMs (node.js, browsers)
// Feel free to add more core types as you see needed if present in node.js and browsers
const CORE_TYPES = [
    'require',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'console',
    'Console',
    'Error',
    'ErrorConstructor',
    'String',
    'TextDecoder',
    'TextEncoder',
    'self',
    'queueMicrotask',
    'Array',
    'Uint8Array',
    'Uint16Array',
    'Uint32Array',
    'Int8Array',
    'Int16Array',
    'Int32Array',
    'Float32Array',
    'Float64Array',
    'Uint8ClampedArray',
    'BigUint64Array',
    'BigInt64Array',
    'btoa',
    'atob',
    'AbortController',
    'AbortSignal',
    'MessageChannel',
    'MessagePort',
    'URL',
    'URLSearchParams',
    'ReadonlyArray',
    'Event',
    'EventTarget',
    'BroadcastChannel',
    'performance',
    'Blob'
];
// Types that are defined in a common layer but are known to be only
// available in native environments should not be allowed in browser
const NATIVE_TYPES = [
    'NativeParsedArgs',
    'INativeEnvironmentService',
    'AbstractNativeEnvironmentService',
    'INativeWindowConfiguration',
    'ICommonNativeHostService',
    'INativeHostService',
    'IMainProcessService'
];
const RULES = [
    // Tests: skip
    {
        target: '**/{vs,sql}/**/test/**',
        skip: true // -> skip all test files
    },
    // TODO@bpasero remove me once electron utility process has landed
    {
        target: '**/vs/workbench/services/extensions/electron-sandbox/nativeLocalProcessExtensionHost.ts',
        skip: true
    },
    // Common: vs/base/common/platform.ts
    {
        target: '**/{vs,sql}/base/common/platform.ts',
        allowedTypes: [
            ...CORE_TYPES,
            // Safe access to postMessage() and friends
            'MessageEvent',
        ],
        disallowedTypes: NATIVE_TYPES,
        disallowedDefinitions: [
            'lib.dom.d.ts',
            '@types/node' // no node.js
        ]
    },
    // Common: vs/platform/environment/common/*
    {
        target: '**/{vs,sql}/platform/environment/common/*.ts',
        allowedTypes: CORE_TYPES,
        disallowedTypes: [ /* Ignore native types that are defined from here */],
        disallowedDefinitions: [
            'lib.dom.d.ts',
            '@types/node' // no node.js
        ]
    },
    // Common: vs/platform/window/common/window.ts
    {
        target: '**/{vs,sql}/platform/window/common/window.ts',
        allowedTypes: CORE_TYPES,
        disallowedTypes: [ /* Ignore native types that are defined from here */],
        disallowedDefinitions: [
            'lib.dom.d.ts',
            '@types/node' // no node.js
        ]
    },
    // Common: vs/platform/native/common/native.ts
    {
        target: '**/{vs,sql}/platform/native/common/native.ts',
        allowedTypes: CORE_TYPES,
        disallowedTypes: [ /* Ignore native types that are defined from here */],
        disallowedDefinitions: [
            'lib.dom.d.ts',
            '@types/node' // no node.js
        ]
    },
    // Common: vs/workbench/api/common/extHostExtensionService.ts
    {
        target: '**/{vs,sql}/workbench/api/common/extHostExtensionService.ts',
        allowedTypes: [
            ...CORE_TYPES,
            // Safe access to global
            'global'
        ],
        disallowedTypes: NATIVE_TYPES,
        disallowedDefinitions: [
            'lib.dom.d.ts',
            '@types/node' // no node.js
        ]
    },
    // Common
    {
        target: '**/{vs,sql}/**/common/**',
        allowedTypes: CORE_TYPES,
        disallowedTypes: NATIVE_TYPES,
        disallowedDefinitions: [
            'lib.dom.d.ts',
            '@types/node' // no node.js
        ]
    },
    // Browser
    {
        target: '**/{vs,sql}/**/browser/**',
        allowedTypes: CORE_TYPES,
        disallowedTypes: NATIVE_TYPES,
        allowedDefinitions: [
            '@types/node/stream/consumers.d.ts' // node.js started to duplicate types from lib.dom.d.ts so we have to account for that
        ],
        disallowedDefinitions: [
            '@types/node' // no node.js
        ]
    },
    // Browser (editor contrib)
    {
        target: '**/src/{vs,sql}/editor/contrib/**',
        allowedTypes: CORE_TYPES,
        disallowedTypes: NATIVE_TYPES,
        disallowedDefinitions: [
            '@types/node' // no node.js
        ]
    },
    // node.js
    {
        target: '**/{vs,sql}/**/node/**',
        allowedTypes: CORE_TYPES,
        disallowedDefinitions: [
            'lib.dom.d.ts' // no DOM
        ]
    },
    // Electron (sandbox)
    {
        target: '**/{vs,sql}/**/electron-sandbox/**/!(commandLine.ts)',
        allowedTypes: CORE_TYPES,
        disallowedDefinitions: [
            '@types/node' // no node.js
        ]
    },
    // {{SQL CARBON TODO}} chgagnon investigate the use of querystring
    {
        target: '**/{vs,sql}/**/electron-sandbox/commandLine.ts',
        allowedTypes: [
            ...CORE_TYPES,
            '@types/node'
        ]
    },
    // Electron (renderer): skip
    {
        target: '**/{vs,sql}/**/electron-browser/**',
        skip: true // -> supports all types
    },
    // Electron (main)
    {
        target: '**/{vs,sql}/**/electron-main/**',
        allowedTypes: [
            ...CORE_TYPES,
            // --> types from electron.d.ts that duplicate from lib.dom.d.ts
            'Event',
            'Request'
        ],
        disallowedTypes: [
            'ipcMain' // not allowed, use validatedIpcMain instead
        ],
        disallowedDefinitions: [
            'lib.dom.d.ts' // no DOM
        ]
    }
];
const TS_CONFIG_PATH = (0, path_1.join)(__dirname, '../../', 'src', 'tsconfig.json');
let hasErrors = false;
function checkFile(program, sourceFile, rule) {
    checkNode(sourceFile);
    function checkNode(node) {
        if (node.kind !== ts.SyntaxKind.Identifier) {
            return ts.forEachChild(node, checkNode); // recurse down
        }
        const checker = program.getTypeChecker();
        const symbol = checker.getSymbolAtLocation(node);
        if (!symbol) {
            return;
        }
        let _parentSymbol = symbol;
        while (_parentSymbol.parent) {
            _parentSymbol = _parentSymbol.parent;
        }
        const parentSymbol = _parentSymbol;
        const text = parentSymbol.getName();
        if (rule.allowedTypes?.some(allowed => allowed === text)) {
            return; // override
        }
        if (rule.disallowedTypes?.some(disallowed => disallowed === text)) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            console.log(`[build/lib/layersChecker.ts]: Reference to type '${text}' violates layer '${rule.target}' (${sourceFile.fileName} (${line + 1},${character + 1}). Learn more about our source code organization at https://github.com/microsoft/vscode/wiki/Source-Code-Organization.`);
            hasErrors = true;
            return;
        }
        const declarations = symbol.declarations;
        if (Array.isArray(declarations)) {
            DeclarationLoop: for (const declaration of declarations) {
                if (declaration) {
                    const parent = declaration.parent;
                    if (parent) {
                        const parentSourceFile = parent.getSourceFile();
                        if (parentSourceFile) {
                            const definitionFileName = parentSourceFile.fileName;
                            if (rule.allowedDefinitions) {
                                for (const allowedDefinition of rule.allowedDefinitions) {
                                    if (definitionFileName.indexOf(allowedDefinition) >= 0) {
                                        continue DeclarationLoop;
                                    }
                                }
                            }
                            if (rule.disallowedDefinitions) {
                                for (const disallowedDefinition of rule.disallowedDefinitions) {
                                    if (definitionFileName.indexOf(disallowedDefinition) >= 0) {
                                        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                                        console.log(`[build/lib/layersChecker.ts]: Reference to symbol '${text}' from '${disallowedDefinition}' violates layer '${rule.target}' (${sourceFile.fileName} (${line + 1},${character + 1}) Learn more about our source code organization at https://github.com/microsoft/vscode/wiki/Source-Code-Organization.`);
                                        hasErrors = true;
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
function createProgram(tsconfigPath) {
    const tsConfig = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    const configHostParser = { fileExists: fs_1.existsSync, readDirectory: ts.sys.readDirectory, readFile: file => (0, fs_1.readFileSync)(file, 'utf8'), useCaseSensitiveFileNames: process.platform === 'linux' };
    const tsConfigParsed = ts.parseJsonConfigFileContent(tsConfig.config, configHostParser, (0, path_1.resolve)((0, path_1.dirname)(tsconfigPath)), { noEmit: true });
    const compilerHost = ts.createCompilerHost(tsConfigParsed.options, true);
    return ts.createProgram(tsConfigParsed.fileNames, tsConfigParsed.options, compilerHost);
}
//
// Create program and start checking
//
const program = createProgram(TS_CONFIG_PATH);
for (const sourceFile of program.getSourceFiles()) {
    for (const rule of RULES) {
        if ((0, minimatch_1.match)([sourceFile.fileName], rule.target).length > 0) {
            if (!rule.skip) {
                checkFile(program, sourceFile, rule);
            }
            break;
        }
    }
}
if (hasErrors) {
    process.exit(1);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzQ2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxheWVyc0NoZWNrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Z0dBR2dHOztBQUVoRyxpQ0FBaUM7QUFDakMsMkJBQThDO0FBQzlDLCtCQUE4QztBQUM5Qyx5Q0FBa0M7QUFFbEMsRUFBRTtBQUNGLGdHQUFnRztBQUNoRyxFQUFFO0FBQ0YsK0ZBQStGO0FBQy9GLG1EQUFtRDtBQUNuRCw0RUFBNEU7QUFDNUUsaUVBQWlFO0FBQ2pFLEVBQUU7QUFDRixnR0FBZ0c7QUFDaEcsRUFBRTtBQUNGLGdHQUFnRztBQUNoRyxFQUFFO0FBRUYsbUZBQW1GO0FBQ25GLHdGQUF3RjtBQUN4RixNQUFNLFVBQVUsR0FBRztJQUNsQixTQUFTO0lBQ1QsWUFBWTtJQUNaLGNBQWM7SUFDZCxhQUFhO0lBQ2IsZUFBZTtJQUNmLFNBQVM7SUFDVCxTQUFTO0lBQ1QsT0FBTztJQUNQLGtCQUFrQjtJQUNsQixRQUFRO0lBQ1IsYUFBYTtJQUNiLGFBQWE7SUFDYixNQUFNO0lBQ04sZ0JBQWdCO0lBQ2hCLE9BQU87SUFDUCxZQUFZO0lBQ1osYUFBYTtJQUNiLGFBQWE7SUFDYixXQUFXO0lBQ1gsWUFBWTtJQUNaLFlBQVk7SUFDWixjQUFjO0lBQ2QsY0FBYztJQUNkLG1CQUFtQjtJQUNuQixnQkFBZ0I7SUFDaEIsZUFBZTtJQUNmLE1BQU07SUFDTixNQUFNO0lBQ04saUJBQWlCO0lBQ2pCLGFBQWE7SUFDYixnQkFBZ0I7SUFDaEIsYUFBYTtJQUNiLEtBQUs7SUFDTCxpQkFBaUI7SUFDakIsZUFBZTtJQUNmLE9BQU87SUFDUCxhQUFhO0lBQ2Isa0JBQWtCO0lBQ2xCLGFBQWE7SUFDYixNQUFNO0NBQ04sQ0FBQztBQUVGLG9FQUFvRTtBQUNwRSxvRUFBb0U7QUFDcEUsTUFBTSxZQUFZLEdBQUc7SUFDcEIsa0JBQWtCO0lBQ2xCLDJCQUEyQjtJQUMzQixrQ0FBa0M7SUFDbEMsNEJBQTRCO0lBQzVCLDBCQUEwQjtJQUMxQixvQkFBb0I7SUFDcEIscUJBQXFCO0NBQ3JCLENBQUM7QUFFRixNQUFNLEtBQUssR0FBWTtJQUV0QixjQUFjO0lBQ2Q7UUFDQyxNQUFNLEVBQUUsd0JBQXdCO1FBQ2hDLElBQUksRUFBRSxJQUFJLENBQUMseUJBQXlCO0tBQ3BDO0lBRUQsa0VBQWtFO0lBQ2xFO1FBQ0MsTUFBTSxFQUFFLHlGQUF5RjtRQUNqRyxJQUFJLEVBQUUsSUFBSTtLQUNWO0lBRUQscUNBQXFDO0lBQ3JDO1FBQ0MsTUFBTSxFQUFFLHFDQUFxQztRQUM3QyxZQUFZLEVBQUU7WUFDYixHQUFHLFVBQVU7WUFFYiwyQ0FBMkM7WUFDM0MsY0FBYztTQUNkO1FBQ0QsZUFBZSxFQUFFLFlBQVk7UUFDN0IscUJBQXFCLEVBQUU7WUFDdEIsY0FBYztZQUNkLGFBQWEsQ0FBQyxhQUFhO1NBQzNCO0tBQ0Q7SUFFRCwyQ0FBMkM7SUFDM0M7UUFDQyxNQUFNLEVBQUUsOENBQThDO1FBQ3RELFlBQVksRUFBRSxVQUFVO1FBQ3hCLGVBQWUsRUFBRSxFQUFDLG9EQUFvRCxDQUFDO1FBQ3ZFLHFCQUFxQixFQUFFO1lBQ3RCLGNBQWM7WUFDZCxhQUFhLENBQUMsYUFBYTtTQUMzQjtLQUNEO0lBRUQsOENBQThDO0lBQzlDO1FBQ0MsTUFBTSxFQUFFLDhDQUE4QztRQUN0RCxZQUFZLEVBQUUsVUFBVTtRQUN4QixlQUFlLEVBQUUsRUFBQyxvREFBb0QsQ0FBQztRQUN2RSxxQkFBcUIsRUFBRTtZQUN0QixjQUFjO1lBQ2QsYUFBYSxDQUFDLGFBQWE7U0FDM0I7S0FDRDtJQUVELDhDQUE4QztJQUM5QztRQUNDLE1BQU0sRUFBRSw4Q0FBOEM7UUFDdEQsWUFBWSxFQUFFLFVBQVU7UUFDeEIsZUFBZSxFQUFFLEVBQUMsb0RBQW9ELENBQUM7UUFDdkUscUJBQXFCLEVBQUU7WUFDdEIsY0FBYztZQUNkLGFBQWEsQ0FBQyxhQUFhO1NBQzNCO0tBQ0Q7SUFFRCw2REFBNkQ7SUFDN0Q7UUFDQyxNQUFNLEVBQUUsNkRBQTZEO1FBQ3JFLFlBQVksRUFBRTtZQUNiLEdBQUcsVUFBVTtZQUViLHdCQUF3QjtZQUN4QixRQUFRO1NBQ1I7UUFDRCxlQUFlLEVBQUUsWUFBWTtRQUM3QixxQkFBcUIsRUFBRTtZQUN0QixjQUFjO1lBQ2QsYUFBYSxDQUFDLGFBQWE7U0FDM0I7S0FDRDtJQUVELFNBQVM7SUFDVDtRQUNDLE1BQU0sRUFBRSwwQkFBMEI7UUFDbEMsWUFBWSxFQUFFLFVBQVU7UUFDeEIsZUFBZSxFQUFFLFlBQVk7UUFDN0IscUJBQXFCLEVBQUU7WUFDdEIsY0FBYztZQUNkLGFBQWEsQ0FBQyxhQUFhO1NBQzNCO0tBQ0Q7SUFFRCxVQUFVO0lBQ1Y7UUFDQyxNQUFNLEVBQUUsMkJBQTJCO1FBQ25DLFlBQVksRUFBRSxVQUFVO1FBQ3hCLGVBQWUsRUFBRSxZQUFZO1FBQzdCLGtCQUFrQixFQUFFO1lBQ25CLG1DQUFtQyxDQUFDLHNGQUFzRjtTQUMxSDtRQUNELHFCQUFxQixFQUFFO1lBQ3RCLGFBQWEsQ0FBQyxhQUFhO1NBQzNCO0tBQ0Q7SUFFRCwyQkFBMkI7SUFDM0I7UUFDQyxNQUFNLEVBQUUsbUNBQW1DO1FBQzNDLFlBQVksRUFBRSxVQUFVO1FBQ3hCLGVBQWUsRUFBRSxZQUFZO1FBQzdCLHFCQUFxQixFQUFFO1lBQ3RCLGFBQWEsQ0FBQyxhQUFhO1NBQzNCO0tBQ0Q7SUFFRCxVQUFVO0lBQ1Y7UUFDQyxNQUFNLEVBQUUsd0JBQXdCO1FBQ2hDLFlBQVksRUFBRSxVQUFVO1FBQ3hCLHFCQUFxQixFQUFFO1lBQ3RCLGNBQWMsQ0FBQyxTQUFTO1NBQ3hCO0tBQ0Q7SUFFRCxxQkFBcUI7SUFDckI7UUFDQyxNQUFNLEVBQUUsc0RBQXNEO1FBQzlELFlBQVksRUFBRSxVQUFVO1FBQ3hCLHFCQUFxQixFQUFFO1lBQ3RCLGFBQWEsQ0FBQyxhQUFhO1NBQzNCO0tBQ0Q7SUFFRCxrRUFBa0U7SUFDbEU7UUFDQyxNQUFNLEVBQUUsZ0RBQWdEO1FBQ3hELFlBQVksRUFBRTtZQUNiLEdBQUcsVUFBVTtZQUNiLGFBQWE7U0FDYjtLQUNEO0lBRUQsNEJBQTRCO0lBQzVCO1FBQ0MsTUFBTSxFQUFFLG9DQUFvQztRQUM1QyxJQUFJLEVBQUUsSUFBSSxDQUFDLHdCQUF3QjtLQUNuQztJQUVELGtCQUFrQjtJQUNsQjtRQUNDLE1BQU0sRUFBRSxpQ0FBaUM7UUFDekMsWUFBWSxFQUFFO1lBQ2IsR0FBRyxVQUFVO1lBRWIsZ0VBQWdFO1lBQ2hFLE9BQU87WUFDUCxTQUFTO1NBQ1Q7UUFDRCxlQUFlLEVBQUU7WUFDaEIsU0FBUyxDQUFDLDRDQUE0QztTQUN0RDtRQUNELHFCQUFxQixFQUFFO1lBQ3RCLGNBQWMsQ0FBQyxTQUFTO1NBQ3hCO0tBQ0Q7Q0FDRCxDQUFDO0FBRUYsTUFBTSxjQUFjLEdBQUcsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFXekUsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDO0FBRXRCLFNBQVMsU0FBUyxDQUFDLE9BQW1CLEVBQUUsVUFBeUIsRUFBRSxJQUFXO0lBQzdFLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUV0QixTQUFTLFNBQVMsQ0FBQyxJQUFhO1FBQy9CLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRTtZQUMzQyxPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsZUFBZTtTQUN4RDtRQUVELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN6QyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFakQsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNaLE9BQU87U0FDUDtRQUVELElBQUksYUFBYSxHQUFRLE1BQU0sQ0FBQztRQUVoQyxPQUFPLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDNUIsYUFBYSxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUM7U0FDckM7UUFFRCxNQUFNLFlBQVksR0FBRyxhQUEwQixDQUFDO1FBQ2hELE1BQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUVwQyxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxFQUFFO1lBQ3pELE9BQU8sQ0FBQyxXQUFXO1NBQ25CO1FBRUQsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsS0FBSyxJQUFJLENBQUMsRUFBRTtZQUNsRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLFVBQVUsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUN0RixPQUFPLENBQUMsR0FBRyxDQUFDLG9EQUFvRCxJQUFJLHFCQUFxQixJQUFJLENBQUMsTUFBTSxNQUFNLFVBQVUsQ0FBQyxRQUFRLEtBQUssSUFBSSxHQUFHLENBQUMsSUFBSSxTQUFTLEdBQUcsQ0FBQyx3SEFBd0gsQ0FBQyxDQUFDO1lBRXJSLFNBQVMsR0FBRyxJQUFJLENBQUM7WUFDakIsT0FBTztTQUNQO1FBRUQsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQztRQUN6QyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUU7WUFDaEMsZUFBZSxFQUFFLEtBQUssTUFBTSxXQUFXLElBQUksWUFBWSxFQUFFO2dCQUN4RCxJQUFJLFdBQVcsRUFBRTtvQkFDaEIsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQztvQkFDbEMsSUFBSSxNQUFNLEVBQUU7d0JBQ1gsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUM7d0JBQ2hELElBQUksZ0JBQWdCLEVBQUU7NEJBQ3JCLE1BQU0sa0JBQWtCLEdBQUcsZ0JBQWdCLENBQUMsUUFBUSxDQUFDOzRCQUNyRCxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtnQ0FDNUIsS0FBSyxNQUFNLGlCQUFpQixJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtvQ0FDeEQsSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEVBQUU7d0NBQ3ZELFNBQVMsZUFBZSxDQUFDO3FDQUN6QjtpQ0FDRDs2QkFDRDs0QkFDRCxJQUFJLElBQUksQ0FBQyxxQkFBcUIsRUFBRTtnQ0FDL0IsS0FBSyxNQUFNLG9CQUFvQixJQUFJLElBQUksQ0FBQyxxQkFBcUIsRUFBRTtvQ0FDOUQsSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEVBQUU7d0NBQzFELE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsVUFBVSxDQUFDLDZCQUE2QixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO3dDQUV0RixPQUFPLENBQUMsR0FBRyxDQUFDLHNEQUFzRCxJQUFJLFdBQVcsb0JBQW9CLHFCQUFxQixJQUFJLENBQUMsTUFBTSxNQUFNLFVBQVUsQ0FBQyxRQUFRLEtBQUssSUFBSSxHQUFHLENBQUMsSUFBSSxTQUFTLEdBQUcsQ0FBQyx1SEFBdUgsQ0FBQyxDQUFDO3dDQUVyVCxTQUFTLEdBQUcsSUFBSSxDQUFDO3dDQUNqQixPQUFPO3FDQUNQO2lDQUNEOzZCQUNEO3lCQUNEO3FCQUNEO2lCQUNEO2FBQ0Q7U0FDRDtJQUNGLENBQUM7QUFDRixDQUFDO0FBRUQsU0FBUyxhQUFhLENBQUMsWUFBb0I7SUFDMUMsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUVsRSxNQUFNLGdCQUFnQixHQUF1QixFQUFFLFVBQVUsRUFBRSxlQUFVLEVBQUUsYUFBYSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUEsaUJBQVksRUFBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUUseUJBQXlCLEVBQUUsT0FBTyxDQUFDLFFBQVEsS0FBSyxPQUFPLEVBQUUsQ0FBQztJQUNwTixNQUFNLGNBQWMsR0FBRyxFQUFFLENBQUMsMEJBQTBCLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxJQUFBLGNBQU8sRUFBQyxJQUFBLGNBQU8sRUFBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFFMUksTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFFekUsT0FBTyxFQUFFLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsY0FBYyxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQztBQUN6RixDQUFDO0FBRUQsRUFBRTtBQUNGLG9DQUFvQztBQUNwQyxFQUFFO0FBQ0YsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBRTlDLEtBQUssTUFBTSxVQUFVLElBQUksT0FBTyxDQUFDLGNBQWMsRUFBRSxFQUFFO0lBQ2xELEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1FBQ3pCLElBQUksSUFBQSxpQkFBSyxFQUFDLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ3pELElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNmLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO2FBQ3JDO1lBRUQsTUFBTTtTQUNOO0tBQ0Q7Q0FDRDtBQUVELElBQUksU0FBUyxFQUFFO0lBQ2QsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNoQiJ9