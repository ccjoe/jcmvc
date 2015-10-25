var request = require('request')
    ,fs = require('fs')
    ,url = require('url')
    ,path = require('path')
    ,_ = require('lodash')
    ,dot = require('dot')
    ,log = require('./log')
    ,utils = require('./utils');

var mvc = module.exports = {
       //获取MVC各要素 对应的文件及方法名称(除model外)
    //Ctrl/Action约定
    queryMvc: function(req, res) {
        var pathname = url.parse(req.url).pathname,
            paths = pathname.split('/');
        var ctrl = paths[1] || 'index', //controller
            action = paths[2] || 'index', //action
            args = paths.slice(3) || '', //arguments
            view = ctrl + '/' + action + '.html';

        var mvcName = {
            pn: pathname,
            v: view,
            c: ctrl,
            a: action,
            p: args
        };
        return mvcName;
    },
    //获取MVC各要素 对应的实体(除model外)
    //主要是请求所对应ctrl的action  及 相应的resource
    parseMvc: function(req, res) {
        var mvcLabels = mvc.queryMvc(req, res);
        log.info('MVC NAME', mvcLabels);
        try {
            var tmpl = utils.load(mvcLabels.v, mvc.config);
        } catch (error) {
            mvc.handleErr(error, res);
            return;
        }

        //如果ctrl存在
        try {
            var ctrl = mvc.getResCtrl(req, res, mvcLabels.c);
            var action = ctrl[mvcLabels.a];
        }catch(error){
            
        }
        
        var mvcElem = {
            pn: mvcLabels.pn,
            v: tmpl,
            // c: ctrl,
            a: action,
            p: mvcLabels.p
        };
        return mvcElem;
    },
    // 处理MVC之间的融合
    /* 这里决定了相应的action需要返回的数据及格式,
       GET 渲染模板
       POST 返回JOSN
       if promise 
    */

    handleMvc: function(req, res) {
       var mvcHandler = mvc.parseMvc(req, res);

        log.info('MVC对象:', mvcHandler);
        if(!mvcHandler){
          return;
        }
        if (mvcHandler.a) {
            log.log('ACTION: ', mvcHandler.a);
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

            log.info('MODEL=>CTRL', rtc);
            
            if (!rtc) {
                render({});
                return;
            };
            //如果 rtc是否promise,不是且存在的话控制器必须返回数据object
            if (!rtc.then) {
                //这里认为GET是为了请求页面， POST是为了提交数据而返回结果
                sendRes(req, res, rtc);
                return;
            }

            rtc.then(function(data) {
                //渲染带模板的数据
                sendRes(req, res, data);
            }).catch(function(error) {
                log.error(error);
            });
        } else {
            //如果没有action,也可以输出相应静态文档，但如果没有ctrl话还是会报错(更改->也不报错,作为前端环境管理时不写服务也需要展示页面)
            render({});
        }

        function sendRes(req, res, rtc) {
            var method = req.method;
            if (method === 'GET'){
                // var dataForTmpl = _.assign({}, {page:rtc}, {path: mvc.queryMvc(req,res)});
                // log.log(rtc,  'dataForTmpl');
                render(rtc);
            }
            else if (method === 'POST'){
                //如果在POST请求时，如果声明sendType为PAGE也要渲染页面;
                if(res.sendType === 'PAGE'){

                    render(rtc);
                    return;
                }
                res.json(rtc);
            }
        }

        //所有渲染模板带上getGlobalDataForView信息
        function render(data){
            var view = mvcHandler ? mvcHandler.v : '';
            var tmplData = dot.template(view, undefined, utils);
            var sendData = _.assign({}, mvc.getGlobalDataForView(req, res), {viewdata: data});
            log.info('CTRL=>VIEW DATA', sendData);
            res.end(tmplData(sendData));
        }
    },
    //获取除业务数据外的 某视图所需要的其它信息包含
    /*
     * @method
     * @return {object} info
     * info.config 全站配置信息
     * info.route  路由信息
     * info.resource 除全app公用资源外的 差异化css,js, ...资源引用
     */
    getGlobalDataForView: function (req, res) {
        return _.assign({}, mvc.config, {
            route: mvc.queryMvc(req, res)}, {
            resource: mvc.parseResource(req, res)
        });
    },
       //解析前端资源目录的 resource-config.js的资源配置
    parseResource: function(req, res){
        var mergeRes = {};
        //读取配置文件
        var resConfig = require(mvc.config.path.fe+'resource-config');
        //读取相应的ctrl与action的对象
        var mvcName = mvc.queryMvc(req, res);
        //获取ctrl内公用的对象与差异化的对象
        var ctrlRes = resConfig[mvcName.c] || {};
        var commonAppRes = resConfig.common || {},
            commonCtrlRes = ctrlRes.common || {},
            specActionRes = ctrlRes[mvcName.a] || {};
        mergeRes = _.merge({}, commonAppRes, commonCtrlRes, specActionRes, function(a, b, c) {
          if (_.isArray(a)) {
            return a.concat(b);
          }
        });
        return mergeRes;
    },
    handleErr: function(err, res) {
        if(!res){
            log.error('发生错误', err);
            return;
        }
        res.writeHead(500, {
            'Content-type': 'text/html'
        });
        res.end(utils.renderByPath('public/error.html', {viewdata: {
            title: 'ERROR',
            error: err
        }}, mvc.config), 'utf-8');
    }
}