var request = require('request')
    ,fs = require('fs')
    ,path = require('path')
    ,dot = require('dot');
var utils = module.exports = {
    //将model promise化
    //简单来讲 将model里面的每个方法 promise化重写，返回这个model方法集合
    promisifyModel: function(model) {
        for (var fn in model) {
            (function(i) {
                var modelfn = model[i]; //指向原方法的引用
                if (typeof modelfn === 'function') {
                    model[i] = function(req, res) {
                        return new Promise(function(resolve, reject) {
                            modelfn(req, res, function(error, data) {
                                if (!error) {
                                    resolve(data);
                                } else {
                                    utils.handleErr(error);
                                    reject(error);
                                }
                            });
                        });
                    }
                } else {
                    //加入 REST的promise化。
                    if (i === 'rest') {
                        utils.promisifyModel(model['rest']);
                    } else {
                        throw 'promisifyModel时Model里只能为function和rest对象';
                    }
                }
            })(fn)
        }
        return model;
    },
    //获取MVC中的CTRL或REST中的RESOURCE
    getResCtrl: function(req, res, resName) {
      try {
        var ctrl = require(path.normalize(utils.config.path.root + resName + '/' + resName + '-ctrl'));
      } catch (error) {
        console.log(error, 'error');
        return;
      }
      return ctrl;
    },
    // 渲染静态文件,返回模板
    renderByPath: function(path, data) {
        var tmpl = utils.load(path);
        return dot.template(tmpl, undefined, utils)(data ? data : {});
    },
    //读取文件
    load: function(path) {
        var data = fs.readFileSync(utils.config.path.view + path);
        if (data) return data.toString();
    },
    handleErr: function (err, res) {
      if (!res) {
        log.error('发生错误', err);
        return;
      }
      res.writeHead(500, {
        'Content-type': 'text/html'
      });
      res.end(utils.renderByPath('public/error.html', {
        viewdata: {
          title: 'ERROR',
          error: err
        }
      }, utils.config), 'utf-8');
    },
    //not use bolow
    fetchDataByUrl: function(url, callback){
        request(url, function(error, response, body){
            if (!error && response.statusCode == 200) {
                callback(body);
            }
        });
    },
    fetchImgByUrlFoo: function(){
        var imgSrcReg = /<img\b[^>]*src\s*=\s*"(https:\/\/images\.unsplash\.com\/([^>"]*))"[^>]*>/gi;

        util.fetchDataByUrl('https://unsplash.com/', function(body){
            var imgSrcArr = [];
            body.replace(imgSrcReg, function(item, $1){
                imgSrcArr.push($1);
            });
        });
    }

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
            log.log('function required');
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
}
