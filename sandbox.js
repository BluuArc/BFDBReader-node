var client = require('./data_tier_client.js');
var fs = require('fs');
let EffectPrinter = require('./effect_printer.js');
let common = require('./server_modules/bfdb_common.js');

client.setAddress("http://127.0.0.1:8081");

let ep = new EffectPrinter({},{
    verbose: true
});

//apply a function to all DBs
//func params: server name, db name
function applyToAllDB(func){
    let db_types = ['bbs', 'es', 'feskills', 'info', 'items', 'ls'];
    let servers = ['gl', 'eu', 'jp'];
    for (let s = 0; s < servers.length; ++s) {
        for (let d = 0; d < db_types.length; ++d) {
            func(servers[s],db_types[d]);
        }
    }
}

//scan all files and get buff data
function getBuffDataForAll() {
    var BuffScraper = function () {
        var result_obj;
        //object_id: ID of unit/item
        //cur_object: object currently being analyzed
        //acc_object: object to store all the data (pass in result_obj)
        //object_type: unit or item
        function getBuffData(object_id, cur_object, acc_object, object_type) {
            function addObjectToAccumulator(object_id, cur_object, index_object, object_type) {
                let gray_listed = ["hit dmg% distribution", "frame times"];
                let black_listed = ['proc id', 'passive id']; //prevent duplicate info`
                let type_value = `${object_type}_value`;
                let type_id = `${object_type}_id`;
                //for every field in cur_object
                for (let f in cur_object) {
                    if (black_listed.indexOf(f) > -1) continue; //ignore blacklisted fields

                    //if if doesn't exist, make it
                    if (index_object[f] === undefined) {
                        index_object[f] = {}
                    }

                    //if unit or item array doesn't exist, create it
                    //e.g. if index_object is result_object.proc["proc_id_1"], then format is
                    //result_object.proc["proc_id_1"][f]["unit" or "item"] = {
                    //  values:[], id: []
                    //}

                    //if it's not a graylisted type
                    if (gray_listed.indexOf(f) === -1) {
                        if (index_object[f][type_value] === undefined) {
                            index_object[f][type_value] = {};
                        }
                        let field_value = (function (value) {
                            if (typeof value === "object" || value instanceof Array) {
                                return JSON.stringify(value);
                            } else if (typeof value !== "string") {
                                return value.toString();
                            } else {
                                return value;
                            }
                        })(cur_object[f]);
                        //if there's a unique value, add it to the index_object
                        // if (index_object[f][object_type].values.indexOf(field_value) === -1 && index_object[f][object_type].id.indexOf(object_id) === -1) {
                        //     index_object[f][object_type].values.push(field_value);
                        //     index_object[f][object_type].id.push(object_id);
                        // }
                        if (index_object[f][type_value][field_value] === undefined) {
                            index_object[f][type_value][field_value] = object_id;
                        }
                    } else { //add to the IDs list if length is less than 5 and object_id is not in list yet
                        if (index_object[f][type_id] === undefined) {
                            index_object[f][type_id] = [];
                        }
                        if (index_object[f][type_id].length < 5 && index_object[f][type_id].indexOf(object_id) === -1) {
                            index_object[f][type_id].push(object_id);
                        }

                    }
                }
                return;
            }
            //for every field in the object
            for (let i in cur_object) {
                //look for ID field in cur_object, then push cur_object if ID field exists
                if (typeof cur_object[i] !== "object") {
                    //check for presence of IDs
                    let unique_index = "", property_type = "";
                    var known_id_fields = ['id', 'guide_id', 'raid', 'invalidate LS chance%', 'invalidate LS turns (60)'];
                    if (i.indexOf("unknown passive id") > -1) {
                        property_type = "passive";
                        unique_index = "unknown_passive_id_" + cur_object[i];
                    } else if (i.indexOf("passive id") > -1) {
                        property_type = "passive";
                        unique_index = "passive_id_" + cur_object[i];
                    } else if (i.indexOf("unknown proc id") > -1) {
                        property_type = "proc";
                        unique_index = "unknown_proc_id_" + cur_object[i];
                    } else if (i.indexOf("proc id") > -1) {
                        property_type = "proc";
                        unique_index = "proc_id_" + cur_object[i];
                    } else if (i.indexOf("unknown buff id") > -1) {
                        property_type = "buff";
                        unique_index = "unknown_buff_id_" + cur_object[i];
                    } else if (i.indexOf("buff id") > -1) {
                        property_type = "buff";
                        unique_index = "buff_id_" + cur_object[i];
                    } else if (i.indexOf("id") > -1 && known_id_fields.indexOf(i) === -1 && i.indexOf("angel idol") === -1) { //print out any missing ID field names
                        console.log(i);
                    }

                    //add current ID to list of property_type is found
                    if (property_type.length > 0) {
                        //create index if it doesn't exist yet
                        if (acc_object[property_type][unique_index] === undefined) {
                            acc_object[property_type][unique_index] = {}
                        }

                        //add cur_object's keys, values, and ID to acc_object
                        addObjectToAccumulator(object_id, cur_object, acc_object[property_type][unique_index], object_type);
                    }
                } else {
                    //recursively look for data
                    if (typeof cur_object[i] === "object") {
                        getBuffData(object_id, cur_object[i], acc_object, object_type);
                    } else if (cur_object[i] instanceof Array) {//traverse the array in reverse order
                        let length = cur_object[i].length;
                        for (let l = length - 1; l >= 0; --l) {
                            getBuffData(object_id, cur_object[i][l], acc_object, object_type);
                        }
                    }
                }
            }
        }
        this.getBuffData = getBuffData;

        //array of objects where each index has two keys
        //name and db
        function getBuffDataForAllinDB(database, database_name) {
            if (result_obj === undefined) {
                result_obj = {
                    passive: {},
                    proc: {},
                    buff: {}
                };
            }

            //get buff data of all units
            for (let id in database) {
                getBuffData(id, database[id], result_obj, database_name);
            }


            // fs.writeFileSync("./test_buff_id.json", JSON.stringify(result_obj, null, "\t"));
            // return result_obj;
        }
        this.getBuffDataForAllinDB = getBuffDataForAllinDB;

        this.getResult = function () {
            //sort each object in result_obj
            let fields = Object.keys(result_obj);
            for (let f = 0; f < fields.length; ++f) {
                var sort_arr = [];
                //put everything into an array
                for (let id_field in result_obj[fields[f]]) {
                    sort_arr.push({
                        prefix: id_field.split("id_")[0],
                        id: id_field.split("id_")[1],
                        data: result_obj[fields[f]][id_field]
                    });
                }
                //sort in ascending order
                sort_arr.sort(function (a, b) {
                    let idA, idB;
                    try {
                        idA = parseInt(a.id);
                    } catch (err) {
                        //erroneous data should go at beginning of array
                        return -1;
                    }

                    try {
                        idB = parseInt(b.id);
                    } catch (err) {
                        //b is erroneous, so a should go after it
                        return 1;
                    }

                    //default sort in ascending order
                    return idA - idB;
                });

                //replace with sorted field
                result_obj[fields[f]] = {};
                for (let i = 0; i < sort_arr.length; ++i) {
                    result_obj[fields[f]][`${sort_arr[i].prefix}id_${sort_arr[i].id}`] = sort_arr[i].data;
                }
            }
            return result_obj;
        }

    }
    let buff_scraper = new BuffScraper();
    applyToAllDB(function(server,db_type){
        console.log(`Scraping ${db_type}-${server}.json`);
        let db = JSON.parse(fs.readFileSync(`./sandbox_data/${db_type}-${server}.json`, 'utf8'));
        buff_scraper.getBuffDataForAllinDB(db, db_type);
    });

    var result = buff_scraper.getResult();
    for (let f in result) {
        let filename = `./full_${f}_id.json`;
        console.log("Saving", filename)
        fs.writeFileSync(filename, JSON.stringify(result[f], null, 4));
    }

    console.log("done");
}

