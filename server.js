//for File management
var fs = require('fs');
var request = require('request');

var underscore = require('underscore'); //for search functions

//for server setup 
var compression = require('compression');
var bodyParser = require('body-parser');
var express = require('express'),
    app = express();

//for command line
var argv = require('yargs')
    .usage('Usage: $0 -p [integer] -i [string of IP address]')
    .default("p", 80)
    .default("i", '127.0.0.1')
    .alias('p', 'port')
    .alias('i', 'ip').alias('i', 'ip-address')
    .describe('p', 'Port to run server on')
    .describe('i', 'IP Address to run server on')
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
}

app.use(compression());
app.use(bodyParser.urlencoded({extended: false}));
app.use(allowCrossDomain);

//on-going database that is a combination of 3 other databases (GL,EU,JP)
var master_list = {
    unit: {},
    item: {},
};

//statistics of the server
var stats = {
    last_update: null,
    num_units: 0,
    num_items: 0
}

function create_id_array(json_obj){
    var array = [];
    for(o in json_obj){
        array.push(json_obj[o]["id"].toString());
    }
    return array;
}

//asynchronous file load, used for updating after database is built
function asynchr_json_load(file, callbackFn){
    console.log("opening " + __dirname + "/" + file);
    fs.readFile(__dirname + "/" + file, 'utf8', function(err,data){
        if(err){
            console.log(err);
            callbackFn(null);
        }
        callbackFn(JSON.parse(data));
    });
}

//download a single file
function asynchr_file_download(url, local_name, callbackFn){
    //based on https://blog.xervo.io/node.js-tutorial-how-to-use-request-module 
    var destination = fs.createWriteStream('./' + local_name);
    request(url).pipe(destination).on('finish',function(){
        // console.log("Finished downloading " + local_name + " from " + url);
        // asynchr_json_load(local_name, callbackFn);
        callbackFn();
    });
}

//download multiple files before continuing
function asynchr_files_download(list,callbackFn){
    if(list == undefined || list.length == 0)
        callbackFn();
    else{
        //based on https://blog.xervo.io/node.js-tutorial-how-to-use-request-module 
        var cur_set = list.pop(); //list is an array of download jobs
        var local_name = cur_set["local_name"];
        var url = cur_set["url"];
        console.log("Downloading " + url + " > " + local_name);
        var destination = fs.createWriteStream('./' + local_name);
        request(url).pipe(destination).on('finish', function () {
            asynchr_files_download(list,callbackFn);
        });
    }
}

//synchronous file load, used for building initial database
function synchr_json_load(file, alternative_files){
    try{
        return JSON.parse(fs.readFileSync(__dirname + "/" + file, 'utf8'));
    }catch(err){//error, try alternative files
        if(alternative_files != undefined && alternative_files.length > 0){
            var new_file = alternative_files.pop();
            return synchr_json_load(new_file,alternative_files);
        }else{//return an error if none of the files work
            return JSON.parse(fs.readFileSync(__dirname + "/" + file, 'utf8'));
        }
    }
}

//used to save data
function asynchr_json_write(file, data){
    fs.writeFile(__dirname + "/" + file, data, function(err){
        if(err){
            console.log(err);
        }
        console.log("Saved " + file);
        return;
    });
}

function rename_file(cur_name,new_name){
    try{
        var data = fs.readFileSync(__dirname + "/" + cur_name, 'utf8');
        fs.writeFileSync(__dirname + "/" + new_name, data ,'utf8');
    }catch(err){
        console.log(err);
    }
}

//add in anything in db_sub that is not in db_main
function merge_databases(db_main, db_sub, server){
    var local_obj = JSON.parse(JSON.stringify(db_main)); //casting
    for(unit in db_sub){ //iterate through everything in object
        if(local_obj[unit] != undefined){ //exists, so just add date add time
            if(local_obj[unit]["server"].indexOf(server) == -1){
                local_obj[unit]["server"].push(server);
                local_obj[unit]["db_add_time"].push(new Date().toUTCString());
            }
        }else{ //doesn't exist, so add it and date add time
            local_obj[unit] = db_sub[unit];
            local_obj[unit].server = [server];
            local_obj[unit]["db_add_time"] = [new Date().toUTCString()];
        }
    }
    return local_obj;
}

