var request = require('request');

var utils = module.exports = {
    stat : 'staticServe',
    fetchImgByUrl: function(url, callback){
        request(url, function(error, response, body){
            if (!error && response.statusCode == 200) {
                callback(body);
            }
        });
    },
    fetchImgByUrlFoo: function(){
        var imgSrcReg = /<img\b[^>]*src\s*=\s*"(https:\/\/images\.unsplash\.com\/([^>"]*))"[^>]*>/gi;
        
        util.fetchImgByUrl('https://unsplash.com/', function(body){
            var imgSrcArr = [];
            body.replace(imgSrcReg, function(item, $1){
                imgSrcArr.push($1);
            });
        });
    }
}