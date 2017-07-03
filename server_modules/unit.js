let bdfb_module = require('./bfdb_module.js');
let translate = require('google-translate-api');
let fs = require('fs');

let UnitDB = function(options){
    options = options || {};
    options.files =  [];
    options.name = "Unit";

    let servers = ['gl','eu','jp'];
    let files = ['info','evo_list', 'feskills'];
    let setupFn = function(db,loaded_files,name){
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
        function get_server_id(unit_id, server) {
            var id = parseInt(unit_id);
            //add special case for overlapping IDs 
            if (server === 'gl' && get_unit_home_server(id) === 'eu') {
                id = "8" + id.toString();
                console.log("Changing " + unit_id + " to " + id);
            } else {
                id = id.toString();
            }
            return id;
        }
        //add in anything in db_sub and not in db_main to db_main
        function merge_databases(db_main, db_sub, server) {
            var previous_evos = [];
            let keys = Object.keys(db_sub);
            for (var unit of keys) { //iterate through everything in object
                var id = get_server_id(unit, server);
                if (db_main[unit] !== undefined) { //exists, so just add date add time
                    if (db_main[unit].server.indexOf(server) == -1) {
                        db_main[unit].server.push(server);
                    }

                    //save evo mats
                    if (db_main[id].evo_mats === undefined && db_sub[unit].evo_mats !== undefined) {
                        var next_id = get_server_id(db_sub[unit].next, server);
                        db_main[id].evo_mats = db_sub[unit].evo_mats;
                        db_main[id].next = next_id.toString();
                        previous_evos.push({
                            id: next_id,
                            prev: id.toString()
                        });
                    }
                } else { //doesn't exist, so add it
                    db_main[id] = db_sub[unit];
                    db_main[id].server = [server];

                }
                delete db_sub[unit];
            }
            //add previous evo data once all units are added
            for (var i = 0; i < previous_evos.length; ++i) {
                db_main[previous_evos[i].id].prev = previous_evos[i].prev.toString();
            }
        }
        //adds a section in in the sub database to the main database
        function add_field_to_db(db_main, db_sub, func) {
            for (var unit in db_sub) {
                try {
                    func(db_main[unit], db_sub[unit], db_main, db_sub);
                } catch (err) {
                    continue;
                }
            }
        }


        console.log(`Loaded files for units in ${name}. Begin processing...`);

        //fix any ID overlap in gl objects
        if(name === 'gl'){
            for (let f of files) {
                let curDB = loaded_files[`${f}`];
                let keys = Object.keys(curDB);
                for (let id of keys) {
                    let newID = get_server_id(id, 'gl');
                    if (newID !== id) {
                        curDB[newID] = curDB[id];
                        delete curDB[id];
                    }
                }
            }
        }

        //merge evo_list
        add_field_to_db(loaded_files[`info`], loaded_files[`evo_list`], function (unit1, unit2, db_main, db_sub) {
            unit1.evo_mats = unit2.evo_mats;
            unit1.next = get_server_id(unit2.evo.id, s);
            db_main[unit1.next].prev = get_server_id(unit1.id, s);
        });
        delete loaded_files[`evo_list`];

        //merge feskills list
        add_field_to_db(loaded_files[`info`], loaded_files[`feskills`], function (unit1, unit2) {
            unit1.skills = unit2.skills;
        });
        delete loaded_files[`feskills`];

        merge_databases(db, loaded_files[`info`], name);

        console.log(`Finished processing for units in ${name}.`);

        // console.log(Object.keys(db));
        // console.log("Sample of unit", JSON.stringify(db['8750166'],null,2));
    };

    //initialize files in options
    for(let s of servers){
        let curObj = {
            name: s,
            files: [],
            setupFn: setupFn
        }
        for(let f of files){
            curObj.files.push({
                name: `${f}`,
                main: `${f}-${s}.json`,
                alternatives: [`${f}-${s}-old.json`]
            });

        }
        options.files.push(curObj);
    }

    options.getByID = (id,db) => {
        let result = db[id];
        if(result === undefined){
            return {error: `${id} is not found`};
        }else{
            return result;
        }
    };

    options.search = (query,db) => {
        //get the corresponding unit value of a given query
        function get_unit_query_value(queryField, unit) {
            try {
                switch (queryField) {
                    case 'unit_name_id':
                        return unit["guide_id"] + ": " + unit["name"].toLowerCase() + (unit.translated_name ? (" " + unit.translated_name.toLowerCase()) : "") + " (" + unit["id"] + ")";
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
                        for (sp in unit["skills"]) {
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
                        msg += safe_json_get(unit, ["extra skill", "name"]) + " " + safe_json_get(unit, ["extra skill", "desc"]) + " ";
                        msg += safe_json_get(unit, ["bb", "name"]) + " " + safe_json_get(unit, ["bb", "desc"]) + " ";
                        msg += safe_json_get(unit, ["sbb", "name"]) + " " + safe_json_get(unit, ["sbb", "desc"]) + " ";
                        msg += safe_json_get(unit, ["ubb", "name"]) + " " + safe_json_get(unit, ["ubb", "desc"]) + " ";
                        if (unit["skills"] !== undefined) {
                            for (sp in unit["skills"]) {
                                try {
                                    msg += unit["skills"][sp]["skill"]["desc"] + " ";
                                } catch (err) {
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
                                try {
                                    msg += JSON.stringify(unit["skills"][sp]["skill"]["effects"]) + "\n";
                                } catch (err) {
                                    continue;
                                }
                            }
                        }
                        // console.log(msg);
                        return msg;
                    default: return "";
                }
            } catch (err) {
                // console.log(err);
                return "";
            }
        }
        function contains_query(query,unit){
            var ignored_fields = ['strict', 'translate', 'verbose'];
            for (var q in query) {
                var curQuery = query[q].toString().toLowerCase();
                //wildcard queries
                if (curQuery.length === 0 || (q == 'element' && curQuery == 'any') ||
                    (q == 'gender' && curQuery == 'any') ||
                    (q == 'server' && curQuery == 'any') || ignored_fields.indexOf(q) > -1) {
                    continue;
                }

                try {
                    var unitValue = get_unit_query_value(q, unit).toString();
                    if (unitValue.indexOf(curQuery) == -1) {
                        // if(query.verbose == true || query.verbose == 'true') console.log("Failed on",unit.id,q,curQuery);
                        return false; //stop if any part of query is not in unit
                    }
                } catch (err) { //only occurs if requested field is empty in unit
                    return false;
                }
            }
            return true;
        }
        //get the list of units linked together by evolution given a single unit
        function get_evo_line(unit_id) {
            var evo = [];
            var curUnit = db[unit_id];
            //go to lowest rarity unit
            while (curUnit.prev !== undefined) {
                curUnit = db[curUnit.prev];
            }

            //traverse to highest rarity unit
            evo.push(curUnit.id);
            while (curUnit.next !== undefined) {
                evo.push(curUnit.next);
                curUnit = db[curUnit.next];
            }

            return evo;
        }
        //shorten results to a single unit IFF only one type of unit exists in the list
        //assumption: result_arr has at least one element in it
        function shorten_results(result_arr, verbose) {
            var last_evo = get_evo_line(result_arr[0]);
            var last_guide_id = db[last_evo[0].toString()].guide_id;
            if (verbose) console.log("last_evo", last_evo, "last_guide", last_guide_id);
            //check for uniqueness, return original array if not unique
            for (var u = 1; u < result_arr.length; ++u) {
                var cur_evo = get_evo_line(result_arr[u]);
                var cur_guide_id = db[cur_evo[0].toString()].guide_id;
                if (verbose) console.log("cur_evo", u, cur_evo, "cur_guide", cur_guide_id);
                if (cur_evo.length !== last_evo.length || cur_evo[0] !== last_evo[0] || cur_guide_id !== last_guide_id) {
                    if (verbose) console.log("found first mismatch");
                    return result_arr;
                }
            }

            //if this point is reached, then only one type of unit exists in the list
            //return last unit in list as it's the highest rarity one
            return [last_evo.pop()];
        }

        if(query.verbose === true || query.verbose == 'true'){
            console.log("Query:",query);
        }

        let results = [];
        for(let u in db){
            if(contains_query(query,db[u])){
                results.push(u);
            }
        }

        //if not using strict mode, try to shorten list
        var notStrict = (query.strict === false || query.strict == 'false');
        var noRarity = (query.rarity === undefined || query.rarity == "*" || query.rarity.length == 0);
        var notGuide = (query.unit_name_id === undefined || (!isNaN(query.unit_name_id) && parseInt(query.unit_name_id) >= 10011) || (isNaN(query.unit_name_id) && query.unit_name_id.indexOf(":") === -1));
        if (notStrict && noRarity && notGuide && results.length > 0) {
            if (query.verbose == true || query.verbose == 'true') {
                console.log("Results before shorten", results);
            }
            results = shorten_results(results, query.verbose === true || query.verbose == 'true');
        }
        if (query.verbose === true || query.verbose == 'true') {
            console.log("Search results", results);
        }
        return results;
    }


    options.translate = {
        needsTranslation: (unit) => { 
            function isJapaneseText(name) {
                return name.search(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) > -1;
            }
            return isJapaneseText(unit.name);
        },
        translate: (unit) => {
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

            return translate_to_english(unit.name,[], "translated_name")
                .then(function(translation_result){
                    unit.name = translation_result.translation;
                    return;
                })
        },
        max_translations: 5
    };

    function update_statistics(db){
        //return everything that's in db_new and not in db_old
        function get_db_diffs(db_old, db_new) {
            var diffs = [];
            for (var elem in db_new) {
                if (db_old.indexOf(db_new[elem]) == -1) {
                    diffs.push(db_new[elem]);
                }
            }
            return diffs;
        }
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
                        return JSON.parse(fs.readFileSync("./json/" + file, 'utf8'));
                    } catch (err) {//error, try alternative files
                        if (alternative_files !== undefined && alternative_files.length > 0) {
                            var new_file = alternative_files.pop();
                            return updater.load(new_file, alternative_files);
                        } else {//return an error if none of the files work
                            return JSON.parse(fs.readFileSync("./json/" + file, 'utf8'));
                        }
                    }
                },
                save: function (file, data) {
                    fs.writeFile("./json/" + file, data, function (err) {
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
            var unit_id = get_ids_from_server(server, db);
            // var item_id = get_ids_from_server(server, master_list.item);
            // var es_id = get_ids_from_server(server, master_list.es);
            console.log(server, "current unit count", unit_id.length);
            stats[server].total_entries = unit_id.length;

            //load previous data, if it exists
            var unit_data;
            try {
                unit_data = updater.load('stats-unit-' + server + ".json");

                //save differences, if any
                if (unit_data.last_loaded.length !== stats[server].total_entries || unit_data.last_loaded[0] !== unit_id[0]) {
                    if (unit_data.last_loaded.length !== stats[server].total_entries) console.log(server, "unit last length", unit_data.last_loaded.length, "/ unit current length", stats[server].total_entries);
                    else if (unit_data.last_loaded[0] !== unit_id[0]) console.log(server, "unit last loaded[0]", unit_data.last_loaded[0], "/ unit current loaded[0]", unit_id[0]);
                    unit_data.newest = get_db_diffs(unit_data.last_loaded, unit_id);
                    unit_data.last_loaded = unit_id;
                    updater.save('stats-unit-' + server + '.json', JSON.stringify(unit_data));
                }
            } catch (err) { //file doesn't exist
                console.log("Creating new unit stats file for", server);
                unit_data = {
                    newest: unit_id,
                    last_loaded: unit_id
                };
                updater.save('stats-unit-' + server + '.json', JSON.stringify(unit_data));
            }

            //keep track of newest on server
            stats[server] = unit_data.newest;
        }

        let stats = {
            last_update: new Date().toUTCString()
        };
        for(let s of servers){
            stats[s] = {};
            update_statistics_per_server(s);
        }

        console.log("Finished updating statistics");
    }
    options.update_statistics = update_statistics;


    return new bdfb_module(options);
};

module.exports = new UnitDB();