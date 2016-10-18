/**
 * @desc: modC
 * @authors: yongxiang.li
 * @date: 2016-09-12 19:49:42
 */


var Pagelet = require('../../../libs/pipe/Pagelet');

module.exports = Pagelet.extend({
    name: 'modC',

    domID: 'mod-c',

    template: 'modC',

    beforeRender: function(data) {
        return {
            msg: 'parsed mod-c'
        }
    }
});
