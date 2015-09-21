# jcmvc
=======
___[npm build](https://www.npmjs.com/package/jcmvc)___  
__一个Nodejs MVC框架，可以用来开发MVC模式的Web应用或者作为前端的html,css,js,img等的模块化管理提供一个环境__

![ccjoe](https://nodei.co/npm/jcmvc.png?downloads=true)

引入依赖jcmvc  `npm install jcmvc`  
jcmvc的example的使用实例: [jc-mvc](https://github.com/ccjoe/jc-mvc)

## 个人觉得有以下特点或优点：

- 采取自然映射，无需配置路由及手动路由，模块或目录结构的组织即路由。 
  1. mvc  ---> ctrl/action/param
  2. rest ---> restUriPrefix/resource/param [GET, POST, PUT, DELETE]  
在缺省ctrl时，会依据view的结构生成路由，意义在于为`重构者或美工`提供一个纯表现与结构的模块化管理

- 无需处理除数据外的其它动作。
  1. model自动promise化
  2. mvc自动渲染页面，rest自动渲染json,仅需要在ctrl里组织装好数据，ctrl自动处理与model及view/json的联结。

- mvc与rest轻松结合, Ctrl/Action 与 Resource/Method约定相结合。

- 与express相同的中间件处理方式

- 多web化管理，可以指定多个前端目录，管理多个前端项目。
相当于提供多web服务，在webs目录里可以新建项目，指定配置文件即可新开一个web服务，且，可以对视图进行最便捷且基础mvc路由与对结构层进行doT模板引擎的模块化管理。
(难道你的开发模式还停留在手动在本地浏览且不停的COPY重复的东东......)

<!-- more -->

## 依赖：
- DB驱动     "mongoskin"
- 模板引擎    "dot"
- 中间件管理     "connect"

## 简介：

一个基于自然映射的MVC Nodejs框架，通过约定的URL与约定的控制器，行为，及视图的目录结构来构成系统。
比如访问 `http://localhost:1337/user/view/123`将会调用 `user控制器的view动作并传参ID`(非必须)去渲染user-view视图...

## 使用：

### 创建server
将简单的配置文件导出对象传入 jc.server方法即可：
```javascript
//app.js
var config = require('./config');
var jc = require('jcmvc');

var app = jc.app();
//......
//app.use(中间件)
//app.use(中间件)
//app.use(中间件)
//启动服务

jc.server(app);
```

### 定义模型
定义模型前首先需要取得对数据驱动的引用，如同创建server样创建
```javascript
var config = require('../../config');
var Jc = require('jcmvc');
//传入配置及db name
var db = Jc.db(config, 'blog');
```

获取db的引用后定义模型就相当简单了，如下user模块的列表（list）和详情(view);
需要注意的间导出user model时需要将导出的方法promise化, `module.exports = Jc.promisifyModel(userSets);`,框架利用原生ES6 Promise对其进行自动处理。
```javascript 
//model user.js
var collection = db.collection('user');

var userSets = {
    list : function (req, res, next) {
        collection.find({}).toArray(next);
    },
    update: function(){},
    create: function(){},
    remove: function(){}
};
//将导出的方法promise化
module.exports = Jc.promisifyModel(userSets);

```

### 定义控制器及ACTION
控制器利用model返回的promise将取得的数据返回，控制器会返回一个带数据的promise方法，框架会将控制器返回的数据自动处理,
控制器仅需返回一个_带数据的promise方法_。
```javascript
//定义MVC的数据输出
var userModel = require('../models/user');

exports.index = function(req, res){
    return {};
}

exports.list = function (req, res, args) {
    return userModel.list(req, res).then(function(list){
        return list;
    });
}

exports.view = function (req, res, args) {
    req.name = args;
    return userModel.view(req, res).then(function(data){
        return data;
    });
}
//定义REST的数据输出
exports.rest = {
    query: exports.list,
    update: function(req, res){
        return userModel.update(req, res).then(function(res){
            return res;
        });
    },
    create: function(req, res){
        return userModel.create(req, res).then(function(res){
            return res;
        });
    },
    remove: function(req, res){
        return userModel.remove(req, res).then(function(res){
            return res;
        });
    }
}
```

### 定义视图
框架将控制器的视图自动传入模板，这里模板引擎固定为doT。doT在测试中执行效率较高，且语法较为简单实用。
```html
{{#def.load('public/header.html')}}
<p>用户 {{=it.name }}：</p>
<pre>
是否管理员： {{=it.admin}}
用户密码： {{=it.password }}
用户邮箱：{{=it.email }}
</pre>
{{#def.load('public/footer.html')}}

```

### 约定的目录结构
按上面的步骤，MVC的user模块就实现了。如前所述，访问 `http://localhost:1337/user/view/123`将会调用 user控制器的view动作并传参ID的渲染user-view视图...，所以目录结构需要按模块进行，这也是目前较好的目录结构方式。

```
//约定的目录结构
├app
├── auth
│   ├── auth-ctrl.js
│   └── auth-model.js
├── index
│   └── index-ctrl.js
└── user
    ├── user-ctrl.js
    └── user-model.js
```

### 开启多web服务管理（其意义仅在于为开发者提供一个模块化管理的web服务）
需要在在webs目录里新那建一个web服务。仅需要实现重新配置config.js里相关,fePath为前端目录配置，目录可以任意指定。实现一个环境配置多个web服务且提供相同的功能。  

`注意：` rootPath为具体的model与ctrl实现（如果不需要可以不指定，例如重构者仅需要交付实现结构与样式及交互时，不涉及到数据时），如果仅需要静态的web开发，可以指定为默认的或不指定。如果需要为新开的web提供model与ctrl的具体实现，也可以指定到任意目录。实现同上目录结构图(约定的目录结构)

`效果即：` localhost:8001/web1module/test  
          localhost:8002/web2module/test  
          localhost:8003/web3module/test  
端口域名均自由配置, web1module， web2module， web3module的父目录即fePath可以任意指定，如此即实现基于Nodejs的MVC模式的模块化管理web服务器，去管理多个web应用。

```javascript
//config.js
var path = require('path')
    ,_ = require('lodash')
    ,env = process.env.NODE_ENV || 'dev'
    ,rootPath = path.normalize(__dirname + '/app/')
    //前端目录配置，目录可以配置在环境之外，在此可以配置, 这里示例指向本机的文件夹webcenter
    ,fePath = path.normalize('/Users/shaofengliu/IT/git/webcenter/web1/')

var config = {
    dev: {
        //应用配置
        app: {
            name: 'JC-web1',
            port: 821,
            host: 'mvc.jc.me',//'127.0.0.1',
        },
        //目录配置
        path: {
            root: rootPath,     //根目录
            stat: path.normalize(fePath + (env==='dev' ? 'src/' : 'dist/')),   //静态资源目录
            view: path.normalize(fePath + 'views/')     //模板目录
        },           
        //Restful url前缀，即带此前缀的url都是restful服务，且无restful资源无关，即与model操作无关型uri前缀;
        restUriPrefix: '/api'   
    },
    //test重载dev, test与dev环境不一致的可以在test对象里定义，一致的不需要
    test: {},
    //生产版环境配置：production重载dev与test,production与test环境不一致的可以在production对象里定义，一致的不需要
    production:{},
    //引用配置,模块引用的header或footer或css,js的配置
    refconfig:{

    }
};
config.test = _.assign({}, config.dev, config.test);
config.production = _.assign({}, config.test, config.production);

module.exports = config[env];
```

### 更新日志:
- 2015-07-26 引入connect模块, 方便使用中间件。
- 2015-08-03 加入passport与passport-local模块，用户登录认证。
- 2015-08-04 更新日志 引入Restful模块，在config里配置restRuiPrefix: '/api',则此路由下服从restful规则。
- 2015-08-05 基本完成rest模块。rest的model可以共用mvc的model，也可以在model里定义个rest对象方法集合，在ctrl里对应的也是exports.rest = {},规则与MVC一样，ctrl仅需要返回组织好的数据，如果是promise则需要返回带组织好的数据的promise便可以自动返回json
- 2015-09-11 
    将jcmvc npm化  
    提供多web服务，可以指定到任意目录（详见以上）  

