/**
 * @desc: Bigpipe
 * @authors: yongxiang.li
 * @date: 2016-08-03 20:32:03
 */

'use strict';

var util = require('util');
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var Pagelet = require('./Pagelet');

function NOOP() {}

function BigPipe(name, options) {

    // 标识符id，需要唯一
    this.id = name;

    this._options = options;

    // pagelet 缓存
    this._cache = {};

    // layout bootstrap
    this.layout = options.layout || {};

    // pagelet module list
    this.pagelets = options.pagelets || [];

    // 实例化的页面片段集合
    this._pagelets = [];

    // pagelet chunk 集合
    this._chunks = [];
    //
    this._queue = [];

    // http something
    this._req = null;
    this._res = null;
    this._next = null;

    this.length = options.length || 1;

    // this.initialize.apply(this, options);
}

BigPipe.prototype = {
    constructor: BigPipe,

    charset: 'utf-8',

    initialize: function(options) {
        return this;
    },

    router: function(req, res, next) {
        this.bootstrap(req, res, next);
        this.createPagelets();

        return this;
    },

    /**
     * 将 render 之后的 pagelet push 到队列中
     * @param  {string} name  pagelet name
     * @param  {Object} chunk pagelet chunk
     * @return {this}       this
     */
    queue: function(name, chunk) {
        this.length--;

        this._chunks.push({
            name: name,
            view: chunk
        });

        if(!this.length) {
            this.flush();
        }

        return this;
    },

    /**
     * flush chunk
     * @param  {Function} done flush 完成之后的callback
     * @return {[type]}        [description]
     */
    flush: function(done) {
        if(typeof  done !== 'function') {
            done = NOOP;
        }

        // this.once('done', done);

        // 确保不会在 end 之后再 write chunk
        if(this._res.finished) {
            // this.emit('done', new Error('Response was closed, unable to flush content'));
        }

        if (!this._queue.length) {
            // this.emit('done');
        }

        var data = new Buffer(this.join(), this.charset);

        if (data.length) {
            this._res.write(
                data
                // this.emit('done')
            );
        }

        //
        // Optional write confirmation, it got added in more recent versions of
        // node, so if it's not supported we're just going to call the callback
        // our selfs.
        // response.write(chunk[, encoding][, callback])
        if (this._res.write.length !== 3 || !data.length) {
            // this.emit('done');
        }
    },

    /**
     * 合并chunk
     * @return {String} 合并后的chunk
     */
    join: function() {
        var result = this._queue.map(function(item) {
            // return item.data;
            return item;
        });

        this._queue.length = 0;

        return result.join('');
    },

    /**
     * 实例化 pagelets
     * @param  {} pagelets [description]
     * @return {[type]}          [description]
     */
    createPagelets: function() {
        var bigpipe = this;
        var _pagelets = this._pagelets;

        this.pagelets.map(function(pagelet) {
            var options = {
                req: bigpipe._req,
                res: bigpipe._res,
                next: bigpipe._next,
                query: bigpipe._query,
                bigpipe: bigpipe
            }
            var pageletPipe = Pagelet.create(pagelet.name, options);
            _pagelets.push(pageletPipe);
        });
    },

    /**
     * render layout
     * @param  {[type]}   req  [description]
     * @param  {[type]}   res  [description]
     * @param  {Function} next [description]
     * @return {[type]}        [description]
     */
    bootstrap: function(req, res, next) {
        this._req = req;
        this._res = res;
        this._next = next;
        // var _layout = new Pagelet('bootstrap', {
        //     req: req,
        //     res: res,
        //     params: {}
        // });
        //

        var _layout = Pagelet.create('bootstrap', {
            req: this._req,
            res: this._res,
            next: this._next,
            bigpipe: this
        });

        _layout.render();
    },

    renderLayout: function() {

    },

    renderAsync: function() {
        var bigpipe = this;
        this._pagelets.forEach(function(pagelet) {
            pagelet.render();
        });
    },

    renderSync: function() {

    },

    renderJSON: function() {

    },

    renderSnippet: function() {

    }
};

// extend eventEmitter
// _.extend(BigPipe.proptotype, EventEmitter);

BigPipe.create = (function() {
    var __instance = {};

    return function(name, options) {
        if(!options) {
            options = name || {};
            name = 'defaults';
        }

        if(!__instance[name]) {
            __instance[name] = new BigPipe(name, options);
        }

        return __instance[name];
    }
})();

module.exports = BigPipe;
// BigPipe 一个页面一个
