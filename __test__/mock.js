/**
 * @desc: mock
 * @authors: yongxiang.li
 * @date: 2016-09-12 19:12:53
 */

var nock = require('nock');
var demoData = require('./data/demoData');

nock('http://api.demo.com')
    .get('/a')
    .reply(200, demoData.data1);

nock('http://api.demo.com')
    .get('/b')
    .reply(200, demoData.data2);

nock('http://api.demo.com')
    .get('/c')
    .reply(200, demoData.data3);
