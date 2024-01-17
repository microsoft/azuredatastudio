"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const es = require("event-stream");
const vfs = require("vinyl-fs");
const util = require("../lib/util");
// @ts-ignore
const deps = require("../lib/dependencies");
const azure = require('gulp-azure-storage');
const root = path.dirname(path.dirname(__dirname));
const commit = util.getVersion(root);
// optionally allow to pass in explicit base/maps to upload
const [, , base, maps] = process.argv;
function src(base, maps = `${base}/**/*.map`) {
    return vfs.src(maps, { base })
        .pipe(es.mapSync((f) => {
        f.path = `${f.base}/core/${f.relative}`;
        return f;
    }));
}
function main() {
    const sources = [];
    // vscode client maps (default)
    if (!base) {
        const vs = src('out-vscode-min'); // client source-maps only
        sources.push(vs);
        const productionDependencies = deps.getProductionDependencies(root);
        const productionDependenciesSrc = productionDependencies.map(d => path.relative(root, d.path)).map(d => `./${d}/**/*.map`);
        const nodeModules = vfs.src(productionDependenciesSrc, { base: '.' })
            .pipe(util.cleanNodeModules(path.join(root, 'build', '.moduleignore')))
            .pipe(util.cleanNodeModules(path.join(root, 'build', `.moduleignore.${process.platform}`)));
        sources.push(nodeModules);
        const extensionsOut = vfs.src(['.build/extensions/**/*.js.map', '!**/node_modules/**'], { base: '.build' });
        sources.push(extensionsOut);
    }
    // specific client base/maps
    else {
        sources.push(src(base, maps));
    }
    return es.merge(...sources)
        .pipe(es.through(function (data) {
        console.log('Uploading Sourcemap', data.relative); // debug
        this.emit('data', data);
    }))
        .pipe(azure.upload({
        account: process.env.AZURE_STORAGE_ACCOUNT,
        key: process.env.AZURE_STORAGE_ACCESS_KEY,
        container: 'sourcemaps',
        prefix: commit + '/'
    }));
}
main();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBsb2FkLXNvdXJjZW1hcHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ1cGxvYWQtc291cmNlbWFwcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztnR0FHZ0c7O0FBRWhHLDZCQUE2QjtBQUM3QixtQ0FBbUM7QUFFbkMsZ0NBQWdDO0FBQ2hDLG9DQUFvQztBQUNwQyxhQUFhO0FBQ2IsNENBQTRDO0FBQzVDLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBRTVDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQ25ELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFFckMsMkRBQTJEO0FBQzNELE1BQU0sQ0FBQyxFQUFFLEFBQUQsRUFBRyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQztBQUV0QyxTQUFTLEdBQUcsQ0FBQyxJQUFZLEVBQUUsSUFBSSxHQUFHLEdBQUcsSUFBSSxXQUFXO0lBQ25ELE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQztTQUM1QixJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQVEsRUFBRSxFQUFFO1FBQzdCLENBQUMsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN4QyxPQUFPLENBQUMsQ0FBQztJQUNWLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDTixDQUFDO0FBRUQsU0FBUyxJQUFJO0lBQ1osTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO0lBRW5CLCtCQUErQjtJQUMvQixJQUFJLENBQUMsSUFBSSxFQUFFO1FBQ1YsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQywwQkFBMEI7UUFDNUQsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLHNCQUFzQixHQUFzRCxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkgsTUFBTSx5QkFBeUIsR0FBRyxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDM0gsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsRUFBRSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQzthQUNuRSxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDO2FBQ3RFLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0YsT0FBTyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUUxQixNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsK0JBQStCLEVBQUUscUJBQXFCLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzVHLE9BQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7S0FDNUI7SUFFRCw0QkFBNEI7U0FDdkI7UUFDSixPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUM5QjtJQUVELE9BQU8sRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQztTQUN6QixJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxVQUFVLElBQVc7UUFDckMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRO1FBQzNELElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3pCLENBQUMsQ0FBQyxDQUFDO1NBQ0YsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7UUFDbEIsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCO1FBQzFDLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLHdCQUF3QjtRQUN6QyxTQUFTLEVBQUUsWUFBWTtRQUN2QixNQUFNLEVBQUUsTUFBTSxHQUFHLEdBQUc7S0FDcEIsQ0FBQyxDQUFDLENBQUM7QUFDTixDQUFDO0FBRUQsSUFBSSxFQUFFLENBQUMifQ==