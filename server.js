//for File management
var fs = require('fs');
var request = require('request');
var rp = require('request-promise');

var _ = require('lodash'); //for search functions
var translate = require('google-translate-api');

//for server setup 
var compression = require('compression');
var bodyParser = require('body-parser');
var express = require('express'),
    app = express();

//for command line
var argv = require('yargs')
    .usage('Usage: $0 -p [integer] -i [string of IP address] -r -n -t')
    .default("p", 8081)
    .default("i", '127.0.0.1')
    .alias('p', 'port')
    .alias('i', 'ip').alias('i', 'ip-address')
    .alias('r', 'reload').alias('r','refresh')
    .alias('n','notranslate')
    .alias('t', 'test_function')
    .describe('p', 'Port to run server on')
    .describe('i', 'IP Address to run server on')
    .describe('r', 'Force a redownload of the database. Use this if you have issues with the JSON files.')
    .describe('n', 'Disable translation (for testing)')
    .describe('t', 'Run test function')
    .help('h')
    .alias('h', 'help')
    .argv;

//source: http://stackoverflow.com/questions/7067966/how-to-allow-cors
//CORS middleware, required for cross-domain reqeusting
var allowCrossDomain = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
};

app.use(compression());
app.use(bodyParser.urlencoded({extended: false}));
app.use(allowCrossDomain);

//on-going database that is a combination of 3 other databases (GL,EU,JP)
var master_list = {
    unit: {},
    item: {},
    es: {}
};

//statistics of the server
var stats = {
    last_update: null,
    gl: {
        num_units: 0,
        num_items: 0,
        num_es: 0,
        newest_units: [],
        newest_items: [],
        newest_es: []
    },
    jp: {
        num_units: 0,
        num_items: 0,
        num_es: 0,
        newest_units: [],
        newest_items: [],
        newest_es: []
    },
    eu: {
        num_units: 0,
        num_items: 0,
        num_es: 0,
        newest_units: [],
        newest_items: [],
        newest_es: []
    }
    
};

