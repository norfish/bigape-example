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
        var store = this.getStore();
        return {
            msg: 'parsed mod-c'
        }
    },

    getRenderData: function() {
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                resolve('Async mod-C data');
            }, 1000)
        })
    }
});