function doItemTest(itemQuery){
    return client.searchItem(itemQuery)
        .then(function(results){
            if(results.length === 1){
                // console.log(results);
                // return client.getItem(result[0]);
                return client.getItem(results[0]).then(function(item){
                    let msg = ep.printItem(item);
                    console.log(JSON.stringify(item, null, 2));
                    console.log(item.name,item.id,"-",item.desc);
                    return msg;
                });
            }else{
                return results;
            }
        })
        .then(function (result) {
            console.log(result);
            // console.log(result.recipe.materials);
        })
        .catch(console.log);
}

function doUnitTest(unitQuery){
    let type = unitQuery.type;
    let burstType = unitQuery.burstType;
    delete unitQuery.type; delete unitQuery.burstType;
    return client.searchUnit(unitQuery)
        .then(function (result) {
            if(result.length === 1){
                return client.getUnit(result[0]).then(function(unit){
                    let unit_printer = ep;
                    ep.setTarget(unit);
                    let msg;
                    if(type === "burst"){
                        msg = unit_printer.printBurst(burstType);
                    }else if(type === "sp"){
                        msg = unit_printer.printSP();   
                    }else if(type === "es"){
                        msg = unit_printer.printES();
                    }else if(type === 'ls'){
                        msg = unit_printer.printLS();
                        // console.log(unit['leader skill'].desc);
                        console.log(JSON.stringify(unit['leader skill'], null, 2));
                    }

                    if (unit.translated_name) console.log(unit.translated_name);
                    console.log(unit.name, unit.id);
                    // console.log(JSON.stringify(unit, null, 2));
                    return msg;
                });
            }else{
                return result;
            }
        })
        .then(function(result){
            // console.log(result);
            // console.log(result.split('\n\n'));
            // console.log(result.length,result);
            if(result instanceof Array){
                if(result.length === 0) console.log("No result found");
                result.forEach(function(elem,index){
                    if(elem.desc && elem.translation){ //SP
                        console.log(index.toString(),elem.desc,"\n ",elem.translation);
                    }else{
                        console.log(index,elem);
                    }
                });
            }else{
                console.log(result);
            }
            // console.log(JSON.stringify(buff_processor.proc_buffs,null,2));
        })
        .catch(console.log);
}

