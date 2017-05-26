//for File management
var fs = require('fs');
var request = require('request-promise');

function bfdb_client(){
    var address = "";

    //example: http://127.0.0.1:8081
    this.setAddress = function(url){
        address = url;
    };

    //convert query to a URL request
    function get_request_options(query) {
        var result = "";
        for (var q in query) {
            result += q + "=" + query[q].toString() + "&";
        }
        return result;
    }

    //run an array against a function that returns a promise n times
    //each function is expected to receive the object at an array index
    function do_n_at_a_time(arr, n, promiseFn) {
        function n_recursive(arr, n, acc, callbackFn) {
            if (arr.length === 0) {
                callbackFn(acc);
            } else {
                var max = (arr.length < n) ? arr.length : n;
                var promises = [];
                for (var i = 0; i < max; ++i) {
                    var curObject = arr.shift();
                    promises.push(promiseFn(curObject));
                }
                Promise.all(promises)
                    .then(function (results) {
                        for(var i = 0; i < results.length; ++i){
                            acc.push(results[i]);
                        }
                        n_recursive(arr, n, acc, callbackFn);
                    });
            }
        }

        var new_arr = arr.slice();
        return new Promise(function (fulfill, reject) {
            n_recursive(new_arr, n, [], fulfill);
        });
    }

    function getUnit (id) {
        return new Promise(function (fulfill, reject) {
            //check if all parameters are properly set
            if (address === undefined || address.length === 0) {
                reject("Error: No URL specified. Use .setAddress(url) to fix.");
            } else if (id === undefined || id.length === 0) {
                reject("Error: No ID specified.");
            } else {
                var options = {
                    method: 'GET',
                    uri: address + "/unit/" + id
                };

                return request(options)
                    .then(function (response) {
                        fulfill(JSON.parse(response));
                    });
            }
        });
    }

    //get unit by ID
    this.getUnit = getUnit;

    //get multiple units by ID
    this.getUnits = function(id_arr){
        return do_n_at_a_time(id_arr,5,getUnit);
    };

    //search for a unit given a set of parameters
    this.searchUnit = function(query){
        function unitQueryIsValid(query){
            var isValid = false;
            var validKeys = Object.keys({
                unit_name_id: "",
                rarity: "",
                element: "",
                gender: "",
                move_speed: "",
                ls_name: "",
                ls_effect: "",
                bb_name: "",
                bb_effect: "",
                sbb_name: "",
                sbb_effect: "",
                ubb_name: "",
                ubb_effect: "",
                es_name: "",
                es_effect: "",
                sp_name: "",
                sp_effect: "",
                evo_mats: "",
                server: "",
                all_desc: "",
                all_effect: "",
                translate: "",
                strict: ""
            });
            var queryKeys = Object.keys(query);
            for(var i = 0; i < queryKeys.length; ++i){
                if(validKeys.indexOf(queryKeys[i]) > -1){
                    isValid = true;
                }
            }
            return isValid;
        }
        return new Promise(function(fulfill,reject){
            //check if all parameters are properly set
            if(address === undefined || address.length === 0){
                reject("Error: No URL specified. Use .setAddress(url) to fix.");
            }else if(query === undefined){
                reject("Error: No query specified.");
            }else if(!unitQueryIsValid(query)){
                reject("Error: Query isn't valid.")
            }else{
                var options = {
                    method: 'GET',
                    uri: address + "/search/unit/options?" + get_request_options(query)
                };

                return request(options)
                    .then(function(response){
                        fulfill(JSON.parse(response));
                    });
            }
        });
    };

    function getItem(id) {
        return new Promise(function (fulfill, reject) {
            //check if all parameters are properly set
            if (address === undefined || address.length === 0) {
                reject("Error: No URL specified. Use .setAddress(url) to fix.");
            } else if (id === undefined || id.length === 0) {
                reject("Error: No ID specified.");
            } else {

                var options = {
                    method: 'GET',
                    uri: address + "/item/" + id
                };

                return request(options)
                    .then(function (response) {
                        fulfill(JSON.parse(response));
                    });
            }
        });
    }

    //get item by ID
    this.getItem = getItem;

    //get multiple items by ID
    this.getItems = function(id_arr){
        return do_n_at_a_time(id_arr,5,getItem);
    }

    //search for an item given a set of parameters
    this.searchItem = function (query) {
        function itemQueryIsValid(query) {
            var isValid = false;
            var validKeys = Object.keys({
                item_name_id: "",
                item_desc: "",
                rarity: "",
                type: "",
                effect: "",
                sphere_type: "",
                server: "",
                translate: "",
            });
            var queryKeys = Object.keys(query);
            for (var i = 0; i < queryKeys.length; ++i) {
                if (validKeys.indexOf(queryKeys[i]) > -1) {
                    isValid = true;
                }
            }
            return isValid;
        }
        return new Promise(function (fulfill, reject) {
            //check if all parameters are properly set
            if (address === undefined || address.length === 0) {
                reject("Error: No URL specified. Use .setAddress(url) to fix.");
            } else if (query === undefined) {
                reject("Error: No query specified.");
            } else if (!itemQueryIsValid(query)) {
                reject("Error: Query isn't valid.");
            } else {
                var options = {
                    method: 'GET',
                    uri: address + "/search/item/options?" + get_request_options(query)
                };

                return request(options)
                    .then(function (response) {
                        fulfill(JSON.parse(response));
                    });
            }
        });
    };

    this.getStatus = function(){
        return new Promise(function (fulfill, reject) {
            //check if all parameters are properly set
            if (address === undefined || address.length === 0) {
                reject("Error: No URL specified. Use .setAddress(url) to fix.");
            } else {
                var options = {
                    method: 'GET',
                    uri: address + "/status"
                };

                return request(options)
                    .then(function (response) {
                        fulfill(JSON.parse(response));
                    });
            }
        });
    }
}

var client = new bfdb_client();

module.exports = client;