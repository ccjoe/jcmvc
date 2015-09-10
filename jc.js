var mongo = require('mongoskin')
   ,http = require('http')
   ,url = require('url')
   ,dot = require('dot')
   ,chalk = require('chalk')
   ,_ = require('lodash')
   ,path = require('path')
   ,fs = require('fs')
   ,staticServe = require('serve-static');


var request = require('./lib/req')
   ,response = require('./lib/res')
   ,utils = require('./lib/utils')
   // ,config = require('./config')
   ,connect = require('connect');

var jc = {
    config: {},
    req: request,
    res: response,
    staticServe: staticServe,
    init: function(req, res) {
        //引入扩展的req, res
        if (res.getHeader('X-Powered-By') !== 'R_E_S_T') {
            jc.handleMvc(req, res);
        } else {
            jc.handleRest(req, res);
        }
    },
    //创建app, 有connect中间件时使用中间件初始app,无时直接初始化
    app: function() {
        if (connect) {
            var app = connect();
            //还是使用中间件形式混合入扩展的req,res;
            app.use(function(req, res, next) {
                req = _.assign(req, jc.req);
                res = _.assign(res, jc.res);
                next();
            })
            return app;
        } else {
            return function() {
                jc.init(req, res)
            };
        }
    },

    //创建server
    server: function(app) {
        app.use(jc.init);
        //没有传入app,则从内部jc.app启动
        http.createServer(app || jc.app).listen(jc.config.app.port, jc.config.app.host);
        console.log(chalk.red('运行于 ' + jc.config.app.host + ':' + jc.config.app.port));
    },
    //连接DB
    db: function(dbname) {
        //连接到DB的blog db
        var db = new mongo.db('mongodb://' + jc.config.db.host + ':' + jc.config.db.port + '/' + dbname, {
            safe: true
        });
        db.open(function(error, dbConnetion) {
            if (error) {
                console.log(error);
                process.exit(1);
            }
        });

        return db;
    },
    //middleWare by REST header
    setHeaderRest: function(req, res, next) {
        //https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Access_control_CORS
        res.header('Access-Control-Allow-Origin', req.headers.origin); //origin参数指定一个允许向该服务器提交请求的URI.对于一个不带有credentials的请求,可以指定为'*',表示允许来自所有域的请求.
        res.header('Access-Control-Allow-Credentials', 'true'); //带上认证信息(如 cookie)
        res.header('Access-Control-Allow-Headers', 'X-Requested-With'); //x-requested-with XMLHttpRequest  //表明是AJax异步
        res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
        res.header('Access-Control-Max-Age', '86400'); // 预请求的结果的有效期
        res.header('X-Powered-By', 'R_E_S_T'); //个人标记,用以区分是否resturl
        res.header('Content-Type', 'application/json;charset=utf-8');
        next();
    },
    handleRest: function(req, res) {
        var restIf = jc.queryRest(req, res); //restInfo
        req.key = restIf.key;
        jc.printf(req, res);
        console.log(restIf, 'restIf');
        var finalRest;
        switch (req.method) {
            case 'GET':
                finalRest = restIf.res.query(req, res);
                break;
            case 'POST':
                finalRest = restIf.res.update(req, res);
                break;
            case 'PUT':
                finalRest = restIf.res.create(req, res);
                break;
            case 'DELETE':
                finalRest = restIf.res.remove(req, res);
                break;
        };
        //判断是否promise
        if(finalRest.then){
            finalRest.then(function(data){
                res.json(data);
            });
        }else{
            res.json(finalRest);
        }
    },

    //因Restful URI 表征资源，相应的URI会影响到collection的设计，因为Restful更应该有好的设计。
    /*比如网上汇款，从账户1向账户2汇款500元，错误的URI是：
　　      POST /accounts/1/transfer/500/to/2
      正确的写法是把动词transfer改成名词transaction，资源不能是动词，但是可以是一种服务：
         POST /transaction  from=1&to=2&amount=500.00 */
    //处理Rest请求, 与处理MVC不同的仅仅是将CTRL/Action 约定改成 Resource/Method约定
    //Resource/Method约定
    queryRest: function(req, res) {
        var uri = url.parse(req.url).pathname;
        uri = uri.split(jc.config.restUriPrefix).join('').split('/');
        var resource = uri[1],
            key = uri[2],
            method = req.method;

        var resAction = jc.getResCtrl(req, res, resource);
        return {
            res: resAction.rest, //对应的resource方法集合
            resname: resource,
            key: key,
            mtd: method
        }
    },
    printf: function(req, res) {
        var restIf = jc.queryRest(req, res),
            action = '';
        switch (req.method) {
            case 'GET':
                action = '获取';
                break;
            case 'POST':
                action = '新增';
                break;
            case 'PUT':
                action = '修改';
                break;
            case 'DELETE':
                action = '删除';
                break;
        }
        console.log(chalk.bgGreen.black(req.method + '请求' + action + '资源:' + restIf.resname + (restIf.key ? ',且Key为' + restIf.key : '列表')));
    },
    //获取MVC中的CTRL或REST中的RESOURCE
    getResCtrl: function(req, res, resName) {
        try {
            var ctrl = require('./app/ctrls/' + resName);
        } catch (error) {
            jc.handleErr(req, res, error);
            return;
        }
        return ctrl;
    },
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
    parseMvc: function(req, res) {
        var mvcLabels = jc.queryMvc(req, res);
        console.log(chalk.underline.bgBlue.white('mvcName'), mvcLabels);
        try {
            var tmpl = jc.load(mvcLabels.v);
        } catch (error) {
            jc.handleErr(req, res, error);
            return;
        }

        var action = jc.getResCtrl(req, res, mvcLabels.c)[mvcLabels.a];
        console.log(action, 'action')
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
        var mvcHandler = jc.parseMvc(req, res);
        console.log(chalk.underline.bgBlue.white('mvcHandler'), mvcHandler, mvcHandler.pn);

        if (!mvcHandler) {
            return;
        };

        var tmplData = dot.template(mvcHandler.v, undefined, jc);
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

            console.log(rtc, 'RTC');
            
            if (!rtc) {
                res.end(tmplData({}));
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
                chalk.bgRed(error);
            });
        } else {
            //如果没有action,也可以输出相应静态文档，但如果没有ctrl话还是会报错
            res.end(tmplData({}));
        }

        function sendRes(req, res, rtc) {
            var method = req.method;
            if (method === 'GET'){
                // var dataForTmpl = _.assign({}, {page:rtc}, {path: jc.queryMvc(req,res)});
                // console.log(rtc,  'dataForTmpl');
                res.end(tmplData(rtc));
            }
            else if (method === 'POST'){
                //如果在POST请求时，如果声明sendType为PAGE也要渲染页面;
                if(res.sendType === 'PAGE'){

                    res.end(tmplData(rtc));
                    return;
                }
                res.json(rtc);
            }
        }
    },

    //处理需要权限控制的URL, true,需要验证登录，false不需要
    access: function(path) {
        var accessDir = jc.config.access;
        if (!(accessDir && accessDir.length)) {
            return false
        };
        for (var i = 0; i < accessDir.length; i++) {
            console.log(path, accessDir[i], 'pathstr');
            if (!!~path.indexOf(accessDir[i])) {
                return true;
            }
        }
        return false
    },
    //将model promise化
    //简单来讲 将model里面的每个方法 promise化重写，返回这个model方法集合
    promisifyModel: function(model) {
        for (var fn in model) {
            console.log(chalk.bgBlack.white(fn, 'promisified function'));
            (function(i) {
                var modelfn = model[i]; //指向原方法的引用
                if (typeof modelfn === 'function') {
                    model[i] = function(req, res) {
                        return new Promise(function(resolve, reject) {
                            modelfn(req, res, function(error, data) {
                                if (!error) {
                                    resolve(data);
                                } else {
                                    reject(error);
                                }
                            });
                        });
                    }
                } else {
                    //加入 REST的promise化。
                    if (i === 'rest') {
                        jc.promisifyModel(model['rest']);
                    } else {
                        throw 'promisifyModel时Model里只能为function和rest对象';
                    }
                }
            })(fn)
        }
        return model;
    },

    // 渲染静态文件,返回模板
    render: function(path, data) {
        var tmpl = jc.load(path);
        return dot.template(tmpl, undefined, jc)(data ? data : {});
    },
    //读取文件
    load: function(path) {
        var data = fs.readFileSync(jc.config.app.dir.view + path);
        if (data) return data.toString();
    },

    handleErr: function(req, res, error) {
        res.writeHead(500, {
            'Content-type': 'text/html'
        });
        res.end(jc.render('public/error.html', {
            error: error
        }), 'utf-8');
    },
    /*//将任何方法promise化
    promisify: function(fn) {
        var callback = function() {
            var args = [].prototype.slice.call(arguments);
            if (args.length <= 1) {
                resolve(args[args.length - 1]);
            } else {
                if (args[0]) {
                    reject(args[0])
                } else {
                    resolve(args.slice(1));
                }
            }
        };

        return new Promise(function(resolve, reject) {
            fn(callback);
        });
    },

    //TJ thunkify
    thunkify: function(fn) {
        if ('function' !== typeof fn) {
            console.log('function required');
        }

        return function() {
            var args = new Array(arguments.length);
            var ctx = this;

            for (var i = 0; i < args.length; ++i) {
                args[i] = arguments[i];
            }

            return function(done) {
                var called;

                args.push(function() {
                    if (called) return;
                    called = true;
                    done.apply(null, arguments);
                });

                try {
                    fn.apply(ctx, args);
                } catch (err) {
                    done(err);
                }
            }
        }
    },
    //TJ Co
    co: function(GenFunc) {
        return function(cb) {
            var gen = GenFunc()
            next();

            function next(err, args) {
                if (err) {
                    cb(err);
                } else {
                    if (gen.next) {
                        var ret = gen.next(args);
                        if (ret.done) {
                            cb && cb(null, args)
                        } else {
                            ret.value(next);
                        }
                    }
                }
            }
        }
    }*/
};

exports = module.exports = jc;