//adds a section in in the sub database to the main database
function add_field_to_db(db_main, db_sub, func){
    for(unit in db_sub){
        try{
            func(db_main[unit], db_sub[unit]);
        }catch(err){
            continue;
        }
    }
}

//load database from a file or files
function load_database(master_obj){
    master_obj["unit"] = {};
    master_obj["item"] = {};

    //open unit
    console.log("Loading individual unit databases...");
    var global = synchr_json_load('info-gl.json', ['info-gl-old.json']);
    var global_sp = synchr_json_load('feskills-gl.json', ['feskills-gl-old.json']);
    var global_evo = synchr_json_load('evo_list-gl.json', ['evo_list-gl-old.json']);
    var japan = synchr_json_load('info-jp.json', ['info-jp-old.json']);
    var japan_sp = synchr_json_load('feskills-jp.json', ['feskills-jp-old.json']);
    var japan_evo = synchr_json_load('evo_list-jp.json', ['evo_list-jp-old.json']);
    var europe = synchr_json_load('info-eu.json',['info-eu-old.json']);
    // var europe_evo = synchr_json_load('evo_list-eu.json', ['evo_list-eu-old.json']); // empty at time of writing (Mar. 23, 2017)
    //add extra data to respective databases
    add_field_to_db(global,global_evo,function(unit1,unit2){
        unit1["evo_mats"] = unit2["mats"];
    });
    add_field_to_db(global,global_sp,function(unit1, unit2){
        unit1["skills"] = unit2["skills"];
    });
    add_field_to_db(japan, japan_sp, function (unit1, unit2) {
        unit1["skills"] = unit2["skills"];
    });
    add_field_to_db(japan, japan_evo, function (unit1, unit2) {
        unit1["evo_mats"] = unit2["mats"];
    });
    // add_field_to_db(europe, europe_evo, function (unit1, unit2) {
    //     unit1["evo_mats"] = unit2["mats"];
    // });
    console.log("Merging unit databases...");
    master_obj["unit"] = merge_databases(master_obj.unit, global, 'gl');
    master_obj["unit"] = merge_databases(master_obj.unit, europe, 'eu');
    master_obj["unit"] = merge_databases(master_obj.unit, japan, 'jp');
    console.log("Finished loading unit database");

    //open item
    console.log("Loading individual item databases");
    global = synchr_json_load('items-gl.json', ['items-gl-old.json']);
    japan = synchr_json_load('items-jp.json', ['items-jp-old.json']);
    europe = synchr_json_load('items-eu.json', ['items-eu-old.json']);
    console.log("Merging item databases...");
    master_obj["item"] = merge_databases(master_obj.item, global, 'gl');
    master_obj["item"] = merge_databases(master_obj.item, europe, 'eu');
    master_obj["item"] = merge_databases(master_obj.item, japan, 'jp');
    console.log("Finished loading item database");

    //update statistics
    stats.last_update = new Date().toUTCString();
    stats.num_units = underscore.size(master_obj["unit"]);
    stats.num_items = underscore.size(master_obj["item"]);
    // console.log(stats);
}

