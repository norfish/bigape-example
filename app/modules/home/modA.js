/**
 * @desc: modA
 * @authors: yongxiang.li
 * @date: 2016-09-12 19:48:33
 */


var Pagelet = require('../../../libs/pipe/Pagelet');

module.exports = Pagelet.extend({
    name: 'modA',

    domID: 'mod-a',

    template: 'modA',

    getRenderData: function() {
        return {
            info: 'mod-a data demo'
        }
    },

    beforeRender: function(data) {
        return {
            msg: 'parsed mod-a' + data.info
        }
    }
});
