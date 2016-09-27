/**
 * @desc: Bigpipe
 * @authors: yongxiang.li
 * @date: 2016-08-03 20:32:03
 *
 * TODO
 * 1. static module
 * 2.
 */

'use strict';

var util = require('util');
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var Pagelet = require('./Pagelet');
var co = require('co');
var qmonitor = require('@qnpm/q-monitor');
var logger = require('@qnpm/q-logger');
var Promise = require('bluebird');

function BigPipe(name, options) {

    this.bigpipe = this;

    // 标识符id，需要唯一
    this.name = name;

    this.options = options;

    // pagelet 缓存
    this._cache = {};

    this.layout = null;

    // pagelet module list
    this.pagelets = options.pagelets || {};

    // layout bootstrap
    this._bootstrap = options._bootstrap || {};

    // 实例化的页面片段集合
    this._pagelets = [];

    // 需要flush到客户端的片段集合
    this._queue = [];

    // http something
    this._req = null;
    this._res = null;
    this._next = null;

    // 所有的一级 pagelet 数量
    this.length = Object.keys(options.pagelets).length || 1;

    // this.initialize.apply(this, options);
}

BigPipe.prototype = {
    constructor: BigPipe,

    charset: 'utf-8',

    initialize: function(options) {
        return this;
    },

    usePagelets: function (pageletsObj) {
        this.pagelets = pageletsObj;
        return this;
    },

    router: function(req, res, next) {
        logger.info('开始Bigpip, start router使用模块为['+ Object.keys(this.pagelets).join('|')+']');
        this._cache = {};
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
     * 清空队列
     */
    clearQueue: function () {
        this._queue = [];
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

        if (!this._queue.length) {
            this.emit('done');
        }

        // 确保不会在 end 之后再 write chunk
        if(this._res.finished) {
            this.emit('done', new Error('Response was closed, unable to flush content'));
        }

        var data = new Buffer(this.join(), this.charset);
        var pageletName = this._queue.map(function (q) {
            return q.name;
        }).join('&');

        if (data.length) {
            logger.record('info: flush pagelet ['+ pageletName +'] data {{', data.toString(), '}}');
            this._res.write(
                data
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

        this.clearQueue();
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
        var _pagelets = this._pagelets = [];

        _.forIn(this.pagelets, function(pagelet, name) {
            var options = {
                req: bigpipe._req,
                res: bigpipe._res,
                next: bigpipe._next,
                query: bigpipe._query,
                bigpipe: bigpipe
            }

            var newPagelet = pagelet.create(name, options);
            bigpipe._cache[name] = newPagelet;
            _pagelets.push(newPagelet);
        });

        //refresh length
        bigpipe.length = _pagelets.length;

        return _pagelets;

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
        logger.info('开始渲染layout脚手架模块');
        return this.layout.render().then(function(chunk) {
                logger.info('渲染layout脚手架模块完成');
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

    renderJSON: function(modules) {

        var bigpipe = this;
        if(!modules || !modules.length) {
            logger.error('处理失败,没有传入需要处理的模块');
            bigpipe._json({
                status: 500,
                message: '未获取到数据'
            });
        }

        logger.info('开始处理JSON接口数据, 模块['+ modules.join(' | ') +']');

        Promise.map(modules, function(mod) {
            mod = bigpipe._cache[mod];
            return mod.get();
        }).then(function(data) {
            bigpipe._json(data);
        }).catch(function(error) {
            logger.error('处理JSON数据接口错误', error);
            var errObj = bigpipe._getErrObj(error);
            bigpipe._json(errObj);
        });

    },

    renderSnippet: function(moduleName) {
        var bigpipe = this;
        if(!moduleName) {
            logger.error('处理失败,没有传入需要处理的模块');
            this._json({
                status: 500,
                message: '未获取到数据'
            });
        }

        logger.info('开始处理html snippet接口数据, 模块['+ moduleName +']');

        var module = this._cache[moduleName];

        // bigpipe._res.set('Content-Type', 'text/html; charset=utf-8');
        module.renderSnippet().then(function(snippet) {
            module.end(snippet);
        });
    },

    /**
     * response json data to the client
     * @param  {Object|Array} data 需要render的原始数据，数组会被处理成Object
     */
    _json: function(data) {
        if(!data || _.isPlainObject(data)) {
            this._res.json(data);
        }

        data = data.reduce(function (pre, cur) {
            return _.extend(pre, cur);
        }, {});

        this._res.json({
            status: 0,
            message: 'success',
            data: data
        });
    },

    /**
     * 根据error Object 获取error json
     * @param  {Object} error error stack 或者Object
     * @return {Object}       error json
     */
    _getErrObj: function (error) {
        return {
            status: error.status || 502,
            message: error.message || '系统繁忙,请稍后重试'
        }
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

// function noop
function NOOP() {}

module.exports = BigPipe;
// BigPipe 一个页面一个
