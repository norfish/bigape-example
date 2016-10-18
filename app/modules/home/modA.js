/**
 * @desc: modA
 * @authors: yongxiang.li
 * @date: 2016-09-12 19:48:33
 */


var Pagelet = require('../../../libs/pipe/Pagelet');
var modB = require('./modB');
var modC = require('./modC');

module.exports = Pagelet.extend({
    name: 'modA',

    domID: 'mod-a',

    template: 'modA',

    getRenderData: function() {
        return {
            info: 'mod-a data demo'
        }
    },

    wait: [modB, modC],

    beforeRender: function(data) {
        var store = this.getStore();
        return {
            msg: 'parsed mod-a' + data.info,
            dep: store.modB.msg + '||' + store.modC.msg
        }
    }
});
