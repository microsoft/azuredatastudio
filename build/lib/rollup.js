"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollupAngular = void 0;
const fs = require("fs");
const rollup = require("rollup");
const path = require("path");
// getting around import rules
const nodeResolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
async function rollupModule(options) {
    const moduleName = options.moduleName;
    try {
        const inputFile = options.inputFile;
        const outputDirectory = options.outputDirectory;
        await fs.promises.mkdir(outputDirectory, {
            recursive: true
        });
        const outputFileName = options.outputFileName;
        const outputMapName = `${outputFileName}.map`;
        const external = options.external || [];
        const outputFilePath = path.resolve(outputDirectory, outputFileName);
        const outputMapPath = path.resolve(outputDirectory, outputMapName);
        const bundle = await rollup.rollup({
            input: inputFile,
            plugins: [
                nodeResolve(),
                commonjs(),
            ],
            external,
        });
        const generatedBundle = await bundle.generate({
            name: moduleName,
            format: 'umd',
            sourcemap: true
        });
        const result = generatedBundle.output[0];
        result.code = result.code + '\n//# sourceMappingURL=' + path.basename(outputMapName);
        await fs.promises.writeFile(outputFilePath, result.code.toString());
        if (result.map) {
            await fs.promises.writeFile(outputMapPath, result.map.toString());
        }
        return {
            name: moduleName,
            result: true
        };
    }
    catch (ex) {
        return {
            name: moduleName,
            result: false,
            exception: ex
        };
    }
}
function rollupAngular(root) {
    return new Promise(async (resolve, reject) => {
        const modules = ['core', 'animations', 'common', 'compiler', 'forms', 'platform-browser', 'platform-browser-dynamic', 'router'];
        const tasks = modules.map((module) => {
            return rollupModule({
                moduleName: `ng.${module}`,
                inputFile: path.resolve(root, 'node_modules', '@angular', module, '@angular', `${module}.es5.js`),
                outputDirectory: path.resolve(root, 'node_modules', '@angular', module, 'bundles'),
                outputFileName: `${module}.umd.js`,
                external: modules.map(mn => `@angular/${mn}`)
            });
        });
        // array of booleans
        const x = await Promise.all(tasks);
        const result = x.reduce((prev, current) => {
            if (!current.result) {
                prev.fails.push(current.name);
                prev.exceptions.push(current.exception);
                prev.result = false;
            }
            return prev;
        }, {
            fails: [],
            exceptions: [],
            result: true,
        });
        if (!result.result) {
            return reject(`failures: ${result.fails} - exceptions: ${JSON.stringify(result.exceptions)}`);
        }
        resolve();
    });
}
exports.rollupAngular = rollupAngular;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm9sbHVwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicm9sbHVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O2dHQUdnRzs7O0FBRWhHLHlCQUF5QjtBQUN6QixpQ0FBaUM7QUFDakMsNkJBQTZCO0FBRTdCLDhCQUE4QjtBQUM5QixNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUMxRCxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsd0JBQXdCLENBQUMsQ0FBQztBQVVuRCxLQUFLLFVBQVUsWUFBWSxDQUFDLE9BQXVCO0lBQ2xELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUM7SUFDdEMsSUFBSTtRQUNILE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7UUFDcEMsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQztRQUVoRCxNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLGVBQWUsRUFBRTtZQUN4QyxTQUFTLEVBQUUsSUFBSTtTQUNmLENBQUMsQ0FBQztRQUVILE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUM7UUFDOUMsTUFBTSxhQUFhLEdBQUcsR0FBRyxjQUFjLE1BQU0sQ0FBQztRQUM5QyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQztRQUV4QyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUNyRSxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUVuRSxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUM7WUFDbEMsS0FBSyxFQUFFLFNBQVM7WUFDaEIsT0FBTyxFQUFFO2dCQUNSLFdBQVcsRUFBRTtnQkFDYixRQUFRLEVBQUU7YUFDVjtZQUNE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