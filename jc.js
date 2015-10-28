var mongo = require('mongoskin')
   ,http = require('http')
   ,_ = require('lodash')
   ,staticServe = require('serve-static')
   ,connect = require('connect')
   ,favicon = require('serve-favicon');

var log = require('./lib/log')
   ,utils = require('./lib/utils')
   ,mvc = require('./lib/mvc')
   ,rest = require('./lib/rest')
   ,request = require('./lib/req')
   ,response = require('./lib/res');

var jc = {
    log:log,
    config: {},
    req: request,
    res: response,
    staticServe: staticServe,
    init: function(req, res, next) {
        jc.initConfig();
        var isStatic = /^\/static\/\S+\.\S+/.test(req.url);
        if(isStatic){
            next(); return;
        }
        //引入扩展的req, res
        if (res.getHeader('X-Powered-By') !== 'JC_REST') {
            mvc.handleMvc(req, res);
        } else {
            rest.handleRest(req, res, jc.config);
        }
    },
    initConfig: function(){
        var config = jc.config;
        utils.config = mvc.config = rest.config = config;
    },
    //创建app, 有connect中间件时使用中间件初始app,无时直接初始化
    app: function() {
        if (connect) {
            var app = connect();
            app.use(favicon(jc.config.path.stat + 'favicon.ico'));
            //还是使用中间件形式混合入扩展的req,res;
            app.use(function(req, res, next) {
                _.assign(req, jc.req);
                _.assign(res, jc.res);
                next();
            });
            return app;
        }
    },
    //创建server
    server: function(app) {
        app.use(jc.init);
        //没有传入app,则从内部jc.app启动
        http.createServer(app || jc.app).listen(jc.config.app.port, jc.config.app.host);
        log.warn('运行于:' + jc.config.app.host + ':' + jc.config.app.port);
    },
    //连接DB
    db: function(dbname) {
        //连接到DB的blog db
        var db = new mongo.db('mongodb://' + jc.config.db.host + ':' + jc.config.db.port + '/' + dbname, {
            safe: true
        });
        db.open(function(error) {
            if (error) {
                jc.handleErr(error);
                process.exit(1);
            }
        });
        return db;
    },
    //处理需要权限控制的URL, true,需要验证登录，false不需要
    access: function(path) {
        var accessDir = jc.config.access;
        if (!(accessDir && accessDir.length)) {
            return false
        }
        for (var i = 0; i < accessDir.length; i++) {
            if (!!~path.indexOf(accessDir[i])) {
                return true;
            }
        }
        return false;
    }
};
//分发api
jc = _.assign(jc, utils, rest);
exports = module.exports = jc;

// 访问不存在的路由会导致报错
// 加上resource-config.js及静态目录加上static后对于子项目的影响
// 静态资源访问拦截