//reload database from remote
function reload_database(callbackFn){
    console.log("Preparing to reload database");
    //save old files
    console.log("Saving old files");
    rename_file('info-gl.json', 'info-gl-old.json');
    rename_file('info-jp.json', 'info-jp-old.json');
    rename_file('info-eu.json', 'info-eu-old.json');
    rename_file('feskills-gl.json', 'feskills-gl-old.json');
    rename_file('feskills-jp.json', 'feskills-jp-old.json');
    rename_file('items-gl.json', 'items-gl-old.json');
    rename_file('items-jp.json', 'items-jp-old.json');
    rename_file('items-eu.json', 'items-eu-old.json');
    rename_file('evo_list-gl.json', 'evo_list-gl-old.json');
    rename_file('evo_list-jp.json', 'evo_list-jp-old.json');
    rename_file('evo_list-eu.json', 'evo_list-eu-old.json');

    //download files from remote servers and load database when finished
    console.log("Downloading new files");
    var main_url = 'https://raw.githubusercontent.com/Deathmax/bravefrontier_data/master';
    var list = [
        {
            url: main_url + '/info.json',
            local_name: 'info-gl.json'
        },
        {
            url: main_url + '/feskills.json',
            local_name: 'feskills-gl.json'
        },
        {
            url: main_url + '/items.json',
            local_name: 'items-gl.json'
        },
        {
            url: main_url + '/evo_list.json',
            local_name: 'evo_list-gl.json'
        },
        {
            url: main_url + '/jp/info.json',
            local_name: 'info-jp.json'
        },
        {
            url: main_url + '/jp/feskills.json',
            local_name: 'feskills-jp.json'
        },
        {
            url: main_url + '/jp/items.json',
            local_name: 'items-jp.json'
        },
        {
            url: main_url + '/jp/evo_list.json',
            local_name: 'evo_list-jp.json'
        },
        {
            url: main_url + '/eu/info.json',
            local_name: 'info-eu.json'
        },
        {
            url: main_url + '/eu/items.json',
            local_name: 'items-eu.json'
        },
        {
            url: main_url + '/eu/evo_list.json',
            local_name: 'evo_list-eu.json'
        },
    ];
    asynchr_files_download(list,function(){
        load_database(master_list);
        try{
            callbackFn();
        }catch(err){
            console.log(err);
        }
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
    response.send("Reloading database...<br>");
    reload_database(function(){
        response.end("Finished reloading database");
    })
});

app.get('/unit/:id', function(request, response){
    var unit = master_list.unit[request.params.id];
    if(unit == undefined)  
        response.end(JSON.stringify({error: request.params.id + " is not found"}));
    else
        response.end(JSON.stringify(unit));
});

app.get('/item/:id', function(request,response){
    var item = master_list.item[request.params.id];
    if (item == undefined)
        response.end(JSON.stringify({ error: request.params.id + " is not found" }));
    else
        response.end(JSON.stringify(item));
})

app.get('/search/unit', function(request,response){
    response.sendFile(__dirname + "/" + "search_unit.html");
});

function safe_json_get(value){
     return (value != undefined) ? value : "";
}

//get the corresponding unit value of a given query
function get_query_value(queryField, unit){
    try{
        switch(queryField){
            case 'unit_name_id': return unit["guide_id"] + ": " + unit["name"].toLowerCase() + " (" + unit["id"]+")";
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
            case 'ubb_effect': return JSON.stringify(unit["ubb"]["levels"][9]["effects"]);
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
            default: return "";
        }
    }catch(err){
        // console.log(err);
        return "";
    }
}

// function contains_query(query, )

//given a series of search options, list units with those qualities
//TODO: finish this function
app.get('/search/unit/options', function(request,response){
    // console.log(request.query);
    var query = request.query;
    for(q in query){
        var curQuery = query[q].toLowerCase();
        //wildcard queries
        if  (curQuery == '' || (q == 'element' && curQuery == 'any') ||
            (q == 'gender' && curQuery == 'any')){
                continue;
        }

        var uValue = get_query_value(q, master_list.unit["10017"]);
        console.log(q + ": " + uValue);
    }
    // console.log("\n\n" + master_list.unit["10017"]);
    response.end("Received request");
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
                        var unit = master_list.unit[tempList[u]];
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
                    var unit = master_list.unit[tempList[u]];
                    if (unit["guide_id"] == start) { //start saving once we reach start position
                        isTraversing = true;
                    }
                    if (isTraversing) {//save unit name
                        resultList.push(unit["guide_id"] + ": " + unit["name"] + " (" + unit["id"] + ")");
                    }
                    if (unit["guide_id"] == (end)) { //stop once we reach our end position
                        console.log(unit["id"]);
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
                        var unit = master_list.unit[tempList[u]];
                        resultList.push(unit["guide_id"] + ": " + unit["name"] + " (" + unit["id"] + ")");
                        c++;
                    }
                }//end traverse
            } else if (query.type == "guide_id") {
                console.log("entered amount, guide_id");
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
                    var unit = master_list.unit[tempList[c]];
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

var server = app.listen(argv["port"], argv["ip"], function(){
    var host = server.address().address;
    var port = server.address().port;

    load_database(master_list);

    console.log("Server listening at http://%s:%s", host, port);
});