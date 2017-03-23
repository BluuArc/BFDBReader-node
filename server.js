var fs = require('fs');
var underscore = require('underscore');
var compression = require('compression');
var bodyParser = require('body-parser');
var express = require('express'),
    app = express();
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
//CORS middleware
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

//synchronous file load, used for building initial database
function synchr_json_load(file){
    return JSON.parse(fs.readFileSync(__dirname + "/" + file, 'utf8'));
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

//adds sp section in in the sub database to the main database
function add_sp_to_db(db_main, db_sub){
    // var local_obj = JSON.parse(JSON.stringify(db_main)); //casting
    for(unit in db_sub){
        db_main[unit]["skills"] = db_sub[unit]["skills"];
    }
}

//load database from a file or files
function load_database(master_obj){
    master_obj["unit"] = {};
    //open unit
    try{
        console.log("Loading master unit database...");
        master_obj["unit"] = synchr_json_load('info-master.json');
    }catch(err){ 
        console.log("Master database not found. Loading individual unit databases...");
        var global = synchr_json_load('info-gl.json');
        var global_sp = synchr_json_load('feskills-gl.json');
        var japan = synchr_json_load('info-jp.json');
        var japan_sp = synchr_json_load('feskills-jp.json');
        var europe = synchr_json_load('info-eu.json');
        //add sp skills to respective databases
        add_sp_to_db(global,global_sp);
        add_sp_to_db(japan,japan_sp);
        console.log("Merging unit databases...");
        master_obj["unit"] = merge_databases(master_obj.unit, global, 'gl');
        master_obj["unit"] = merge_databases(master_obj.unit, europe, 'eu');
        master_obj["unit"] = merge_databases(master_obj.unit, japan, 'jp');
        //TODO: Add creation of smaller JSON file of BFDBReader-node specific additions (e.g. add time and server)
        asynchr_json_write('info-master.json', JSON.stringify(master_obj["unit"]));
    }

    //open item
}

app.get('/', function(request, response){
    response.end("<h1>Hello World</h1>");
});

app.get('/unit/:id', function(request, response){
    var unit = master_list.unit[request.params.id];
    if(unit == undefined)  
        response.end(JSON.stringify({error: request.params.id + " is not found"}));
    else
        response.end(JSON.stringify(master_list.unit[request.params.id]));
});

app.get('/search', function(request,response){
    response.sendFile(__dirname + "/" + "search.html");
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

//given a series of search options, list units with those qualities
//TODO: finish this function
app.get('/search/options', function(request,response){
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
                    start = 0;

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
                    if (end != -1 && unit["guide_id"] == (end+1)) { //stop once we reach our end position
                        isTraversing = false;
                        break;
                    }
                    if (isTraversing) {//save unit name
                        resultList.push(unit["guide_id"] + ": " + unit["name"] + " (" + unit["id"] + ")");
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

                for (var c = start; c != (count+1) && c < tempList.length; ++c) {
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
})

var server = app.listen(argv["port"], argv["ip"], function(){
    var host = server.address().address;
    var port = server.address().port;

    load_database(master_list);

    console.log("Server listening at http://%s:%s", host, port);
});
