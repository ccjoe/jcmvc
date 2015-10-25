var rest = module.exports = {
     //middleWare by REST header
    setHeaderRest: function(req, res, next) {
        //https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Access_control_CORS
        res.header('Access-Control-Allow-Origin', req.headers.origin); //origin参数指定一个允许向该服务器提交请求的URI.对于一个不带有credentials的请求,可以指定为'*',表示允许来自所有域的请求.
        res.header('Access-Control-Allow-Credentials', 'true'); //带上认证信息(如 cookie)
        res.header('Access-Control-Allow-Headers', 'X-Requested-With'); //x-requested-with XMLHttpRequest  //表明是AJax异步
        res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
        res.header('Access-Control-Max-Age', '86400'); // 预请求的结果的有效期
        res.header('X-Powered-By', 'JC_REST'); //标记,用以区分是否resturl
        res.header('Content-Type', 'application/json;charset=utf-8');
        next();
    },
    handleRest: function(req, res) {
        var restIf = this.queryRest(req, res); //restInfo
        req.key = restIf.key;
        this.printf(req, res);
       
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
        uri = uri.split(rest.config.restUriPrefix).join('').split('/');
        var resource = uri[1],
            key = uri[2],
            method = req.method;

        var resAction = this.getResCtrl(req, res, resource);
        return {
            res: resAction.rest, //对应的resource方法集合
            resname: resource,
            key: key,
            mtd: method
        }
    },
    //获取MVC中的CTRL或REST中的RESOURCE
    getResCtrl: function(req, res, resName) {
        try {
            var ctrl = require(rest.config.path.root + resName + '/' + resName + '-ctrl');
        } catch (error) {
            // mvc.handleErr(req, res, error);
            return;
        }
        return ctrl;
    },

    printf: function(req, res) {
        var restIf = this.queryRest(req, res),
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
        log.info(req.method + '请求' + action + '资源:' + restIf.resname + (restIf.key ? ',且Key为' + restIf.key : '列表'));
    },
};