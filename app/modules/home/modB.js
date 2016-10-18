/**
 * @desc: modB
 * @authors: yongxiang.li
 * @date: 2016-09-12 19:49:28
 */


var Pagelet = require('../../../libs/pipe/Pagelet');
var modC = require('./modC');

module.exports = Pagelet.extend({
    name: 'modB',

    domID: 'mod-b',

    template: 'modB',

    wait: [modC],

    beforeRender: function(data) {
        debugger
        var store = this.getStore();
        return {
            msg: 'parsed mod-b',
            dep: store.modC.msg
        }
    }
});