function doBurstTest(id){
    var bursts = {};
    let printBurst = ep.printBurst;
    let servers = ['gl','eu','jp'];
    while(!bursts[id] && servers.length > 0){
        let server = servers.shift();
        console.log(`checking ${server}`);
        bursts = JSON.parse(fs.readFileSync(`./sandbox_data/bbs-${server}.json`, 'utf8'));
    }

    // let id = "3116";
    let burst_object = bursts[id];
    console.log(JSON.stringify(burst_object,null,2));
    if(burst_object){
        let msg = printBurst(burst_object);
        console.log(burst_object.name);
        console.log(burst_object.desc);
        console.log(msg);
    } else 
        console.log("No burst found with ID",id);
}

function doESTest(id){
    var es_db = {};
    let servers = ['gl', 'eu', 'jp'];
    while (!es_db[id] && servers.length > 0) {
        let server = servers.shift();
        console.log(`checking ${server}`);
        es_db = JSON.parse(fs.readFileSync(`./sandbox_data/es-${server}.json`, 'utf8'));
    }
    let es_object = es_db[id];
    console.log(JSON.stringify(es_object,null,2));
    if(es_object){
        let msg = ep.printES(es_object);
        console.log(es_object.name, "-", es_object.desc);
        console.log("target:",es_object.target);
        console.log(msg);
    }else{
        console.log("No ES found with ID", id);
    }
}

function doLSTest(id){
    var ls_db = {};
    let servers = ['gl', 'eu', 'jp'];
    while (!ls_db[id] && servers.length > 0) {
        let server = servers.shift();
        console.log(`checking ${server}`);
        ls_db = JSON.parse(fs.readFileSync(`./sandbox_data/ls-${server}.json`, 'utf8'));
    }
    let ls_object = ls_db[id];
    console.log(JSON.stringify(ls_object,null,2));
    if(ls_object){
        let msg = ep.printLS(ls_object);
        console.log(ls_object.name, "-", ls_object.desc);
        console.log(msg);
    }else{
        console.log("No LS found with ID", id);
    }
}

function analyzeObjectForValuesOf(target, field_name) {
    let values = [];
    if (typeof target !== "object") return values;
    let fields = [target];
    while (fields.length > 0) {
        let curField = fields.shift();
        //skip non-objects
        if (typeof curField !== "object") {
            continue;
        }

        for (let f in curField) {
            if (typeof curField[f] === "object") {
                fields.push(curField[f]);
            }
            if (f == field_name) {
                let value;
                if (typeof curField[f] !== "object")
                    value = (curField[f]);
                else
                    value = (JSON.stringify(curField[f]));
                
                if(values.indexOf(value) === -1){
                    values.push(value);
                }
            }
        }
    }

    return values;
}

function sandbox_function(){
    // let attacking_bursts = {};
    return client.searchExtraSkill({name_id: 'lux aeterno'}).then((results) => { return client.getExtraSkill(results[0]); })
        .then((unit) => {
            let values = common.analyzeObjectForValuesOf(unit,['proc id', 'unknown proc id', 'passive id', 'unknown passive id', 'unknown buff id'], {
                unique: true,
            });
            // console.log(values);
            console.log(JSON.stringify(unit,null,2));
        })
}

ep.init().then(function(){ 
    return (
        sandbox_function()
        // getBuffDataForAll()
        // doItemTest({ name_id: "41404", verbose: true})
        // doUnitTest({ name_id: "serge",strict: "false", verbose:true,burstType: "ubb", type: "sp"})
        // doBurstTest("1750165")
        // doESTest("7")
        // doLSTest('6500')
    );
}).then(function(){
    console.log(" ")  
}).catch(console.log);


// unitDB.init();