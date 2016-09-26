/**
 * @desc: test
 * @authors: yongxiang.li
 * @date: 2016-09-12 19:24:52
 */

var BigPipe = require('../../libs/pipe/BigPipe');
var HomeAction = require('../modules/home');

exports.render = function(req, res, next) {
    return HomeAction
            .router(req, res, next)
            .renderAsync();
};

exports.renderJSON = function(req, res, next) {
    return HomeAction
        .router(req, res, next)
        .renderJSON(['modA', 'modB']);
};
