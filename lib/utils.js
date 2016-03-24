var request = require('request')
    ,fs = require('fs')
    ,path = require('path')
    ,dot = require('dot');
var utils = module.exports = {
  /**
   * 将model文件的每个方法 promise化
   * 简单来讲 将model里面的每个方法 promise化重写，返回这个model方法集合
   * @param models
   * @returns {*}
     */
    promisifyModel: function(models) {
        for (var fn in models) {
            (function(i) {
                var modelsfn = models[i]; //指向原方法的引用
                if (typeof modelsfn === 'function') {
                    models[i] = function(req, res) {
                        return new Promise(function(resolve, reject) {
                            modelsfn(req, res, function(error, data) {
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
                        utils.promisifyModel(models['rest']);
                    } else {
                        throw 'promisifyModel时Model里只能为function和rest对象';
                    }
                }
            })(fn)
        }
        return models;
    },

  /**
   * 获取Ctrl对象（根据 Name获取 MVC中的CTRL 或 REST中的RESOURCE）
   */
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
    handleErr: function (req, res, err, title) {
      if (!res) {
        log.error('发生错误', err);
        return;
      }
      res.end(utils.renderByPath('public/error.html', {
        viewdata: {
          title: title,
          error: err
        }
      }, utils.config), 'utf-8');
    },
    handle500: function(req, res, error){
        res.writeHead(500, {
        'Content-type': 'text/html'
        });
        this.handleErr(req, res, error, 'ERROR');
    },
    handle404: function(req, res, error){
        res.writeHead(404, {
            'Location': req.url
        });
        this.handleErr(req, res, error, 'Not Found');
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
}
