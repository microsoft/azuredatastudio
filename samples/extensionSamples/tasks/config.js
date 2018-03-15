var path = require('path');

var projectRoot = path.resolve(path.dirname(__dirname));
var srcRoot = path.resolve(projectRoot, 'src');
var viewsRoot = path.resolve(srcRoot, 'views');
var htmlcontentRoot = path.resolve(viewsRoot, 'htmlcontent');
var outRoot = path.resolve(projectRoot, 'out');
var htmloutroot = path.resolve(outRoot, 'src/views/htmlcontent');
var localization = path.resolve(projectRoot, 'localization');

var config = {
    paths: {
        project: {
            root: projectRoot,
            localization: localization
        },
        extension: {
            root: srcRoot
        },
        html: {
            root: htmlcontentRoot,
            out: htmloutroot
        }
    }
};

module.exports = config;
