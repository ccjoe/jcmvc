var request = require('request')
  , fs = require('fs')
  , url = require('url')
  , path = require('path')
  , _ = require('lodash')
  , dot = require('dot')
  , log = require('./log')
  , utils = require('./utils');

var mvc = module.exports = {
  /**
   * 获取MVC各要素 对应的文件及方法名称(除model外)
   * Ctrl/Action约定
   */
  queryMvc: function (req, res) {
    var pathname = url.parse(req.url).pathname,
      paths = pathname.split('/');
    var ctrl = paths[1] || 'index', //controller
      action = paths[2] || 'index', //action
      args = paths.slice(3) || '', //arguments
      view = ctrl + '/' + action + '.html';

    var mvcName = {
      n: pathname,
      v: view,
      c: ctrl,
      a: action,
      p: args
    };
    return mvcName;
  },
  /**
   * 主要是请求所对应ctrl的action  及 相应的resource
   * 获取MVC各要素 对应的实体(除model外)
   */
  parseMvc: function (req, res) {
    var mvcLabels = mvc.queryMvc(req, res);
    log.info('['+new Date()+'] '+'MVC NAME', mvcLabels);
    try {
      var tmpl = utils.load(mvcLabels.v, mvc.config);
    } catch (error) {
      //没找到视图不抛错：因为可能有ctrl去send json不需要展示view
      //utils.handleErr(error, res);
      //return;
    }

    //如果ctrl存在
    try {
      var ctrl = utils.getResCtrl(req, res, mvcLabels.c),
        action = ctrl[mvcLabels.a];
    } catch (error) {
      //没找到ctrl action不抛错：因为可能仅需要展示view
      console.log(error, 'error')
    }

    return {
      n: mvcLabels.n,
      v: tmpl,
      a: action,
      p: mvcLabels.p
    };
  },
  /** 处理MVC之间的融合, 这里决定了相应的action需要返回的数据及格式,
    * GET 渲染模板
    * POST 返回JOSN
    * if promise
    */
  handleMvc: function (req, res) {
    var mvcHandler = mvc.parseMvc(req, res);

    //log.info('MVC OBJECT:', mvcHandler);
    if (!mvcHandler) {
      return;
    }
    if (mvcHandler.a) {
      //tmplData是一个dot.template方法，这里action执行在此方法上，可以在action里的this获取到此方法。
      // rtc 为 action 的 返回体
      //req.key为id或标识信息，数组长度为1时即为第一个元素，否则为数组。
      req.key = mvcHandler.p.length === 1 ? mvcHandler.p[0] : mvcHandler.p;
      var rtc = mvcHandler.a.apply(null, [req, res]); //.concat(mvcHandler.p)
      //但是这里统一处理tmplData(data),没有在action里处理这个，仅需要在action里返回带data的promise;
      //如果之前有设置请求头，则不渲染
      // if(res.headersSent){
      //     return;
      // };
      //如果 rtc为不返回任何东西，则默认渲染无数据页面
      log.info('['+new Date()+'] '+'MODEL=>CTRL', rtc);
      if (!rtc) {
        //render({});
        return;
      }
      ;
      //如果 rtc是否promise,不是且存在的话控制器必须返回数据object
      if (!rtc.then) {
        //这里认为GET是为了请求页面， POST是为了提交数据而返回结果
        sendRes(req, res, rtc);
        return;
      }

      rtc.then(function (data) {
        //渲染带模板的数据
        sendRes(req, res, data);
      }).catch(function (error) {
        log.error(error);
      });
    } else {
      //如果没有action,也可以输出相应静态文档，但如果没有ctrl话还是会报错(更改->也不报错,作为前端环境管理时不写服务也需要展示页面)
      render();
    }

    function sendRes(req, res, rtc) {
      var method = req.method;
      if (method === 'GET') {
        // var dataForTmpl = _.assign({}, {page:rtc}, {path: mvc.queryMvc(req,res)});
        // log.log(rtc,  'dataForTmpl');
        render(rtc);
      }
      else if (method === 'POST') {
        //如果在POST请求时，如果声明sendType为PAGE也要渲染页面;
        if (res.sendType === 'PAGE') {

          render(rtc);
          return;
        }
        res.json(rtc);
      }
    }

    //所有渲染模板带上getGlobalDataForView信息
    function render(data) {
      var view = mvcHandler ? mvcHandler.v : '';
      //没有数据时直接渲染页面,也不要这样渲染页面render({})，因为会经由dot渲染，与前端模板引擎冲突;
      if (data !== void 0) {
        var tmplData = dot.template(view, undefined, utils);
        var sendData = _.assign({}, mvc.getGlobalDataForView(req, res), {viewdata: data});
        log.info('['+new Date()+'] '+'CTRL=>VIEW DATA', sendData);
        res.end(tmplData(sendData));
      } else {
        res.end(view);
      }
    }
  },
  /**
   * warning:Not coverage, for staticServer Deal
   * 处理静态文件相关 header
   * 主要是处理header中的缓存相关头 Expires Cache-Control Last-Modified If-Modify-Since
   * 浏览器在发送请求之前由于检测到Cache-Control和Expires
   * （Cache-Control的优先级高于Expires，但有的浏览器不支持Cache-Control，这时采用Expires），
   * 如果没有过期，则不会发送请求，而直接从缓存中读取文件。
   */
  headerMvc: function(req, res){
    var config= mvc.config,
        ext = path.extname(realPath);
        ext = ext ? ext.slice(1) : 'unknown';
    if (ext.match(config.Expires.fileMatch)) {
      var expires = new Date();
      expires.setTime(expires.getTime() + config.Expires.maxAge * 1000);
      response.setHeader("Expires", expires.toUTCString());
      response.setHeader("Cache-Control", "max-age=" + config.Expires.maxAge);
    }
    fs.stat(req.path, function (err, stat) {
      var lastModified = stat.mtime.toUTCString();
      response.setHeader("Last-Modified", lastModified);
    });

    if (request.headers[ifModifiedSince] && lastModified == request.headers[ifModifiedSince]) {
      response.writeHead(304, "Not Modified");
      response.end();
    }

  },
  /**
   * 获取除业务数据外的 某视图所需要的其它信息包含:
   * info.config 全站配置信息
   * info.route  路由信息
   * info.resource 除全app公用资源外的 差异化css,js, ...资源引用
   * @return {object} info
   */
  getGlobalDataForView: function (req, res) {
    return _.assign({}, mvc.config, {
      route: mvc.queryMvc(req, res)
    }, {
      resource: mvc.parseResource(req, res)
    });
  },
  /**
   * 解析前端资源目录的 resource-config.js的资源配置
   * @param req
   * @param res
   * @returns {*}
   * @example 在每个项目的前端目录根里可以定义res-conf.js，配置如下。
module.exports = {
  // 全app公用资源引用
  common:{
      css: ["/static/lib/amazeui/dist/css/amazeui.css", "/static/css/app.css"],
      js: ["/static/lib/amazeui/dist/js/amazeui.js", "/static/lib/requirejs/require.js", "/static/js/app.js"]
  },
  //模块或ctrl级资源引用
  user:{
      // ctrl或模块公用
      common: {
          css: ['/static/css/user.css'],
          js: ['/static/js/user2.js']
      },
      index: {
          css: ['/static/css/user-index.css'],
          js: ['/static/js/user-index.js', '/static/js/user-index2.js']
      },
      //action 如 user/edit/123
      edit:{
          css: [],
          js: []
      }
  },
  auth:{
      // ctrl或模块公用
      common: {
          css: [],
          js: []
      },
      //action 如 user/edit/123
      edit:{
          css: [],
          js: []
      }
  }
};
   */
  parseResource: function (req, res) {
    //读取配置文件
    try {
      var resConfig = require(mvc.config.path.fe + 'res-conf');
    } catch (e) {
      return null;
    }
    //读取相应的ctrl与action的对象
    var mvcName = mvc.queryMvc(req, res);
    //获取ctrl内公用的对象与差异化的对象
    var ctrlRes = resConfig[mvcName.c] || {};
    var commonAppRes = resConfig.common || {},
      commonCtrlRes = ctrlRes.common || {},
      specActionRes = ctrlRes[mvcName.a] || {};
    var mergeRes = _.merge({}, commonAppRes, commonCtrlRes, specActionRes, function (a, b, c) {
      if (_.isArray(a)) {
        return a.concat(b);
      }
    });
    return mergeRes;
  }
};
