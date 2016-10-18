/**
 * @desc: modB
 * @authors: yongxiang.li
 * @date: 2016-09-12 19:49:28
 */


var Pagelet = require('../../../libs/pipe/Pagelet');
var modC = require('./modC');
var modA = require('./modA');

module.exports = Pagelet.extend({
    name: 'modB',

    domID: 'mod-b',

    template: 'modB',

    wait: [modA, modC],

    beforeRender: function(data) {
        var store = this.getStore();
        return {
            msg: 'parsed mod-b' + data.info,
            dep: store.modA.msg + '||' + store.modC.msg,
            info: store.modA.info
        }
    },

    getRenderData: function() {
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                resolve('Async mod-B data');
            }, 500)
        })
    }
});
