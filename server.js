//for File management
var fs = require('fs');
var request = require('request');

var underscore = require('underscore'); //for search functions
var translate = require('google-translate-api');

//for server setup 
var compression = require('compression');
var bodyParser = require('body-parser');
var express = require('express'),
    app = express();

//for command line
var argv = require('yargs')
    .usage('Usage: $0 -p [integer] -i [string of IP address] -r -n')
    .default("p", 8081)
    .default("i", '127.0.0.1')
    .alias('p', 'port')
    .alias('i', 'ip').alias('i', 'ip-address')
    .alias('r', 'reload').alias('r','refresh')
    .alias('n','notranslate')
    .describe('p', 'Port to run server on')
    .describe('i', 'IP Address to run server on')
    .describe('r', 'Force a redownload of the database. Use this if you have issues with the JSON files.')
    .describe('n', 'Disable translation (for testing)')
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
    translated_units: {},
    item: {},
    translated_items: {},
};

//statistics of the server
var stats = {
    last_update: null,
    gl: {
        num_units: 0,
        num_items: 0,
        newest_units: [],
        newest_items: []
    },
    jp: {
        num_units: 0,
        num_items: 0,
        newest_units: [],
        newest_items: []
    },
    eu: {
        num_units: 0,
        num_items: 0,
        newest_units: [],
        newest_items: []
    }
    
};

function create_id_array(json_obj){
    var array = [];
    for(var o in json_obj){
        array.push(json_obj[o].id.toString());
    }
    return array;
}