//donwnload a single file
function json_download_promisified(url,local_name){
    return new Promise(function(fulfill,reject){
        console.log("DL: " + url + " > " + local_name);
        try{
            fs.mkdirSync(__dirname + '/json/');
        }catch(err){/*do nothing as directory already exists*/}
        var destination = fs.createWriteStream(__dirname + '/json/' + local_name);
        console.log(destination.path);
        request(url).pipe(destination).on('finish', function () {
            fulfill(local_name);
        });
    });
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
                    for (var i = 0; i < results.length; ++i) {
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

function rename_file_promisified(cur_name,new_name){
    return new Promise(function(fulfill,reject){
        fs.readFile(__dirname + "/json/" + cur_name, 'utf8', function (err, data) {
            if (err) {
                console.log("Couldn't find " + cur_name + " to rename");
                fulfill(); //file doesn't exist, but that's okay
            }else{
                fs.writeFile(__dirname + "/json/" + new_name, data, 'utf8',function(err){
                    if(err) console.log("Couldn't rename " + cur_name + " to " + new_name);
                    else    console.log("Renamed " + cur_name + " to " + new_name);
                    fulfill(); //finished trying to rename file
                });
            }
        });
    });
}

//add in anything in db_sub that is not in db_main
function merge_databases(db_main, db_sub, server) {
    function get_unit_home_server(id) {
        if (id >= 10000 && id < 70000) {
            return 'jp';
        } else if (id < 800000 && id >= 700000) {
            return 'eu';
        } else if (id >= 800000 && id < 900000) {
            return 'gl';
        } else {
            // console.log("Unkown root for " + id);
            return 'unknown';
        }
    }
    function get_server_id(unit_id, server){
        var id = parseInt(unit_id);
        //add special case for overlapping IDs 
        if (get_unit_home_server(id) == 'eu' && server == 'gl') {
            id = "8" + id.toString();
            console.log("Changing " + unit + " to " + id);
        } else {
            id = id.toString();
        }
        return id;
    }
    var local_obj = JSON.parse(JSON.stringify(db_main)); //casting
    var previous_evos = [];
    for (var unit in db_sub) { //iterate through everything in object
        var id = get_server_id(unit, server);
        if (local_obj[unit] !== undefined) { //exists, so just add date add time
            if (local_obj[unit].server.indexOf(server) == -1) {
                local_obj[unit].server.push(server);
                // local_obj[unit]["db_add_time"].push(new Date().toUTCString());
            }
            //save evo mats
            if (local_obj[id].evo_mats === undefined && db_sub[unit].evo_mats !== undefined){
                var next_id = get_server_id(db_sub[unit].next, server);
                local_obj[id].evo_mats = db_sub[unit].evo_mats;
                local_obj[id].next = next_id.toString();
                previous_evos.push({
                    id: next_id,
                    prev: id.toString()
                });
                // local_obj[next_id].prev = id;
            }
        } else { //doesn't exist, so add it and date add time
            
            local_obj[id] = db_sub[unit];
            local_obj[id].server = [server];
            // local_obj[unit]["db_add_time"] = [new Date().toUTCString()];
        }
    }
    //add previous evo data once all units are added
    for(var i = 0; i < previous_evos.length; ++i){
        local_obj[previous_evos[i].id].prev = previous_evos[i].prev.toString();
    }
    return local_obj;
}

//adds a section in in the sub database to the main database
function add_field_to_db(db_main, db_sub, func){
    for(var unit in db_sub){
        try{
            func(db_main[unit], db_sub[unit], db_main, db_sub);
        }catch(err){
            continue;
        }
    }
}

//convert all IDs in recipes to names
function translate_recipes(items){
    for(var i in items){
        var curItem = items[i];
        if(curItem.recipe !== undefined){
            for(var m in curItem.recipe.materials){
                curItem.recipe.materials[m].name = items[curItem.recipe.materials[m].id].name;
                // console.log(curItem.recipe.materials[m].name);
            }
        }
    }
}

//create usage field for all items
function get_item_usage(items){
    //for every item
    for(var i in items){
        var curItem = items[i];
        curItem.usage = [];
        //for every other item with a recipe
        for(var j in items){
            if(items[j].recipe !== undefined && j !== i){
                //for every material in the other item
                for(var m in items[j].recipe.materials){
                    if(items[j].recipe.materials[m].id == curItem.id){
                        curItem.usage.push({
                            id: j,
                            name: items[j].name
                        });
                    }
                }
            }
        }
    }
}

function load_json_promisified(file, alternative_files){
    return new Promise(function(fulfill,reject){
        //try to load first file
        fs.readFile(__dirname + "/json/" + file, 'utf8', function (err, data) {
            if (err) {
                //try another file if possible
                if(alternative_files !== undefined &&  alternative_files.length > 0){
                    var new_file = alternative_files.pop();
                    console.log("Couldn't load " + file + ". Trying " + new_file);
                    load_json_promisified(new_file,alternative_files).then(fulfill).catch(reject);
                    return;
                }else{
                    reject("Error: cannot open " + file + " or its alternatives");
                    return;
                }
            }
            //return parsed data 
            var result;
            try{
                result = JSON.parse(data);
            }catch(parseError){
                //try another file if possible
                if (alternative_files !== undefined && alternative_files.length > 0) {
                    var new_file = alternative_files.pop();
                    console.log(parseError,"Couldn't load " + file + ". Trying " + new_file);
                    load_json_promisified(new_file, alternative_files).then(fulfill).catch(reject);
                    return;
                } else {
                    reject(`${parseError}` + "\nError: cannot open " + file + " or its alternatives");
                    return;
                }
            }
            if(file.indexOf("-old.json") > -1){
                // console.log(file.indexOf("-old.json"));
                rename_file_promisified(file,file.replace("-old.json",".json"))
                    .then(function(){
                        console.log("Successfully loaded old file. Renamed old file to current file");
                        fulfill(result);
                    }).catch(reject);
            }else{
                fulfill(result);
            }
        });
    });
}

//server: gl, jp, or eu
function single_server_db_load(server){
    return new Promise(function(fulfill,reject){
        var mini_db = {};
        //load files asynchronously
        var main_promise = load_json_promisified('info-' + server + '.json', ['info-' + server + '-old.json'])
            .then(function(result){
                mini_db.main = result;
            }).catch(reject);
        var sp_promise = load_json_promisified('feskills-' + server + '.json', ['feskills-' + server + '-old.json'])
            .then(function (result) {
                mini_db.sp = result;
            }).catch(reject);
        var evo_promise = load_json_promisified('evo_list-' + server + '.json', ['evo_list-' + server + '-old.json'])
            .then(function (result) {
                mini_db.evo = result;
            }).catch(reject);

        var es_promise = load_json_promisified('es-' + server + '.json', ['es-' + server + '-old.json'])
            .then(function (result) {
                mini_db.es = result;
            }).catch(reject);
        
        var item_promise = load_json_promisified('items-' + server + '.json', ['items-' + server + '-old.json'])
            .then(function (result) {
                mini_db.items = result;
            }).catch(reject);
        
        //process files once finished loading
        Promise.all([main_promise, sp_promise, evo_promise, es_promise, item_promise])
            .then(function(results){ //finished loading JSON files
                console.log("Successfully opened files for " + server, "\nProceeding to load them now.");
                //merge into one database object
                add_field_to_db(mini_db.main,mini_db.evo,function(unit1,unit2, db_main, db_sub){
                    unit1.evo_mats = unit2.mats;
                    unit1.next = unit2.evo.id;
                    db_main[unit1.next].prev = unit1.id;
                });

                add_field_to_db(mini_db.main,mini_db.sp, function(unit1,unit2){
                    unit1.skills = unit2.skills;
                });

                var present_IDs = get_es_ids(mini_db.main);
                // console.log(present_IDs);
                for(let e in mini_db.es){
                    // console.log(e);
                    //remove ES already in in main unit DB
                    if(_.sortedIndexOf(present_IDs,parseInt(e)) > -1){
                        delete mini_db.es[e];
                        // console.log("Removing ES",e);
                    }
                }

                //return merged databases
                fulfill({
                    unit: mini_db.main,
                    item: mini_db.items,
                    es: mini_db.es
                });
            }).catch(reject);
    });
}

//make sure all known evo mats are in English
function translate_evo_mats(unit_db, item_db){
    //for every unit with an evolution
    for(var unit in unit_db){
        var curUnit = unit_db[unit];
        if(curUnit.evo_mats !== undefined){
            //for every evo mat
            for(var m = 0; m < curUnit.evo_mats.length; ++m){
                var curMat = curUnit.evo_mats[m];
                //use names currently available in database
                if(curMat.type === "unit" && unit_db[curMat.id] !== undefined){
                    unit_db[unit].evo_mats[m].name = unit_db[curMat.id].name;
                }else if(curMat.type === "item" && item_db[curMat.id] !== undefined){
                    unit_db[unit].evo_mats[m].name = item_db[curMat.id].name;
                }
            }
        }
    }
}

//load database from a file or files
function load_database(master){
    return new Promise(function(fulfill,reject){
        master.unit = {};
        master.item = {};
        master.es = {};

        console.log("Loading individual databases");
        var global = single_server_db_load('gl').catch(reject);
        var japan = single_server_db_load('jp').catch(reject);
        var europe = single_server_db_load('eu').catch(reject);

        //wait for databases to finish loading
        Promise.all([global, japan, europe])
            .then(function(results){
                console.log("Merging unit databases");
                master.unit = merge_databases(master.unit, results[0].unit, 'gl');
                master.unit = merge_databases(master.unit, results[2].unit, 'eu');
                master.unit = merge_databases(master.unit, results[1].unit, 'jp');

                console.log("Merging item databases...");
                master.item = merge_databases(master.item, results[0].item, 'gl');
                master.item = merge_databases(master.item, results[2].item, 'eu');
                master.item = merge_databases(master.item, results[1].item, 'jp');

                console.log("Merging ES databases...");
                master.es = merge_databases(master.es, results[0].es, 'gl');
                master.es = merge_databases(master.es, results[2].es, 'eu');
                master.es = merge_databases(master.es, results[1].es, 'jp');

                translate_recipes(master.item);
                get_item_usage(master.item);
                translate_evo_mats(master.unit, master.item);
                console.log("Finished loading databases");
            })
            .then(function(){
                update_statistics();
                fulfill(); //finished loading and updating
            })
            .catch(reject);
    });
}

//return everything that's in db_new and not in db_old
function get_db_diffs(db_old, db_new){
    var diffs = [];
    for(var elem in db_new){
        if(db_old.indexOf(db_new[elem]) == -1){
            diffs.push(db_new[elem]);
        }
    }
    return diffs;
}

//update statistics for all servers
function update_statistics(){
    function get_ids_from_server(server, db) {
        var result = [];
        for (let i in db) {
            if (db[i].server.indexOf(server) > -1) {
                result.push(i); //i is ID of current object
            }
        }
        return result;
    }
    function update_statistics_per_server(server) {
        //holds local file load/save functions
        var updater = {
            load: function (file, alternative_files) {
                try {
                    return JSON.parse(fs.readFileSync(__dirname + "/json/" + file, 'utf8'));
                } catch (err) {//error, try alternative files
                    if (alternative_files !== undefined && alternative_files.length > 0) {
                        var new_file = alternative_files.pop();
                        return updater.load(new_file, alternative_files);
                    } else {//return an error if none of the files work
                        return JSON.parse(fs.readFileSync(__dirname + "/json/" + file, 'utf8'));
                    }
                }
            },
            save: function (file, data) {
                fs.writeFile(__dirname + "/json/" + file, data, function (err) {
                    if (err) {
                        console.log(err);
                    }
                    console.log("Saved " + file);
                    return;
                });
            }
        };

        console.log("Updating " + server.toUpperCase() + " statistics...");
        //gather basic statistics
        var unit_id = get_ids_from_server(server,master_list.unit);
        var item_id = get_ids_from_server(server,master_list.item);
        var es_id = get_ids_from_server(server, master_list.es);
        console.log(server,"current unit count", unit_id.length,"/ current item count", item_id.length, '/ current es count', es_id.length);
        stats[server].num_units = unit_id.length;
        stats[server].num_items = item_id.length;
        stats[server].num_es = es_id.length;

        //load previous data, if it exists
        var unit_data;
        try {
            unit_data = updater.load('stats-unit-' + server + ".json");

            //save differences, if any
            if (unit_data.last_loaded.length !== stats[server].num_units || unit_data.last_loaded[0] !== unit_id[0]) {
                if (unit_data.last_loaded.length !== stats[server].num_units) console.log(server,"unit last length", unit_data.last_loaded.length, "/ unit current length", stats[server].num_units);
                else if (unit_data.last_loaded[0] !== unit_id[0]) console.log(server, "unit last loaded[0]", unit_data.last_loaded[0], "/ unit current loaded[0]", unit_id[0]);
                unit_data.newest = get_db_diffs(unit_data.last_loaded, unit_id);
                unit_data.last_loaded = unit_id;
                updater.save('stats-unit-' + server + '.json', JSON.stringify(unit_data));
            }
        } catch (err) { //file doesn't exist
            console.log("Creating new unit stats file for",server);
            unit_data = {
                newest: unit_id,
                last_loaded: unit_id
            };
            updater.save('stats-unit-' + server + '.json', JSON.stringify(unit_data));
        }

        //load previous data, if it exists
        var item_data;
        try {
            item_data = updater.load('stats-item-' + server + ".json");

            //save differences, if any
            if (item_data.last_loaded.length !== stats[server].num_items || item_data.last_loaded[0] !== item_id[0]) {
                if (item_data.last_loaded.length !== stats[server].num_items) console.log(server,"item last length", item_data.last_loaded.length, "/ item cur length", stats[server].num_items);
                else if (item_data.last_loaded[0] !== item_id[0]) console.log(server,"item last loaded[0]", item_data.last_loaded[0], "/ item current loaded[0]", item_id[0]);
                item_data.newest = get_db_diffs(item_data.last_loaded, item_id);
                item_data.last_loaded = item_id;
                updater.save('stats-item-' + server + '.json', JSON.stringify(item_data));
            }
        } catch (err) { //file doesn't exist
            console.log("Creating new item stats file for", server);
            item_data = {
                newest: item_id,
                last_loaded: item_id
            };
            updater.save('stats-item-' + server + '.json', JSON.stringify(item_data));
        }

        var es_data;
        try {
            es_data = updater.load('stats-es-' + server + ".json");

            //save differences, if any
            if (es_data.last_loaded.length !== stats[server].num_es || es_data.last_loaded[0] !== es_id[0]) {
                if (es_data.last_loaded.length !== stats[server].num_es) console.log(server, "es last length", es_data.last_loaded.length, "/ es cur length", stats[server].num_ess);
                else if (es_data.last_loaded[0] !== es_id[0]) console.log(server, "es last loaded[0]", es_data.last_loaded[0], "/ es current loaded[0]", es_id[0]);
                es_data.newest = get_db_diffs(es_data.last_loaded, es_id);
                es_data.last_loaded = es_id;
                updater.save('stats-es-' + server + '.json', JSON.stringify(es_data));
            }
        } catch (err) { //file doesn't exist
            console.log("Creating new es stats file for", server);
            es_data = {
                newest: es_id,
                last_loaded: es_id
            };
            updater.save('stats-es-' + server + '.json', JSON.stringify(es_data));
        }

        //keep track of newest on server
        stats[server].newest_units = unit_data.newest;
        stats[server].newest_items = item_data.newest;
        stats[server].newest_es = es_data.newest;
    }

    console.log("Updating statistics...");
    var servers = ['gl','jp','eu'];
    stats.last_update = new Date().toUTCString();
    for(var i = 0; i < servers.length; ++i){
        update_statistics_per_server(servers[i]);
    }
    console.log("Finished updating statistics");
}

//reload database from remote
function reload_database(){
    return new Promise(function(fulfill,reject){
        console.log("Preparing to reload database...");

        console.log("Saving old files");
        var db_type = ['info','feskills','items','evo_list','es'];
        var servers = ['gl','jp','eu'];

        var promises = [];
        //rename old files
        for(var d = 0; d < db_type.length; ++d){
            for(var s = 0; s < servers.length; ++s){
                var filePrefix = db_type[d] + '-' + servers[s];
                var p = rename_file_promisified(filePrefix + ".json", filePrefix + "-old.json");
                promises.push(p);
            }
        }

        Promise.all(promises)
            .then(function(result){ //finished renaming files
                //download files from remote servers and load database when finished
                console.log("Downloading new files...");
                var main_url = 'https://raw.githubusercontent.com/Deathmax/bravefrontier_data/master/';
                var requests = [];
                var info_requests = [];
                // var sp_requests = [];
                var other_requests = [];
                var completed = 0;
                //generate URLs to download from
                for(var d = 0; d < db_type.length; ++d){
                    for(var s = 0; s < servers.length; ++s){
                        var url = main_url;
                        if(servers[s] !== "gl") url += servers[s] + "/";
                        url += db_type[d] + ".json";
                        var fileName = db_type[d] + "-" + servers[s] + ".json";
                        if(db_type[d] === 'info'){
                            info_requests.push({ url: url, fileName: fileName });
                        }else{
                            other_requests.push({ url: url, fileName: fileName });
                        }
                    }
                }

                var total_requests = info_requests.length + other_requests.length;
                //DL info files one at a time
                requests.push(do_n_at_a_time(info_requests,1,function(dl_request){
                    var url = dl_request.url;
                    var fileName = dl_request.fileName;
                    return json_download_promisified(url, fileName)
                        .then(function (name) {
                            console.log("Downloaded " + name + " (" + (++completed) + "/" + total_requests + ")");
                        });
                }));
                //DL other files 5 at a time
                requests.push(do_n_at_a_time(other_requests, 5, function (dl_request) {
                    var url = dl_request.url;
                    var fileName = dl_request.fileName;
                    return json_download_promisified(url, fileName)
                        .then(function (name) {
                            console.log("Downloaded " + name + " (" + (++completed) + "/" + total_requests + ")");
                        });
                }));
                return Promise.all(requests);
            })
            .then(function(results){ //finished downloading files
                return load_database(master_list);
            })
            .then(function(){
                fulfill(); //done redownloading and reloading everything
            })
            .catch(reject);
    });
}

app.get('/', function(request, response){
    response.end("<h1>Hello World</h1>");
});

//show the statistics of the server
app.get('/status', function(request,response){
    response.end(JSON.stringify(stats));
});

app.get('/reload', function(request,response){
    reload_database().then(function(){
        if (!argv.notranslate) {
            var translations = [translate_jp_units(), translate_jp_items(), translate_jp_es()];
            Promise.all(translations)
                .then(function (result) {
                    send_updates().then(function (results) {
                        console.log("Sent update hooks");
                    });
                    console.log("Finished reloading database");
                });
        }
        response.end(JSON.stringify(stats));
    });
});

app.get('/unit/:id', function(request, response){
    var unit = master_list.unit[request.params.id];
    if(unit === undefined)  
        response.end(JSON.stringify({error: request.params.id + " is not found"}));
    else
        response.end(JSON.stringify(unit));
});

app.get('/item/:id', function(request,response){
    var item = master_list.item[request.params.id];
    if (item === undefined)
        response.end(JSON.stringify({ error: request.params.id + " is not found" }));
    else
        response.end(JSON.stringify(item));
});

app.get('/es/:id', function(request,response){
    var es = master_list.es[request.params.id];
    if (es === undefined)
        response.end(JSON.stringify({ error: request.params.id + " is not found" }));
    else
        response.end(JSON.stringify(es));
});

function safe_json_get(json_obj, fields_arr, default_return){
    var curValue = json_obj;
    // console.log(fields_arr);
    try{
        for(var f in fields_arr){
            curValue = curValue[fields_arr[f]];
        }
        // console.log(curValue);
        return JSON.stringify(curValue).toLowerCase();
    }catch(err){
        // console.log(err);
        return (default_return !== undefined) ? default_return : "";
    }
}

//get the corresponding unit value of a given query
function get_unit_query_value(queryField, unit){
    try{
        switch(queryField){
            case 'unit_name_id': 
                    return unit["guide_id"] + ": " + unit["name"].toLowerCase() + (unit.translated_name ? (" " + unit.translated_name.toLowerCase()) : "") + " (" + unit["id"]+")";
            case 'rarity': return unit["rarity"].toString();
            case 'element': return unit["element"].toLowerCase();
            case 'gender': return unit["gender"].toLowerCase();
            case 'move_speed': return unit["movement"]["skill"]["move speed type"].toLowerCase();
            case 'ls_name': return (unit["leader skill"]["name"] + " - " + unit["leader skill"]["desc"]).toLowerCase();
            case 'ls_effect': return JSON.stringify(unit["leader skill"]["effects"]);
            case 'bb_name': return (unit["bb"]["name"] + " - " + unit["bb"]["desc"]).toLowerCase();
            case 'bb_effect': return JSON.stringify(unit["bb"]["levels"][9]["effects"]);
            case 'sbb_name': return (unit["sbb"]["name"] + " - " + unit["sbb"]["desc"]).toLowerCase();
            case 'sbb_effect': return JSON.stringify(unit["sbb"]["levels"][9]["effects"]);
            case 'ubb_name': return (unit["ubb"]["name"] + " - " + unit["ubb"]["desc"]).toLowerCase();
            case 'ubb_effect': return JSON.stringify(unit["ubb"]["levels"][0]["effects"]);
            case 'es_name': return (unit["extra skill"]["name"] + " - " + unit["extra skill"]["desc"]).toLowerCase();
            case 'es_effect': return JSON.stringify(unit["extra skill"]["effects"]);
            case 'sp_name':
                var result = "";
                for(sp in unit["skills"]){
                    result += unit["skills"][sp]["skill"]["desc"] + "\n";
                }
                return result;
            case 'sp_effect':
                var result = "";
                for (sp in unit["skills"]) {
                    result += JSON.stringify(unit["skills"][sp]["skill"]["effects"]) + "\n";
                }
                return result;
            case 'evo_mats': return JSON.stringify(unit["evo_mats"]);
            case 'server': return unit["server"];
            case 'all_desc': var msg = safe_json_get(unit, ["leader skill", "name"]) + " " + safe_json_get(unit, ["leader skill", "desc"]) + " ";
                msg += safe_json_get(unit, ["extra skill", "name"]) + " " + safe_json_get(unit, ["extra skill", "desc"]) +" ";
                msg += safe_json_get(unit, ["bb", "name"]) + " " + safe_json_get(unit, ["bb", "desc"]) + " ";
                msg += safe_json_get(unit, ["sbb", "name"]) + " " + safe_json_get(unit, ["sbb", "desc"]) + " ";
                msg += safe_json_get(unit, ["ubb", "name"]) + " " + safe_json_get(unit, ["ubb", "desc"]) + " ";
                if (unit["skills"] !== undefined) {
                    for (sp in unit["skills"]) {
                        try{
                            msg += unit["skills"][sp]["skill"]["desc"] + " ";
                        }catch(err){
                            continue;
                        }
                    }
                }
                // console.log(msg);
                return msg;
            case 'all_effect': var msg = safe_json_get(unit, ["leader skill", "effects"]) + " ";
                msg += safe_json_get(unit, ["extra skill", "effects"]) + " ";
                msg += safe_json_get(unit, ["bb", "levels", 9, "effects"]) + " " + safe_json_get(unit, ["sbb", "levels", 9, "effects"]) + " " + safe_json_get(unit, ["ubb", "levels", 0, "effects"]);
                if (unit["skills"] !== undefined) {
                    for (sp in unit["skills"]) {
                        try{
                            msg += JSON.stringify(unit["skills"][sp]["skill"]["effects"]) + "\n";
                        }catch(err){
                            continue;
                        }
                    }
                }
                // console.log(msg);
                return msg;
            default: return "";
        }
    }catch(err){
        // console.log(err);
        return "";
    }
}

//returns true if all non-empty query values are in the given unit
function contains_unit_query(query, unit){
    var ignored_fields = ['strict','translate','verbose'];
    for(var q in query){
        var curQuery = query[q].toLowerCase();
        //wildcard queries
        if (curQuery.length === 0 || (q == 'element' && curQuery == 'any') ||
            (q == 'gender' && curQuery == 'any') ||
            (q == 'server' && curQuery == 'any') || ignored_fields.indexOf(q) > -1) {
            continue;
        }

        try{
            var unitValue = get_unit_query_value(q, unit).toString();
            if(unitValue.indexOf(curQuery) == -1){
                // if(query.verbose == true || query.verbose == 'true') console.log("Failed on",unit.id,q,curQuery);
                return false; //stop if any part of query is not in unit
            }
        }catch(err){ //only occurs if requested field is empty in unit
            return false;
        }
    }
    return true;
}

app.get('/search/unit', function (request, response) {
    response.sendFile(__dirname + "/json/" + "search_unit.html");
});

function get_highest_rarity(category){
    var final_id = (category + 1).toString();
    for(var i = 8; i >= 0; --i){
        var str = (category + i).toString();
        if(master_list.unit[str] != undefined){
            final_id = str;
            break;
        }
    }
    return parseInt(final_id);
}

//get the list of units linked together by evolution given a single unit
function get_evo_line(unit_id){
    var evo = [];
    var curUnit = master_list.unit[unit_id];
    //go to lowest rarity unit
    while(curUnit.prev !== undefined){
        curUnit = master_list.unit[curUnit.prev];
    }

    //traverse to highest rarity unit
    evo.push(curUnit.id);
    while(curUnit.next !== undefined){
        evo.push(curUnit.next);
        curUnit = master_list.unit[curUnit.next];
    }

    return evo;
}

//shorten results to a single unit IFF only one type of unit exists in the list
//assumption: result_arr has at least one element in it
function shorten_results(result_arr, verbose){
    var last_evo = get_evo_line(result_arr[0]);
    var last_guide_id = master_list.unit[last_evo[0].toString()].guide_id;
    if(verbose) console.log("last_evo", last_evo, "last_guide", last_guide_id);
    //check for uniqueness, return original array if not unique
    for(var u = 1; u < result_arr.length; ++u){
        var cur_evo = get_evo_line(result_arr[u]);
        var cur_guide_id = master_list.unit[cur_evo[0].toString()].guide_id;
        if(verbose) console.log("cur_evo",u, cur_evo, "cur_guide", cur_guide_id);
        if(cur_evo.length !== last_evo.length || cur_evo[0] !== last_evo[0] || cur_guide_id !== last_guide_id){
            if(verbose) console.log("found first mismatch");
            return result_arr;
        }
    }

    //if this point is reached, then only one type of unit exists in the list
    //return last unit in list as it's the highest rarity one
    return [last_evo.pop()];
}

//shorten results to a single unit IFF only one type of unit exists in the list
function shorten_results_old(result_arr) {
    // console.log("before shorten: " + JSON.stringify(result_arr));
    var unique = [];
    for (r in result_arr) {
        var cur_id = result_arr[r];
        var category = cur_id - (cur_id % 10);
        if (unique.indexOf(category) == -1) {
            unique.push(category);
        }
    }

    // console.log(unique);
    if (unique.length == 1) {
        var result = result_arr[result_arr.length - 1]; //result is at the end of the list in special case

        //check for special cases where ID rule doesn't apply due to shared IDs between
        //two or more units
        var special_case_arr = [860124,860125,750156];
        var special_case = false;
        for(c in special_case_arr){
            if(result_arr.indexOf(special_case_arr[c]) > -1){
                special_case = true;
            }
        }

        //clear result array
        while (result_arr.length != 0) {
            result_arr.pop();
        }

        //push final result
        if(!special_case)
            result_arr.push(get_highest_rarity(unique[0]));
        else
            result_arr.push(result);
    }
    // console.log("after shorten: " + JSON.stringify(result_arr));
}

//given a series of search options, list units with those qualities
app.get('/search/unit/options', function(request,response){
    var query = request.query;
    if (query.verbose == true || query.verbose == 'true'){
        console.log("Query",query);
    }

    var results = [];
    for(u in master_list["unit"]){
        var unit = master_list["unit"][u];
        if(contains_unit_query(query, unit)){
            // console.log("Found " + u);
            results.push(u);
        }
    }
    //if not using strict mode, try to shorten list
    var notStrict = (query["strict"] == false || query["strict"] == 'false');
    var noRarity = (query["rarity"] == undefined || query["rarity"] == "*" || query["rarity"].length == 0);
    var notGuide = (query["unit_name_id"] == undefined || (!isNaN(query["unit_name_id"]) && parseInt(query["unit_name_id"]) >= 10011) || (isNaN(query["unit_name_id"]) && query["unit_name_id"].indexOf(":") == -1));
    if (notStrict && noRarity && notGuide && results.length > 0) {
        if(query.verbose == true || query.verbose == 'true'){
            console.log("Results before shorten",results);
        }
        results = shorten_results(results, query.verbose == true || query.verbose == 'true');
    }
    if (query.verbose == true || query.verbose == 'true') console.log("Search results",results);
    response.end(JSON.stringify(results));
});

function get_item_query_value(queryField, item){
    try {
        switch (queryField) {
            case 'item_name_id': 
                return item["name"].toLowerCase() + + (item.translated_name ? (" " + item.translated_name.toLowerCase()) : "") + `(${item["id"]})`;
            case 'item_desc': return item["desc"].toLowerCase();
            case 'rarity': return item["rarity"].toString();
            case 'type': return item["type"].toLowerCase();
            case 'effect': return JSON.stringify(item["effect"]);
            case 'sphere_type': return item["sphere type text"].toLowerCase();
            case 'recipe': return JSON.stringify(item["recipe"]);
            case 'server': return JSON.stringify(item["server"]);
            default: return "";
        }
    } catch (err) {
        // console.log(err);
        return "";
    }
}

//returns true if all non-empty query values are in the given item
function contains_item_query(query, item){
    var ignored_fields = ['strict', 'translate', 'verbose'];
    for (var q in query) {
        var curQuery = query[q].toLowerCase();
        //wildcard queries
        if (curQuery == '' || (q == 'type' && curQuery == 'any') ||
            (q == 'sphere_type' && curQuery == 'any') || 
            (q == 'server' && curQuery == 'any') || ignored_fields.indexOf(q) > -1){
            continue;
        }

        try{
            var itemValue = get_item_query_value(q, item).toString();
            if (itemValue.indexOf(curQuery) == -1) {
                return false; //stop if any part of query is not in item
            }
        } catch (err) { //only occurs if requested field is empty in item
            return false;
        }
    }
    return true;
}

app.get('/search/item', function (request, response) {
    response.sendFile(__dirname + "/" + "search_item.html");
});

//given a series of search options, list items with those qualities
app.get('/search/item/options', function (request, response) {
    var query = request.query;
    if (query.verbose == true || query.verbose == 'true')
        console.log("Query", query);
    // console.log(query);
    var results = [];
    for (i in master_list["item"]) {
        var item = master_list["item"][i];
        if (contains_item_query(query, item))
            results.push(item["id"]);
    }
    if (query.verbose == true || query.verbose == 'true') 
        console.log("Search results", results);
    response.end(JSON.stringify(results));
});


function get_es_query_value(queryField, es) {
    try {
        switch (queryField) {
            case 'es_name_id':
                return es["name"].toLowerCase() + + (es.translated_name ? (" " + es.translated_name.toLowerCase()) : "") + `(${es["id"]})`;
            case 'es_desc': return es["desc"].toLowerCase();
            case 'effects': return JSON.stringify(es["effects"]);
            case 'server': return JSON.stringify(es["server"]);
            default: return "";
        }
    } catch (err) {
        // console.log(err);
        return "";
    }
}

//returns true if all non-empty query values are in the given ES
function contains_es_query(query, es) {
    var ignored_fields = ['strict', 'translate', 'verbose'];
    for (var q in query) {
        var curQuery = query[q].toLowerCase();
        //wildcard queries
        if (curQuery == '' || (q == 'type' && curQuery == 'any') ||
            (q == 'sphere_type' && curQuery == 'any') ||
            (q == 'server' && curQuery == 'any') || ignored_fields.indexOf(q) > -1) {
            continue;
        }

        try {
            var esValue = get_es_query_value(q, es).toString();
            if (esValue.indexOf(curQuery) == -1) {
                return false; //stop if any part of query is not in es
            }
        } catch (err) { //only occurs if requested field is empty in es
            return false;
        }
    }
    return true;
}

app.get('/search/es/options',function(request,response){
    var query = request.query;
    if (query.verbose == true || query.verbose == 'true')
        console.log("Query", query);
    var results = [];
    for(let e in master_list.es){
        var es = master_list.es[e];
        if(contains_es_query(query,es))
            results.push(es["id"]);
    }
    if (query.verbose == true || query.verbose == 'true')
        console.log("Search results", results);
    response.end(JSON.stringify(results));
});

//arr - array where each index has 2 fields: id (search attribute) and name
//start/end - start and end values to filter from arr
//comparatorFn - function used to filter (optional)
function get_list(arr,start,end,comparatorFn){
    function default_comparator(d){
        let id = parseInt(d.id);
        if (start !== -1 && end !== -1) {
            return id >= start && id <= end;
        } else if (end !== -1) {
            return id <= end;
        } else if (start !== -1) {
            return id >= start;
        } else {
            return true; //get everything, since both are -1
        }
    }

    try {
        let comparator = comparatorFn || default_comparator;
        var list = arr.filter(comparator);

        //convert array to array of names
        list = list.map(function (d) {
            return d.name;
        });

        return list;
    } catch (err) {
        throw err;
    }
}

app.get('/list/items', function(request,response){
    var query = request.query;

    query.verbose = query.verbose == true || query.verbose == 'true';

    if(query.verbose)
        console.log(query);

    var list = [];

    for(let i in master_list.item){
        var name = master_list.item[i].translated_name || master_list.item[i].name;
        list.push({
            id: parseInt(master_list.item[i].id),
            name: `${name} (${master_list.item[i].id})`
        });
    }

    try{
        var start = (query.start) ? parseInt(query.start) : -1;
        var end = (query.end) ? parseInt(query.end) : -1;

        if (query.verbose)
            console.log("start:", start, "end:", end);

        var result = get_list(list,start,end);

        response.end(JSON.stringify(result));
    }catch(err){
        console.log(err);
        response.end(JSON.stringify([err]));
    }
});

app.get('/list/es', function(request,response){
    var query = request.query;

    query.verbose = query.verbose == true || query.verbose == 'true';

    if (query.verbose)
        console.log(query);

    var list = [];

    for (let i in master_list.es) {
        var name = master_list.es[i].translated_name || master_list.es[i].name;
        list.push({
            id: parseInt(master_list.es[i].id),
            name: `${name} (${master_list.es[i].id})`
        });
    }

    try {
        var start = (query.start) ? parseInt(query.start) : -1;
        var end = (query.end) ? parseInt(query.end) : -1;

        if(query.verbose)
            console.log("start:",start,"end:",end);

        var result = get_list(list, start, end);

        response.end(JSON.stringify(result));
    } catch (err) {
        console.log(err);
        response.end(JSON.stringify([err]));
    }
});

//given a start and end range, list unit names in that range
app.get('/list/units', function(request,response){
    var query = request.query;
    // console.log(query);
    /*//expected format for query
        query = {
            type: "unit_id" || "guide_id",
            start: "-1" || null (defaults to -1 to start from the very beginning),
            end: "-1" || some number || null (defaults to -1 to print all values); only for range,
            verbose: true || false || 'true' || 'false'
        }
    */

    if (query.verbose)
        console.log(query);
    
    var list = [];
    for (let u in master_list.unit) {
        var name = master_list.unit[u].translated_name || master_list.unit[u].name;
        list.push({
            id: parseInt(master_list.unit[u].id),
            guide_id: parseInt(master_list.unit[u].guide_id),
            name: `${master_list.unit[u].guide_id}: ${name} (${master_list.unit[u].id})`
        });
    }

    try{
        var start = (query.start) ? parseInt(query.start) : -1;
        var end = (query.end) ? parseInt(query.end) : -1;
        var result;
        if (query.verbose)
            console.log("start:", start, "end:", end);

        if(query.type == "unit_id"){
            result = get_list(list, start, end);

        }else if(query.type == "guide_id"){
            list.sort(function(a,b){
                return a.guide_id - b.guide_id;
            });

            if (query.verbose)
                console.log("start:", start, "end:", end);

            //custom function due to guide_id
            result = get_list(list, start, end,function (d) {
                let id = parseInt(d.guide_id);
                if (start !== -1 && end !== -1) {
                    return id >= start && id <= end;
                } else if (start === -1) {
                    return id <= end;
                } else if (end === -1) {
                    return id >= start;
                } else {
                    return true; //get everything, since both are -1
                }
            }); 
        }else{
            throw "Query Type " + query.type + " is not valid"; 
        }

        response.end(JSON.stringify(result));
    }catch(err){
        console.log(err);
        response.end(JSON.stringify(err)); //return an empty array
    }
});

function translate_to_english(msg, fields, endField) {
    return translate(msg, { from: 'ja', to: 'en' })
        .then(function (result) {
            var result_text = "";
            //clean up result, if necessary
            if (result.text.indexOf("null") == result.text.length - 4) {
                result_text = result.text.replace("null", "");
            } else {
                result_text = result.text;
            }
            return {
                translation: result_text + "*",
                fields: fields.concat(endField)
            };
        }).catch(err => {
            console.error(err);
        });
}

//given a unit, return a promise that contains the translated unit object (name only)
function translate_unit_name(unit) {
    //recursively translate all fields
    function translate_unit_recursive(object, levels) {
        var promises = [];
        var translatable_fields = ["desc", "name", "dependency comment"];

        //get to desired position
        var curObject = object;
        for (var f in levels) {
            curObject = curObject[levels[f]];
        }

        var local_levels = levels.slice();
        //check each field
        for (var field in curObject) {
            local_levels.push(field);
            var curField = curObject[field];

            if (Array.isArray(curField) || (typeof curField == "object")) {
                //recursively translate all sub fields
                promises = promises.concat(translate_unit_recursive(object, local_levels));
            } else if (translatable_fields.indexOf(field) > -1 && (typeof curField == "string") && curField.length > 0) {
                //translate current field
                var curPromise = translate_to_english(curField, local_levels, field)
                promises.push(curPromise);
            }
            local_levels.pop();
        }
        return promises;
    }

    function translate_unit_name_helper(unit){
        return (translate_to_english(unit.name,[],"translated_name"));
    }

    //merge the data of the sub_object into the fields of the main_object
    function merge_field(main_object, sub_object) {
        var cur_position = main_object;
        var f = 0;
        for (f = 0; f < sub_object.fields.length - 1; ++f) {
            cur_position = cur_position[sub_object.fields[f]];
        }

        cur_position[sub_object.fields[f]] = sub_object.translation;
        // cur_position[sub_object.fields[f] + "_translated"] = sub_object.translation;
    }

    //make a copy of the unit
    var new_unit = JSON.parse(JSON.stringify(unit));
    // var promises = translate_unit_recursive(new_unit, []);
    var promises = [translate_unit_name_helper(new_unit)];
    return Promise.all(promises)
        .then(function (translated_objects) {
            for (var r in translated_objects) {
                merge_field(new_unit, translated_objects[r]);
            }
            // console.log(new_unit);
            return new_unit;
        });
}

function isJapaneseText(name) {
    return name.search(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) > -1;
}

function translate_jp_es() {
    return new Promise(function (fulfill, reject) {
        var es_to_translate = [];
        var count_finished = 0;
        for (var i in master_list.es) {
            var curES = master_list.es[i];
            if (isJapaneseText(curES.name)) {
                es_to_translate.push(curES);
            }
        }
        console.log("Translating " + es_to_translate.length + " ES");
        // Promise.all(promises)
        do_n_at_a_time(es_to_translate, 10, function (es) {
            return translate_unit_name(es)
                .then(function (translated_es) {
                    console.log("Translated es " + translated_es.id + " (" + (++count_finished) + "/" + es_to_translate.length + ")");
                    return translated_es;
                })
        }).then(function (results) {
            //put translated ES into master list
            console.log("Putting translated JP ES into list now.");
            // console.log(results);
            for (var r in results) {
                var curES = results[r];
                master_list.es[curES.id] = curES;
            }
        })
            .then(function () {
                console.log("Finished translating JP ES.");
                fulfill();
            }).catch(reject);
    });
}

function translate_jp_items(){
    return new Promise(function(fulfill,reject){
        // console.log("Translating items");
        // var promises = [];
        var items_to_translate = [];
        var count_finished = 0;
        for(var i in master_list.item){
            var curItem = master_list.item[i];
            if(isJapaneseText(curItem.name)){
                items_to_translate.push(curItem);
            }
        }
        console.log("Translating " + items_to_translate.length + " items");
        // Promise.all(promises)
        do_n_at_a_time(items_to_translate,10,function(item){
            return translate_unit_name(item)
                .then(function (translated_item) {
                    console.log("Translated item " + translated_item.id + " (" + (++count_finished) + "/" + items_to_translate.length + ")");
                    return translated_item;
                })
        }).then(function(results){
                //put translated items into master list
                console.log("Putting translated JP items into list now.");
                // console.log(results);
                for(var r in results){
                    var curItem = results[r];
                    master_list.item[curItem.id] = curItem;
                }
            })
            .then(function(){
                console.log("Finished translating JP items.");
                fulfill();
            }).catch(reject);
    });
}

function translate_jp_units(){
    return new Promise(function(fulfill,reject){
        // console.log("Translating units");
        var units_to_translate = [];
        var count_finished = 0;
        for(var u in master_list.unit){
            var curUnit = master_list.unit[u];
            if(isJapaneseText(curUnit.name)){
                units_to_translate.push(curUnit);
            }
        }  
        console.log("Translating " + units_to_translate.length + " units");

        // Promise.all(promises)
        do_n_at_a_time(units_to_translate,10,function(unit){
            return translate_unit_name(unit)
                .then(function (translated_unit) {
                    console.log("Translated unit " + translated_unit.id + " (" + (++count_finished) + "/" + units_to_translate.length + ")");
                    return translated_unit;
                });
        }).then(function(results){
                //put translated units into master list
                console.log("Putting translated JP units into list now.");
                for(var r in results){
                    var curUnit = results[r];
                    master_list.unit[curUnit.id] = curUnit;
                }
            })
            .then(function(){
                console.log("Finished translating JP units");
                fulfill();
            }).catch(reject);
    });
}

var server = app.listen(argv["port"], argv["ip"], function(){
    if(argv["reload"]){
        reload_database()
            .then(function(){
                var host = server.address().address;
                var port = server.address().port;
                if (!argv.notranslate){
                    var translations = [translate_jp_units(), translate_jp_items(), translate_jp_es()];
                    Promise.all(translations)
                        .then(function(result){
                            send_updates().then(function (results) {
                                console.log("Sent update hooks");
                            });
                            console.log("Finished reloading database");
                            console.log("Ready! Server listening at http://%s:%s", host, port);
                        });
                }else{
                    send_updates().then(function (results) {
                        console.log("Sent update hooks");
                    });
                    console.log("Finished reloading database");
                    console.log("Ready! Server listening at http://%s:%s", host, port);
                }
        });
    }else{
        var host = server.address().address;
        var port = server.address().port;
        load_database(master_list)
            .then(function(){
                if (!argv.notranslate) {
                    var translations = [translate_jp_units(), translate_jp_items(), translate_jp_es()];
                    return Promise.all(translations)
                        .then(function (result) {
                            console.log("Ready! Server listening at http://%s:%s", host, port);
                        });
                } else {
                    console.log("Ready! Server listening at http://%s:%s", host, port);
                    return;
                }
            })
            .catch(function(err){
                console.log(err);
                console.log("Exiting...");
                process.exit();
            })
            .then(function(){
                if(argv.test_function)
                    test_function();
            });
    }
});

function wiki_move_helper(unit){
    // console.log(unit);
    console.log("Processing " + unit.id);
    var result = "", temp = "";
    result += "ID: " + unit.id + "\n";
    try{
        try{
            temp = "|animation_attack  = " + unit.animations.attack['total number of frames']  + "\n";
            temp += "|animation_idle    = " + unit.animations.idle['total number of frames'] + "\n";
            temp += "|animation_move    = " + unit.animations.move['total number of frames'] + "\n";
            result += temp;
        }catch(err){
            console.log(err);
            result += "|animation_attack  = " + "Error: field doesn't exist" + "\n";
            result += "|animation_idle    = " + "Error: field doesn't exist" + "\n";
            result += "|animation_move    = " + "Error: field doesn't exist" + "\n";
        }

        try{
            temp = "|movespeed_attack  = " + unit.movement.attack['move speed'] + "\n";
            temp += "|movespeed_skill   = " + unit.movement.skill['move speed'] + "\n";
            result += temp;
        }catch(err){
            console.log(err);
            result += "|movespeed_attack  = " + "Error: field doesn't exist" + "\n";
            result += "|movespeed_skill   = " + "Error: field doesn't exist" + "\n";
        }

        try{
            temp = "|speedtype_attack  = " + unit.movement.attack['move speed type'] + "\n";
            temp += "|speedtype_skill   = " + unit.movement.skill['move speed type'] + "\n";
            result += temp;
        }catch(err){
            console.log(err);
            result += "|speedtype_attack  = " + "Error: field doesn't exist" + "\n";
            result += "|speedtype_skill   = " + "Error: field doesn't exist" + "\n";
        }
        
        try{
            temp = "|movetype_attack   = " + unit.movement.attack['move type'] + "\n";
            temp += "|movetype_skill    = " + unit.movement.skill['move type'] + "\n\n";
            result += temp;
        }catch(err){
            console.log(err);
            result += "|movetype_attack   = " + "Error: field doesn't exist" + "\n";
            result += "|movetype_skill    = " + "Error: field doesn't exist" + "\n\n";
        }
    }catch(err){
        console.log(err);
        result = "ERROR\n\n";
    }
    return result;
}

//used for gathering move data for wiki
function wiki_move(server){
    var destination = fs.createWriteStream('move.txt', {encoding: 'utf8'});
    var result = "";
    for(var u in master_list.unit){
        result += (wiki_move_helper(master_list.unit[u]));
    }
    destination.write(result);
    destination.close();
    console.log("Done");
}

//send database statistics to Discord webhooks
function send_updates(){
    function create_sectional_messages(data_arr,msg_len,acc_limit){
        var msg_arr = [];
        var curMsg = "";
        var local_data = data_arr.slice();
        while(local_data.length > 0){
            //reached max limit, push and continue
            if(curMsg.length + local_data[0].length > msg_len){
                if(msg_arr.length === acc_limit - 1){
                    curMsg += `...and ${local_data.length} more.`;
                    msg_arr.push(curMsg);
                    curMsg = "";
                    break;
                }else{
                    msg_arr.push(curMsg);
                    curMsg = "";
                }
            }else{ //keep adding to curMsg
                curMsg += local_data.shift();
            }
        }

        if(curMsg.length > 0){
            msg_arr.push(curMsg);
        }

        return msg_arr;
    }
    //given a server name (GL,EU,JP) and type (Units or Items)
    //return an array of field objects with keys title and value
    function get_server_statistics(stats, server_name, type){
        var newest = stats[`newest_${type.toLowerCase()}`];
        var field_title = `${server_name} Server - ${type}`;
        var msg = `${server_name} has ` + stats[`num_${type.toLowerCase()}`] + ` ${type}. `;
        if(newest.length > 0 && newest.length !== stats[`num_${type.toLowerCase()}`]){
            msg += `The ${newest.length} new ${type.toLowerCase()} are:\n`;
        }else{
            msg += `There are ${newest.length} new ${type.toLowerCase()}.`;
            return [
                {
                    title: field_title,
                    value: msg
                }
            ];
        }

        var parsed_newest = [];
        if(type === "Units"){
            for(let u = 0; u < newest.length; ++u){
                let curUnit = master_list.unit[newest[u]];
                let name = (curUnit.translated_name) ? curUnit.translated_name : curUnit.name;
                parsed_newest.push(`${name} (${curUnit.id})\n`);
            }
        }else if(type === "Items"){
            for(let i = 0; i < newest.length; ++i){
                let curItem = master_list.item[newest[i]];
                let name = (curItem.translated_name) ? curItem.translated_name : curItem.name;
                parsed_newest.push(`${name} (${curItem.id})\n`);
            }
        }else if(type === "ES"){
            for (let i = 0; i < newest.length; ++i) {
                let curES = master_list.es[newest[i]];
                let name = (curES.translated_name) ? curES.translated_name : curES.name;
                parsed_newest.push(`${name} (${curES.id})\n`);
            }
        }else{
            msg += "Error: Unknown type " + type;
            return [
                {
                    title: field_title,
                    value: msg
                }
            ];
        }


        var msg_arr = create_sectional_messages(parsed_newest,900,5);
        var field_arr = [
            {
                title: `${field_title} - 1`,
                value: msg+msg_arr[0]
            }
        ];

        for(let m = 1; m < msg_arr.length; ++m){
            field_arr.push({
                title: `${field_title} - ${m+1}`,
                value: msg_arr[m]
            });
        }
        return field_arr;
    }

    //create payload for discord webhook
    function create_update_payload(){
        var mapping = {
            gl: "Global",
            jp: "Japan",
            eu: "Europe"
        }

        var types = ["Units", "Items", "ES"];

        var fields = [];
        for(let m in mapping){
            for(let t = 0; t < types.length; ++t){
                fields.push(get_server_statistics(stats[m],mapping[m],types[t]));
            }
        }
        
        var payload = {
            username: "Bluubot DB Update",
            text: "This message is sent whenever the database server for Bluubot is updated",
            attachments: [
                {
                    color: '#3498DB',
                    fields: [
                    ]
                }
            ]
        };

        for(let f = 0; f < fields.length; ++f){
            for(let m = 0; m < fields[f].length; ++m){
                payload.attachments[0].fields.push(fields[f][m]);
            }
        }

        console.log(JSON.stringify(payload,null,2));
        return payload;
    }

    function send_webhook_post(url, payload){
        var send_options = {
            method: "POST",
            uri: url,
            json: payload
        };
        return rp(send_options)
            .then(function(result){
                console.log("Successfully sent to " + url);
            }).catch(function(err){
                console.log(err);
                console.log("Error with " + url);
            });
    }
    var webhooks;
    try{
        webhooks = fs.readFileSync('./webhooks.txt','utf8');
        //clean input
        while(webhooks.indexOf('\r') > -1){
            webhooks = webhooks.replace('\r','\n');
        }
        webhooks = webhooks.split('\n');
    }catch(err){
        console.log(err);
        return;
    }

    console.log("Webhook found:",webhooks);
    var payload = create_update_payload();
    var promises = [];
    for(var i = 0; i < webhooks.length; ++i){
        if(webhooks[i].length > 0){
            console.log("Sending payload to " + webhooks[i]);
            promises.push(send_webhook_post(webhooks[i] + "/slack",payload));
        }
    }

    return Promise.all(promises);
}

function get_es_ids(unit_db){
    var ids = [];
    //get all ES IDs
    for(let u in unit_db){
        if(unit_db[u]["extra skill"])
            ids.push(parseInt(unit_db[u]["extra skill"].id));
    }

    //sort for easier searching
    ids.sort(function(a,b){
        return a - b;
    });
    return ids;
}

function test_function(){
    console.log("Entered test function");
    
    // send_updates().then(function(results){
    //     console.log("Sent update hooks");
    // });
    // console.log(master_list.es);
    console.log("Done");
}