/**
 * @desc: Pagelets
 * @authors: yongxiang.li
 * @date: 2016-08-03 20:32:19
 */

'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var co = require('co');
var qtemplate = require('@qnpm/q-template');
var qmonitor = require('@qnpm/q-monitor');
var logger = require('@qnpm/q-logger');

function Pagelet(name, options) {
    // pagelet uid
    this.name = name;

    // request
    this.req = options.req;

    // response
    this.res = options.res;

    // bigpipe 实例
    this.bigpipe = options.bigpipe;

    //
    this._bootstrap = options.bootstrap;

    // 初始化
    this.initialize.apply(this);
}

Pagelet.prototype = {
    constructor: Pagelet,

    qmonitor: '',

    name: '',

    domID: '',

    // 子片段
    pagelets: null,

    // template
    template: '',

    // 渲染模式 html json
    mode: 'html',

    // 脚本
    scripts: '',

    /**
     * 样式
     * @type {String}
     */
    styles: '',

    _parent: null,

    _children: null,

    service: function() {
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                resolve({
                    info: 'demodemo'
                })
            }, 100);
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
     * 暴露出的获取本pagelet数据的函数  readonly
     * @return {Promise} Object
     */
    get: function() {
        var pagelet = this;
        return this._getRenderData().then(function(json) {
            var parsed = {};
            parsed[pagelet.name] = pagelet.beforeRender(json);
            return parsed;
        });
    },

    /**
     * 获取渲染的原始数据 readonly
     * @return {Object} Promise
     */
    _getRenderData: function() {
        var data = this.getRenderData();

        if(this.isPromise(data)) {
            return data;
        }

        return Promise.resolve(data);
    },

    /**
     * 获取渲染的原始数据 可以被覆盖，默认是通过service取接口数据，返回promise
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
            .then(function(html) {
                return pagelet._createChunk(html);
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


    _getRenderHtml: function() {
        var pagelet = this;

        return this._getRenderData()
            .then(function(json) {
                // 预处理
                return pagelet.beforeRender(json);
            })
            .then(function(parsed) {
                var templatePath;

                if(pagelet.isBootstrap()) {
                    templatePath = pagelet.template;
                } else {
                    templatePath = 'partials/' + pagelet.template;
                }
                return qtemplate.render(templatePath, parsed);
            })
            .then(function(html) {
                return pagelet.afterRender(html);
            });
    },

    /**
     * 生成数据块
     * @param {String} html
     */
    _createChunk: function(html) {
        var chunkObj = {
            id: this.name,
            html: html,
            scripts: this.scripts,
            styles: this.styles,
            domID: this.domID
        };

        if(this.isBootstrap()) {
            return html;
        }

        return '<script>BigPipe.onArrive('+ JSON.stringify(chunkObj) +')</script>'
    },

    /**
     * 是否是基础模块
     * @return {Boolean}
     */
    isBootstrap: function() {
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

            pagelet.res.end();
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

        if(!__instance[name]) {
            __instance[name] = new this(name, options);
        }

        return __instance[name];
    }
})();

module.exports = Pagelet;
