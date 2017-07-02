let bdfb_module = require('./bfdb_module.js');


let UnitDB = function(){
    let options = {
        files: [],
        name: "Unit"
    };

    let servers = ['gl','eu','jp'];
    let files = ['info','evo_list', 'feskills'];
    for(let s of servers){
        for(let f of files){
            options.files.push({
                name: `${f}_${s}`,
                main: `${f}-${s}.json`,
                alternatives: [`${f}-${s}-old.json`]
            });
        }
    }

    options.setupFn = (loaded_files) => {
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


        console.log("Loaded files for units. Result keys:",Object.keys(loaded_files));
        let db = {};

        //fix any ID overlap in gl objects
        for(let f of files){
            let curDB = loaded_files[`${f}_gl`];
            let keys = Object.keys(curDB);
            for(let id of keys){
                let newID = get_server_id(id,'gl');
                if(newID !== id){
                    curDB[newID] = curDB[id];
                    delete curDB[id];
                }
            }
        }

        //merge info, feskills, evo_list together
        for(let s of servers){
            //merge evo_list
            add_field_to_db(loaded_files[`info_${s}`], loaded_files[`evo_list_${s}`],function(unit1,unit2,db_main,db_sub){
                unit1.evo_mats = unit2.evo_mats;
                unit1.next = get_server_id(unit2.evo.id,s);
                db_main[unit1.next].prev = get_server_id(unit1.id,s);
            });
            delete loaded_files[`evo_list_${s}`];

            //merge feskills list
            add_field_to_db(loaded_files[`info_${s}`], loaded_files[`feskills_${s}`], function (unit1, unit2) {
                unit1.skills = unit2.skills;
            });
            delete loaded_files[`feskills_${s}`];
        }

        console.log("Merged smaller files for units. Result keys:", Object.keys(loaded_files));

        //merge databases together
        for(let s of servers){
            merge_databases(db,loaded_files[`info_${s}`],s);
        }

        console.log("Merged unit DB. Result keys", loaded_files);

        // console.log("Sample of unit", JSON.stringify(db['8750166'],null,2));
        return db;
    };


    return new bdfb_module(options);
};

module.exports = new UnitDB();