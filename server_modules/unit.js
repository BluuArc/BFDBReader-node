let bdfb_module = require('./bfdb_module.js');
let bfdb_common = require('./bfdb_common.js');
let _ = require('lodash');

let UnitDB = function(){
    let options = {};
    // options.files =  [];
    options.name = "Unit";

    let verbose = false;
    let servers = ['gl','eu','jp'];
    let files = ['info','evo_list', 'feskills'];
    let setupFn = function(db,loaded_files,server){
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
            let mainKeys = Object.keys(db_main).map((d) => { return +d; }).sort((a,b) => { return a-b; });
            for (var unit of keys) { //iterate through everything in object
                var id = get_server_id(unit, server);
                // if (db_main[unit] !== undefined) { //exists, so just add date add time
                if(_.sortedIndexOf(mainKeys,+id) > -1){
                    if (db_main[id].server.indexOf(server) == -1) {
                        db_main[id].server.push(server);
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

        console.log(`Loaded files for units in ${server}. Begin processing...`);

        //fix any ID overlap in gl objects
        if(server === 'gl'){
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
        bfdb_common.addFieldToDB(loaded_files.info, loaded_files.evo_list, function (unit1, unit2, db_main, db_sub) {
            if(verbose){
                if(!unit1 && !unit2){
                    console.log("Both units are missing");
                }else if(!unit1){
                    console.log("Unit 1 is missing");
                }else if(!unit2){
                    console.log("Unit 2 is missing");
                }
            }
            unit1.evo_mats = unit2.mats;
            unit1.next = get_server_id(unit2.evo.id, server);
            db_main[unit1.next].prev = get_server_id(unit1.id, server);
        });
        // console.log(loaded_files.evo_list['8750166']);
        delete loaded_files.evo_list;

        //merge feskills list
        bfdb_common.addFieldToDB(loaded_files.info, loaded_files.feskills, function (unit1, unit2) {
            if(verbose){
                if (!unit1 && !unit2) {
                    console.log("Both units are missing");
                } else if (!unit1) {
                    console.log("Unit 1 is missing");
                } else if (!unit2) {
                    console.log("Unit 2 is missing");
                }
            }
            unit1.skills = unit2.skills;
        });
        delete loaded_files.feskills;

        merge_databases(db, loaded_files.info, server);

        console.log(`Finished processing for units in ${server}.`);

        // console.log(Object.keys(db));
        // console.log("Sample of unit", JSON.stringify(db['8750166'],null,2));
    };

    //initialize files in options
    options.files = bfdb_common.generateSetupFiles(files, setupFn);

    options.getByID = bfdb_common.getByID;

    options.search = (query,db) => {
        //get the corresponding unit value of a given query
        function get_query_value(queryField, unit) {
            try {
                let result,msg;
                let acc = [];
                switch (queryField) {
                    case 'name_id':
                        return `${unit.guide_id}: ${unit.name.toLowerCase()}${(unit.translated_name ? (" " + unit.translated_name.toLowerCase()) : "")} (${unit.id})`;
                    case 'rarity': return unit.rarity.toString();
                    case 'element': return unit.element.toLowerCase();
                    case 'gender': return unit.gender.toLowerCase();
                    case 'move_speed': return unit.movement.skill["move speed type"].toLowerCase();
                    case 'ls_name': return `${unit["leader skill"].name} - ${unit["leader skill"].desc.toLowerCase()}`;
                    case 'ls_effect': return JSON.stringify(unit["leader skill"].effects);
                    case 'bb_name': return (unit.bb.name + " - " + unit.bb.desc).toLowerCase();
                    case 'bb_effect': return JSON.stringify(unit.bb.levels[9].effects);
                    case 'sbb_name': return (unit.sbb.name + " - " + unit.sbb.desc).toLowerCase();
                    case 'sbb_effect': return JSON.stringify(unit.sbb.levels[9].effects);
                    case 'ubb_name': return (unit.ubb.name + " - " + unit.ubb.desc).toLowerCase();
                    case 'ubb_effect': return JSON.stringify(unit.ubb.levels[0].effects);
                    case 'es_name': return (unit["extra skill"].name + " - " + unit["extra skill"].desc).toLowerCase();
                    case 'es_effect': return JSON.stringify(unit["extra skill"].effects);
                    case 'sp_name':
                        result = "";
                        if(unit.skills){
                            for (sp in unit.skills) {
                                result += unit.skills[sp].skill.desc.toLowerCase() + "\n";
                                // console.log(result);
                            }
                        }
                        return result;
                    case 'sp_effect':
                        result = "";
                        if(unit.skills){
                            for (sp in unit.skills) {
                                result += JSON.stringify(unit.skills[sp].skill.effects) + "\n";
                            }
                        }
                        return result;
                    case 'evo_mats': return JSON.stringify(unit.evo_mats);
                    case 'server': return unit.server;
                    case 'all_desc': msg = safe_json_get(unit, ["leader skill", "name"]) + " " + safe_json_get(unit, ["leader skill", "desc"]) + " ";
                        msg += safe_json_get(unit, ["extra skill", "name"]) + " " + safe_json_get(unit, ["extra skill", "desc"]) + " ";
                        msg += safe_json_get(unit, ["bb", "name"]) + " " + safe_json_get(unit, ["bb", "desc"]) + " ";
                        msg += safe_json_get(unit, ["sbb", "name"]) + " " + safe_json_get(unit, ["sbb", "desc"]) + " ";
                        msg += safe_json_get(unit, ["ubb", "name"]) + " " + safe_json_get(unit, ["ubb", "desc"]) + " ";
                        if (unit.skills !== undefined) {
                            for (sp in unit.skills) {
                                try {
                                    msg += unit.skills[sp].skill.desc + " ";
                                } catch (err) {
                                    continue;
                                }
                            }
                        }
                        // console.log(msg);
                        return msg;
                    case 'all_effect': msg = safe_json_get(unit, ["leader skill", "effects"]) + " ";
                        msg += safe_json_get(unit, ["extra skill", "effects"]) + " ";
                        msg += safe_json_get(unit, ["bb", "levels", 9, "effects"]) + " " + safe_json_get(unit, ["sbb", "levels", 9, "effects"]) + " " + safe_json_get(unit, ["ubb", "levels", 0, "effects"]);
                        if (unit.skills !== undefined) {
                            for (sp in unit.skills) {
                                try {
                                    msg += JSON.stringify(unit.skills[sp].skill.effects) + "\n";
                                } catch (err) {
                                    continue;
                                }
                            }
                        }
                        // console.log(msg);
                        return msg;
                    case 'proc_id' || 'unknown_proc_id': 
                        if(unit.es){
                            
                        }
                    default: return "";
                }
            } catch (err) {
                console.log(err);
                return "";
            }
        }
        function contains_query(query,unit){
            var ignored_fields = ['strict', 'translate', 'verbose'];
            for (var q in query) {
                var curQuery = query[q].toString().toLowerCase();
                //wildcard queries
                if (curQuery.length === 0 || (q === 'element' && curQuery === 'any') ||
                    (q === 'gender' && curQuery === 'any') ||
                    (q === 'server' && curQuery === 'any') || ignored_fields.indexOf(q) > -1) {
                    continue;
                }

                try {
                    var unitValue = get_query_value(q, unit).toString();
                    if (unitValue.indexOf(curQuery) === -1) {
                        if(query.verbose == true || query.verbose == 'true') console.log("Failed on",unit.id,q,curQuery);
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

            if(evo.length !== 1)
                return evo;
            else
                return [+unit_id]; //needed for cases where internal ID may be different from DB ID
        }
        //shorten results to a single unit IFF only one type of unit exists in the list
        //assumption: result_arr has at least one element in it
        function shorten_results(result_arr, verbose) {
            if(verbose){
                console.log("result_arr", result_arr);
            }
            let first_unit_evo = get_evo_line(result_arr.shift());
            if(verbose){
                console.log("first_unit_evo",first_unit_evo);
            }
            for(let u of result_arr){
                let cur_unit_evo = get_evo_line(u);
                let isEqualEvo = ((a,b) => {
                    let isEqual = a.length === b.length;
                    let index = 0;
                    while(isEqual && index < a.length){
                        isEqual = (a[index] === b[index]) && (db[a[index].toString()].guide_id === db[b[index].toString()].guide_id);
                        index++;
                    }
                    if(!isEqual && verbose){
                        console.log("mismatch",a,b);
                    }
                    return isEqual;
                })(first_unit_evo,cur_unit_evo);

                if(!isEqualEvo){
                    if (verbose) console.log("found first mismatch");
                    return result_arr;
                }
            }

            //if this point is reached, then only one type of unit exists in the list
            //return last unit in list as it's the highest rarity one
            return [first_unit_evo.pop()];
        }

        query = query || {};

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
        var notGuide = (query.name_id === undefined || (!isNaN(query.name_id) && parseInt(query.name_id) < 10011) || (isNaN(query.name_id) && query.name_id.indexOf(":") === -1));
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
    };

    options.translate = {
        needsTranslation: bfdb_common.needsTranslation,
        translate: bfdb_common.defaultTranslate,
        max_translations: 5
    };

    options.update_statistics = (db) => { return bfdb_common.updateStatistics(db,"unit"); };

    //custom list options due to ability to list by guide_id
    options.list = {
        getEntry: (target) => {
            let name = target.translated_name || target.name || target.desc;
            return {
                id: parseInt(target.id),
                guide_id: parseInt(target.guide_id),
                name: `${target.guide_id}: ${name} (${target.id})`,
            };
        },
        filter: (query,list) => {
            let compareFn;
            if(query.type === "guide_id"){
                list.sort(function (a, b) {
                    return a.guide_id - b.guide_id;
                });
                compareFn = (d,start,end) => {
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
                };
            }
            return bfdb_common.listFilter(query,list, compareFn);
        }
    };

    //custom function as units have multiple fields with different buffs
    options.analyzeTarget = function(unit,fields,analyze_options){
        let buff_fields = ['leader skill', 'extra skill', 'bb', 'sbb', 'ubb', 'skills'];
        for(let b of buff_fields){
            if(unit[b] !== undefined){
                let buffs = bfdb_common.analyzeObjectForValuesOf(unit[b], fields, analyze_options);
                if(b !== 'skills'){
                    unit[b].buffs = buffs;
                }else{
                    unit.skills_buffs = buffs;
                }
            }
        }
    }

    return new bdfb_module(options);
};

module.exports = new UnitDB();