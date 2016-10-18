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
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                resolve('Async mod-A data');
            }, 500)
        })
    },

    beforeRender: function(data) {
        var store = this.getStore();
        return {
            msg: 'parsed mod-a' + data.info,
            // dep: store.modC.msg,
            info: data
        }
    }
});
