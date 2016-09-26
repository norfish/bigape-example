/**
 * @desc: index
 * @authors: yongxiang.li
 * @date: 2016-09-12 19:39:22
 */

var BigPipe = require('../../../libs/pipe/BigPipe');
var layout = require('./layout');
var modA = require('./modA');
var modB = require('./modB');
var modC = require('./modC');

var HomeAction = BigPipe.create('home', {
    _bootstrap: layout,

    pagelets: {
        'modA': modA,
        'modB': modB,
        'modC': modC
    }
});

module.exports = HomeAction;
