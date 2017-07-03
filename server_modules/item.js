let bdfb_module = require('./bfdb_module.js');


let ItemDB = function(options){
    options = options || {};
    options.files = [];
    options.name = "Item";

    let servers = ['gl','eu','jp'];
    let files = ['items'];
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
        //add in anything in db_sub and not in db_main to db_main
        function merge_databases(db_main, db_sub, server) {
            let keys = Object.keys(db_sub);
            for (var item of keys) { //iterate through everything in object
                var id = item;
                if (db_main[item] !== undefined) { //exists, so just add date add time
                    if (db_main[item].server.indexOf(server) == -1) {
                        db_main[item].server.push(server);
                    }
                } else { //doesn't exist, so add it
                    db_main[id] = db_sub[item];
                    db_main[id].server = [server];
                }
                delete db_sub[item];
            }
        }
        //adds a section in in the sub database to the main database
        function add_field_to_db(db_main, db_sub, func) {
            for (var item in db_sub) {
                try {
                    func(db_main[item], db_sub[item], db_main, db_sub);
                } catch (err) {
                    continue;
                }
            }
        }
        console.log("Loaded files for items. Begin processing...");
        let db = {};

        //merge databases together
        for(let s of servers){
            merge_databases(db,loaded_files[`items_${s}`],s);
        }

        console.log("Finished processing for item DB.");

        // console.log(Object.keys(db));
        // console.log("Sample of unit", JSON.stringify(db['8750166'],null,2));
        return db;
    };


    return new bdfb_module(options);
};

module.exports = new ItemDB();