#!/usr/bin/env node
// setNodeTitle
process.title = '掘金抽奖';
// Use magic to suppress node deprecation warnings
// See: https://github.com/nodejs/node/blob/master/lib/internal/process/warning.js#L77
// @ts-ignore
process.noDeprecation = '1';
require('../dist/cli')
    .run()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });