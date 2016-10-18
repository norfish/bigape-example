/**
 * @desc: Pagelets
 * @authors: yongxiang.li
 * @date: 2016-08-03 20:32:19
 *
 * getRenderData
 *
 *
 * lifecycle
 *
 * getRenderData
 * beforeRender(json)
 * afterRender({
 * 	html: html,
 * 	renderData: renderData
 * })
 *
 * getPipeData(json) renderData
 */

'use strict';

var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var co = require('co');
var qtemplate = require('@qnpm/q-template');
var qmonitor = require('@qnpm/q-monitor');
var logger = require('@qnpm/q-logger');
var Promise = require('bluebird');

function Pagelet(name, options) {
    // pagelet uid
    this.name = name;

    // request
    this.req = options.req;

    // response
    this.res = options.res;

    // bigpipe 实例
    this.bigpipe = options.bigpipe;

    // 脚手架模块实例
    this._bootstrap = options.layout;

    // 初始化
    this.initialize.apply(this);
}

Pagelet.prototype = {
    constructor: Pagelet,

    qmonitor: '',

    name: '',

    domID: '',

    // template
    template: '',

    // 渲染模式 html json
    mode: 'html',

    // 脚本x`x``
    scripts: '',

    /**
     * 样式
     * @type {String}
     */
    styles: '',

    // 需要依赖的模块
    wait: [],

    // require: null,

    service: function() {
        return this.getService();
    },

    getService: function() {
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                resolve({
                    info: 'demo'
                })
            }, 0);
        })
    },

    initialize: function() {
        return this;
    },

    bootstrap: function(value) {
        if(!value) {
            return !this._bootstrap && this.name === 'bootstrap' ? this : this._bootstrap || {};
        }
        if (value && value.name === 'bootstrap') {
            return this._bootstrap = value;
        }
    },

    /**
     * 通用的获取本模块的pagelet数据的方法，返回Promise
     * @return {Object} Promise
     */
    get: function() {
        var pagelet = this;
        return this.ready()
            .then(function() {
                return pagelet._getAfterReady();
            })
            .then(function(data) {
                logger.info('数据处理成功，触发事件['+ pagelet.name +':done]', data);
                pagelet.bigpipe.emit(pagelet.name + ':done', data);
                return data;
            })
    },

    /**
     * 依赖数据已经ready，本模块可以正常render
     * @param  {string} done 是否已经ready
     * @return {Object}        Promise
     */
    ready: function(done) {
        if(!this._ready) {
            this._ready = new Promise(function(resolve, reject) {
                this.once('ready', function() {
                    resolve(null);
                });
            }.bind(this))
        }

        if(done) {
            this.emit('ready');
        }

        return this._ready;
    },

    /**
     * 获取渲染的原始数据 可以被覆盖，默认是通过service取接口数据，返回promise
     * 支持返回同步数据或者Promise异步
     * @return {[type]} [description]
     */
    getRenderData: function() {
        var serviceData = {};
        if(typeof this.service === 'function') {
            serviceData = this.service();
        }

        return serviceData;
    },

    /**
     * 处理通过getRenderData获取的原始数据
     * @param  {Object} json 原始数据
     * @return {Object}      处理之后的数据
     */
    beforeRender: function(json) {
        return json;
    },

    afterRender: function(html) {
        return html;
    },

    /**
     * 执行pagelet的渲染,
     * @param {Object} renderData 可选,如果传入则直接使用该数据渲染,否则通过service调用获取数据
     */
    render: function(renderData) {
        var pagelet = this;

        logger.info('开始渲染Pagelet模块['+ pagelet.name +']@', new Date());

        return this._getRenderHtml()
            .then(function(source) {
                return pagelet._createChunk(source);
            })
            // handle error
            .catch(function(err) {
                logger.error('Pagelet render error::', err);
                pagelet.catch(err);
            });
    },

    /**
     * 渲染html-fragment 片段
     * @param  {String} html render result
     * @return {String}      处理之后的数据
     */
    renderSnippet: function() {
        var pagelet = this;

        return this._getRenderHtml()
            .then(function(html) {
                return html;
            })
            // handle error
            .catch(function(err) {
                logger.error('Pagelet render snippet error::', err);
                pagelet.catch(err);
            });
    },

    /**
     * 暴露出的获取本pagelet数据的函数  readonly
     * @return {Object} parsed pagelet data {name: data}  function(data){}
     */
    _getAfterReady: function() {

        var pagelet = this;

        logger.info('开始获取数据['+ pagelet.name +']');

        // 优先使用缓存数据
        // 避免重复获取数据
        var _cache = this.getCache();
        if(_cache) {
            logger.info('使用数据缓存['+ pagelet.name +']', _cache);
            return Promise.resolve(_cache);
        }

        var getOriginData = this.getRenderData();

        // 如果数据可以同步, 直接返回同步数据
        if(!this.isPromise(getOriginData)) {
            logger.info('使用同步方式获取数据['+ pagelet.name +']');
            logger.record('获取模块数据成功['+ pagelet.name +']', json);
            getOriginData = Promise.resolve(getOriginData);
        }

        return getOriginData.then(function(json) {
            logger.record('获取模块数据成功['+ pagelet.name +']', json);
            // beforeRender
            var data = pagelet.beforeRender(json);
            pagelet.setCache(data);
            return data;

        }, function(error) {
            logger.error('获取pagelet数据失败', pagelet.name, error);
            return pagelet._getErrObj(error);

        }).catch(function(error) {
            qmonitor.addCount('module_handler_error');
            logger.error('获取pagelet数据异常', pagelet.name, error);
            return pagelet._getErrObj(error);
        });
    },

    /**
     * 获取 html 片段渲染结果
     * @return {Object} Promise   function(html){};
     */
    _getRenderHtml: function() {
        var pagelet = this;
        var renderData;

        return this.get()
            .then(function(parsed) {
                renderData = Object.assign({}, parsed);
                // ext data
                pagelet._addExtRenderData(parsed);

                return qtemplate.render(pagelet._getTemplatePath(), parsed);

            // 模板渲染reject时候，渲染错误信息
            }, function(error) {
                logger.error('渲染pagelet失败', pagelet.name, error);
                var errorObj = pagelet._getErrObj(error);
                return qtemplate.render('partials/error', errorObj);
            })
            .then(function(html) {
                return pagelet.afterRender(html);
            })
            .catch(function(error) {
                qmonitor.addCount('module_render_error');
                logger.error('渲染pagelet异常', pagelet.name, error);
                return pagelet._getErrObj(error);
            });
    },

    _getTemplatePath: function() {
        if(this._isBootstrap()) {
            return 'pages/' + this.template;
        } else {
            return 'partials/' + this.template;
        }
    },

    // 统一为渲染数据增加额外的数据
    _addExtRenderData: function(parsed) {
        return _.assign(parsed, {
            locals: this.res.locals
        });
    },

    /**
     * 生成数据块
     * @param {String} html
     */
    _createChunk: function(html) {
        // 如果是主框架则直接返回
        if(this._isBootstrap()) {
            return html;
        }

        var chunkObj = {
            id: this.name,
            html: html,
            scripts: this.scripts,
            data: this.getPipeData(),
            styles: this.styles,
            domID: this.domID,
            modID: this.name,
            pageletDataKey: this.pageletDataKey,
            dataEventName: this.dataEventName,
            pageletEventName: this.pageletEventName
        };

        return '<script>BigPipe.onArrive('+ JSON.stringify(chunkObj) +')</script>'
    },

    getPipeData: function () {
        return null;
    },

    /**
     * 是否是基础模块
     * @return {Boolean}
     */
    _isBootstrap: function() {
        return this.name == 'layout' || this.name == 'bootstrap';
    },

    /**
     * flush
     * @return {[type]} [description]
     */
    flush: function() {
        this.bigpipe.flush();
    },

    /**
     * flush
     * @param  {[type]} name  [description]
     * @param  {[type]} chunk [description]
     * @return {[type]}       [description]
     */
    write: function(name, chunk) {
        if (!chunk) {
            chunk = name;
            name = this.name;
        }

        return this.bigpipe.queue(name, chunk);
    },

    /**
     * end flush
     * @param  {[type]} chunk [description]
     * @return {[type]}       [description]
     */
    end: function(chunk) {

        var pagelet = this;

        if (chunk) this.write(chunk);

        //
        // Do not close the connection before all pagelets are send.
        //
        if (this.bigpipe.length > 0) {
            return false;
        }

        //
        // Everything is processed, close the connection and clean up references.
        //
        this.bigpipe.flush(function close(error) {
            if (error) return pagelet.catch(error, true);
            logger.info('Bigpipe end @', new Date());
            pagelet.res.end('</html>');
        });

        return true;
    },

    /**
     * catch error
     * @param  {[type]} error [description]
     * @return {[type]}       [description]
     */
    catch: function(error) {
        console.error('error', error);
    },

    /**
     * 获取依赖数据
     * @return {[type]} [description]
     */
    _getDepData: function() {

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

    _renderError: function(error) {

    },

    getStore: function() {
        var store = this.bigpipe.store;
        return store.get.apply(store, arguments);
    },

    setStore: function() {
        var store = this.bigpipe.store;
        return store.set.apply(store, arguments);
    },

    getCache: function() {
        return this.getStore(this.name);
    },

    setCache: function(data) {
        return this.setStore(this.name, data);
    },

    isPromise: function(fn) {
        return fn && typeof fn.then !== 'undefined';
    }
}

/*###########################*
 * 类继承
 *##########################*/

/**
 * extend
 * @param  {Object} props  子类属性
 *                 constructor: 构造器属性
 *                 static: 静态属性
 * @return {Object}        子类
 */
var extend = function(props) {

    var parent = this;
    var child;

    if(props && props.hasOwnProperty('constructor')) {
        child = function(){
            parent.apply(this, arguments);
            props.constructor.apply(this, arguments);
        }

        //delete props.constructor;
    } else {
        child = function() {
            return parent.apply(this, arguments);
        }
    }

    // staticProps
    Object.assign(child, parent);
    if(props && props.hasOwnProperty('static')) {
        Object.assign(child, props.static);
        delete props.static;
    };

    // extend
    child.prototype = Object.create(this.prototype);

    // child props
    if(props) {
        Object.assign(child.prototype, props);
    }

    // inject props
    // injectChild(child);

    child.__super__ = parent.prototype;

    return child;
};

var _pagelets = {};
function extendPagelet(props) {
    var child = extend.apply(this, arguments);
    _pagelets[props.name] = child;
    return child;
}

// extend eventEmitter
// util.inherits(Pagelet, EventEmitter);
// extend eventEmitter
_.extend(Pagelet.prototype, EventEmitter.prototype);

Pagelet.extend = extendPagelet;

Pagelet.create = (function() {
    var __instance = {};

    return function(name, options) {
        if(!options) {
            options = name || {};
            name = 'defaults';
        }

        __instance[name] = new this(name, options);
        return __instance[name];
    }
})();

module.exports = Pagelet;
