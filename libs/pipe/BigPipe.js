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
var co = require('co');

function NOOP() {}

function BigPipe(name, options) {

    this.bigpipe = this;

    // 标识符id，需要唯一
    this.id = name;

    this._options = options;

    // pagelet 缓存
    this._cache = {};

    // layout bootstrap
    this._bootstrap = options._bootstrap || {};

    this.layout = null;

    // pagelet module list
    this.pagelets = options.pagelets || [];

    // 实例化的页面片段集合
    this._pagelets = [];

    // pagelet chunk 集合
    this._chunks = [];

    // 需要flush到客户端的片段集合
    this._queue = [];

    // http something
    this._req = null;
    this._res = null;
    this._next = null;

    this.length = options.pagelets.length || 1;

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

        this._queue.push({
            name: name,
            view: chunk
        });

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

        this.once('done', done);

        // 确保不会在 end 之后再 write chunk
        if(this._res.finished) {
            this.emit('done', new Error('Response was closed, unable to flush content'));
        }

        if (!this._queue.length) {
            this.emit('done');
        }

        var data = new Buffer(this.join(), this.charset);

        if (data.length) {
            console.log('info: flush pagelet data {{', data.toString(), '}}');
            this._res.write(
                data,
                this.emit('done')
            );
        }

        //
        // Optional write confirmation, it got added in more recent versions of
        // node, so if it's not supported we're just going to call the callback
        // our selfs.
        // response.write(chunk[, encoding][, callback])
        if (this._res.write.length !== 3 || !data.length) {
            this.emit('done');
        }
    },

    /**
     * 合并chunk
     * @return {String} 合并后的chunk
     */
    join: function() {
        var result = this._queue.map(function(item) {
            // return item.data;
            return item.view;
        });

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

        // pagelet length
        this.length = _pagelets.length;

        this._pagelets = this.pagelets.map(function(pagelet) {
            var options = {
                req: bigpipe._req,
                res: bigpipe._res,
                next: bigpipe._next,
                query: bigpipe._query,
                bigpipe: bigpipe
            }
            return pagelet.create(pagelet.prototype.name, options);
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

        this.layout = this._bootstrap.create(this._bootstrap.prototype.name, {
            req: this._req,
            res: this._res,
            next: this._next,
            bigpipe: this
        });

        return this;

    },

    renderLayout: function() {
        var bigpipe = this;
        return this.layout.render().then(function(chunk) {
                return bigpipe.layout.write(chunk).flush();
            });
    },

    renderAsync: function() {
        var bigpipe = this;
        this.renderLayout().then(function() {
            // promise array
            var pageletArr = [];
            
            bigpipe._pagelets.forEach(function(pagelet) {
                // render Promise
                var render = pagelet.render().then(function (chunk) {
                    pagelet.write(chunk).flush();
                }, function (errData) {
                    // render error
                }).then(function() {
                    pagelet.end();
                });

                pageletArr.push(render);
            });

        }).catch(function(err) {
            bigpipe.catch(err);
        });
    },

    renderSync: function() {

    },

    renderJSON: function() {

    },

    renderSnippet: function() {

    },

    catch: function(err) {
        console.error('error', err)
    }
};

// extend eventEmitter
_.extend(BigPipe.prototype, EventEmitter.prototype);

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