//donwnload a single file
function file_download_promisified(url,local_name){
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

function rename_file_promisified(cur_name,new_name){
    return new Promise(function(fulfill,reject){
        fs.readFile(__dirname + "/json/" + cur_name, 'utf8', function (err, data) {
            if (err) {
                console.log("Couldn't find " + cur_name + " to rename");
                fulfill(); //file doesn't exist, but that's okay
            }else{
                fs.writeFile(__dirname + "/json/" + new_name, data, 'utf8',function(err){
                    if(err) console.log("Couldn't rename " + cur_name + " to " + new_name);
                    else    console.log("Remamed " + cur_name + " to " + new_name);
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
    for(var i in items){
        var curItem = items[i];
        curItem.usage = [];
        for(var j in items){
            if(items[j].recipe !== undefined){
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
                    return load_json_promisified(new_file,alternative_files).catch(reject);
                }else{
                    reject("Error: cannot open " + file + " or its alternatives");
                }
            }
            //return parsed data 
            try{
                var result = JSON.parse(data);
                fulfill(result);
            }catch(parseError){
                reject(parseError);
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
        
        var item_promise = load_json_promisified('items-' + server + '.json', ['items-' + server + '-old.json'])
            .then(function (result) {
                mini_db.items = result;
            }).catch(reject);
        
        //process files once finished loading
        Promise.all([main_promise, sp_promise, evo_promise])
            .then(function(results){ //finished loading JSON files
                //merge into one database object
                add_field_to_db(mini_db.main,mini_db.evo,function(unit1,unit2, db_main, db_sub){
                    unit1.evo_mats = unit2.mats;
                    unit1.next = unit2.evo.id;
                    db_main[unit1.next].prev = unit1.id;
                });

                add_field_to_db(mini_db.main,mini_db.sp, function(unit1,unit2){
                    unit1.skills = unit2.skills;
                });

                //return merged databases
                fulfill({
                    unit: mini_db.main,
                    item: mini_db.items
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
        var unit_list = underscore.filter(master_list.unit, function (unit) {
            return unit.server.indexOf(server) > -1;
        });
        var item_list = underscore.filter(master_list.item, function (item) {
            return item.server.indexOf(server) > -1;
        });

        //gather basic statistics
        var unit_id = create_id_array(unit_list);
        var item_id = create_id_array(item_list);
        stats[server].num_units = underscore.size(unit_id);
        stats[server].num_items = underscore.size(item_id);

        //load previous data, if it exists
        var unit_data;
        try {
            unit_data = updater.load('stats-unit-' + server + ".json");

            //save differences, if any
            if (unit_data.last_loaded.length != stats[server].num_units || unit_data.last_loaded[0] !== unit_id[0]) {
                unit_data.newest = get_db_diffs(unit_data.last_loaded, unit_id);
                unit_data.last_loaded = unit_id;
                updater.save('stats-unit-' + server + '.json', JSON.stringify(unit_data));
            }
        } catch (err) { //file doesn't exist
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
            if (item_data.last_loaded.length != stats[server].num_items || item_data.last_loaded[0] !== item_id[0]) {
                item_data.newest = get_db_diffs(item_data.last_loaded, item_id);
                item_data.last_loaded = item_id;
                updater.save('stats-item-' + server + '.json', JSON.stringify(item_data));
            }
        } catch (err) { //file doesn't exist
            item_data = {
                newest: item_id,
                last_loaded: item_id
            };
            updater.save('stats-item-' + server + '.json', JSON.stringify(item_data));
        }

        //keep track of newest units on server
        stats[server].newest_units = unit_data.newest;
        stats[server].newest_items = item_data.newest;
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
        var db_type = ['info','feskills','items','evo_list'];
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
                var completed = 0;
                for(var d = 0; d < db_type.length; ++d){
                    for(var s = 0; s < servers.length; ++s){
                        var url = main_url;
                        if(servers[s] !== "gl") url += servers[s] + "/";
                        url += db_type[d] + ".json";
                        var fileName = db_type[d] + "-" + servers[s] + ".json";
                        requests.push(file_download_promisified(url,fileName)
                            .then(function(name){
                                console.log("Downloaded " + name + " (" + (++completed) + "/" + requests.length + ")");
                            }));
                    }
                }
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
            var translations = [translate_jp_units(), translate_jp_items()];
            Promise.all(translations)
                .then(function (result) {
                    console.log("Finished reloading database");
                });
        }
        response.end(JSON.stringify(stats));
    });
});

app.get('/unit/:id', function(request, response){
    var unit = master_list.translated_units[request.params.id];
    if(unit === undefined)
        unit = master_list.unit[request.params.id];
    if(unit === undefined)  
        response.end(JSON.stringify({error: request.params.id + " is not found"}));
    else
        response.end(JSON.stringify(unit));
});

app.get('/item/:id', function(request,response){
    var item = master_list.translated_items[request.params.id];
    if(item === undefined)
        item = master_list.item[request.params.id];
    if (item === undefined)
        response.end(JSON.stringify({ error: request.params.id + " is not found" }));
    else
        response.end(JSON.stringify(item));
})

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
        console.log(err);
        return (default_return !== undefined) ? default_return : "";
    }
}

//get the corresponding unit value of a given query
function get_unit_query_value(queryField, unit){
    try{
        switch(queryField){
            case 'unit_name_id': 
                if(master_list.translated_units[unit.id] === undefined )
                    return unit["guide_id"] + ": " + unit["name"].toLowerCase() + " (" + unit["id"]+")";
                else{
                    var tempUnit = master_list.translated_units[unit.id];
                    return tempUnit["guide_id"] + ": " + tempUnit["name"].toLowerCase() + " (" + tempUnit["id"] + ")";
                }
                break;
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
    for(var q in query){
        var curQuery = query[q].toLowerCase();
        //wildcard queries
        if (curQuery == '' || (q == 'element' && curQuery == 'any') ||
            (q == 'gender' && curQuery == 'any') ||
            (q == 'server' && curQuery == 'any') || q == 'strict' || q == 'translate') {
            continue;
        }

        try{
            var unitValue = get_unit_query_value(q, unit).toString();
            if(unitValue.indexOf(curQuery) == -1){
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
function shorten_results(result_arr){
    var last_evo = get_evo_line(result_arr[0]);
    //check for uniqueness, return original array if not unique
    for(var u = 1; u < result_arr.length; ++u){
        var cur_evo = get_evo_line(result_arr[u]);
        if(cur_evo.length !== last_evo.length || cur_evo[0] !== last_evo[0]){
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
    // console.log(query);
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
        results = shorten_results(results);
    }
    // console.log(results);
    response.end(JSON.stringify(results));
});

function get_item_query_value(queryField, item){
    try {
        switch (queryField) {
            case 'item_name_id': 
                if(master_list.translated_units[item.id] === undefined)
                    return item["id"] + ": " + item["name"].toLowerCase();
                else{
                    var tempItem = master_list.translated_units[item.id];
                    return tempItem.id + ": " + tempItem.name.toLowerCase();
                }
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
    for (var q in query) {
        var curQuery = query[q].toLowerCase();
        //wildcard queries
        if (curQuery == '' || (q == 'type' && curQuery == 'any') ||
            (q == 'sphere_type' && curQuery == 'any') || 
            (q == 'server' && curQuery == 'any') || q == 'strict' || q == 'translate'){
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
    // console.log(query);
    var results = [];
    for (i in master_list["item"]) {
        var item = master_list["item"][i];
        if (contains_item_query(query, item))
            results.push(item["id"]);
    }

    response.end(JSON.stringify(results));
});

//given a start and end range, list unit names in that range
app.get('/list/units', function(request,response){
    var query = request.query;
    // console.log(query);
    /*//expected format for query
        query = {
            type: "unit_id" || "guide_id",
            list_type: "range" || "amount"
            start: "10011" || "1" || null (defaults to one of the first two depending on type),
            end: "-1" || some number || null (defaults to -1 to print all values); only for range,
            count: "-1" || some number || null (refaults to -1 to print all values); only for amount
        }
    */
    //build temporary list to sort through
    var tempList = [];
    var resultList = []; //to be returned
    for(u in master_list.unit){
        tempList.push(master_list.unit[u]["id"].toString());
    }
    try{
        var start;
        var isTraversing = false;
        if(query.list_type == "range"){ //print units within a range [from start to end inclusive]
            var end;
            if(query.type == "unit_id"){
                //no sort since it's sorted by ID by default

                //set traversal options
                if(query.start != undefined)
                    start = parseInt(query.start.toString());
                else
                    start = "10011";

                if(query.end != undefined)
                    end = parseInt(query.end.toString());
                else
                    end = -1;

                //traverse
                for(u in tempList){
                    if(parseInt(tempList[u]) >= start){ //start saving once we reach start position
                        isTraversing = true;
                    }
                    if(isTraversing){//save unit name
                        var unit = master_list.translated_units[tempList[u]];
                        if(unit === undefined)
                            unit = master_list.unit[tempList[u]];
                        resultList.push(unit["guide_id"] + ": " + unit["name"] + " (" + unit["id"] + ")");
                    }
                    if(end != -1 && parseInt(tempList[u]) >= end){ //stop once we reach our end position
                        isTraversing = false;
                        break;
                    }
                }//end traverse
            }else if(query.type == "guide_id"){
                tempList = underscore.sortBy(tempList, function (id) { 
                    var unit = master_list.unit[id];
                    return unit["guide_id"];
                });
                //set traversal options
                if (query.start != undefined)
                    start = parseInt(query.start.toString());
                else
                    start = 1;

                if (query.end != undefined)
                    end = parseInt(query.end.toString());
                else
                    end = -1;

                //traverse
                for (u in tempList) {
                    var unit = master_list.translated_units[tempList[u]];
                    if (unit === undefined)
                        unit = master_list.unit[tempList[u]];
                    if (unit["guide_id"] >= start) { //start saving once we reach start position
                        isTraversing = true;
                    }
                    if (isTraversing) {//save unit name
                        resultList.push(unit["guide_id"] + ": " + unit["name"] + " (" + unit["id"] + ")");
                    }
                    if (end != -1 && unit["guide_id"] >= (end)) { //stop once we reach our end position
                        // console.log(unit["id"]);
                        isTraversing = false;
                        break;
                    }
                }//end traverse
            }else{
                throw "Query Type " + query.type + " is not valid"; 
            }
            response.end(JSON.stringify(resultList));
        }else if(query.list_type == "amount"){//print X amount of units
            var count;
            if (query.type == "unit_id") {
                //no sort since it's sorted by ID by default

                //set traversal options
                if (query.start != undefined)
                    start = parseInt(query.start.toString());
                else
                    start = "10011";

                if (query.count != undefined)
                    count = parseInt(query.count.toString());
                else
                    count = "-1";

                //traverse
                var c = 0;
                for (u in tempList) {
                    if (tempList[u] == start) { //start saving once we reach start position
                        isTraversing = true;
                    }
                    if (c == count) { //stop once we reach our end position
                        isTraversing = false;
                        break;
                    }
                    if (isTraversing) {//save unit name
                        var unit = master_list.translated_units[tempList[u]];
                        if (unit === undefined)
                            unit = master_list.unit[tempList[u]];
                        resultList.push(unit["guide_id"] + ": " + unit["name"] + " (" + unit["id"] + ")");
                        c++;
                    }
                }//end traverse
            } else if (query.type == "guide_id") {
                // console.log("entered amount, guide_id");
                tempList = underscore.sortBy(tempList, function (id) {
                    var unit = master_list.unit[id];
                    return unit["guide_id"];
                });

                //set traversal options
                if (query.start != undefined)
                    start = parseInt(query.start.toString());
                else
                    start = 0;

                if (query.count != undefined)
                    count = parseInt(query.count.toString());
                else
                    count = -1;

                // console.log(start + " to " + count);
                for (var c = start; c != (count) && c < tempList.length; ++c) {
                    var unit = master_list.translated_units[tempList[c]];
                    if(unit === undefined)
                        unit = master_list.unit[tempList[c]];
                    resultList.push(unit["guide_id"] + ": " + unit["name"] + " (" + unit["id"] + ")");
                }//end traverse
            } else {
                throw "Query Type " + query.type + " is not valid";
            }
            response.end(JSON.stringify(resultList));
        }else{
            throw "Query List Type " + query.list_type + " is not valid"; 
        }
    }catch(err){
        console.log(err);
        response.end(JSON.stringify([err])); //return an empty array
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
        return (translate_to_english(unit.name,[],"name"));
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
            return new_unit;
        });
}

function isJapaneseText(name) {
    return name.search(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) > -1;
}

function translate_jp_items(){
    return new Promise(function(fulfill,reject){
        console.log("Translating items");
        var promises = [];
        var count_finished = 0;
        for(var i in master_list.item){
            var curItem = master_list.item[i];
            if(isJapaneseText(curItem.name)){
                // console.log("Translating item " + curItem.id);
                promises.push(translate_unit_name(curItem)
                    .then(function(translated_item){
                        console.log("Translated item " + translated_item.id + " (" + (++count_finished) + "/" + promises.length + ")");
                        return translated_item;
                    }));
            }
        }
        console.log("Translating " + promises.length + " items");
        Promise.all(promises)
            .then(function(results){
                //put translated items into master list
                console.log("Putting translated JP items into list now.");
                // console.log(results);
                for(var r in results){
                    var curItem = results[r];
                    master_list.translated_items[curItem.id] = curItem;
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
        console.log("Translating units");
        var promises = [];
        var count_finished = 0;
        for(var u in master_list.unit){
            var curUnit = master_list.unit[u];
            if(isJapaneseText(curUnit.name)){
                // console.log("Translating unit " + curUnit.id);
                promises.push(translate_unit_name(curUnit)
                    .then(function(translated_unit){
                        console.log("Translated unit " + translated_unit.id + " (" + (++count_finished) + "/" + promises.length + ")");
                        return translated_unit;
                    }));
            }
        }  
        console.log("Translating " + promises.length + " units");
        Promise.all(promises)
            .then(function(results){
                //put translated units into master list
                console.log("Putting translated JP units into list now.");
                for(var r in results){
                    var curUnit = results[r];
                    master_list.translated_units[curUnit.id] = curUnit;
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
                    var translations = [translate_jp_units(),translate_jp_items()];
                    Promise.all(translations)
                        .then(function(result){
                            console.log("Finished reloading database");
                            console.log("Ready! Server listening at http://%s:%s", host, port);
                        });
                }else{
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
                    var translations = [translate_jp_units(), translate_jp_items()];
                    Promise.all(translations)
                        .then(function (result) {
                            console.log("Ready! Server listening at http://%s:%s", host, port);
                        });
                } else {
                    console.log("Ready! Server listening at http://%s:%s", host, port);
                }
            })
            .catch(function(err){
                console.log(err);
                console.log("Exiting...");
                process.exit();
            });
    }

    // test_function();
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

function test_function(){
    var types = [];
    for(var i in master_list.item){
        var curItem = master_list.item[i];
        if (types.indexOf(curItem.type) == -1){
            types.push(curItem.type);
        }
            
    }
    console.log(types);
}